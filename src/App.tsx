import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Container, useMediaQuery, useTheme } from '@mui/material'; // Added useMediaQuery, useTheme
import HomePage from './pages/HomePage';
import SubmissionDetailPage from './pages/SubmissionDetailPage'; // Import new page
import CheckRequestPage from './pages/CheckRequestPage';
import AdminLoginPage from './pages/AdminLoginPage'; // Import new page
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminReportPage from './pages/AdminReportPage'; // Import new page

import SelfCheckGuidePage from './pages/SelfCheckGuidePage'; // Import new page
import AdminGuideEditorPage from './pages/AdminGuideEditorPage';
import EditRequestPage from './pages/EditRequestPage';
import NavBar from './components/NavBar';
import AdminRoute from './components/AdminRoute';
import AdminGuideListPage from './pages/AdminGuideListPage';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#607d8b', // Material Blue Grey 500
    },
    secondary: {
      main: '#ffab91', // Material Deep Orange 200
    },
  },
  shape: { // Added shape property for global border radius
    borderRadius: 12, // Consistent border radius for components
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: ({ theme }) => ({ // Applied global subtle shadow to Paper components
          boxShadow: theme.shadows[1], // Use MUI's default elevation 1 shadow
        }),
      },
    },
  },
});

function App() {
  const currentTheme = useTheme(); // Use useTheme to access the theme
  const isMobile = useMediaQuery(currentTheme.breakpoints.down('sm')); // Check if screen is mobile

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
            px: isMobile ? 2 : 3, // Responsive horizontal padding: 2 for mobile, 3 for desktop
          }}
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/submission-detail/:id" element={<SubmissionDetailPage />} />
            <Route path="/check-request" element={<CheckRequestPage />} />
            <Route path="/self-check-guide" element={<SelfCheckGuidePage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />

            {/* Authenticated Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={<AdminRoute><AdminDashboardPage /></AdminRoute>}
            />
            <Route
              path="/admin/reports"
              element={<AdminRoute><AdminReportPage /></AdminRoute>}
            />
            <Route
              path="/admin/guides"
              element={<AdminRoute><AdminGuideListPage /></AdminRoute>}
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
            path="/edit-request/:id"
            element={<EditRequestPage />}
          />

        </Routes>
        </Container>
      </Router>
    </ThemeProvider>
  );
}

export default App;