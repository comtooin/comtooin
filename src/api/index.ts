import axios from 'axios';

// Axios 인스턴스를 위한 기본 URL
const axiosBaseURL = process.env.NODE_ENV === 'production'
    ? '/'
    : process.env.REACT_APP_API_URL;

/**
 * API 요청을 보내기 위한 Axios 인스턴스.
 */
const api = axios.create({
  baseURL: axiosBaseURL
});

export default api;

/**
 * 이미지 등 정적 파일의 URL을 생성하기 위한 접두사.
 * 프로덕션 환경에서는 상대 경로(/uploads/image.png)를 사용하기 위해 빈 문자열로 설정.
 * 개발 환경에서는 백엔드 서버의 전체 주소를 사용.
 */
export const assetBaseURL = process.env.NODE_ENV === 'production'
    ? ''
    : process.env.REACT_APP_API_URL;
