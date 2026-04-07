import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, TextField, Button, Box, Paper, IconButton, Grid, Divider, Stack, Alert, MenuItem
} from '@mui/material';
import { PhotoCamera, Delete, Assignment as AssignmentIcon } from '@mui/icons-material';
import { supabase } from '../api';
import { Helmet } from 'react-helmet-async';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [customerOptions, setCustomerOptions] = useState<string[]>([]); 
  const [staffOptions, setStaffOptions] = useState<string[]>([]); 
  const [customerName, setCustomerName] = useState('');
  const [userName, setUserName] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [workDate, setWorkDate] = useState(new Date().toISOString().split('T')[0]);
  const [content, setContent] = useState(''); 
  const [processingContent, setProcessingContent] = useState(''); 
  const [images, setImages] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: customerData } = await supabase.from('customers').select('name').order('name', { ascending: true });
        const { data: staffData } = await supabase.from('staff').select('name').order('name', { ascending: true });
        if (customerData) setCustomerOptions(customerData.map(c => c.name));
        if (staffData) setStaffOptions(staffData.map(s => s.name));
      } catch (err: any) {
        console.error("Data fetch error", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (images.length + files.length > 5) {
        setError('이미지는 최대 5개까지 첨부할 수 있습니다.');
        return;
      }
      setImages(prevImages => [...prevImages, ...files]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prevImages => prevImages.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!customerName || !userName || !content) {
      setError('필수 항목을 모두 입력해주세요.');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;
      const userId = session?.user?.id;

      const requestPayload = {
        customer_name: customerName,
        user_name: userName,
        requester_name: requesterName,
        password: '',
        content: content,
        status: processingContent ? 'completed' : 'processing',
        created_at: new Date(workDate).toISOString(),
        user_email: userEmail,
      };

      const { data: requestData, error: insertError } = await supabase.from('requests').insert([requestPayload]).select();
      if (insertError) throw insertError;
      const requestId = requestData?.[0]?.id;

      if (processingContent.trim()) {
        await supabase.from('comments').insert({ request_id: requestId, comment: processingContent, user_id: userId });
      }

      for (const image of images) {
        const fileExtension = image.name.split('.').pop();
        const filePath = `${requestId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
        await supabase.storage.from('uploads').upload(filePath, image);
        const { data: publicUrlData } = supabase.storage.from('uploads').getPublicUrl(filePath);
        if (publicUrlData?.publicUrl) {
          const { data: currentReq } = await supabase.from('requests').select('images').eq('id', requestId).single();
          const newImages = [...(currentReq?.images || []), publicUrlData.publicUrl];
          await supabase.from('requests').update({ images: newImages }).eq('id', requestId);
        }
      }
      navigate(`/admin/dashboard`);
    } catch (err: any) {
      setError(err.message || '저장 중 오류가 발생했습니다.');
    }
  };

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
      <Helmet><title>유지보수 업무내역작성</title></Helmet>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <AssignmentIcon sx={{ mr: 1.5, fontSize: '2rem' }} />
        <Typography variant="h5">유지보수 업무내역작성</Typography>
      </Box>
      <Divider sx={{ my: 2 }} />
      
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={4}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>기본 정보</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}><TextField label="업무 일자" type="date" fullWidth required variant="outlined" size="small" value={workDate} onChange={(e) => setWorkDate(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
              <Grid item xs={12} md={4}>
                <TextField select label="거래처명" fullWidth required variant="outlined" size="small" value={customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={loading}>
                  {customerOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField select label="작성자" fullWidth required variant="outlined" size="small" value={userName} onChange={(e) => setUserName(e.target.value)} disabled={loading}>
                  {staffOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h6">접수내용 (필수)</Typography>
              <TextField 
                label="요청자 (고객 담당자)" 
                fullWidth variant="outlined" size="small"
                value={requesterName} onChange={(e) => setRequesterName(e.target.value)}
              />
              <TextField
                label="상세 접수내용"
                multiline rows={6} fullWidth variant="outlined"
                value={content} onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
                InputProps={{ style: { fontSize: '16px' } }}
              />
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h6">처리내용 (선택)</Typography>
              <TextField
                label="처리내용"
                multiline rows={6} fullWidth variant="outlined"
                value={processingContent} onChange={(e) => setProcessingContent(e.target.value)}
                spellCheck={false}
                InputProps={{ style: { fontSize: '16px' } }}
              />
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>이미지 첨부</Typography>
            <Button variant="outlined" component="label" startIcon={<PhotoCamera />} fullWidth>
              파일 선택
              <input type="file" hidden multiple accept="image/*" onChange={handleImageChange} />
            </Button>
            <Grid container spacing={2} sx={{ mt: 2 }}>
              {images.map((image, index) => (
                <Grid item key={index}>
                  <Box sx={{ position: 'relative' }}>
                    <img src={URL.createObjectURL(image)} alt="preview" style={{ width: 100, height: 100, objectFit: 'cover' }} />
                    <IconButton size="small" onClick={() => handleRemoveImage(index)} sx={{ position: 'absolute', top: 0, right: 0, bgcolor: 'white' }}><Delete fontSize="small" /></IconButton>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" fullWidth size="large">저장하기</Button>
        </Stack>
      </Box>
    </Paper>
  );
};

export default HomePage;
