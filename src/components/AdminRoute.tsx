import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface AdminRouteProps {
  children: JSX.Element;
  requiredRole?: 'admin' | 'member';
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children, requiredRole }) => {
  const token = localStorage.getItem('adminToken');
  const expiresAt = localStorage.getItem('adminSessionExpiresAt');
  const userRole = localStorage.getItem('adminRole');
  const location = useLocation();

  // 토큰이 없거나 세션이 만료된 경우
  if (!token || (expiresAt && new Date().getTime() > parseInt(expiresAt))) {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminSessionExpiresAt');
    localStorage.removeItem('adminRole');
    localStorage.removeItem('adminCustomerId');
    localStorage.removeItem('adminName');
    return <Navigate to="/admin/login" />;
  }

  // 거래처 권한(customer) 접근 제한
  if (userRole === 'customer') {
    const isAllowed = 
      location.pathname === '/admin/dashboard' || 
      location.pathname === '/admin/profile' || 
      location.pathname === '/admin/help' || 
      /^\/admin\/customers\/[^/]+\/inventory$/.test(location.pathname);

    if (!isAllowed) {
      return <Navigate to="/admin/dashboard" replace />;
    }
  }

  // 특정 역할이 필요한 경우 체크 (예: 멤버관리 등 어드민 전용)
  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/" />;
  }

  // If token exists and not expired, render the protected component
  return children;
};

export default AdminRoute;
