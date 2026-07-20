import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized: " + (userError?.message || "User not found"));

    // 관리자 권한 확인
    const { data: callerProfile, error: profileError } = await supabase
      .from("staff")
      .select("role")
      .eq("auth_user_id", user.id)
      .single();

    if (profileError || callerProfile?.role !== "admin") {
      throw new Error("Only admins can perform this action. Your role: " + (callerProfile?.role || "unknown"));
    }

    const { action, userData } = await req.json();

    switch (action) {
      case "create": {
        const { email, password, name, username, role, phone } = userData;
        
        // 비밀번호 길이 체크 (Supabase 기본값은 6자)
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters long.");
        }

        // 1. Auth 사용자 생성
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name, role }
        });

        if (authError) throw new Error("Auth error: " + authError.message);

        // 2. staff 테이블 프로필 생성
        const { error: staffError } = await supabase
          .from("staff")
          .insert([{
            id: crypto.randomUUID(), // ID 자동생성 안될 경우 대비
            auth_user_id: authData.user.id,
            email,
            name,
            username,
            role: role || 'member',
            phone
          }]);

        if (staffError) {
          await supabase.auth.admin.deleteUser(authData.user.id);
          throw new Error("Database error: " + staffError.message);
        }

        return new Response(JSON.stringify({ success: true, user: authData.user }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case "update": {
        const { id, auth_user_id, email, name, username, role, phone } = userData;
        
        // 1. Auth 사용자 정보 업데이트 (auth_user_id가 있는 경우만)
        if (auth_user_id && email) {
          const { error: authError } = await supabase.auth.admin.updateUserById(auth_user_id, { email });
          if (authError) throw new Error("Auth update error: " + authError.message);
        }

        // 2. staff 테이블 업데이트 (staff id 기준)
        const { error: staffError } = await supabase
          .from("staff")
          .update({ name, email, username, role, phone })
          .eq("id", id);

        if (staffError) throw new Error("Database update error: " + staffError.message);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case "delete": {
        const { id, auth_user_id } = userData;
        
        // 1. Auth 사용자 삭제 (있는 경우만)
        if (auth_user_id) {
          const { error: authError } = await supabase.auth.admin.deleteUser(auth_user_id);
          if (authError) throw new Error("Auth delete error: " + authError.message);
        } else {
          // Auth ID가 없는 경우 staff 테이블에서 직접 삭제
          const { error: staffError } = await supabase
            .from("staff")
            .delete()
            .eq("id", id);
          if (staffError) throw new Error("Database delete error: " + staffError.message);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case "reset-password": {
        const { id, newPassword } = userData;
        if (newPassword.length < 6) {
          throw new Error("New password must be at least 6 characters long.");
        }
        
        const { error: authError } = await supabase.auth.admin.updateUserById(id, {
          password: newPassword
        });

        if (authError) throw new Error("Password reset error: " + authError.message);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case "create-customer": {
        const customerId = userData.customerId || userData.customer_id;
        const loginId = userData.loginId || userData.login_id;
        const loginEmail = userData.loginEmail || userData.login_email;
        const password = userData.password;
        const name = userData.name;
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters long.");
        }

        // 1. Auth 사용자 생성
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: loginEmail,
          password: password,
          email_confirm: true,
          user_metadata: { name, role: 'customer' }
        });

        if (authError) throw new Error("Auth error: " + authError.message);

        // 2. customers 테이블 정보 업데이트
        const { error: customerError } = await supabase
          .from("customers")
          .update({
            auth_user_id: authData.user.id,
            login_id: loginId,
            login_email: loginEmail
          })
          .eq("id", customerId);

        if (customerError) {
          // 롤백: Auth 사용자 삭제
          await supabase.auth.admin.deleteUser(authData.user.id);
          throw new Error("Database error: " + customerError.message);
        }

        return new Response(JSON.stringify({ success: true, user: authData.user }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case "delete-customer": {
        const customerId = userData.customerId || userData.customer_id;
        const authUserId = userData.authUserId || userData.auth_user_id;

        // 1. Auth 사용자 삭제
        if (authUserId) {
          const { error: authError } = await supabase.auth.admin.deleteUser(authUserId);
          if (authError) throw new Error("Auth delete error: " + authError.message);
        }

        // 2. customers 테이블 인증 컬럼 초기화
        const { error: customerError } = await supabase
          .from("customers")
          .update({
            auth_user_id: null,
            login_id: null,
            login_email: null
          })
          .eq("id", customerId);

        if (customerError) throw new Error("Database update error: " + customerError.message);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case "reset-customer-password": {
        const authUserId = userData.authUserId || userData.auth_user_id;
        const newPassword = userData.newPassword || userData.new_password;
        if (newPassword.length < 6) {
          throw new Error("New password must be at least 6 characters long.");
        }

        const { error: authError } = await supabase.auth.admin.updateUserById(authUserId, {
          password: newPassword
        });

        if (authError) throw new Error("Password reset error: " + authError.message);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      default:
        throw new Error("Invalid action: " + action);
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
