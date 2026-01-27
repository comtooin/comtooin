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

// 기존 axios 인스턴스 대신 Supabase 클라이언트를 내보냅니다.
export default supabase;

/**
 * 이미지 등 정적 파일의 URL을 생성하기 위한 접두사.
 * Supabase Storage의 공개 URL을 기반으로 합니다.
 */
export const assetBaseURL = supabaseUrl;
