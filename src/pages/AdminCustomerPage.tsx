import React, { useState, useEffect } from 'react';
import {
  Typography, Box, Paper, TextField, Button, List, ListItem,
  IconButton, Divider, CircularProgress, Alert, Stack, Container, Grid, Tooltip
} from '@mui/material';
import { 
  Delete as DeleteIcon, 
  Add as AddIcon, 
  Business as BusinessIcon,
  Store as StoreIcon,
  FiberNew as NewIcon,
  VerifiedUser as ActiveIcon,
  Computer as ComputerIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../api';
import { Helmet } from 'react-helmet-async';

const AdminCustomerPage: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<{ id: string; name: string; created_at?: string }[]>([]);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const isAdmin = localStorage.getItem('adminRole') === 'admin';

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
      <Box sx={{ mb: 2.5 }}>
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

      <Divider sx={{ mb: 2.5 }} />

      {/* 상단 요약 위젯 섹션 */}
      <Paper variant="outlined" sx={{ mb: 2.5, borderRadius: 2, display: 'flex', overflow: 'hidden', bgcolor: 'background.paper' }}>
        {[
          { label: '총 거래처', shortLabel: '총거래처', count: stats.total, icon: <StoreIcon fontSize="small" sx={{ color: '#607d8b' }} /> },
          { label: '신규 거래처', shortLabel: '신규', count: stats.recent, icon: <NewIcon fontSize="small" sx={{ color: '#2e7d32' }} /> },
          { label: '활성 거래처', shortLabel: '활성', count: stats.active, icon: <ActiveIcon fontSize="small" sx={{ color: '#0288d1' }} /> },
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

      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        {/* 왼쪽: 등록 폼 */}
        {isAdmin && (
          <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2, md: 3 }, borderRadius: 1, bgcolor: 'background.paper', height: '100%' }}>
            <Box component="form" onSubmit={handleAddCustomer}>
              <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AddIcon fontSize="small" /> 새 거래처 등록
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                새로운 유지보수 대상 고객사를 시스템에 등록합니다. 등록 후 우측 목록에서 인프라 자산을 관리할 수 있습니다.
              </Typography>
              <Stack spacing={{ xs: 1.5, sm: 2.5 }}>
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
                  sx={{ py: 1, fontWeight: 'bold', borderRadius: 1 }}
                >
                  거래처 추가하기
                </Button>
              </Stack>
            </Box>
          </Paper>
        </Grid>
        )}

        {/* 오른쪽: 목록 */}
        <Grid item xs={12} md={isAdmin ? 7 : 12}>
          <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2, md: 3 }, borderRadius: 1, bgcolor: 'background.paper', minHeight: '400px' }}>
            <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <BusinessIcon fontSize="small" /> 등록된 거래처 목록
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              거래처를 선택하거나 '자산 관리' 버튼을 클릭하여 해당 고객사의 PC 및 소프트웨어 설치 현황을 확인하고 관리할 수 있습니다.
            </Typography>
            
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading ? (
              <Box sx={{ textAlign: 'center', py: 10 }}><CircularProgress /></Box>
            ) : (
              <List sx={{ bgcolor: 'transparent', p: 1, maxHeight: 500, overflowY: 'auto' }}>
                {customers.length === 0 ? (
                  <Typography color="text.secondary" align="center" sx={{ py: 10 }}>
                    등록된 거래처가 없습니다.
                  </Typography>
                ) : (
                  customers.map((customer, index) => (
                    <React.Fragment key={customer.id}>
                      <ListItem
                        sx={{ 
                          mb: 1,
                          bgcolor: '#ffffff',
                          borderRadius: 2,
                          border: '1px solid #e2e8f0',
                          transition: 'all 0.2s ease-in-out', 
                          '&:hover': { 
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                            borderColor: 'primary.light',
                            transform: 'translateY(-2px)'
                          },
                          display: 'flex',
                          flexDirection: { xs: 'column', sm: 'row' },
                          alignItems: { xs: 'flex-start', sm: 'center' },
                          justifyContent: 'space-between',
                          gap: { xs: 1, sm: 1.5 },
                          py: 1.5, px: 2
                        }}
                      >
                        <Box sx={{ flex: 1, wordBreak: 'break-all' }}>
                          <Typography 
                            component="span" 
                            variant="body1"
                            sx={{ 
                              fontWeight: 'bold', 
                              color: 'primary.main', 
                              cursor: 'pointer', 
                              '&:hover': { textDecoration: 'underline' } 
                            }}
                            onClick={() => navigate(`/admin/customers/${customer.id}/inventory`)}
                          >
                            {customer.name}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ width: { xs: '100%', sm: 'auto' }, justifyContent: { xs: 'flex-end', sm: 'flex-end' } }}>
                          <Button 
                            variant="contained"
                            size="small"
                            startIcon={<ComputerIcon fontSize="small" />}
                            onClick={() => navigate(`/admin/customers/${customer.id}/inventory`)}
                            sx={{ fontWeight: 'bold', px: 2, py: 0.5, boxShadow: 0 }}
                          >
                            자산 관리
                          </Button>
                          <Tooltip title="삭제">
                            <IconButton size="small" aria-label="delete" onClick={() => handleDeleteCustomer(customer.id, customer.name)} sx={{ '&:hover': { color: 'error.main' } }}>
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
    </Container>
  );
};

export default AdminCustomerPage;
