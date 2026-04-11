import React, { useState, useEffect } from 'react';
import {
  Typography, Box, Paper, TextField, Button, List, ListItem, ListItemText,
  IconButton, Divider, CircularProgress, Alert, Stack, Container
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon, Business as BusinessIcon } from '@mui/icons-material';
import { supabase } from '../api';
import { Helmet } from 'react-helmet-async';

const AdminCustomerPage: React.FC = () => {
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
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
    <Container maxWidth="md">
      <Helmet>
        <title>거래처 관리 - 컴투인</title>
      </Helmet>

      {/* 표준 헤더 섹션 */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <BusinessIcon sx={{ fontSize: '2rem', color: 'primary.main' }} />
          <Typography variant="h5" component="h1" fontWeight="bold">
            거래처 관리
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          유지보수 대상 고객사 목록을 관리합니다.
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 4 }, borderRadius: 3, bgcolor: 'background.paper' }}>
        <Box component="form" onSubmit={handleAddCustomer} sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ mb: 2 }}>새 거래처 등록</Typography>
          <Stack direction="row" spacing={2}>
            <TextField
              label="거래처 이름"
              variant="outlined"
              size="small"
              fullWidth
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              disabled={submitting}
              placeholder="예: (주)컴투인"
            />
            <Button
              type="submit"
              variant="contained"
              startIcon={<AddIcon />}
              disabled={submitting || !newCustomerName.trim()}
              sx={{ minWidth: '100px', fontWeight: 'bold' }}
            >
              추가
            </Button>
          </Stack>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ mb: 2 }}>등록된 거래처 목록</Typography>
        
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <List sx={{ bgcolor: 'grey.50', borderRadius: 2, p: 1 }}>
            {customers.length === 0 ? (
              <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
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
                      primaryTypographyProps={{ fontWeight: 'medium' }}
                    />
                  </ListItem>
                  {index < customers.length - 1 && <Divider component="li" />}
                </React.Fragment>
              ))
            )}
          </List>
        )}
      </Paper>
    </Container>
  );
};

export default AdminCustomerPage;
