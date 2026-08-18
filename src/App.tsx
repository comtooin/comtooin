import React, { useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';
import SubmissionDetailPage from './pages/SubmissionDetailPage'; 
import AdminLoginPage from './pages/AdminLoginPage'; 

import AdminReportPage from './pages/AdminReportPage'; 
import AdminCustomerPage from './pages/AdminCustomerPage';
import AdminQuotePage from './pages/AdminQuotePage';
import AdminCustomerInventoryPage from './pages/AdminCustomerInventoryPage';
import AdminStaffPage from './pages/AdminStaffPage';
import AdminSchedulePage from './pages/AdminSchedulePage';
import AdminProfilePage from './pages/AdminProfilePage';
import ArchivePage from './pages/ArchivePage';
import EditRequestPage from './pages/EditRequestPage';
import AdminHelpPage from './pages/AdminHelpPage';
import AdminMessengerPage from './pages/AdminMessengerPage';
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
      primary: '#222222', // 대비 피로도를 없애고 번짐(Halation)을 억제하는 짙은 차콜블랙 (네이버 뉴스 규격)
      secondary: '#475569', // Muted Slate 600
    },
  },
  typography: {
    fontFamily: '"Pretendard Variable", "Pretendard", -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif',
    allVariants: {
      letterSpacing: '-0.01em',
    },
    body1: {
      lineHeight: 1.65,
      letterSpacing: '-0.005em',
    },
    body2: {
      lineHeight: 1.6,
      letterSpacing: '-0.005em',
    },
    subtitle1: {
      fontWeight: 500, // 볼드 뭉개짐 방지를 위한 세미볼드
      lineHeight: 1.5,
      letterSpacing: '-0.01em',
    },
    subtitle2: {
      fontWeight: 500,
      lineHeight: 1.5,
      letterSpacing: '-0.01em',
    },
    button: {
      fontWeight: 500,
      fontSize: '0.95rem',
      letterSpacing: '-0.005em',
    },
    h4: {
      fontWeight: 600, // 과도한 볼드를 경량화하여 획 뭉치기 방지
      fontSize: '1.75rem',
      letterSpacing: '-0.015em',
      '@media (max-width:600px)': {
        fontSize: '1.5rem',
      },
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.5rem',
      letterSpacing: '-0.015em',
      '@media (max-width:600px)': {
        fontSize: '1.25rem',
      },
    },
    h6: {
      fontWeight: 500, // SemiBold
      fontSize: '1.15rem',
      letterSpacing: '-0.01em',
      '@media (max-width:600px)': {
        fontSize: '1.05rem',
      },
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
          color: '#222222', // 차콜 그레이로 통일
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
  const isAdminLoggedIn = !!sessionStorage.getItem('adminToken');
  const expiresAt = sessionStorage.getItem('adminSessionExpiresAt');
  
  // 세션 만료 체크 (만료 시 세션 정리)
  if (expiresAt && new Date().getTime() > parseInt(expiresAt)) {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminSessionExpiresAt');
    sessionStorage.removeItem('adminRole');
    sessionStorage.removeItem('adminCustomerId');
    sessionStorage.removeItem('adminName');
    return <Navigate to="/admin/login" replace />;
  }

  if (isAdminLoggedIn) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Navigate to="/admin/login" replace />;
};

// 세션 만료를 감시하는 컴포넌트 (페이지 이동 및 타이머 기준)
const SessionManager = () => {
  const location = useLocation();
  
  const checkSession = useCallback(() => {
    const token = sessionStorage.getItem('adminToken');
    const expiresAt = sessionStorage.getItem('adminSessionExpiresAt');
    
    if (token && expiresAt) {
      if (new Date().getTime() > parseInt(expiresAt)) {
        sessionStorage.removeItem('adminToken');
        sessionStorage.removeItem('adminSessionExpiresAt');
        window.location.href = '/admin/login';
      }
    }
  }, []);

  // 사용자가 활동 중일 때 세션 만료 시점을 30분 뒤로 연장(슬라이딩 윈도우)
  const extendSession = useCallback(() => {
    const token = sessionStorage.getItem('adminToken');
    const expiresAt = sessionStorage.getItem('adminSessionExpiresAt');
    
    if (token && expiresAt) {
      const now = new Date().getTime();
      const currentExpiresAt = parseInt(expiresAt);
      
      if (now <= currentExpiresAt) {
        // 성능 최적화: 만료 시간이 25분 이하로 남았을 때만 연장하도록 Throttling 처리
        if (currentExpiresAt - now < 25 * 60 * 1000) {
          const newExpiresAt = now + 30 * 60 * 1000;
          sessionStorage.setItem('adminSessionExpiresAt', newExpiresAt.toString());
        }
      }
    }
  }, []);

  // 사용자 활동 감지 이벤트 수신기 설정
  useEffect(() => {
    const handleActivity = () => {
      extendSession();
    };

    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [extendSession]);

  useEffect(() => {
    checkSession();
  }, [location, checkSession]);

  useEffect(() => {
    const interval = setInterval(checkSession, 60000); // 1분마다 주기적 체크
    return () => clearInterval(interval);
  }, [checkSession]);

  return null;
};

let isOneSignalInitialized = false;

const OneSignalManager = () => {
  const location = useLocation();

  const updatePlayerId = async () => {
    if (!isOneSignalInitialized) return;
    try {
      const pushId = OneSignal.User.PushSubscription.id;
      if (!pushId) return;

      // 중복 방지 선제 소거 처리 (Deduplication)
      // 본인 기기 ID(pushId)와 동일한 값을 갖고 있는 다른 모든 staff 및 customers의 컬럼을 null로 깨끗이 밀어냄
      await supabase
        .from('staff')
        .update({ onesignal_id: null })
        .eq('onesignal_id', pushId);

      await supabase
        .from('customers')
        .update({ onesignal_id: null })
        .eq('onesignal_id', pushId);

      const role = sessionStorage.getItem('adminRole');
      if (role === 'customer') {
        const customerId = sessionStorage.getItem('adminCustomerId');
        if (customerId) {
          await supabase
            .from('customers')
            .update({ onesignal_id: pushId })
            .eq('id', customerId);
          console.log('Successfully updated OneSignal push ID for customer:', customerId);
        }
      } else {
        const staffId = await getCurrentStaffId();
        if (staffId) {
          await supabase
            .from('staff')
            .update({ onesignal_id: pushId })
            .eq('id', staffId);
          console.log('Successfully updated OneSignal push ID for staff:', staffId);
        }
      }
    } catch (err) {
      console.error('Error updating OneSignal player ID:', err);
    }
  };

  // 로그인 상태 및 경로 이동 시 OneSignal ID와 계정 매핑 갱신 감시
  useEffect(() => {
    updatePlayerId();
  }, [location]);

  useEffect(() => {
    if (isOneSignalInitialized) return;

    const initOneSignal = async () => {
      const appId = process.env.REACT_APP_ONESIGNAL_APP_ID;
      console.log('OneSignal App ID:', appId);
      
      if (!appId) {
        console.warn('OneSignal App ID is undefined. Make sure to restart the dev server or check Vercel environment variables.');
        return;
      }

      try {
        console.log('Initializing OneSignal...');
        isOneSignalInitialized = true;
        await OneSignal.init({
          appId: appId,
          allowLocalhostAsSecureOrigin: true,
        });

        console.log('OneSignal initialized. Prompting for push...');
        OneSignal.Slidedown.promptPush();

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
        isOneSignalInitialized = false;
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
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
          <NavBar />
          <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, sm: 3, md: 4 }, overflow: 'hidden' }}>
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
                path="/admin/quote"
                element={<AdminRoute><AdminQuotePage /></AdminRoute>}
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
                path="/admin/help"
                element={<AdminRoute><AdminHelpPage /></AdminRoute>}
              />
              <Route
                path="/admin/schedule"
                element={<AdminRoute><AdminSchedulePage /></AdminRoute>}
              />
              <Route
                path="/admin/messenger"
                element={<AdminRoute><AdminMessengerPage /></AdminRoute>}
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
