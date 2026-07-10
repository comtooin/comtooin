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

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

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
  const cachedId = localStorage.getItem('adminStaffId');
  if (cachedId) return cachedId;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;

  const { data: profile } = await supabase
    .from('staff')
    .select('id')
    .eq('auth_user_id', session.user.id)
    .single();

  if (profile) {
    localStorage.setItem('adminStaffId', profile.id);
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
export const sendPushNotification = async (title: string, message: string, targetStaffIds?: string[] | 'all') => {
  try {
    let query = supabase.from('staff').select('onesignal_id, role').not('onesignal_id', 'is', null).neq('role', 'admin');
    
    if (Array.isArray(targetStaffIds) && targetStaffIds.length > 0) {
      query = query.in('id', targetStaffIds);
    }
    
    const { data } = await query;
    if (!data || data.length === 0) return;

    const validPlayerIds = data.map(s => s.onesignal_id).filter(Boolean);
    if (validPlayerIds.length === 0) return;

    await fetch('/api/sendPush', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message, include_player_ids: validPlayerIds })
    });
  } catch (error) {
    console.error('Error sending push notification', error);
  }
};

