import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Container } from '@mui/material';
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

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Router>
        <NavBar />
        <Container component="main" maxWidth="lg" sx={{ mt: 4 }}>
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