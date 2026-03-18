import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Container, useMediaQuery, useTheme } from '@mui/material';
import HomePage from './pages/HomePage';
import SubmissionDetailPage from './pages/SubmissionDetailPage'; 
import AdminLoginPage from './pages/AdminLoginPage'; 
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminReportPage from './pages/AdminReportPage'; 
import AdminCustomerPage from './pages/AdminCustomerPage'; // Added Customer Management Page

import AdminGuideEditorPage from './pages/AdminGuideEditorPage';

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
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: ({ theme }) => ({
          boxShadow: theme.shadows[1],
        }),
      },
    },
  },
});

// 로그인 상태에 따라 루트 경로를 분기해주는 컴포넌트
const RootRoute = () => {
  const isAdminLoggedIn = !!localStorage.getItem('adminToken');
  return isAdminLoggedIn ? <HomePage /> : <Navigate to="/admin/login" replace />;
};

function App() {
  const currentTheme = useTheme(); 
  const isMobile = useMediaQuery(currentTheme.breakpoints.down('sm'));

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <NavBar />
        <Container
          component="main"
          maxWidth="lg"
          sx={{
            mt: 4,
            px: isMobile ? 2 : 3,
          }}
        >
          <Routes>
            {/* Root path: RootRoute 컴포넌트 내부에서 매번 토큰을 확인하도록 함 */}
            <Route path="/" element={<RootRoute />} />
            
            <Route path="/admin/login" element={<AdminLoginPage />} />

            {/* 인증된 관리자 전용 경로 */}
            <Route
              path="/admin/dashboard"
              element={<AdminRoute><AdminDashboardPage /></AdminRoute>}
            />
            <Route
              path="/admin/reports"
              element={<AdminRoute><AdminReportPage /></AdminRoute>}
            />
            <Route
              path="/admin/customers"
              element={<AdminRoute><AdminCustomerPage /></AdminRoute>}
            />
            <Route
              path="/admin/guide/new"
              element={<AdminRoute><AdminGuideEditorPage /></AdminRoute>}
            />
            <Route
              path="/admin/guide/edit/:id"
              element={<AdminRoute><AdminGuideEditorPage /></AdminRoute>}
            />
            <Route
              path="/admin/request/detail/:id"
              element={<AdminRoute><SubmissionDetailPage /></AdminRoute>}
            />
            <Route
              path="/admin/request/edit/:id"
              element={<AdminRoute><EditRequestPage /></AdminRoute>}
            />

            {/* 정의되지 않은 모든 경로는 루트로 리다이렉트 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Container>
      </Router>
    </ThemeProvider>
  );
}

export default App;
