import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Typography, TextField, Button, Box, Paper, CircularProgress, Alert, Stack } from '@mui/material';
import { supabase } from '../api';
import { Helmet } from 'react-helmet-async';

// 삭제됨: const API_URL = ...

const AdminLoginPage: React.FC = () => {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: id, // Assuming 'id' is used as email for Supabase Auth
        password: password,
      });

      if (authError) {
        throw authError;
      }

      if (data?.session) {
        // Store the access token (JWT) from Supabase session
        localStorage.setItem('adminToken', data.session.access_token);
        // Navigate to work record page (HomePage)
        navigate('/');
      } else {
        throw new Error('로그인 정보가 올바르지 않습니다.');
      }
    } catch (err: any) {
      console.error('Supabase Auth error:', err);
      setError(err.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Helmet>
        <title>관리자 로그인 | COMTOOIN</title>
      </Helmet>
      
      {/* 브랜드 헤더 섹션 */}
      <Box sx={{ mb: 5, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" fontWeight="800" color="primary.main" gutterBottom sx={{ letterSpacing: 1 }}>
          COMTOOIN
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'medium' }}>
          유지보수 업무 관리 시스템
        </Typography>
      </Box>

      <Paper 
        variant="outlined" 
        sx={{ 
          p: { xs: 3, md: 5 }, 
          borderRadius: 3, 
          bgcolor: 'background.paper', 
          boxShadow: '0 8px 32px 0 rgba(0,0,0,0.05)' 
        }}
      >
        <Typography variant="h5" align="center" fontWeight="bold" sx={{ mb: 4 }}>
          관리자 로그인
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <TextField
              label="관리자 아이디 (이메일)"
              fullWidth
              required
              variant="outlined"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="admin@example.com"
            />
            <TextField
              label="비밀번호"
              type="password"
              fullWidth
              required
              variant="outlined"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="****"
            />
            
            {error && (
              <Alert severity="error" variant="outlined" sx={{ borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <Button 
              type="submit" 
              variant="contained" 
              fullWidth 
              size="large" 
              sx={{ 
                py: 1.5, 
                fontSize: '1.1rem', 
                fontWeight: 'bold',
                boxShadow: '0 4px 12px 0 rgba(96, 125, 139, 0.3)'
              }} 
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : '로그인'}
            </Button>
          </Stack>
        </Box>
      </Paper>

      <Typography variant="body2" color="text.disabled" align="center" sx={{ mt: 4 }}>
        &copy; {new Date().getFullYear()} COMTOOIN. All rights reserved.
      </Typography>
    </Container>
  );
};

export default AdminLoginPage;