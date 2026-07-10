import React, { useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';
import HomePage from './pages/HomePage';
import SubmissionDetailPage from './pages/SubmissionDetailPage'; 
import AdminLoginPage from './pages/AdminLoginPage'; 

import AdminReportPage from './pages/AdminReportPage'; 
import AdminCustomerPage from './pages/AdminCustomerPage';
import AdminCustomerInventoryPage from './pages/AdminCustomerInventoryPage';
import AdminStaffPage from './pages/AdminStaffPage';
import AdminSchedulePage from './pages/AdminSchedulePage';
import AdminProfilePage from './pages/AdminProfilePage';
import ArchivePage from './pages/ArchivePage';
import EditRequestPage from './pages/EditRequestPage';
import NavBar from './components/NavBar';
import AdminRoute from './components/AdminRoute';
import OneSignal from 'react-onesignal';
import { supabase, getCurrentStaffId } from './api';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#334155', // Muted Slate 700
      light: '#475569',
      dark: '#0f172a',
    },
    secondary: {
      main: '#64748b', // Muted Slate 500
      light: '#94a3b8',
      dark: '#334155',
    },
    background: {
      default: '#f8fafc', // Very soft cool gray
      paper: '#ffffff',
    },
    text: {
      primary: '#1e293b', // Slate 800
      secondary: '#64748b', // Slate 500
    },
  },
  typography: {
    fontFamily: '"Pretendard Variable", "Pretendard", -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif',
    h4: {
      fontWeight: 700,
      fontSize: '1.75rem',
      letterSpacing: '-0.02em',
      '@media (max-width:600px)': {
        fontSize: '1.5rem',
      },
    },
    h5: {
      fontWeight: 700,
      fontSize: '1.5rem',
      letterSpacing: '-0.02em',
      '@media (max-width:600px)': {
        fontSize: '1.25rem',
      },
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.15rem',
      letterSpacing: '-0.01em',
      '@media (max-width:600px)': {
        fontSize: '1.1rem',
      },
    },
    subtitle1: {
      fontWeight: 600,
    },
    subtitle2: {
      fontWeight: 600,
    },
    body1: {
      letterSpacing: '-0.01em',
    },
    body2: {
      letterSpacing: '-0.01em',
    },
    button: {
      fontWeight: 600,
      fontSize: '0.95rem',
      letterSpacing: '-0.01em',
    },
  },
  shape: {
    borderRadius: 12, // More rounded corners
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f8fafc',
          minHeight: '100vh',
          letterSpacing: '-0.01em',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)', // Tailwind shadow-sm
        },
        outlined: {
          borderColor: '#e2e8f0', // Slate 200
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)', // Subtle shadow even on outlined
        }
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none', 
          borderRadius: 8,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          },
        },
        contained: {
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          },
        }
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #f1f5f9', // Slate 100
          padding: '12px 16px',
        },
        head: {
          fontWeight: 600,
          color: '#64748b', // Slate 500
          backgroundColor: '#f8fafc', // Very subtle header background
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-child td, &:last-child th': {
            borderBottom: 0,
          },
        },
        hover: {
          '&:hover': {
            backgroundColor: '#f1f5f9 !important', // Slate 100 hover
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', // Tailwind shadow-xl
        }
      }
    }
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

const OneSignalManager = () => {
  useEffect(() => {
    const initOneSignal = async () => {
      const appId = process.env.REACT_APP_ONESIGNAL_APP_ID;
      if (!appId) return;

      try {
        await OneSignal.init({
          appId: appId,
          allowLocalhostAsSecureOrigin: true,
        });

        OneSignal.Slidedown.promptPush();

        const updatePlayerId = async () => {
          const staffId = await getCurrentStaffId();
          if (staffId && OneSignal.User.PushSubscription.id) {
            await supabase.from('staff').update({ onesignal_id: OneSignal.User.PushSubscription.id }).eq('id', staffId);
          }
        };

        if (OneSignal.User.PushSubscription.id) {
          updatePlayerId();
        }

        OneSignal.User.PushSubscription.addEventListener("change", (e: any) => {
          if (e.current?.id) {
            updatePlayerId();
          }
        });
      } catch (err) {
        console.error('OneSignal Init Error:', err);
      }
    };
    initOneSignal();
  }, []);

  return null;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <SessionManager />
        <OneSignalManager />
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <NavBar />
          <Box component="main" sx={{ flexGrow: 1, py: { xs: 3, md: 5 } }}>
            <Routes>
              <Route path="/" element={<RootRoute />} />
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route
                path="/admin/dashboard"
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
                path="/admin/customers/:id/inventory"
                element={<AdminRoute><AdminCustomerInventoryPage /></AdminRoute>}
              />
              <Route
                path="/admin/staff"
                element={<AdminRoute requiredRole="admin"><AdminStaffPage /></AdminRoute>}
              />
              <Route
                path="/admin/profile"
                element={<AdminRoute><AdminProfilePage /></AdminRoute>}
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
