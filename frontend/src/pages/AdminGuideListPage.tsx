import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Button, Box, Paper, List, ListItem, ListItemText, ListItemSecondaryAction, IconButton, CircularProgress, Alert, Divider 
} from '@mui/material';
import { Edit, Delete, ListAlt as ListAltIcon } from '@mui/icons-material';
import axios from 'axios';
import { Helmet } from 'react-helmet-async';

const API_URL = process.env.NODE_ENV === 'production' ? '' : process.env.REACT_APP_API_URL || 'http://localhost:3001';

interface IGuide {
  id: number;
  title: string;
  content: string;
}

const AdminGuideListPage: React.FC = () => {
  const [guides, setGuides] = useState<IGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchGuides = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/guide`);
      setGuides(response.data);
    } catch (err) {
      setError('가이드 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuides();
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm(`${id}번 가이드를 정말로 삭제하시겠습니까?`)) return;

    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/guide/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGuides(guides.filter(g => g.id !== id));
      alert('가이드가 삭제되었습니다.');
    } catch (err) {
      alert('가이드 삭제 중 오류가 발생했습니다.');
    }
  };

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <>
      <Helmet>
        <title>가이드 관리</title>
      </Helmet>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <ListAltIcon sx={{ mr: 1.5, fontSize: '2rem' }} />
          <Typography variant="h4" component="h1">
            가이드 관리
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => navigate('/admin/guide/new')}>
          새 가이드 작성
        </Button>
      </Box>
      <Divider sx={{ mb: 3 }} />
      <Paper>
        <List>
          {guides.map(guide => (
            <ListItem key={guide.id} divider>
              <ListItemText primary={guide.title} secondary={`ID: ${guide.id}`} />
              <ListItemSecondaryAction>
                <IconButton edge="end" aria-label="edit" onClick={() => navigate(`/admin/guide/edit/${guide.id}`)}>
                  <Edit />
                </IconButton>
                <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(guide.id)}>
                  <Delete />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Paper>
    </>
  );
};

export default AdminGuideListPage;
