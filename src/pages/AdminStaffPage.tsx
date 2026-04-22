import React, { useState, useEffect } from 'react';
import {
  Typography, Box, Paper, TextField, Button, List, ListItem, ListItemText,
  IconButton, Divider, CircularProgress, Alert, Stack, Container
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon, People as PeopleIcon } from '@mui/icons-material';
import { supabase } from '../api';
import { Helmet } from 'react-helmet-async';

const AdminStaffPage: React.FC = () => {
  const [staffs, setStaffs] = useState<{ id: string; name: string; email: string }[]>([]);
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

  return (
    <Container maxWidth="md">
      <Helmet><title>멤버 | COMTOOIN</title></Helmet>
      
      {/* 표준 헤더 섹션 */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <PeopleIcon sx={{ fontSize: '2rem', color: 'primary.main' }} />
          <Typography variant="h5" component="h1" fontWeight="bold">
            멤버
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          시스템을 이용하는 멤버 목록을 관리합니다.
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 4 }, borderRadius: 3, bgcolor: 'background.paper' }}>
        <Box component="form" onSubmit={handleAddStaff} sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ mb: 2 }}>새 멤버 등록</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
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
              sx={{ minWidth: '100px', fontWeight: 'bold' }}
            >
              추가
            </Button>
          </Stack>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ mb: 2 }}>등록된 멤버 목록</Typography>
        
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <List sx={{ bgcolor: 'grey.50', borderRadius: 2, p: 1 }}>
            {staffs.length === 0 ? (
              <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
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
                      primaryTypographyProps={{ fontWeight: 'medium' }}
                    />
                  </ListItem>
                  {index < staffs.length - 1 && <Divider component="li" />}
                </React.Fragment>
              ))
            )}
          </List>
        )}
      </Paper>
    </Container>
  );
};

export default AdminStaffPage;
