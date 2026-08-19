import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is not defined in environment variables.');
  // 개발 모드에서는 오류를 발생시켜 빠른 감지를 돕고, 프로덕션에서는 오류 메시지를 남기고 진행합니다.
  if (process.env.NODE_ENV === 'development') {
    throw new Error('Supabase environment variables are missing.');
  }
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    storage: window.sessionStorage
  }
});

// default export 제거 (named export로만 내보냄)

/**
 * 이미지 등 정적 파일의 URL을 생성하기 위한 접두사.
 * Supabase Storage의 공개 URL을 기반으로 합니다.
 * 실제 Storage URL은 'supabaseUrl/storage/v1/object/public' 형태입니다.
 */
export const assetBaseURL = `${supabaseUrl}/storage/v1/object/public`;

/**
 * 현재 로그인한 사용자의 staff 테이블 고유 ID를 가져옵니다.
 * localStorage에 저장된 값이 있으면 사용하고, 없으면 DB에서 조회하여 캐시합니다.
 */
export const getCurrentStaffId = async () => {
  const cachedId = sessionStorage.getItem('adminStaffId');
  if (cachedId) return cachedId;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;

  const { data: profile } = await supabase
    .from('staff')
    .select('id')
    .eq('auth_user_id', session.user.id)
    .single();

  if (profile) {
    sessionStorage.setItem('adminStaffId', profile.id);
    return profile.id;
  }
  return null;
};

/**
 * 푸시 알림을 전송하는 헬퍼 함수
 * @param title 알림 제목
 * @param message 알림 내용
 * @param targetStaffIds 특정 직원에게만 보낼 경우 ID 배열. 없거나 'all'이면 전체 발송. (관리자는 항상 제외됨)
 */
export const sendPushNotification = async (
  title: string, 
  message: string, 
  targetOrOptions?: string[] | 'all' | 'member_only' | {
    targetStaffIds?: string[] | 'all' | 'member_only';
    targetCustomerId?: string;
  }, 
  url?: string
) => {
  try {
    let targetStaffIds: string[] | 'all' | 'member_only' | undefined = undefined;
    let targetCustomerId: string | undefined = undefined;

    if (targetOrOptions) {
      if (typeof targetOrOptions === 'string' || Array.isArray(targetOrOptions)) {
        targetStaffIds = targetOrOptions;
      } else {
        targetStaffIds = targetOrOptions.targetStaffIds;
        targetCustomerId = targetOrOptions.targetCustomerId;
      }
    }

    const validPlayerIds: string[] = [];

    // 1. 내부직원 수신 대상 추출 (targetStaffIds 필터링 적용)
    let hasStaffTarget = true;

    // 옵션 객체에 targetCustomerId만 있고 targetStaffIds가 명시적으로 제공되지 않은 경우, 스태프 알림 제외
    if (
      targetOrOptions &&
      typeof targetOrOptions === 'object' &&
      !Array.isArray(targetOrOptions) &&
      !('targetStaffIds' in targetOrOptions) &&
      ('targetCustomerId' in targetOrOptions)
    ) {
      hasStaffTarget = false;
    }

    // targetStaffIds가 명시적으로 빈 배열([])인 경우, 스태프 알림 제외
    if (Array.isArray(targetStaffIds) && targetStaffIds.length === 0) {
      hasStaffTarget = false;
    }

    if (hasStaffTarget) {
      let rpcRole: string | null = null;
      let rpcIds: string[] | null = null;

      if (targetStaffIds === 'member_only') {
        rpcRole = 'member_only';
      } else if (Array.isArray(targetStaffIds) && targetStaffIds.length > 0) {
        rpcIds = targetStaffIds;
      }

      let staffQuery;
      if (rpcRole || rpcIds) {
        if (rpcRole) {
          staffQuery = supabase.rpc('get_staff_onesignal_ids', { target_role: rpcRole });
        } else if (rpcIds) {
          // 특정 스태프 ID 배열이 주어진 경우, 이들을 쿼리하는 행위는 이미 스태프 세션이 존재하므로 RLS 통과 가능
          staffQuery = supabase.from('staff').select('onesignal_id').in('id', rpcIds).not('onesignal_id', 'is', null);
        } else {
          staffQuery = supabase.rpc('get_staff_onesignal_ids');
        }
      } else {
        // targetStaffIds가 없거나 'all'인 경우 (스태프 전체 조회)
        staffQuery = supabase.rpc('get_staff_onesignal_ids');
      }

      const { data: staffData, error: rpcError } = await staffQuery;
      if (!rpcError && staffData) {
        validPlayerIds.push(...staffData.map((s: any) => s.onesignal_id).filter(Boolean));
      }
    }

    // 2. 거래처는 본인 해당 업무만 알림 수신 (targetCustomerId가 매치될 때만 타겟팅 발송)
    if (targetCustomerId) {
      const { data: custData } = await supabase
        .from('customers')
        .select('onesignal_id')
        .eq('id', targetCustomerId)
        .not('onesignal_id', 'is', null);
      
      if (custData) {
        validPlayerIds.push(...custData.map(c => c.onesignal_id).filter(Boolean));
      }
    }

    console.log('sendPushNotification - Target Staff IDs config:', targetStaffIds);
    console.log('sendPushNotification - Target Customer ID config:', targetCustomerId);
    console.log('sendPushNotification - Gathered raw Player IDs:', validPlayerIds);

    if (validPlayerIds.length === 0) {
      console.warn('sendPushNotification - Discarded. No target subscription IDs found in database.');
      return;
    }
    const uniquePlayerIds = Array.from(new Set(validPlayerIds));
    console.log('sendPushNotification - Sending request for unique Player IDs:', uniquePlayerIds);

    const res = await fetch('/api/sendPush', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message, include_player_ids: uniquePlayerIds, url })
    });

    const resData = await res.json().catch(() => ({}));
    console.log('sendPushNotification - OneSignal Send API Response:', { status: res.status, data: resData });

    if (!res.ok) {
      console.error('Push API Error Response status:', res.status, resData);
    }
  } catch (error) {
    console.error('Error sending push notification', error);
  }
};

