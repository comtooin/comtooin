import React from 'react';
import { Navigate } from 'react-router-dom';

interface AdminRouteProps {
  children: JSX.Element;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const token = localStorage.getItem('adminToken');

  if (!token) {
    // If no token, redirect to the login page
    return <Navigate to="/admin/login" />;
  }

  // If token exists, render the protected component
  return children;
};

export default AdminRoute;
