import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Typography, TextField, Button, Box, Paper, CircularProgress, Alert } from '@mui/material';
import api from '../api'; // 수정됨: 중앙 API 모듈 임포트
import { Helmet } from 'react-helmet-async';

// 삭제됨: const API_URL = ...

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
      // 수정됨: api 모듈 사용
      const response = await api.post('/api/admin/login', { id, password });
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