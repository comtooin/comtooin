import React from 'react';
import { Navigate } from 'react-router-dom';

interface AdminRouteProps {
  children: JSX.Element;
  requiredRole?: 'admin' | 'member';
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children, requiredRole }) => {
  const token = localStorage.getItem('adminToken');
  const expiresAt = localStorage.getItem('adminSessionExpiresAt');
  const userRole = localStorage.getItem('adminRole');

  // 토큰이 없거나 세션이 만료된 경우
  if (!token || (expiresAt && new Date().getTime() > parseInt(expiresAt))) {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminSessionExpiresAt');
    localStorage.removeItem('adminRole');
    return <Navigate to="/admin/login" />;
  }

  // 특정 역할이 필요한 경우 체크
  if (requiredRole && userRole !== requiredRole) {
    // 관리자 전용 페이지에 멤버가 접근하려 할 때 홈으로 리다이렉트
    return <Navigate to="/" />;
  }

  // If token exists and not expired, render the protected component
  return children;
};

export default AdminRoute;
