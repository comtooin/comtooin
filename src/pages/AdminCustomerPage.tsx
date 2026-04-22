import React, { useState, useEffect } from 'react';
import {
  Typography, Box, Paper, TextField, Button, List, ListItem, ListItemText,
  IconButton, Divider, CircularProgress, Alert, Stack, Container, Grid
} from '@mui/material';
import { 
  Delete as DeleteIcon, 
  Add as AddIcon, 
  Business as BusinessIcon,
  Store as StoreIcon,
  FiberNew as NewIcon,
  VerifiedUser as ActiveIcon
} from '@mui/icons-material';
import { supabase } from '../api';
import { Helmet } from 'react-helmet-async';

const AdminCustomerPage: React.FC = () => {
  const [customers, setCustomers] = useState<{ id: string; name: string; created_at?: string }[]>([]);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('customers')
        .select('*')
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;
      setCustomers(data || []);
    } catch (err: any) {
      setError(err.message || '거래처 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 통계 계산
  const stats = {
    total: customers.length,
    recent: customers.filter(c => {
      if (!c.created_at) return false;
      const created = new Date(c.created_at);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return created > thirtyDaysAgo;
    }).length,
    active: customers.length
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;

    setSubmitting(true);
    setError('');
    try {
      const { error: insertError } = await supabase
        .from('customers')
        .insert([{ name: newCustomerName.trim() }]);

      if (insertError) throw insertError;

      setNewCustomerName('');
      fetchCustomers();
    } catch (err: any) {
      setError(err.message || '거래처 추가 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!window.confirm(`'${name}' 거래처를 삭제하시겠습니까?`)) return;

    try {
      const { error: deleteError } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      fetchCustomers();
    } catch (err: any) {
      setError(err.message || '거래처 삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <Container maxWidth="lg">
      <Helmet><title>거래처 | COMTOOIN</title></Helmet>
      
      {/* 표준 헤더 섹션 */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <BusinessIcon sx={{ fontSize: '2.2rem', color: 'primary.main' }} />
          <Typography variant="h5" component="h1" fontWeight="bold">
            거래처
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          유지보수 대상 고객사 목록을 체계적으로 관리합니다.
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* 상단 요약 위젯 섹션 */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { label: '전체 고객사', count: stats.total, icon: <StoreIcon color="primary" fontSize="small" />, color: '#607d8b' },
          { label: '이번달 신규', count: stats.recent, icon: <NewIcon color="success" fontSize="small" />, color: '#2e7d32' },
          { label: '유지보수 활성', count: stats.active, icon: <ActiveIcon color="info" fontSize="small" />, color: '#0288d1' },
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
                {item.count}<Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'text.secondary', fontWeight: 'bold' }}>개</Typography>
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* 왼쪽: 등록 폼 */}
        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, bgcolor: 'background.paper', height: '100%' }}>
            <Box component="form" onSubmit={handleAddCustomer}>
              <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AddIcon fontSize="small" /> 새 거래처 등록
              </Typography>
              <Stack spacing={2.5}>
                <TextField
                  label="거래처 이름"
                  variant="outlined"
                  size="small"
                  fullWidth
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  disabled={submitting}
                  placeholder="예: (주)컴투인"
                  required
                />
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<AddIcon />}
                  disabled={submitting || !newCustomerName.trim()}
                  sx={{ py: 1, fontWeight: 'bold', borderRadius: 2 }}
                >
                  거래처 추가하기
                </Button>
              </Stack>
            </Box>
          </Paper>
        </Grid>

        {/* 오른쪽: 목록 */}
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, bgcolor: 'background.paper', minHeight: '400px' }}>
            <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <BusinessIcon fontSize="small" /> 등록된 거래처 목록
            </Typography>
            
            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {loading ? (
              <Box sx={{ textAlign: 'center', py: 10 }}><CircularProgress /></Box>
            ) : (
              <List sx={{ bgcolor: 'grey.50', borderRadius: 2, p: 1 }}>
                {customers.length === 0 ? (
                  <Typography color="text.secondary" align="center" sx={{ py: 10 }}>
                    등록된 거래처가 없습니다.
                  </Typography>
                ) : (
                  customers.map((customer, index) => (
                    <React.Fragment key={customer.id}>
                      <ListItem
                        secondaryAction={
                          <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteCustomer(customer.id, customer.name)} sx={{ '&:hover': { color: 'error.main' } }}>
                            <DeleteIcon color="action" fontSize="small" />
                          </IconButton>
                        }
                        sx={{ transition: 'bgcolor 0.2s', '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' } }}
                      >
                        <ListItemText 
                          primary={customer.name} 
                          primaryTypographyProps={{ fontWeight: 'bold', color: 'text.primary' }}
                        />
                      </ListItem>
                      {index < customers.length - 1 && <Divider component="li" />}
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

export default AdminCustomerPage;
