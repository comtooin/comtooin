import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Typography, Button, Box, Paper, CircularProgress, Alert, TextField, Divider, Stack } from '@mui/material'; // Added Stack
import { Edit as EditIcon } from '@mui/icons-material';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { supabase } from '../api'; // 수정됨: 중앙 API 모듈 임포트
import { Helmet } from 'react-helmet-async';

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
          const { data, error: fetchError } = await supabase
            .from('guides')
            .select('*')
            .eq('id', id)
            .single();

          if (fetchError) {
            throw fetchError;
          }
          setTitle(data.title);
          setContent(data.content);
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

    const guideData = { title, content };

    try {
      if (isEditMode) {
        const { error: updateError } = await supabase
          .from('guides')
          .update(guideData)
          .eq('id', id);

        if (updateError) {
          throw updateError;
        }
        setSuccess('가이드가 성공적으로 수정되었습니다.');
                          } else {
                            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                            if (sessionError) throw sessionError;
                            if (!session?.user?.id) throw new Error('로그인 정보가 없습니다.');
                
                            const { error: insertError } = await supabase
                              .from('guides')
                              .insert({ ...guideData, author_user_id: session.user.id });
                      
                  if (insertError) {
                    throw insertError;
                  }
                  setSuccess('가이드가 성공적으로 생성되었습니다.');
                  navigate('/admin/guides');
                }    } catch (err: any) {
      console.error('Supabase save error:', err);
      setError(err.message || '가이드 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 } }}> {/* Adjusted responsive padding and removed border radius */}
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
        
      <Stack spacing={3}> {/* Stack for consistent vertical spacing */}
        {error && <Alert severity="error">{error}</Alert>}
        
        <TextField
          label="제목"
          fullWidth
          variant="outlined"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
        />

        <Box sx={{ minHeight: '400px', mb: 6 }}> {/* Wrapper Box for ReactQuill, minHeight adjusted */}
          <ReactQuill
            theme="snow"
            value={content}
            onChange={setContent}
            style={{ height: '300px' }} // Fixed height for Quill editor
          />
        </Box>
        {success && <Alert severity="success">{success}</Alert>}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}> {/* Adjusted mt */}
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
      </Stack>
    </Paper>
  );
};

export default AdminGuideEditorPage;