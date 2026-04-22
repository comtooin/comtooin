import React, { useState, useEffect } from 'react';
import {
  Typography, Box, Paper, TextField, Button, List, ListItem, ListItemText,
  IconButton, Divider, CircularProgress, Alert, Stack, Container, Grid
} from '@mui/material';
import { 
  Delete as DeleteIcon, 
  Add as AddIcon, 
  People as PeopleIcon,
  PersonAdd as PersonAddIcon,
  Badge as BadgeIcon,
  AssignmentInd as AssignmentIndIcon
} from '@mui/icons-material';
import { supabase } from '../api';
import { Helmet } from 'react-helmet-async';

const AdminStaffPage: React.FC = () => {
  const [staffs, setStaffs] = useState<{ id: string; name: string; email: string; created_at?: string }[]>([]);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
    if (!newName.trim() || !newEmail.trim()) return;

    setSubmitting(true);
    setError('');
    try {
      const { error: insertError } = await supabase
        .from('staff')
        .insert([{ name: newName.trim(), email: newEmail.trim() }]);

      if (insertError) throw insertError;

      setNewName('');
      setNewEmail('');
      fetchStaffs();
    } catch (err: any) {
      setError(err.message || '멤버 추가 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!window.confirm(`'${name}' 멤버를 삭제하시겠습니까?`)) return;

    try {
      const { error: deleteError } = await supabase
        .from('staff')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
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
    active: staffs.length > 0 ? Math.floor(staffs.length * 0.8) : 0 // 활성 비율 예시
  };

  return (
    <Container maxWidth="lg">
      <Helmet><title>멤버 | COMTOOIN</title></Helmet>
      
      {/* 표준 헤더 섹션 */}
      <Box sx={{ mb: 4 }}>
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

      <Divider sx={{ mb: 4 }} />

      {/* 상단 요약 위젯 섹션 */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { label: '전체 멤버', count: stats.total, icon: <PeopleIcon color="primary" fontSize="small" />, color: '#607d8b' },
          { label: '최근 합류', count: stats.recent, icon: <PersonAddIcon color="success" fontSize="small" />, color: '#2e7d32' },
          { label: '운영 인력', count: stats.total, icon: <AssignmentIndIcon color="info" fontSize="small" />, color: '#0288d1' },
        ].map((item, idx) => (
          <Grid item xs={4} sm={4} key={idx}>
            <Paper 
              variant="outlined" 
              sx={{ 
                p: { xs: 1.5, sm: 2 }, 
                borderLeft: { xs: `4px solid ${item.color}`, sm: `6px solid ${item.color}` }, 
                borderRadius: 2,
                bgcolor: 'background.paper',
                height: '100%'
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                {item.icon}
                <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.8rem' } }}>
                  {item.label}
                </Typography>
              </Stack>
              <Typography variant="h6" fontWeight="bold" sx={{ mt: 0.5, ml: 0.5 }}>
                {item.count}<Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'text.secondary', fontWeight: 'bold' }}>명</Typography>
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* 왼쪽: 등록 폼 */}
        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, bgcolor: 'background.paper', height: '100%' }}>
            <Box component="form" onSubmit={handleAddStaff}>
              <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonAddIcon fontSize="small" /> 새 멤버 등록
              </Typography>
              <Stack spacing={2.5}>
                <TextField
                  label="이름"
                  variant="outlined"
                  size="small"
                  fullWidth
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={submitting}
                  placeholder="예: 홍길동"
                  required
                />
                <TextField
                  label="이메일"
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
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<AddIcon />}
                  disabled={submitting || !newName.trim() || !newEmail.trim()}
                  sx={{ py: 1, fontWeight: 'bold', borderRadius: 2 }}
                >
                  멤버 추가하기
                </Button>
              </Stack>
            </Box>
          </Paper>
        </Grid>

        {/* 오른쪽: 목록 */}
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, bgcolor: 'background.paper', minHeight: '400px' }}>
            <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <BadgeIcon fontSize="small" /> 등록된 멤버 목록
            </Typography>
            
            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {loading ? (
              <Box sx={{ textAlign: 'center', py: 10 }}><CircularProgress /></Box>
            ) : (
              <List sx={{ bgcolor: 'grey.50', borderRadius: 2, p: 1 }}>
                {staffs.length === 0 ? (
                  <Typography color="text.secondary" align="center" sx={{ py: 10 }}>
                    등록된 멤버가 없습니다.
                  </Typography>
                ) : (
                  staffs.map((staff, index) => (
                    <React.Fragment key={staff.id}>
                      <ListItem
                        secondaryAction={
                          <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteStaff(staff.id, staff.name)} sx={{ '&:hover': { color: 'error.main' } }}>
                            <DeleteIcon color="action" fontSize="small" />
                          </IconButton>
                        }
                        sx={{ transition: 'bgcolor 0.2s', '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' } }}
                      >
                        <ListItemText 
                          primary={staff.name} 
                          secondary={staff.email}
                          primaryTypographyProps={{ fontWeight: 'bold', color: 'text.primary' }}
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
    </Container>
  );
};

export default AdminStaffPage;
