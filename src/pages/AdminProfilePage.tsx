import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Paper, TextField, Button, Stack, Alert, CircularProgress, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton
} from '@mui/material';
import { 
  AccountCircle as AccountCircleIcon, 
  Lock as LockIcon, 
  Close as CloseIcon, 
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon
} from '@mui/icons-material';
import OneSignal from 'react-onesignal';
import { supabase } from '../api';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

interface AdminProfileProps {
  isDialog?: boolean;
  onClose?: () => void;
}

const AdminProfilePage: React.FC<AdminProfileProps> = ({ isDialog = false, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState<{ type: 'success' | 'info' | 'error', text: string } | null>(null);
  const navigate = useNavigate();
  
  const [userInfo, setUserInfo] = useState({
    name: '',
    email: '',
    username: '',
    role: '',
    phone: ''
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

      const role = sessionStorage.getItem('adminRole');
      const customerId = sessionStorage.getItem('adminCustomerId');

      if (role === 'customer' && customerId) {
        const { data: customerProfile, error: customerError } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single();

        if (customerError) throw customerError;

        setUserInfo({
          name: customerProfile.name,
          email: customerProfile.manager_email || '',
          username: customerProfile.login_id || '',
          role: 'customer',
          phone: customerProfile.manager_phone || ''
        });
      } else {
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
          role: profile.role,
          phone: profile.phone || ''
        });
      }
    } catch (err: any) {
      setError(err.message || '사용자 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSave = async () => {
    setSubmitting(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인 정보가 없습니다.');

      const role = sessionStorage.getItem('adminRole');
      const customerId = sessionStorage.getItem('adminCustomerId');

      if (role === 'customer' && customerId) {
        const { error: updateError } = await supabase
          .from('customers')
          .update({ manager_phone: userInfo.phone.trim() })
          .eq('id', customerId);

        if (updateError) throw updateError;
      } else {
        const { error: updateError } = await supabase
          .from('staff')
          .update({ phone: userInfo.phone.trim() })
          .eq('auth_user_id', user.id);

        if (updateError) throw updateError;
      }
      
      alert('연락처가 정상적으로 저장되었습니다.');
      fetchUserInfo();
    } catch (err: any) {
      setError(err.message || '연락처 저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
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
      let msg = err.message || '비밀번호 변경 중 오류가 발생했습니다.';
      const rawMessage = String(err.message || '');
      
      if (rawMessage.includes('should be different') || rawMessage.includes('different from the old')) {
        msg = '이전과 동일한 비밀번호로는 변경할 수 없습니다.';
      } else if (rawMessage.includes('at least 6 characters')) {
        msg = '비밀번호는 최소 6자 이상이어야 합니다.';
      } else if (rawMessage.includes('Too many requests')) {
        msg = '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisablePush = async () => {
    setPushLoading(true);
    setPushMessage(null);
    try {
      if (OneSignal?.User?.PushSubscription) {
        await OneSignal.User.PushSubscription.optOut();
      }
      
      const role = sessionStorage.getItem('adminRole');
      if (role === 'customer') {
        const customerId = sessionStorage.getItem('adminCustomerId');
        if (customerId) {
          await supabase.from('customers').update({ onesignal_id: null }).eq('id', customerId);
        }
      } else {
        const staffId = sessionStorage.getItem('adminStaffId');
        if (staffId) {
          await supabase.from('staff').update({ onesignal_id: null }).eq('id', staffId);
        }
      }

      setPushMessage({ type: 'success', text: '이 기기의 푸시 알림이 성공적으로 초기화(해제)되었습니다.' });
    } catch (err: any) {
      console.error('Error disabling push:', err);
      setPushMessage({ type: 'error', text: '푸시 알림 초기화 중 오류가 발생했습니다: ' + (err.message || String(err)) });
    } finally {
      setPushLoading(false);
    }
  };

  const handleEnablePush = async () => {
    setPushLoading(true);
    setPushMessage(null);
    try {
      if (OneSignal?.User?.PushSubscription) {
        await OneSignal.User.PushSubscription.optIn();
        OneSignal.Slidedown.promptPush();
      }
      
      const pushId = OneSignal?.User?.PushSubscription?.id;
      const role = sessionStorage.getItem('adminRole');
      if (role === 'customer') {
        const customerId = sessionStorage.getItem('adminCustomerId');
        if (customerId && pushId) {
          await supabase.from('customers').update({ onesignal_id: pushId }).eq('id', customerId);
        }
      } else {
        const staffId = sessionStorage.getItem('adminStaffId');
        if (staffId && pushId) {
          await supabase.from('staff').update({ onesignal_id: pushId }).eq('id', staffId);
        }
      }

      setPushMessage({ type: 'success', text: '이 기기에서 푸시 알림이 정상적으로 활성화되었습니다.' });
    } catch (err: any) {
      console.error('Error enabling push:', err);
      setPushMessage({ type: 'error', text: '푸시 알림 활성화 중 오류가 발생했습니다: ' + (err.message || String(err)) });
    } finally {
      setPushLoading(false);
    }
  };

  const handleFinalLogout = () => {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminSessionExpiresAt');
    sessionStorage.removeItem('adminRole');
    sessionStorage.removeItem('adminName');
    setSuccessDialogOpen(false);
    if (onClose) onClose();
    navigate('/admin/login');
  };

  if (loading && !isDialog) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '30vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const profileContent = (
    <Stack spacing={2.5}>
      {error && <Alert severity="error" variant="outlined">{error}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5, bgcolor: 'background.paper' }}>
        <Typography variant="subtitle1" gutterBottom fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
          <PersonIcon color="action" sx={{ fontSize: '1.15rem' }} /> 기본 회원 정보
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
            value={userInfo.role === 'admin' ? '관리자' : userInfo.role === 'customer' ? '거래처' : '멤버'} 
            fullWidth 
            variant="outlined" 
            size="small" 
            InputProps={{ readOnly: true }} 
            sx={{ bgcolor: 'grey.50' }}
          />
          <TextField 
            label="연락처" 
            value={userInfo.phone} 
            onChange={(e) => setUserInfo({ ...userInfo, phone: e.target.value })}
            placeholder="예: 010-1234-5678"
            fullWidth 
            variant="outlined" 
            size="small" 
            InputProps={{
              endAdornment: (
                <Button 
                  size="small" 
                  variant="contained" 
                  onClick={handlePhoneSave} 
                  disabled={submitting} 
                  sx={{ ml: 1, whiteSpace: 'nowrap', minWidth: '60px', fontWeight: 'bold', height: '30px', fontSize: '0.75rem', borderRadius: 1 }}
                >
                  저장
                </Button>
              )
            }}
          />
        </Stack>
      </Paper>

      {/* 기기 푸시 알림 간편 초기화 및 설정 섹션 */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5, bgcolor: 'background.paper' }}>
        <Typography variant="subtitle1" gutterBottom fontWeight="bold" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
          <NotificationsIcon color="action" sx={{ fontSize: '1.15rem' }} /> 기기 푸시 알림 설정
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.85rem' }}>
          현재 사용 중인 스마트폰이나 PC의 실시간 알림 수신 상태를 간편하게 끄거나 초기화할 수 있습니다.
        </Typography>

        {pushMessage && (
          <Alert severity={pushMessage.type} sx={{ mb: 2, py: 0.5, fontSize: '0.85rem' }} onClose={() => setPushMessage(null)}>
            {pushMessage.text}
          </Alert>
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button
            variant="outlined"
            color="error"
            onClick={handleDisablePush}
            disabled={pushLoading}
            startIcon={<NotificationsOffIcon />}
            sx={{ fontWeight: 'bold', fontSize: '0.8rem', borderRadius: 1, py: 1 }}
          >
            {pushLoading ? <CircularProgress size={20} color="inherit" /> : '이 기기 푸시 알림 초기화 / 끄기'}
          </Button>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleEnablePush}
            disabled={pushLoading}
            startIcon={<NotificationsIcon />}
            sx={{ fontWeight: 'bold', fontSize: '0.8rem', borderRadius: 1, py: 1 }}
          >
            푸시 알림 다시 켜기 / 등록
          </Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5, bgcolor: 'background.paper' }}>
        <Typography variant="subtitle1" gutterBottom fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
          <LockIcon color="action" sx={{ fontSize: '1.15rem' }} /> 비밀번호 변경
        </Typography>

        {isAdminAccount ? (
          <Alert severity="info" variant="outlined">
            관리자(admin) 계정은 보안을 위해 본 화면에서 비밀번호를 변경할 수 없습니다.
          </Alert>
        ) : (
          <Box component="form" onSubmit={handlePasswordChange}>
            <Stack spacing={2}>
              <TextField
                label="새 비밀번호 (6자 이상)"
                type="password"
                fullWidth
                size="small"
                required
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                placeholder="영문, 숫자 포함 6자 이상"
              />
              <TextField
                label="새 비밀번호 확인"
                type="password"
                fullWidth
                size="small"
                required
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                placeholder="새 비밀번호 재입력"
              />
              <Button
                type="submit"
                variant="contained"
                disabled={submitting}
                sx={{ mt: 1, fontWeight: 'bold', height: '36px', fontSize: '0.75rem', borderRadius: 1 }}
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
        style={{ zIndex: 2100 }}
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '20px 16px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 40px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 32px)' },
            maxWidth: { xs: 'calc(100% - 32px)', sm: 'xs' }
          }
        }}
      >
        <DialogTitle fontWeight="bold">비밀번호 변경 완료</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            비밀번호가 성공적으로 변경되었습니다. 
            보안을 위해 다시 로그인해 주세요.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 1, '& button': { width: { xs: 'calc(50% - 4px)', sm: 'auto' }, m: '0 !important' } }}>
          <Button 
            variant="contained" 
            fullWidth 
            onClick={handleFinalLogout}
            sx={{ fontWeight: 'bold', height: '36px', fontSize: '0.75rem', borderRadius: 1 }}
          >
            확인 (로그아웃)
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );

  if (isDialog) {
    return (
      <Dialog 
        open={true} 
        onClose={onClose} 
        maxWidth="sm" 
        fullWidth 
        style={{ zIndex: 1400 }}
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '20px 16px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 40px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 32px)' },
            maxWidth: { xs: 'calc(100% - 32px)', sm: 'sm' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box display="flex" alignItems="center" gap={1}>
            <AccountCircleIcon color="action" sx={{ fontSize: '1.25rem' }} />
            <span>내 정보 및 보안 설정</span>
          </Box>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2.5, bgcolor: '#f8fafc' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '20vh' }}>
              <CircularProgress />
            </Box>
          ) : (
            profileContent
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Helmet><title>내 정보 | COMTOOIN</title></Helmet>
      <Box sx={{ mb: 2.5 }}>
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
      <Divider sx={{ mb: 2.5 }} />
      {profileContent}
    </Container>
  );
};

export default AdminProfilePage;
