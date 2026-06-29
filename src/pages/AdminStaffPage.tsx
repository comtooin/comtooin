import React, { useState, useEffect } from 'react';
import {
  Typography, Box, Paper, TextField, Button, List, ListItem, ListItemText,
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
            role: newRole
          }
        }
      });

      if (funcError) {
        // Edge Function에서 반환한 상세 에러 메시지 추출 시도
        let errorMessage = funcError.message;
        try {
          const body = await funcError.context?.json();
          if (body && body.error) errorMessage = body.error;
        } catch (e) {
          // JSON 파싱 실패 시 기존 에러 메시지 유지
        }
        throw new Error(errorMessage);
      }

      setNewName('');
      setNewEmail('');
      setNewUsername('');
      setNewPassword('');
      setSuccess('새 멤버가 등록되었습니다.');
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
            name: editingStaff.name,
            email: editingStaff.email,
            username: editingStaff.username,
            role: editingStaff.role
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

      setEditDialogOpen(false);
      setSuccess('멤버 정보가 수정되었습니다.');
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
      setResetDialogOpen(false);
      setResetPassword('');
      setSuccess(`'${resettingStaff?.name}' 멤버의 비밀번호가 [ ${tempPassword} ] (으)로 초기화되었습니다.`);
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

      setSuccess('멤버가 삭제되었습니다.');
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
      <Helmet><title>멤버 관리 | COMTOOIN</title></Helmet>
      
      {/* 표준 헤더 섹션 */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <PeopleIcon sx={{ fontSize: '2.2rem', color: 'primary.main' }} />
          <Typography variant="h5" component="h1" fontWeight="bold">
            멤버 관리
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          시스템을 이용하는 멤버 목록을 관리하고 권한을 제어합니다.
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* 상단 요약 위젯 섹션 */}
      <Paper variant="outlined" sx={{ mb: 4, borderRadius: 2, display: 'flex', overflow: 'hidden', bgcolor: 'background.paper' }}>
        {[
          { label: '전체 멤버', shortLabel: '전체', count: stats.total, icon: <PeopleIcon fontSize="small" sx={{ color: '#607d8b' }} /> },
          { label: '최근 합류', shortLabel: '최근', count: stats.recent, icon: <PersonAddIcon fontSize="small" sx={{ color: '#2e7d32' }} /> },
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
            <Stack direction="row" spacing={{ xs: 0.5, sm: 1 }} alignItems="center" justifyContent="center" flexWrap="wrap">
              {item.icon}
              <Typography variant="body2" fontWeight="bold" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                {item.label}
              </Typography>
              <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' }, fontSize: '0.7rem' }}>
                {item.shortLabel}
              </Typography>
              <Typography variant="body1" fontWeight="900" color="text.primary" sx={{ ml: { xs: 0.5, sm: 1 } }}>
                {item.count}
                <Typography component="span" variant="caption" sx={{ ml: 0.2, color: 'text.secondary', fontWeight: 'bold' }}>명</Typography>
              </Typography>
            </Stack>
          </Box>
        ))}
      </Paper>

      <Grid container spacing={3}>
        {/* 왼쪽: 등록 폼 */}
        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1, bgcolor: 'background.paper', height: '100%' }}>
            <Box component="form" onSubmit={handleAddStaff}>
              <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonAddIcon fontSize="small" /> 새 멤버 등록
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="사용자 아이디"
                  variant="outlined"
                  size="small"
                  fullWidth
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  disabled={submitting}
                  placeholder="아이디 (로그인용)"
                  required
                />
                <TextField
                  label="비밀번호"
                  variant="outlined"
                  size="small"
                  fullWidth
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={submitting}
                  placeholder="초기 비밀번호"
                  required
                />
                <TextField
                  label="이름"
                  variant="outlined"
                  size="small"
                  fullWidth
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={submitting}
                  placeholder="실명"
                  required
                />
                <TextField
                  label="이메일 주소"
                  variant="outlined"
                  size="small"
                  fullWidth
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={submitting}
                  placeholder="example@comtooin.com"
                  type="email"
                  required
                />
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
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<AddIcon />}
                  disabled={submitting || !newName.trim() || !newEmail.trim() || !newUsername.trim() || !newPassword.trim()}
                  sx={{ py: 1, mt: 1, fontWeight: 'bold', borderRadius: 1 }}
                >
                  멤버 추가하기
                </Button>
              </Stack>
            </Box>
          </Paper>
        </Grid>

        {/* 오른쪽: 목록 */}
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1, bgcolor: 'background.paper', minHeight: '400px' }}>
            <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <BadgeIcon fontSize="small" /> 등록된 멤버 목록
            </Typography>
            
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

            {loading ? (
              <Box sx={{ textAlign: 'center', py: 10 }}><CircularProgress /></Box>
            ) : (
              <List sx={{ bgcolor: 'grey.50', borderRadius: 1, p: 1 }}>
                {staffs.length === 0 ? (
                  <Typography color="text.secondary" align="center" sx={{ py: 10 }}>
                    등록된 멤버가 없습니다.
                  </Typography>
                ) : (
                  staffs.map((staff, index) => (
                    <React.Fragment key={staff.id}>
                      <ListItem
                        secondaryAction={
                          <Stack direction="row" spacing={0.5}>
                            <IconButton 
                              size="small" 
                              onClick={() => {
                                setEditingStaff({...staff});
                                setEditDialogOpen(true);
                              }}
                              title="수정"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <Tooltip title={!staff.auth_user_id ? "로그인 계정이 없는 기존 멤버는 비밀번호를 초기화할 수 없습니다." : "비밀번호 초기화"}>
                              <span>
                                <IconButton 
                                  size="small" 
                                  onClick={() => {
                                    setResettingStaff(staff);
                                    setResetDialogOpen(true);
                                  }}
                                  disabled={!staff.auth_user_id}
                                >
                                  <LockResetIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <IconButton 
                              edge="end" 
                              aria-label="delete" 
                              onClick={() => handleDeleteStaff(staff)} 
                              sx={{ '&:hover': { color: 'error.main' } }}
                              title="삭제"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        }
                        sx={{ transition: 'bgcolor 0.2s', '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' } }}
                      >
                        <ListItemText 
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography fontWeight="bold" color="text.primary">{staff.name}</Typography>
                              <Typography variant="caption" sx={{ bgcolor: staff.role === 'admin' ? 'primary.light' : 'grey.300', color: 'white', px: 0.8, py: 0.1, borderRadius: 1 }}>
                                {staff.role === 'admin' ? '관리자' : '멤버'}
                              </Typography>
                            </Stack>
                          }
                          secondary={`${staff.username} (${staff.email})`}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                      {index < staffs.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  ))
                )}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* 수정 다이얼로그 */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle fontWeight="bold">멤버 정보 수정</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="이름"
              fullWidth
              size="small"
              value={editingStaff?.name || ''}
              onChange={(e) => setEditingStaff(prev => prev ? {...prev, name: e.target.value} : null)}
            />
            <TextField
              label="사용자 아이디"
              fullWidth
              size="small"
              value={editingStaff?.username || ''}
              onChange={(e) => setEditingStaff(prev => prev ? {...prev, username: e.target.value} : null)}
            />
            <TextField
              label="이메일 주소"
              fullWidth
              size="small"
              value={editingStaff?.email || ''}
              onChange={(e) => setEditingStaff(prev => prev ? {...prev, email: e.target.value} : null)}
            />
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
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setEditDialogOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleUpdateStaff} disabled={submitting}>저장하기</Button>
        </DialogActions>
      </Dialog>

      {/* 비밀번호 초기화 다이얼로그 */}
      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle fontWeight="bold">비밀번호 초기화</DialogTitle>
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
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setResetDialogOpen(false)}>취소</Button>
          <Button variant="contained" color="warning" onClick={handleResetPassword} disabled={submitting || !resetPassword.trim()}>비밀번호 변경</Button>
        </DialogActions>
      </Dialog>

    </Container>
  );
};

export default AdminStaffPage;
