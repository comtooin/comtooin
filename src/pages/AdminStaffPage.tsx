import React, { useState, useEffect } from 'react';
import {
  Typography, Box, Paper, TextField, Button, List, ListItem,
  IconButton, Divider, CircularProgress, Alert, Stack, Container, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Select, FormControl, InputLabel,
  Tooltip
} from '@mui/material';
import { 
  Delete as DeleteIcon, 
  Add as AddIcon, 
  People as PeopleIcon,
  PersonAdd as PersonAddIcon,
  Badge as BadgeIcon,
  AssignmentInd as AssignmentIndIcon,
  Edit as EditIcon,
  LockReset as LockResetIcon
} from '@mui/icons-material';
import { supabase } from '../api';
import { Helmet } from 'react-helmet-async';

interface Staff {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  username: string;
  role: 'admin' | 'member';
  phone?: string;
  created_at?: string;
}

const AdminStaffPage: React.FC = () => {
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 신규 등록 폼 상태
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'member'>('member');
  const [newPhone, setNewPhone] = useState('');

  // 새 멤버 등록 팝업 모달 상태
  const [registerOpen, setRegisterOpen] = useState(false);

  // 수정 다이얼로그 상태
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  // 비밀번호 초기화 다이얼로그 상태
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resettingStaff, setResettingStaff] = useState<Staff | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  useEffect(() => {
    fetchStaffs();
  }, []);

  const fetchStaffs = async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('staff')
        .select('*')
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;
      setStaffs(data || []);
    } catch (err: any) {
      setError(err.message || '멤버 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newUsername.trim() || !newPassword.trim()) return;

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const { error: funcError } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create',
          userData: {
            name: newName.trim(),
            email: newEmail.trim(),
            username: newUsername.trim(),
            password: newPassword.trim(),
            role: newRole,
            phone: newPhone.trim()
          }
        }
      });

      if (funcError) {
        let errorMessage = funcError.message;
        try {
          const body = await funcError.context?.json();
          if (body && body.error) errorMessage = body.error;
        } catch (e) {}
        throw new Error(errorMessage);
      }

      if (newPhone.trim()) {
        await supabase.from('staff').update({ phone: newPhone.trim() }).eq('email', newEmail.trim());
      }

      setNewName('');
      setNewEmail('');
      setNewUsername('');
      setNewPassword('');
      setNewRole('member');
      setNewPhone('');
      alert('새로운 멤버가 등록되었습니다.');
      setRegisterOpen(false);
      fetchStaffs();
    } catch (err: any) {
      setError(err.message || '멤버 추가 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStaff = async () => {
    if (!editingStaff) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const { error: funcError } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'update',
          userData: {
            id: editingStaff.id,
            auth_user_id: editingStaff.auth_user_id,
            email: editingStaff.email.trim(),
            name: editingStaff.name.trim(),
            username: editingStaff.username.trim(),
            role: editingStaff.role,
            phone: editingStaff.phone?.trim()
          }
        }
      });

      if (funcError) {
        let errorMessage = funcError.message;
        try {
          const body = await funcError.context?.json();
          if (body && body.error) errorMessage = body.error;
        } catch (e) {}
        throw new Error(errorMessage);
      }

      if (editingStaff.phone !== undefined) {
        await supabase.from('staff').update({ phone: editingStaff.phone.trim() }).eq('id', editingStaff.id);
      }

      alert('멤버 정보가 수정되었습니다.');
      setEditDialogOpen(false);
      fetchStaffs();
    } catch (err: any) {
      setError(err.message || '멤버 수정 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resettingStaff || !resetPassword.trim()) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const { error: funcError } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'reset-password',
          userData: {
            id: resettingStaff.auth_user_id,
            newPassword: resetPassword.trim()
          }
        }
      });

      if (funcError) {
        let errorMessage = funcError.message;
        try {
          const body = await funcError.context?.json();
          if (body && body.error) errorMessage = body.error;
        } catch (e) {}
        throw new Error(errorMessage);
      }

      const tempPassword = resetPassword;
      alert(`'${resettingStaff?.name}' 멤버의 비밀번호가 [ ${tempPassword} ] (으)로 초기화되었습니다.`);
      setResetDialogOpen(false);
      setResetPassword('');
    } catch (err: any) {
      setError(err.message || '비밀번호 초기화 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStaff = async (staff: Staff) => {
    if (!window.confirm(`'${staff.name}' 멤버를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며 해당 사용자의 로그인 계정도 함께 삭제됩니다.`)) return;

    setError('');
    setSuccess('');
    try {
      const { error: funcError } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'delete',
          userData: { 
            id: staff.id,
            auth_user_id: staff.auth_user_id
          }
        }
      });

      if (funcError) {
        let errorMessage = funcError.message;
        try {
          const body = await funcError.context?.json();
          if (body && body.error) errorMessage = body.error;
        } catch (e) {}
        throw new Error(errorMessage);
      }

      alert('멤버가 삭제되었습니다.');
      fetchStaffs();
    } catch (err: any) {
      setError(err.message || '멤버 삭제 중 오류가 발생했습니다.');
    }
  };

  // 통계 계산
  const stats = {
    total: staffs.length,
    recent: staffs.filter(s => {
      if (!s.created_at) return false;
      const created = new Date(s.created_at);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return created > thirtyDaysAgo;
    }).length,
    admin: staffs.filter(s => s.role === 'admin').length
  };

  return (
    <Container maxWidth="lg">
      <Helmet><title>멤버 | COMTOOIN</title></Helmet>
      
      {/* 표준 헤더 섹션 */}
      <Box sx={{ mb: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <PeopleIcon sx={{ fontSize: '2.2rem', color: 'primary.main' }} />
          <Typography variant="h5" component="h1" fontWeight="bold">
            멤버
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          시스템을 이용하는 멤버 목록을 관리하고 권한을 제어합니다.
        </Typography>
      </Box>

      <Divider sx={{ mb: 2.5 }} />

      {/* 상단 요약 위젯 섹션 */}
      <Paper variant="outlined" sx={{ mb: 2.5, borderRadius: 2, display: 'flex', overflow: 'hidden', bgcolor: 'background.paper' }}>
        {[
          { label: '총 멤버', shortLabel: '총멤버', count: stats.total, icon: <PeopleIcon fontSize="small" sx={{ color: '#607d8b' }} /> },
          { label: '신규 멤버', shortLabel: '신규', count: stats.recent, icon: <PersonAddIcon fontSize="small" sx={{ color: '#2e7d32' }} /> },
          { label: '관리자', shortLabel: '관리자', count: stats.admin, icon: <AssignmentIndIcon fontSize="small" sx={{ color: '#0288d1' }} /> },
        ].map((item, idx, arr) => (
          <Box 
            key={idx}
            sx={{ 
              flex: 1, 
              p: { xs: 1.5, sm: 2 }, 
              borderRight: idx < arr.length - 1 ? '1px solid' : 'none',
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" spacing={{ xs: 0.5, sm: 1 }} alignItems="center" justifyContent="center" sx={{ whiteSpace: 'nowrap' }}>
              {item.icon}
              <Typography variant="body2" fontWeight="bold" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                {item.label}
              </Typography>
              <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' }, fontSize: '0.7rem' }}>
                {item.shortLabel}
              </Typography>
              <Typography variant="body1" fontWeight="900" color="text.primary" sx={{ ml: { xs: 0.5, sm: 1 } }}>
                {item.count}
              </Typography>
            </Stack>
          </Box>
        ))}
      </Paper>

      <Grid container spacing={2}>
        {/* 멤버 목록 */}
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 1, bgcolor: 'background.paper', minHeight: '500px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BadgeIcon fontSize="small" /> 등록된 멤버 목록
              </Typography>
              <Button 
                variant="contained" 
                color="primary" 
                startIcon={<AddIcon />} 
                onClick={() => setRegisterOpen(true)}
                sx={{ fontWeight: 'bold', height: '36px', fontSize: '0.75rem', borderRadius: 1 }}
              >
                새 멤버 등록
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              시스템을 이용하는 일반 멤버 및 어드민 관리자 계정 정보를 관리합니다.
            </Typography>
            
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

            {loading ? (
              <Box sx={{ textAlign: 'center', py: 10 }}><CircularProgress /></Box>
            ) : (
              <List sx={{ bgcolor: 'transparent', p: 0, maxHeight: 800, overflowY: 'auto' }}>
                {staffs.length === 0 ? (
                  <Typography color="text.secondary" align="center" sx={{ py: 10 }}>
                    등록된 멤버가 없습니다.
                  </Typography>
                ) : (
                  staffs.map((staff) => (
                    <React.Fragment key={staff.id}>
                      <ListItem
                        sx={{ 
                          mb: 1.5,
                          bgcolor: '#ffffff',
                          borderRadius: 2,
                          border: '1px solid #e2e8f0',
                          transition: 'all 0.2s ease-in-out', 
                          position: 'relative',
                          '&:hover': { 
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                            borderColor: 'primary.light',
                            transform: 'translateY(-2px)'
                          },
                          display: 'flex',
                          flexDirection: { xs: 'column', sm: 'row' },
                          alignItems: { xs: 'stretch', sm: 'center' },
                          justifyContent: 'space-between',
                          gap: 2,
                          py: { xs: 1.5, sm: 2 }, 
                          px: { xs: 1.5, sm: 2.5 }
                        }}
                      >
                        {/* 왼쪽: 멤버 정보 */}
                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5, pr: { xs: 4, sm: 0 } }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography fontWeight="bold" color="text.primary">{staff.name}</Typography>
                            <Typography variant="caption" sx={{ bgcolor: staff.role === 'admin' ? 'primary.light' : 'grey.300', color: 'white', px: 0.8, py: 0.1, borderRadius: 1 }}>
                              {staff.role === 'admin' ? '관리자' : '멤버'}
                            </Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                            <strong>아이디:</strong> {staff.username} &nbsp;|&nbsp; <strong>이메일:</strong> {staff.email}
                          </Typography>
                          {staff.phone && (
                            <Typography variant="caption" color="text.secondary">
                              <strong>연락처:</strong> {staff.phone}
                            </Typography>
                          )}
                        </Box>
                        
                        {/* 오른쪽: 버튼 스택 */}
                        <Stack 
                          direction={{ xs: 'column', sm: 'row' }} 
                          spacing={1} 
                          alignItems={{ xs: 'stretch', sm: 'center' }} 
                          sx={{ 
                            justifyContent: 'flex-end', 
                            width: { xs: '100%', sm: 'auto' } 
                          }}
                        >
                          <Button 
                            variant="outlined" 
                            size="small" 
                            startIcon={<EditIcon fontSize="small" />}
                            onClick={() => {
                              setEditingStaff({...staff});
                              setEditDialogOpen(true);
                            }}
                            sx={{ fontWeight: 'bold', fontSize: '0.75rem', px: 1.5, py: 0.5 }}
                          >
                            정보관리
                          </Button>
                          <Button 
                            variant="outlined" 
                            size="small"
                            color="success"
                            startIcon={<LockResetIcon fontSize="small" />}
                            onClick={() => {
                              setResettingStaff(staff);
                              setResetDialogOpen(true);
                            }}
                            disabled={!staff.auth_user_id}
                            sx={{ fontWeight: 'bold', fontSize: '0.75rem', px: 1.5, py: 0.5 }}
                          >
                            계정관리
                          </Button>
                          <Tooltip title="멤버 삭제">
                            <IconButton 
                              size="small" 
                              aria-label="delete" 
                              onClick={() => handleDeleteStaff(staff)} 
                              sx={{ 
                                position: { xs: 'absolute', sm: 'static' },
                                top: { xs: 8, sm: 'auto' },
                                right: { xs: 8, sm: 'auto' },
                                '&:hover': { color: 'error.main' }, 
                                ml: { sm: 0.5 } 
                              }}
                            >
                              <DeleteIcon color="action" fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </ListItem>
                    </React.Fragment>
                  ))
                )}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* 수정 다이얼로그 */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)} 
        fullWidth 
        maxWidth="sm"
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '20px 16px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 40px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 32px)', sm: '600px' },
            maxWidth: { xs: 'calc(100% - 32px)', sm: '600px' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <PeopleIcon color="action" sx={{ fontSize: '1.25rem' }} /> 멤버 정보 수정
        </DialogTitle>
        <DialogContent dividers>
          <Box component="form" onSubmit={(e) => { e.preventDefault(); handleUpdateStaff(); }} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="이름"
                  fullWidth
                  size="small"
                  value={editingStaff?.name || ''}
                  onChange={(e) => setEditingStaff(prev => prev ? {...prev, name: e.target.value} : null)}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="사용자 아이디"
                  fullWidth
                  size="small"
                  value={editingStaff?.username || ''}
                  onChange={(e) => setEditingStaff(prev => prev ? {...prev, username: e.target.value} : null)}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="이메일 주소"
                  fullWidth
                  size="small"
                  value={editingStaff?.email || ''}
                  onChange={(e) => setEditingStaff(prev => prev ? {...prev, email: e.target.value} : null)}
                  type="email"
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="연락처"
                  fullWidth
                  size="small"
                  value={editingStaff?.phone || ''}
                  onChange={(e) => setEditingStaff(prev => prev ? {...prev, phone: e.target.value} : null)}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>권한</InputLabel>
                  <Select
                    value={editingStaff?.role || 'member'}
                    label="권한"
                    onChange={(e) => setEditingStaff(prev => prev ? {...prev, role: e.target.value as 'admin' | 'member'} : null)}
                  >
                    <MenuItem value="member">일반 멤버</MenuItem>
                    <MenuItem value="admin">관리자</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 1, '& > button': { width: { xs: 'calc(50% - 4px)', sm: 'auto' }, m: '0 !important' } }}>
          <Button variant="contained" color="primary" onClick={handleUpdateStaff} disabled={submitting || !editingStaff?.name.trim() || !editingStaff?.username.trim() || !editingStaff?.email.trim()} sx={{ fontWeight: 'bold', height: '36px', fontSize: '0.75rem', borderRadius: 1 }}>저장</Button>
          <Button onClick={() => setEditDialogOpen(false)} variant="outlined" color="inherit" sx={{ height: '36px', fontSize: '0.75rem', borderRadius: 1 }}>닫기</Button>
        </DialogActions>
      </Dialog>

      {/* 비밀번호 초기화 다이얼로그 */}
      <Dialog 
        open={resetDialogOpen} 
        onClose={() => setResetDialogOpen(false)} 
        fullWidth 
        maxWidth="xs"
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '20px 16px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 40px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 32px)', sm: '500px' },
            maxWidth: { xs: 'calc(100% - 32px)', sm: '500px' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <LockResetIcon color="action" sx={{ fontSize: '1.25rem' }} /> 비밀번호 초기화
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, mt: 1 }}>
            <strong>{resettingStaff?.name}</strong> 멤버의 새로운 비밀번호를 입력하세요.
          </Typography>
          <TextField
            label="새 비밀번호"
            fullWidth
            type="password"
            size="small"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            placeholder="최소 6자 이상"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 1, '& > button': { width: { xs: 'calc(50% - 4px)', sm: 'auto' }, m: '0 !important' } }}>
          <Button variant="contained" color="warning" onClick={handleResetPassword} disabled={submitting || !resetPassword.trim()} sx={{ fontWeight: 'bold', height: '36px', fontSize: '0.75rem', borderRadius: 1 }}>비밀번호 변경</Button>
          <Button onClick={() => setResetDialogOpen(false)} variant="outlined" color="inherit" sx={{ height: '36px', fontSize: '0.75rem', borderRadius: 1 }}>닫기</Button>
        </DialogActions>
      </Dialog>

      {/* 새 멤버 등록 팝업 Dialog */}
      <Dialog 
        open={registerOpen} 
        onClose={() => setRegisterOpen(false)} 
        maxWidth="sm" 
        fullWidth
        scroll="paper"
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '20px 16px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 40px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 32px)', sm: '600px' },
            maxWidth: { xs: 'calc(100% - 32px)', sm: '600px' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <PeopleIcon color="action" sx={{ fontSize: '1.25rem' }} /> 새 멤버 등록
        </DialogTitle>
        <DialogContent dividers>
          <Box component="form" onSubmit={handleAddStaff} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="사용자 아이디"
                  fullWidth
                  size="small"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  disabled={submitting}
                  placeholder="아이디 (로그인용)"
                  required
                  inputProps={{
                    autoComplete: 'new-username',
                    form: {
                      autoComplete: 'off',
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="비밀번호"
                  fullWidth
                  size="small"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={submitting}
                  placeholder="초기 비밀번호"
                  required
                  inputProps={{
                    autoComplete: 'new-password'
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="이름"
                  fullWidth
                  size="small"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={submitting}
                  placeholder="실명"
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="이메일 주소"
                  fullWidth
                  size="small"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={submitting}
                  placeholder="example@comtooin.com"
                  type="email"
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="연락처"
                  fullWidth
                  size="small"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  disabled={submitting}
                  placeholder="010-0000-0000"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>권한</InputLabel>
                  <Select
                    value={newRole}
                    label="권한"
                    onChange={(e) => setNewRole(e.target.value as 'admin' | 'member')}
                    disabled={submitting}
                  >
                    <MenuItem value="member">일반 멤버</MenuItem>
                    <MenuItem value="admin">관리자</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 1, '& > button': { width: { xs: 'calc(50% - 4px)', sm: 'auto' }, m: '0 !important' } }}>
          <Button 
            variant="contained" 
            color="primary"
            onClick={handleAddStaff} 
            disabled={submitting || !newName.trim() || !newEmail.trim() || !newUsername.trim() || !newPassword.trim()}
            sx={{ fontWeight: 'bold', height: '36px', fontSize: '0.75rem', borderRadius: 1 }}
          >
            저장
          </Button>
          <Button onClick={() => setRegisterOpen(false)} variant="outlined" color="inherit" sx={{ height: '36px', fontSize: '0.75rem', borderRadius: 1 }}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminStaffPage;