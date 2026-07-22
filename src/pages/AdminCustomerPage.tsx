import React, { useState, useEffect } from 'react';
import {
  Typography, Box, Paper, TextField, Button, List, ListItem,
  IconButton, Divider, CircularProgress, Alert, Stack, Container, Grid, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Checkbox, FormControlLabel,
  useTheme, useMediaQuery
} from '@mui/material';
import { 
  Delete as DeleteIcon, 
  Add as AddIcon, 
  Business as BusinessIcon,
  Store as StoreIcon,
  FiberNew as NewIcon,
  VerifiedUser as ActiveIcon,
  Computer as ComputerIcon,
  Edit as EditIcon,
  VpnKey as VpnKeyIcon,
  Info as InfoIcon,
  Person as PersonIcon
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
  auth_user_id?: string;
  login_id?: string;
  login_email?: string;
}

const AdminCustomerPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
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

  // 새 거래처 등록 팝업 모달 상태
  const [registerOpen, setRegisterOpen] = useState(false);
  const [createAccountOption, setCreateAccountOption] = useState(false);
  const [newLoginId, setNewLoginId] = useState('');
  const [newPassword, setNewPassword] = useState('');

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

  // 거래처 계정 관리 모달 상태
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [accountCustomer, setAccountCustomer] = useState<Customer | null>(null);
  const [accountLoginId, setAccountLoginId] = useState('');
  const [accountLoginEmail, setAccountLoginEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountSubmitting, setAccountSubmitting] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [accountSuccess, setAccountSuccess] = useState('');

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
      const { data, error: insertError } = await supabase
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
        }])
        .select();

      if (insertError) throw insertError;

      // 로그인 계정 정보 추가 옵션이 켜져 있고 유효한 값들이 입력된 경우 계정 생성
      if (createAccountOption && newLoginId.trim() && newPassword.trim() && data && data[0]) {
        const newCustomer = data[0];
        const generatedEmail = `${newLoginId.trim()}@comtooin-customer.local`;
        
        const { error: funcError } = await supabase.functions.invoke('manage-users', {
          body: {
            action: 'create-customer',
            userData: {
              customerId: newCustomer.id,
              loginId: newLoginId.trim(),
              loginEmail: generatedEmail,
              password: newPassword.trim(),
              name: newCustomer.name
            }
          }
        });

        if (funcError) {
          let errorMessage = funcError.message;
          try {
            const body = await funcError.context?.json();
            if (body && body.error) errorMessage = body.error;
          } catch (e) {}
          alert(`거래처는 성공적으로 등록되었으나, 로그인 계정 생성에 실패했습니다: ${errorMessage}`);
        }
      }

      // 등록 성공 시 폼 리셋 및 모달 닫기
      setNewCustomerName('');
      setNewAddress('');
      setNewManagerName1('');
      setNewManagerPhone1('');
      setNewManagerEmail1('');
      setNewManagerName2('');
      setNewManagerPhone2('');
      setNewManagerEmail2('');
      setCreateAccountOption(false);
      setNewLoginId('');
      setNewPassword('');
      alert('거래처가 성공적으로 등록되었습니다.');
      setRegisterOpen(false);
      
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
      alert('거래처 정보가 수정되었습니다.');
      setEditOpen(false);
      fetchCustomers();
    } catch (err: any) {
      setError(err.message || '거래처 수정 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!isAdmin) {
      alert('거래처 삭제 권한이 없습니다.');
      return;
    }
    if (!window.confirm(`'${name}' 거래처를 삭제하시겠습니까?`)) return;

    try {
      const { error: deleteError } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      alert('거래처가 삭제되었습니다.');
      fetchCustomers();
    } catch (err: any) {
      setError(err.message || '거래처 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleOpenAccountDialog = (customer: Customer) => {
    setAccountCustomer(customer);
    setAccountLoginId(customer.login_id || '');
    setAccountLoginEmail(customer.login_email || '');
    setAccountPassword('');
    setAccountError('');
    setAccountSuccess('');
    setAccountDialogOpen(true);
  };

  const handleCreateAccount = async () => {
    const generatedEmail = `${accountLoginId.trim()}@comtooin-customer.local`;

    if (!accountCustomer || !accountLoginId.trim() || !accountPassword.trim()) {
      setAccountError('모든 필드를 입력해 주세요.');
      return;
    }
    setAccountSubmitting(true);
    setAccountError('');
    setAccountSuccess('');
    try {
      const { error: funcError } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create-customer',
          userData: {
            customerId: accountCustomer.id,
            loginId: accountLoginId.trim(),
            loginEmail: generatedEmail,
            password: accountPassword.trim(),
            name: accountCustomer.name
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

      alert('거래처 계정이 성공적으로 생성되었습니다.');
      setAccountDialogOpen(false);
      
      // 즉시 로컬 데이터 갱신
      setAccountCustomer(prev => prev ? {
        ...prev,
        auth_user_id: 'temp-auth-id', // 대화 상대 갱신용 임시값
        login_id: accountLoginId.trim(),
        login_email: accountLoginEmail.trim()
      } : null);
      
      setAccountPassword('');
      fetchCustomers();
    } catch (err: any) {
      setAccountError(err.message || '계정 생성 중 오류가 발생했습니다.');
    } finally {
      setAccountSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!accountCustomer) return;
    if (!window.confirm(`'${accountCustomer.name}' 거래처의 로그인 계정을 삭제하시겠습니까?`)) return;

    setAccountSubmitting(true);
    setAccountError('');
    setAccountSuccess('');
    try {
      const { error: funcError } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'delete-customer',
          userData: {
            customerId: accountCustomer.id,
            authUserId: accountCustomer.auth_user_id
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

      alert('거래처 계정이 삭제되었습니다.');
      setAccountDialogOpen(false);
      setAccountCustomer(prev => prev ? {
        ...prev,
        auth_user_id: undefined,
        login_id: undefined,
        login_email: undefined
      } : null);
      setAccountLoginId('');
      setAccountLoginEmail('');
      setAccountPassword('');
      fetchCustomers();
    } catch (err: any) {
      setAccountError(err.message || '계정 삭제 중 오류가 발생했습니다.');
    } finally {
      setAccountSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!accountCustomer || !accountPassword.trim()) {
      setAccountError('새 비밀번호를 입력해 주세요.');
      return;
    }
    setAccountSubmitting(true);
    setAccountError('');
    setAccountSuccess('');
    try {
      const { error: funcError } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'reset-customer-password',
          userData: {
            authUserId: accountCustomer.auth_user_id,
            newPassword: accountPassword.trim()
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

      alert('비밀번호가 성공적으로 변경되었습니다.');
      setAccountDialogOpen(false);
      setAccountPassword('');
    } catch (err: any) {
      setAccountError(err.message || '비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setAccountSubmitting(false);
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

      <Grid container spacing={2}>
        {/* 거래처 목록 */}
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 1, bgcolor: 'background.paper', minHeight: '500px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BusinessIcon fontSize="small" /> 등록된 거래처 목록
              </Typography>
              {isAdmin && (
                <Button 
                  variant="contained" 
                  color="primary" 
                  startIcon={<AddIcon />} 
                  onClick={() => setRegisterOpen(true)}
                  sx={{ fontWeight: 'bold' }}
                >
                  새 거래처 등록
                </Button>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              고객사의 기본 정보관리, 자산관리 및 계정 로그인 부여 설정을 관리할 수 있습니다.
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
                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5, pr: { xs: 4, sm: 0 } }}>
                          <Typography 
                            variant="subtitle1"
                            sx={{ 
                              fontWeight: 'bold', 
                              color: 'text.primary'
                            }}
                          >
                            {customer.name}
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
                            onClick={() => handleOpenEdit(customer)}
                            sx={{ fontWeight: 'bold', fontSize: '0.75rem', px: 1.5, py: 0.5 }}
                          >
                            {isAdmin ? '정보관리' : '정보조회'}
                          </Button>
                          <Button 
                            variant="outlined" 
                            size="small"
                            color={customer.auth_user_id ? "success" : "warning"}
                            startIcon={<VpnKeyIcon fontSize="small" />}
                            onClick={() => handleOpenAccountDialog(customer)}
                            sx={{ fontWeight: 'bold', fontSize: '0.75rem', px: 1.5, py: 0.5 }}
                          >
                            {isAdmin ? '계정관리' : '계정조회'}
                          </Button>
                          <Button 
                            variant="contained"
                            size="small"
                            color="primary"
                            startIcon={<ComputerIcon fontSize="small" />}
                            onClick={() => navigate(`/admin/customers/${customer.id}/inventory`)}
                            sx={{ fontWeight: 'bold', fontSize: '0.75rem', px: 1.5, py: 0.5, boxShadow: 0 }}
                          >
                            자산관리
                          </Button>
                          {isAdmin && (
                            <Tooltip title="거래처 삭제">
                              <IconButton 
                                size="small" 
                                aria-label="delete" 
                                onClick={() => handleDeleteCustomer(customer.id, customer.name)} 
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
                          )}
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
        fullScreen={isMobile}
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: isMobile ? 0 : 1.5, sm: 3 },
            maxHeight: { xs: isMobile ? '100%' : 'calc(100% - 24px)', sm: 'calc(100% - 64px)' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <BusinessIcon color="action" sx={{ fontSize: '1.25rem' }} /> {isAdmin ? '거래처 정보 수정' : '거래처 정보 조회'}
        </DialogTitle>
        <DialogContent dividers>
          <Box component="form" onSubmit={handleEditCustomer} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="primary" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <InfoIcon sx={{ fontSize: '1.1rem' }} /> 기본 정보
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="거래처 이름"
                  fullWidth
                  size="small"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  disabled={!isAdmin}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="사업장 주소"
                  fullWidth
                  size="small"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  disabled={!isAdmin}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Divider sx={{ my: 0.5 }} />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="primary" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PersonIcon sx={{ fontSize: '1.1rem' }} /> 담당자 1 정보
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="이름"
                  fullWidth
                  size="small"
                  value={editManagerName1}
                  onChange={(e) => setEditManagerName1(e.target.value)}
                  disabled={!isAdmin}
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  label="연락처"
                  fullWidth
                  size="small"
                  value={editManagerPhone1}
                  onChange={(e) => setEditManagerPhone1(e.target.value)}
                  disabled={!isAdmin}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="이메일"
                  fullWidth
                  size="small"
                  value={editManagerEmail1}
                  onChange={(e) => setEditManagerEmail1(e.target.value)}
                  disabled={!isAdmin}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Divider sx={{ my: 0.5 }} />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="primary" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PersonIcon sx={{ fontSize: '1.1rem' }} /> 담당자 2 정보 (선택)
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="이름 2"
                  fullWidth
                  size="small"
                  value={editManagerName2}
                  onChange={(e) => setEditManagerName2(e.target.value)}
                  disabled={!isAdmin}
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  label="연락처 2"
                  fullWidth
                  size="small"
                  value={editManagerPhone2}
                  onChange={(e) => setEditManagerPhone2(e.target.value)}
                  disabled={!isAdmin}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="이메일 2"
                  fullWidth
                  size="small"
                  value={editManagerEmail2}
                  onChange={(e) => setEditManagerEmail2(e.target.value)}
                  disabled={!isAdmin}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          {isAdmin ? (
            <>
              <Button 
                variant="contained" 
                color="primary"
                onClick={handleEditCustomer} 
                disabled={submitting || !editCustomerName.trim()}
                sx={{ fontWeight: 'bold' }}
              >
                저장
              </Button>
              <Button onClick={() => setEditOpen(false)} variant="outlined" color="inherit">닫기</Button>
            </>
          ) : (
            <Button onClick={() => setEditOpen(false)} variant="contained" color="primary" sx={{ fontWeight: 'bold' }}>닫기</Button>
          )}
        </DialogActions>
      </Dialog>

      {/* 거래처 계정 설정 Dialog */}
      <Dialog 
        open={accountDialogOpen} 
        onClose={() => setAccountDialogOpen(false)} 
        maxWidth="xs" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <VpnKeyIcon color="action" sx={{ fontSize: '1.25rem' }} /> {accountCustomer?.name} 계정 {isAdmin ? '관리' : '조회'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {accountCustomer?.auth_user_id ? (
              <Alert severity="success" variant="outlined">
                로그인 계정이 등록되어 있습니다.
              </Alert>
            ) : (
              <Alert severity="warning" variant="outlined">
                {isAdmin ? '계정이 없습니다. 새 로그인 아이디와 비밀번호를 부여하십시오.' : '등록된 로그인 계정이 없습니다.'}
              </Alert>
            )}

            <TextField
              label="로그인용 아이디"
              fullWidth
              size="small"
              value={accountLoginId}
              onChange={(e) => setAccountLoginId(e.target.value)}
              disabled={accountSubmitting || !!accountCustomer?.auth_user_id || !isAdmin}
              placeholder="예: user_samsung"
            />
            {isAdmin && (
              <TextField
                label={accountCustomer?.auth_user_id ? "새 비밀번호 (변경 시 입력)" : "초기 비밀번호"}
                type="password"
                fullWidth
                size="small"
                value={accountPassword}
                onChange={(e) => setAccountPassword(e.target.value)}
                disabled={accountSubmitting}
                placeholder="최소 6자 이상"
              />
            )}

            {accountError && <Alert severity="error">{accountError}</Alert>}
            {accountSuccess && <Alert severity="success">{accountSuccess}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: { xs: 1.5, sm: 2 }, display: 'flex', justifyContent: isAdmin ? 'space-between' : 'flex-end', gap: 1 }}>
          {isAdmin ? (
            <>
              {accountCustomer?.auth_user_id ? (
                <Button 
                  variant="outlined" 
                  color="error" 
                  size="small"
                  onClick={handleDeleteAccount} 
                  disabled={accountSubmitting}
                >
                  삭제
                </Button>
              ) : <Box />}
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                {accountCustomer?.auth_user_id ? (
                  <Button 
                    variant="contained" 
                    onClick={handleResetPassword} 
                    disabled={accountSubmitting || !accountPassword.trim()}
                    size="small"
                    sx={{ fontWeight: 'bold' }}
                  >
                    비번 변경
                  </Button>
                ) : (
                  <Button 
                    variant="contained" 
                    onClick={handleCreateAccount} 
                    disabled={accountSubmitting || !accountLoginId.trim() || !accountPassword.trim()}
                    size="small"
                    sx={{ fontWeight: 'bold' }}
                  >
                    생성
                  </Button>
                )}
                <Button onClick={() => setAccountDialogOpen(false)} variant="outlined" color="inherit" size="small">닫기</Button>
              </Box>
            </>
          ) : (
            <Button onClick={() => setAccountDialogOpen(false)} variant="contained" color="primary" size="small" sx={{ fontWeight: 'bold' }}>닫기</Button>
          )}
        </DialogActions>
      </Dialog>

      {/* 새 거래처 등록 팝업 Dialog */}
      <Dialog 
        open={registerOpen} 
        onClose={() => setRegisterOpen(false)} 
        maxWidth="sm" 
        fullWidth
        scroll="paper"
        fullScreen={isMobile}
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: isMobile ? 0 : 1.5, sm: 3 },
            maxHeight: { xs: isMobile ? '100%' : 'calc(100% - 24px)', sm: 'calc(100% - 64px)' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <BusinessIcon color="action" sx={{ fontSize: '1.25rem' }} /> 새 거래처 등록
        </DialogTitle>
        <DialogContent dividers>
          <Box component="form" onSubmit={handleAddCustomer} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="primary" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <InfoIcon sx={{ fontSize: '1.1rem' }} /> 기본 정보
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="거래처 이름"
                  fullWidth
                  size="small"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="예: (주)컴투인"
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="사업장 주소"
                  fullWidth
                  size="small"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="예: 경기도 의정부시..."
                />
              </Grid>
              
              <Grid item xs={12}>
                <Divider sx={{ my: 0.5 }} />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="primary" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PersonIcon sx={{ fontSize: '1.1rem' }} /> 담당자 1 정보
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="이름"
                  fullWidth
                  size="small"
                  value={newManagerName1}
                  onChange={(e) => setNewManagerName1(e.target.value)}
                  placeholder="홍길동"
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  label="연락처"
                  fullWidth
                  size="small"
                  value={newManagerPhone1}
                  onChange={(e) => setNewManagerPhone1(e.target.value)}
                  placeholder="010-0000-0000"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="이메일"
                  fullWidth
                  size="small"
                  value={newManagerEmail1}
                  onChange={(e) => setNewManagerEmail1(e.target.value)}
                  placeholder="user@example.com"
                />
              </Grid>
              
              <Grid item xs={12}>
                <Divider sx={{ my: 0.5 }} />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="primary" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PersonIcon sx={{ fontSize: '1.1rem' }} /> 담당자 2 정보 (선택)
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="이름 2"
                  fullWidth
                  size="small"
                  value={newManagerName2}
                  onChange={(e) => setNewManagerName2(e.target.value)}
                  placeholder="이몽룡"
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  label="연락처 2"
                  fullWidth
                  size="small"
                  value={newManagerPhone2}
                  onChange={(e) => setNewManagerPhone2(e.target.value)}
                  placeholder="010-1111-1111"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="이메일 2"
                  fullWidth
                  size="small"
                  value={newManagerEmail2}
                  onChange={(e) => setNewManagerEmail2(e.target.value)}
                  placeholder="user2@example.com"
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 0.5 }} />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={createAccountOption}
                      onChange={(e) => setCreateAccountOption(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={
                    <Typography variant="body2" fontWeight="bold">
                      등록과 동시에 로그인 계정(아이디/비밀번호) 생성하기
                    </Typography>
                  }
                />
              </Grid>

              {createAccountOption && (
                <>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="로그인용 아이디"
                      fullWidth
                      size="small"
                      value={newLoginId}
                      onChange={(e) => setNewLoginId(e.target.value)}
                      placeholder="예: user_samsung"
                      required={createAccountOption}
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
                      label="초기 비밀번호"
                      type="password"
                      fullWidth
                      size="small"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="최소 6자 이상"
                      required={createAccountOption}
                      inputProps={{
                        autoComplete: 'new-password'
                      }}
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            variant="contained" 
            color="primary"
            onClick={handleAddCustomer} 
            disabled={submitting || !newCustomerName.trim() || (createAccountOption && (!newLoginId.trim() || !newPassword.trim()))}
            sx={{ fontWeight: 'bold' }}
          >
            저장
          </Button>
          <Button onClick={() => setRegisterOpen(false)} variant="outlined" color="inherit">닫기</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminCustomerPage;
