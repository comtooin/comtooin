import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Paper, TextField, Button, Stack, Alert, CircularProgress, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { AccountCircle as AccountCircleIcon, Lock as LockIcon } from '@mui/icons-material';
import { supabase } from '../api';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

const AdminProfilePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const navigate = useNavigate();
  
  const [userInfo, setUserInfo] = useState({
    name: '',
    email: '',
    username: '',
    role: ''
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  // 'admin' 계정인지 확인하는 로직 (이메일 또는 아이디가 'admin'인 경우)
  const isAdminAccount = userInfo.email === 'admin' || userInfo.username === 'admin' || userInfo.email.startsWith('admin@');

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인 정보가 없습니다.');

      const { data: profile, error: profileError } = await supabase
        .from('staff')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      if (profileError) throw profileError;

      setUserInfo({
        name: profile.name,
        email: profile.email,
        username: profile.username,
        role: profile.role
      });
    } catch (err: any) {
      setError(err.message || '사용자 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isAdminAccount) {
      setError('관리자(admin) 계정의 비밀번호는 시스템 설정에서만 변경 가능합니다.');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (updateError) throw updateError;

      setSuccessDialogOpen(true);
      setPasswordData({
        newPassword: '',
        confirmPassword: ''
      });
    } catch (err: any) {
      setError(err.message || '비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminSessionExpiresAt');
    localStorage.removeItem('adminRole');
    localStorage.removeItem('adminName');
    setSuccessDialogOpen(false);
    navigate('/admin/login');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="sm">
      <Helmet><title>내 정보 | COMTOOIN</title></Helmet>
      
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <AccountCircleIcon sx={{ fontSize: '2.2rem', color: 'primary.main' }} />
          <Typography variant="h5" component="h1" fontWeight="bold">
            내 정보
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          로그인된 계정의 정보를 확인하고 비밀번호를 관리합니다.
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 1, mb: 3, bgcolor: 'background.paper' }}>
        <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ mb: 3 }}>
          기본 정보
        </Typography>
        <Stack spacing={2}>
          <TextField 
            label="이름" 
            value={userInfo.name} 
            fullWidth 
            variant="outlined" 
            size="small" 
            InputProps={{ readOnly: true }} 
            sx={{ bgcolor: 'grey.50' }}
          />
          <TextField 
            label="이메일" 
            value={userInfo.email} 
            fullWidth 
            variant="outlined" 
            size="small" 
            InputProps={{ readOnly: true }} 
            sx={{ bgcolor: 'grey.50' }}
          />
          <TextField 
            label="아이디" 
            value={userInfo.username} 
            fullWidth 
            variant="outlined" 
            size="small" 
            InputProps={{ readOnly: true }} 
            sx={{ bgcolor: 'grey.50' }}
          />
          <TextField 
            label="권한" 
            value={userInfo.role === 'admin' ? '관리자' : '멤버'} 
            fullWidth 
            variant="outlined" 
            size="small" 
            InputProps={{ readOnly: true }} 
            sx={{ bgcolor: 'grey.50' }}
          />
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 1, bgcolor: 'background.paper' }}>
        <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LockIcon fontSize="small" /> 비밀번호 변경
        </Typography>

        {isAdminAccount ? (
          <Alert severity="info" variant="outlined">
            관리자(admin) 계정은 보안을 위해 본 화면에서 비밀번호를 변경할 수 없습니다.
          </Alert>
        ) : (
          <Box component="form" onSubmit={handlePasswordChange}>
            <Stack spacing={2.5}>
              {error && <Alert severity="error" variant="outlined">{error}</Alert>}
              
              <TextField
                label="새 비밀번호"
                type="password"
                fullWidth
                size="small"
                required
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                placeholder="최소 6자 이상"
              />
              <TextField
                label="새 비밀번호 확인"
                type="password"
                fullWidth
                size="small"
                required
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                placeholder="비밀번호 재입력"
              />
              <Button
                type="submit"
                variant="contained"
                disabled={submitting}
                sx={{ mt: 1, py: 1.5, fontWeight: 'bold', fontSize: '1rem' }}
              >
                {submitting ? <CircularProgress size={24} color="inherit" /> : '비밀번호 변경하기'}
              </Button>
            </Stack>
          </Box>
        )}
      </Paper>

      {/* 비밀번호 변경 성공 다이얼로그 */}
      <Dialog 
        open={successDialogOpen} 
        onClose={(e, reason) => {
          if (reason !== 'backdropClick') handleFinalLogout();
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle fontWeight="bold">비밀번호 변경 완료</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            비밀번호가 성공적으로 변경되었습니다. 
            보안을 위해 다시 로그인해 주세요.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button 
            variant="contained" 
            fullWidth 
            onClick={handleFinalLogout}
            sx={{ fontWeight: 'bold' }}
          >
            확인 (로그아웃)
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminProfilePage;
