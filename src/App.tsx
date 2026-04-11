import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Container, useMediaQuery, useTheme } from '@mui/material';
import HomePage from './pages/HomePage';
import SubmissionDetailPage from './pages/SubmissionDetailPage'; 
import AdminLoginPage from './pages/AdminLoginPage'; 
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminReportPage from './pages/AdminReportPage'; 
import AdminCustomerPage from './pages/AdminCustomerPage';
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
    MuiPaper: {
      styleOverrides: {
        root: ({ theme }) => ({
          boxShadow: theme.shadows[1],
        }),
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none', // 버튼 텍스트가 강제로 대문자가 되지 않도록 설정
        },
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
        </Container>
      </Router>
    </ThemeProvider>
  );
}

export default App;
