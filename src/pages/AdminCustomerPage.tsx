import React, { useState, useEffect } from 'react';
import {
  Typography, Box, Paper, TextField, Button, List, ListItem,
  IconButton, Divider, CircularProgress, Alert, Stack, Container, Grid, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { 
  Delete as DeleteIcon, 
  Add as AddIcon, 
  Business as BusinessIcon,
  Store as StoreIcon,
  FiberNew as NewIcon,
  VerifiedUser as ActiveIcon,
  Computer as ComputerIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../api';
import { Helmet } from 'react-helmet-async';

interface Customer {
  id: string;
  name: string;
  address?: string;
  manager_name?: string;
  manager_phone?: string;
  manager_email?: string;
  manager_name_2?: string;
  manager_phone_2?: string;
  manager_email_2?: string;
  created_at?: string;
}

const AdminCustomerPage: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // 새 거래처 등록 폼 상태
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newManagerName1, setNewManagerName1] = useState('');
  const [newManagerPhone1, setNewManagerPhone1] = useState('');
  const [newManagerEmail1, setNewManagerEmail1] = useState('');
  const [newManagerName2, setNewManagerName2] = useState('');
  const [newManagerPhone2, setNewManagerPhone2] = useState('');
  const [newManagerEmail2, setNewManagerEmail2] = useState('');

  // 거래처 수정 모달 상태
  const [editOpen, setEditOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editManagerName1, setEditManagerName1] = useState('');
  const [editManagerPhone1, setEditManagerPhone1] = useState('');
  const [editManagerEmail1, setEditManagerEmail1] = useState('');
  const [editManagerName2, setEditManagerName2] = useState('');
  const [editManagerPhone2, setEditManagerPhone2] = useState('');
  const [editManagerEmail2, setEditManagerEmail2] = useState('');

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
        .insert([{ 
          name: newCustomerName.trim(),
          address: newAddress.trim(),
          manager_name: newManagerName1.trim(),
          manager_phone: newManagerPhone1.trim(),
          manager_email: newManagerEmail1.trim(),
          manager_name_2: newManagerName2.trim(),
          manager_phone_2: newManagerPhone2.trim(),
          manager_email_2: newManagerEmail2.trim(),
        }]);

      if (insertError) throw insertError;

      // 등록 성공 시 폼 리셋
      setNewCustomerName('');
      setNewAddress('');
      setNewManagerName1('');
      setNewManagerPhone1('');
      setNewManagerEmail1('');
      setNewManagerName2('');
      setNewManagerPhone2('');
      setNewManagerEmail2('');
      
      fetchCustomers();
    } catch (err: any) {
      setError(err.message || '거래처 추가 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditCustomerName(customer.name || '');
    setEditAddress(customer.address || '');
    setEditManagerName1(customer.manager_name || '');
    setEditManagerPhone1(customer.manager_phone || '');
    setEditManagerEmail1(customer.manager_email || '');
    setEditManagerName2(customer.manager_name_2 || '');
    setEditManagerPhone2(customer.manager_phone_2 || '');
    setEditManagerEmail2(customer.manager_email_2 || '');
    setEditOpen(true);
  };

  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !editCustomerName.trim()) return;

    setSubmitting(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          name: editCustomerName.trim(),
          address: editAddress.trim(),
          manager_name: editManagerName1.trim(),
          manager_phone: editManagerPhone1.trim(),
          manager_email: editManagerEmail1.trim(),
          manager_name_2: editManagerName2.trim(),
          manager_phone_2: editManagerPhone2.trim(),
          manager_email_2: editManagerEmail2.trim(),
        })
        .eq('id', selectedCustomer.id);

      if (updateError) throw updateError;

      setEditOpen(false);
      fetchCustomers();
    } catch (err: any) {
      setError(err.message || '거래처 수정 중 오류가 발생했습니다.');
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

      <Grid container spacing={{ xs: 2, sm: 3 }}>
        {/* 왼쪽: 등록 폼 */}
        {isAdmin && (
          <Grid item xs={12} md={5}>
            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 1, bgcolor: 'background.paper' }}>
              <Box component="form" onSubmit={handleAddCustomer}>
                <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AddIcon fontSize="small" /> 새 거래처 등록
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  새로운 유지보수 대상 고객사를 시스템에 등록합니다.
                </Typography>
                
                <Stack spacing={2}>
                  <Typography variant="subtitle2" color="primary" fontWeight="bold">
                    • 기본 정보
                  </Typography>
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
                  <TextField
                    label="사업장 주소"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    disabled={submitting}
                    placeholder="예: 경기도 의정부시..."
                  />
                  
                  <Divider />
                  
                  <Typography variant="subtitle2" color="primary" fontWeight="bold">
                    • 담당자 1 정보
                  </Typography>
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="이름"
                        variant="outlined"
                        size="small"
                        fullWidth
                        value={newManagerName1}
                        onChange={(e) => setNewManagerName1(e.target.value)}
                        disabled={submitting}
                        placeholder="홍길동"
                      />
                    </Grid>
                    <Grid item xs={12} sm={8}>
                      <TextField
                        label="연락처"
                        variant="outlined"
                        size="small"
                        fullWidth
                        value={newManagerPhone1}
                        onChange={(e) => setNewManagerPhone1(e.target.value)}
                        disabled={submitting}
                        placeholder="010-0000-0000"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="이메일"
                        variant="outlined"
                        size="small"
                        fullWidth
                        value={newManagerEmail1}
                        onChange={(e) => setNewManagerEmail1(e.target.value)}
                        disabled={submitting}
                        placeholder="user@example.com"
                      />
                    </Grid>
                  </Grid>

                  <Divider />

                  <Typography variant="subtitle2" color="primary" fontWeight="bold">
                    • 담당자 2 정보 (선택)
                  </Typography>
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="이름 2"
                        variant="outlined"
                        size="small"
                        fullWidth
                        value={newManagerName2}
                        onChange={(e) => setNewManagerName2(e.target.value)}
                        disabled={submitting}
                        placeholder="이몽룡"
                      />
                    </Grid>
                    <Grid item xs={12} sm={8}>
                      <TextField
                        label="연락처 2"
                        variant="outlined"
                        size="small"
                        fullWidth
                        value={newManagerPhone2}
                        onChange={(e) => setNewManagerPhone2(e.target.value)}
                        disabled={submitting}
                        placeholder="010-1111-1111"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="이메일 2"
                        variant="outlined"
                        size="small"
                        fullWidth
                        value={newManagerEmail2}
                        onChange={(e) => setNewManagerEmail2(e.target.value)}
                        disabled={submitting}
                        placeholder="user2@example.com"
                      />
                    </Grid>
                  </Grid>

                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<AddIcon />}
                    disabled={submitting || !newCustomerName.trim()}
                    sx={{ py: 1, fontWeight: 'bold', borderRadius: 1, mt: 1 }}
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
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 1, bgcolor: 'background.paper', minHeight: '400px' }}>
            <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <BusinessIcon fontSize="small" /> 등록된 거래처 목록
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              거래처명을 누르면 상세 정보 수정 팝업이 표시됩니다. 자산 관리 버튼으로 인프라를 조회할 수 있습니다.
            </Typography>
            
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading ? (
              <Box sx={{ textAlign: 'center', py: 10 }}><CircularProgress /></Box>
            ) : (
              <List sx={{ bgcolor: 'transparent', p: 0, maxHeight: 800, overflowY: 'auto' }}>
                {customers.length === 0 ? (
                  <Typography color="text.secondary" align="center" sx={{ py: 10 }}>
                    등록된 거래처가 없습니다.
                  </Typography>
                ) : (
                  customers.map((customer) => (
                    <React.Fragment key={customer.id}>
                      <ListItem
                        sx={{ 
                          mb: 1.5,
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
                          alignItems: { xs: 'stretch', sm: 'center' },
                          justifyContent: 'space-between',
                          gap: 2,
                          py: 2, px: 2.5
                        }}
                      >
                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Typography 
                            variant="subtitle1"
                            sx={{ 
                              fontWeight: 'bold', 
                              color: 'primary.main', 
                              cursor: 'pointer', 
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.8,
                              '&:hover': { textDecoration: 'underline' } 
                            }}
                            onClick={() => handleOpenEdit(customer)}
                          >
                            {customer.name}
                            <EditIcon sx={{ fontSize: '1rem', opacity: 0.6 }} />
                          </Typography>
                          
                          {customer.address && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', gap: 0.5 }}>
                              <strong>주소:</strong> {customer.address}
                            </Typography>
                          )}
                          
                          {(customer.manager_name || customer.manager_name_2) && (
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 2 }} sx={{ mt: 0.5 }}>
                              {customer.manager_name && (
                                <Typography variant="caption" color="text.secondary">
                                  <strong>담당자1:</strong> {customer.manager_name} ({customer.manager_phone || '-'})
                                </Typography>
                              )}
                              {customer.manager_name_2 && (
                                <Typography variant="caption" color="text.secondary">
                                  <strong>담당자2:</strong> {customer.manager_name_2} ({customer.manager_phone_2 || '-'})
                                </Typography>
                              )}
                            </Stack>
                          )}
                        </Box>
                        
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ justifyContent: { xs: 'flex-end', sm: 'center' } }}>
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

      {/* 거래처 수정 팝업 Dialog */}
      <Dialog 
        open={editOpen} 
        onClose={() => setEditOpen(false)} 
        maxWidth="sm" 
        fullWidth
        scroll="paper"
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: 1.5, sm: 3 }, // 모바일 여백 최소화
            maxHeight: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon /> 거래처 정보 수정
        </DialogTitle>
        <DialogContent dividers>
          <Box component="form" onSubmit={handleEditCustomer} sx={{ mt: 1 }}>
            <Stack spacing={2.5}>
              <Typography variant="subtitle2" color="primary" fontWeight="bold">
                • 기본 정보
              </Typography>
              <TextField
                label="거래처 이름"
                fullWidth
                size="small"
                value={editCustomerName}
                onChange={(e) => setEditCustomerName(e.target.value)}
                required
              />
              <TextField
                label="사업장 주소"
                fullWidth
                size="small"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
              />
              
              <Divider />
              
              <Typography variant="subtitle2" color="primary" fontWeight="bold">
                • 담당자 1 정보
              </Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="이름"
                    fullWidth
                    size="small"
                    value={editManagerName1}
                    onChange={(e) => setEditManagerName1(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={8}>
                  <TextField
                    label="연락처"
                    fullWidth
                    size="small"
                    value={editManagerPhone1}
                    onChange={(e) => setEditManagerPhone1(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="이메일"
                    fullWidth
                    size="small"
                    value={editManagerEmail1}
                    onChange={(e) => setEditManagerEmail1(e.target.value)}
                  />
                </Grid>
              </Grid>
              
              <Divider />
              
              <Typography variant="subtitle2" color="primary" fontWeight="bold">
                • 담당자 2 정보 (선택)
              </Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="이름 2"
                    fullWidth
                    size="small"
                    value={editManagerName2}
                    onChange={(e) => setEditManagerName2(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={8}>
                  <TextField
                    label="연락처 2"
                    fullWidth
                    size="small"
                    value={editManagerPhone2}
                    onChange={(e) => setEditManagerPhone2(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="이메일 2"
                    fullWidth
                    size="small"
                    value={editManagerEmail2}
                    onChange={(e) => setEditManagerEmail2(e.target.value)}
                  />
                </Grid>
              </Grid>
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditOpen(false)} color="inherit">취소</Button>
          <Button 
            variant="contained" 
            onClick={handleEditCustomer} 
            disabled={submitting || !editCustomerName.trim()}
            sx={{ fontWeight: 'bold' }}
          >
            저장하기
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminCustomerPage;
