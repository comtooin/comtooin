import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Typography, TextField, Button, Box, Paper, CircularProgress, Alert } from '@mui/material';
import axios from 'axios';
import { Helmet } from 'react-helmet-async';

const API_URL = process.env.NODE_ENV === 'production' ? '' : process.env.REACT_APP_API_URL || 'http://localhost:3001';

const AdminLoginPage: React.FC = () => {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/api/admin/login`, { id, password });
      localStorage.setItem('adminToken', response.data.token);
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Helmet>
        <title>관리자 로그인</title>
      </Helmet>
      <Paper elevation={3} sx={{ p: 4, mt: 8 }}>
        <Typography variant="h5" component="h1" align="center" gutterBottom>
          관리자 로그인
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="아이디"
            fullWidth
            required
            margin="normal"
            value={id}
            onChange={(e) => setId(e.target.value)}
          />
          <TextField
            label="비밀번호"
            type="password"
            fullWidth
            required
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          <Button type="submit" variant="contained" fullWidth size="large" sx={{ mt: 2 }} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : '로그인'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default AdminLoginPage;
