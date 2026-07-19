import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    const expiresAt = localStorage.getItem('adminSessionExpiresAt');
    
    if (token && expiresAt && new Date().getTime() <= parseInt(expiresAt)) {
      navigate('/');
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let loginEmail = id;

      // 만약 입력값이 이메일 형식이 아니라면 (아이디 로그인 시도)
      if (!id.includes('@')) {
        const { data: staffData } = await supabase
          .from('staff')
          .select('email')
          .eq('username', id)
          .single();

        if (staffData) {
          loginEmail = staffData.email;
        } else {
          // 2차 조회: 거래처(customers) 테이블에서 login_id로 이메일 조회
          const { data: customerData } = await supabase
            .from('customers')
            .select('login_email')
            .eq('login_id', id)
            .single();

          if (customerData?.login_email) {
            loginEmail = customerData.login_email;
          } else {
            throw new Error('존재하지 않는 아이디입니다.');
          }
        }
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: password,
      });

      if (authError) {
        throw authError;
      }

      if (data?.session) {
        // 1. staff 테이블의 고유 ID 및 역할 조회
        const { data: staffProfile } = await supabase
          .from('staff')
          .select('id, role, name')
          .eq('auth_user_id', data.session.user.id)
          .single();

        // 2시간 뒤 만료 시간 설정
        const expiresAt = new Date().getTime() + 2 * 60 * 60 * 1000;
        localStorage.setItem('adminToken', data.session.access_token);
        localStorage.setItem('adminSessionExpiresAt', expiresAt.toString());
        
        if (staffProfile) {
          localStorage.setItem('adminStaffId', staffProfile.id);
          localStorage.setItem('adminRole', staffProfile.role);
          localStorage.setItem('adminName', staffProfile.name);
          localStorage.removeItem('adminCustomerId'); // 이전에 저장되었을 수 있는 거래처 ID 명시적 제거
        } else {
          // 2. staff가 아니라면 customers 테이블에서 거래처 계정 조회
          const { data: customerProfile } = await supabase
            .from('customers')
            .select('id, name')
            .eq('auth_user_id', data.session.user.id)
            .single();

          if (customerProfile) {
            localStorage.setItem('adminRole', 'customer');
            localStorage.setItem('adminName', customerProfile.name);
            localStorage.setItem('adminCustomerId', customerProfile.id);
            localStorage.removeItem('adminStaffId'); // 어드민 스태프 ID 제거
          } else {
            // 둘 다 정보가 없는 경우 기본 임시 회원 권한
            localStorage.setItem('adminRole', 'member');
            localStorage.setItem('adminName', data.session.user.user_metadata?.name || '관리자');
            localStorage.removeItem('adminCustomerId');
          }
        }

        // Navigate to dashboard if customer, else home page
        const userRole = localStorage.getItem('adminRole');
        if (userRole === 'customer') {
          navigate('/admin/dashboard');
        } else {
          navigate('/');
        }
      } else {
        throw new Error('로그인 정보가 올바르지 않습니다.');
      }
    } catch (err: any) {
      console.error('Supabase Auth error:', err);
      
      let errorMessage = '로그인 중 오류가 발생했습니다.';
      const rawMessage = err.message || '';

      if (rawMessage.includes('Invalid login credentials')) {
        errorMessage = '아이디 또는 비밀번호가 일치하지 않습니다.';
      } else if (rawMessage.includes('Email not confirmed')) {
        errorMessage = '이메일 인증이 완료되지 않은 계정입니다.';
      } else if (rawMessage.includes('User not found')) {
        errorMessage = '존재하지 않는 사용자 계정입니다.';
      } else if (rawMessage.includes('Too many requests')) {
        errorMessage = '너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해 주세요.';
      } else if (err.status === 400 || rawMessage.includes('bad request')) {
        errorMessage = '로그인 정보가 올바르지 않습니다.';
      } else {
        errorMessage = rawMessage || errorMessage;
      }

      setError(errorMessage);
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
          p: { xs: 2, md: 3 }, 
          borderRadius: 1, 
          bgcolor: 'background.paper', 
          boxShadow: '0 8px 32px 0 rgba(0,0,0,0.05)' 
        }}
      >
        <Typography variant="h5" align="center" fontWeight="bold" sx={{ mb: 2.5 }}>
          시스템 로그인
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
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

      <Typography variant="body2" color="text.disabled" align="center" sx={{ mt: 2.5 }}>
        &copy; {new Date().getFullYear()} COMTOOIN. All rights reserved.
      </Typography>
    </Container>
  );
};

export default AdminLoginPage;