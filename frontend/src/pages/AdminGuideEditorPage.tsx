import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Typography, Button, Box, Paper, CircularProgress, Alert, TextField, Divider } from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import axios from 'axios';
import { Helmet } from 'react-helmet-async';

const API_URL = process.env.NODE_ENV === 'production' ? '' : process.env.REACT_APP_API_URL || 'http://localhost:3001';

const AdminGuideEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isEditMode = Boolean(id);

  useEffect(() => {
    if (isEditMode) {
      const fetchGuide = async () => {
        setLoading(true);
        try {
          const response = await axios.get(`${API_URL}/api/guide/${id}`);
          setTitle(response.data.title);
          setContent(response.data.content);
        } catch (err) {
          setError('가이드 내용을 불러오는 중 오류가 발생했습니다.');
        }
        setLoading(false);
      };
      fetchGuide();
    } else {
      setLoading(false);
    }
  }, [id, isEditMode]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
      return;
    }

    const guideData = { title, content };

    try {
      if (isEditMode) {
        await axios.put(`${API_URL}/api/guide/${id}`, guideData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSuccess('가이드가 성공적으로 수정되었습니다.');
      } else {
        await axios.post(`${API_URL}/api/guide`, guideData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSuccess('가이드가 성공적으로 생성되었습니다.');
        navigate('/admin/guides'); // Redirect after creation
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '가이드 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CircularProgress />;

  return (
    <Paper sx={{ p: 3 }}>
      <Helmet>
        <title>{isEditMode ? '가이드 수정' : '새 가이드 작성'}</title>
      </Helmet>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <EditIcon sx={{ mr: 1.5, fontSize: '2rem' }} />
        <Typography variant="h4" component="h1">
          {isEditMode ? '가이드 수정' : '새 가이드 작성'}
        </Typography>
      </Box>
      <Divider sx={{ mb: 3 }} />
        
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        <TextField
          label="제목"
          fullWidth
          variant="outlined"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          sx={{ mb: 2 }}
        />

        <ReactQuill 
          theme="snow" 
          value={content} 
          onChange={setContent} 
          style={{ height: '400px', marginBottom: '70px' }}
        />

        {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button variant="outlined" onClick={() => navigate('/admin/guides')}>
            목록으로 돌아가기
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSave} 
            disabled={saving}
          >
            {saving ? <CircularProgress size={24} /> : '저장하기'}
          </Button>
        </Box>
      </Paper>
  );
};

export default AdminGuideEditorPage;