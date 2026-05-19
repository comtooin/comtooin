import React, { useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';
import HomePage from './pages/HomePage';
import SubmissionDetailPage from './pages/SubmissionDetailPage'; 
import AdminLoginPage from './pages/AdminLoginPage'; 
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminReportPage from './pages/AdminReportPage'; 
import AdminCustomerPage from './pages/AdminCustomerPage';
import AdminStaffPage from './pages/AdminStaffPage';
import AdminSchedulePage from './pages/AdminSchedulePage';
import ArchivePage from './pages/ArchivePage';
import EditRequestPage from './pages/EditRequestPage';
import NavBar from './components/NavBar';
import AdminRoute from './components/AdminRoute';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#607d8b',
    },
    secondary: {
      main: '#ffab91',
    },
    background: {
      default: '#f8f9fa',
    },
  },
  typography: {
    fontFamily: '"Noto Sans KR", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
      fontSize: '1.75rem',
      '@media (max-width:600px)': {
        fontSize: '1.5rem',
      },
    },
    h5: {
      fontWeight: 700,
      fontSize: '1.5rem',
      '@media (max-width:600px)': {
        fontSize: '1.25rem',
      },
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.15rem',
      '@media (max-width:600px)': {
        fontSize: '1.1rem',
      },
    },
    button: {
      fontWeight: 500,
      fontSize: '0.95rem',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f8f9fa',
          minHeight: '100vh',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 12px 0 rgba(0,0,0,0.05)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none', // 버튼 텍스트가 강제로 대문자가 되지 않도록 설정
          borderRadius: 8,
        },
      },
    },
  },
});

// 로그인 상태에 따라 루트 경로를 분기해주는 컴포넌트
const RootRoute = () => {
  const isAdminLoggedIn = !!localStorage.getItem('adminToken');
  const expiresAt = localStorage.getItem('adminSessionExpiresAt');
  
  // 세션 만료 체크 (만료 시 세션 정리)
  if (expiresAt && new Date().getTime() > parseInt(expiresAt)) {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminSessionExpiresAt');
    return <Navigate to="/admin/login" replace />;
  }

  return isAdminLoggedIn ? <HomePage /> : <Navigate to="/admin/login" replace />;
};

// 세션 만료를 감시하는 컴포넌트 (페이지 이동 및 타이머 기준)
const SessionManager = () => {
  const location = useLocation();
  
  const checkSession = useCallback(() => {
    const token = localStorage.getItem('adminToken');
    const expiresAt = localStorage.getItem('adminSessionExpiresAt');
    
    if (token && expiresAt) {
      if (new Date().getTime() > parseInt(expiresAt)) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminSessionExpiresAt');
        window.location.href = '/admin/login';
      }
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [location, checkSession]);

  useEffect(() => {
    const interval = setInterval(checkSession, 60000); // 1분마다 주기적 체크
    return () => clearInterval(interval);
  }, [checkSession]);

  return null;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <SessionManager />
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <NavBar />
          <Box component="main" sx={{ flexGrow: 1, py: { xs: 3, md: 5 } }}>
            <Routes>
              <Route path="/" element={<RootRoute />} />
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route
                path="/admin/dashboard"
                element={<AdminRoute><AdminDashboardPage /></AdminRoute>}
              />
              <Route
                path="/admin/reports"
                element={<AdminRoute><AdminReportPage /></AdminRoute>}
              />
              <Route
                path="/admin/archive"
                element={<AdminRoute><ArchivePage /></AdminRoute>}
              />
              <Route
                path="/admin/customers"
                element={<AdminRoute><AdminCustomerPage /></AdminRoute>}
              />
              <Route
                path="/admin/staff"
                element={<AdminRoute><AdminStaffPage /></AdminRoute>}
              />
              <Route
                path="/admin/schedule"
                element={<AdminRoute><AdminSchedulePage /></AdminRoute>}
              />
              <Route
                path="/admin/request/detail/:id"
                element={<AdminRoute><SubmissionDetailPage /></AdminRoute>}
              />
              <Route
                path="/admin/request/edit/:id"
                element={<AdminRoute><EditRequestPage /></AdminRoute>}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Box>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
