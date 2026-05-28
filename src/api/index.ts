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
