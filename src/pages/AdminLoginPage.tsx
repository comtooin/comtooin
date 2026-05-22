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
      let loginEmail = id;

      // 만약 입력값이 이메일 형식이 아니라면 (아이디 로그인 시도)
      if (!id.includes('@')) {
        const { data: staffData, error: staffError } = await supabase
          .from('staff')
          .select('email')
          .eq('username', id)
          .single();

        if (staffError || !staffData) {
          throw new Error('존재하지 않는 아이디입니다.');
        }
        loginEmail = staffData.email;
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: password,
      });

      if (authError) {
        throw authError;
      }

      if (data?.session) {
        // 사용자 역할(role) 및 이름 조회
        const { data: profile, error: profileError } = await supabase
          .from('staff')
          .select('role, name')
          .eq('auth_user_id', data.session.user.id)
          .single();

        // 2시간 뒤 만료 시간 설정
        const expiresAt = new Date().getTime() + 2 * 60 * 60 * 1000;
        localStorage.setItem('adminToken', data.session.access_token);
        localStorage.setItem('adminSessionExpiresAt', expiresAt.toString());
        
        if (profile) {
          localStorage.setItem('adminRole', profile.role);
          localStorage.setItem('adminName', profile.name);
        } else {
          // 프로필이 없는 경우 기본값 'member' (또는 상황에 따라 처리)
          localStorage.setItem('adminRole', 'member');
          localStorage.setItem('adminName', data.session.user.user_metadata?.name || '관리자');
        }

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
        <title>로그인 | COMTOOIN</title>
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
          borderRadius: 1, 
          bgcolor: 'background.paper', 
          boxShadow: '0 8px 32px 0 rgba(0,0,0,0.05)' 
        }}
      >
        <Typography variant="h5" align="center" fontWeight="bold" sx={{ mb: 4 }}>
          시스템 로그인
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <TextField
              label="아이디 (이메일)"
              fullWidth
              required
              variant="outlined"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="user@example.com"
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
              <Alert severity="error" variant="outlined" sx={{ borderRadius: 1 }}>
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