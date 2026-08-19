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

    console.log('sendPushNotification (Client) - Forwarding targets to Server API:', {
      targetStaffIds,
      targetCustomerId
    });

    // 프론트엔드는 RLS 정책 제약이 있으므로, 모든 쿼리 처리를 service_role 권한을 가진 백엔드 API로 위임
    const res = await fetch('/api/sendPush', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        title, 
        message, 
        targetStaffIds, 
        targetCustomerId,
        url 
      })
    });

    const resData = await res.json().catch(() => ({}));
    console.log('sendPushNotification (Client) - Backend Server Response:', { 
      status: res.status, 
      success: resData.success,
      targetIdsCount: resData.targetIdsCount,
      oneSignalErrors: resData.data?.errors,
      oneSignalRecipients: resData.data?.recipients,
      rawOneSignalData: resData.data 
    });

    if (!res.ok) {
      console.error('Push API Error Response status:', res.status, resData);
    }
  } catch (error) {
    console.error('Error sending push notification', error);
  }
};

