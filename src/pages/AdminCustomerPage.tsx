import React, { useState, useEffect } from 'react';
import {
  Typography, Box, Paper, TextField, Button, List, ListItem, ListItemText,
  IconButton, Divider, CircularProgress, Alert, Stack
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
    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
      <Helmet>
        <title>거래처 관리 - 컴투인</title>
      </Helmet>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <BusinessIcon sx={{ mr: 1.5, fontSize: '2rem' }} />
        <Typography variant="h5" component="h1">
          거래처 관리
        </Typography>
      </Box>
      <Divider sx={{ my: 2 }} />

      <Box component="form" onSubmit={handleAddCustomer} sx={{ mb: 4 }}>
        <Stack direction="row" spacing={2}>
          <TextField
            label="새 거래처 이름"
            variant="outlined"
            size="small"
            fullWidth
            value={newCustomerName}
            onChange={(e) => setNewCustomerName(e.target.value)}
            disabled={submitting}
          />
          <Button
            type="submit"
            variant="contained"
            startIcon={<AddIcon />}
            disabled={submitting || !newCustomerName.trim()}
            sx={{ minWidth: '100px' }}
          >
            추가
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <List>
          {customers.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              등록된 거래처가 없습니다.
            </Typography>
          ) : (
            customers.map((customer) => (
              <React.Fragment key={customer.id}>
                <ListItem
                  secondaryAction={
                    <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteCustomer(customer.id, customer.name)}>
                      <DeleteIcon color="error" />
                    </IconButton>
                  }
                >
                  <ListItemText primary={customer.name} />
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))
          )}
        </List>
      )}
    </Paper>
  );
};

export default AdminCustomerPage;
