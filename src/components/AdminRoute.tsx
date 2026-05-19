import React from 'react';
import { Navigate } from 'react-router-dom';

interface AdminRouteProps {
  children: JSX.Element;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const token = localStorage.getItem('adminToken');
  const expiresAt = localStorage.getItem('adminSessionExpiresAt');

  // 토큰이 없거나 세션이 만료된 경우
  if (!token || (expiresAt && new Date().getTime() > parseInt(expiresAt))) {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminSessionExpiresAt');
    return <Navigate to="/admin/login" />;
  }

  // If token exists and not expired, render the protected component
  return children;
};

export default AdminRoute;
