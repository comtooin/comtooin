import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, TextField, Button, Box, Paper, IconButton, Grid, Divider, Stack, Alert, MenuItem, CircularProgress, Container, List, ListItem, ListItemText, Chip
} from '@mui/material';
import { 
  PhotoCamera, Delete, Mic as MicIcon, AutoAwesome as AutoAwesomeIcon, EditNote as EditNoteIcon,
  Today as TodayIcon, Assessment as AssessmentIcon, Business as BusinessIcon, History as HistoryIcon,
  Info as InfoIcon
} from '@mui/icons-material';
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
  const [isListening, setIsListening] = useState<'content' | 'processingContent' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // 최근 기록 상태
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [stats, setStats] = useState({ today: 0, monthly: 0, activeCustomers: 0 });

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 1200;
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('이미지 압축 중 오류가 발생했습니다.'));
          }, 'image/jpeg', 0.8);
        };
        img.onerror = () => reject(new Error('이미지 로드 중 오류가 발생했습니다.'));
      };
      reader.onerror = () => reject(new Error('파일 읽기 중 오류가 발생했습니다.'));
    });
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: customerData } = await supabase.from('customers').select('name').order('name', { ascending: true });
      const { data: staffData } = await supabase.from('staff').select('name').order('name', { ascending: true });
      if (customerData) setCustomerOptions(customerData.map(c => c.name));
      if (staffData) setStaffOptions(staffData.map(s => s.name));

      const today = new Date().toISOString().split('T')[0];
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      
      const [todayRes, monthlyRes, recentRes] = await Promise.all([
        supabase.from('requests').select('id', { count: 'exact' }).gte('created_at', today + 'T00:00:00Z'),
        supabase.from('requests').select('id', { count: 'exact' }).gte('created_at', firstDayOfMonth),
        supabase.from('requests').select('*').order('created_at', { ascending: false }).limit(5)
      ]);

      setStats({
        today: todayRes.count || 0,
        monthly: monthlyRes.count || 0,
        activeCustomers: customerData?.length || 0
      });
      setRecentRequests(recentRes.data || []);
    } catch (err: any) {
      console.error("Data fetch error", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVoiceInput = (target: 'content' | 'processingContent') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("이 브라우저는 음성 인식을 지원하지 않습니다.");
    if (isListening) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.onstart = () => setIsListening(target);
    recognition.onend = () => setIsListening(null);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (target === 'content') setContent(prev => prev ? `${prev} ${transcript}` : transcript);
      else setProcessingContent(prev => prev ? `${prev} ${transcript}` : transcript);
    };
    recognition.start();
  };

  const handlePolishText = async (target: 'content' | 'processingContent') => {
    const textToPolish = target === 'content' ? content : processingContent;
    if (!textToPolish.trim()) return setError("정돈할 내용이 없습니다.");
    setLoading(true);
    setError('');
    try {
      const { data, error: functionError } = await supabase.functions.invoke('polish-text', { body: { text: textToPolish } });
      if (functionError) throw functionError;
      if (data?.polishedText) {
        if (target === 'content') setContent(data.polishedText);
        else setProcessingContent(data.polishedText);
      }
    } catch (err: any) {
      setError("AI 정돈 중 오류가 발생했습니다.");
    } finally { setLoading(false); }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (images.length + files.length > 5) return setError('이미지는 최대 5개까지 첨부할 수 있습니다.');
      setImages(prevImages => [...prevImages, ...files]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!customerName || !userName || !content) return setError('필수 항목을 모두 입력해주세요.');
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let uploadedImageUrls: string[] = [];
      if (images.length > 0) {
        const formData = new FormData();
        for (const image of images) {
          const compressedBlob = await compressImage(image);
          formData.append('files', compressedBlob, image.name);
        }
        formData.append('customerName', customerName);
        formData.append('userName', userName);
        const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-daily-log-image', { body: formData });
        if (uploadError) throw uploadError;
        uploadedImageUrls = uploadData?.urls || [];
      }
      const requestPayload = {
        customer_name: customerName, user_name: userName, requester_name: requesterName,
        password: '', content: content, status: processingContent ? 'completed' : 'processing',
        created_at: new Date(workDate).toISOString(), user_email: session?.user?.email, images: uploadedImageUrls,
      };
      const { data: requestData, error: insertError } = await supabase.from('requests').insert([requestPayload]).select();
      if (insertError) throw insertError;
      if (processingContent.trim()) {
        await supabase.from('comments').insert({ request_id: requestData?.[0]?.id, comment: processingContent, user_id: session?.user?.id });
      }
      navigate(`/admin/dashboard`);
    } catch (err: any) { setError(err.message || '저장 중 오류가 발생했습니다.'); } finally { setSubmitting(false); }
  };

  return (
    <Container maxWidth="lg">
      <Helmet><title>업무 기록 | COMTOOIN</title></Helmet>
      
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <EditNoteIcon sx={{ fontSize: '2.2rem', color: 'primary.main' }} />
          <Typography variant="h5" component="h1" fontWeight="bold">업무 기록</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">유지보수 업무 내용을 상세히 기록하고 보관합니다.</Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { label: '오늘 등록', count: stats.today, icon: <TodayIcon color="primary" fontSize="small" />, color: '#607d8b' },
          { label: '이번달 전체', count: stats.monthly, icon: <AssessmentIcon color="success" fontSize="small" />, color: '#2e7d32' },
          { label: '활성 거래처', count: stats.activeCustomers, icon: <BusinessIcon color="info" fontSize="small" />, color: '#0288d1' },
        ].map((item, idx) => (
          <Grid item xs={4} sm={4} key={idx}>
            <Paper 
              variant="outlined" 
              sx={{ 
                p: { xs: 1.5, sm: 2 }, 
                borderLeft: { xs: `4px solid ${item.color}`, sm: `6px solid ${item.color}` }, 
                borderRadius: 2,
                bgcolor: 'background.paper',
                height: '100%'
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                {item.icon}
                <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.8rem' } }}>
                  {item.label}
                </Typography>
              </Stack>
              <Typography variant="h6" fontWeight="bold" sx={{ mt: 0.5, ml: 0.5 }}>
                {item.count}<Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'text.secondary', fontWeight: 'bold' }}>건</Typography>
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={3}>
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, bgcolor: 'background.paper' }}>
                <Typography variant="subtitle1" gutterBottom fontWeight="bold" sx={{ mb: 2.5 }}>기본 정보</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}><TextField label="업무 일자" type="date" fullWidth required variant="outlined" size="small" value={workDate} onChange={(e) => setWorkDate(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField select label="거래처명" fullWidth required variant="outlined" size="small" value={customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={loading || submitting}>
                      {customerOptions.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField select label="작성자" fullWidth required variant="outlined" size="small" value={userName} onChange={(e) => setUserName(e.target.value)} disabled={loading || submitting}>
                      {staffOptions.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                  </Grid>
                </Grid>
              </Paper>

              <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, bgcolor: 'background.paper' }}>
                <Stack spacing={2.5}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="subtitle1" fontWeight="bold">접수 및 처리 내용</Typography>
                    <Stack direction="row" spacing={1}>
                      <Button variant="outlined" size="small" startIcon={<MicIcon />} onClick={() => handleVoiceInput('content')} sx={{ fontSize: '0.75rem' }}>음성</Button>
                      <Button variant="outlined" size="small" color="success" startIcon={<AutoAwesomeIcon />} onClick={() => handlePolishText('content')} sx={{ fontSize: '0.75rem' }}>AI 정돈</Button>
                    </Stack>
                  </Box>
                  <TextField label="요청자 (고객 담당자)" fullWidth variant="outlined" size="small" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} />
                  <TextField label="상세 접수내용 (필수)" multiline rows={4} fullWidth variant="outlined" value={content} onChange={(e) => setContent(e.target.value)} required />
                  <TextField label="처리내용 (선택)" multiline rows={4} fullWidth variant="outlined" value={processingContent} onChange={(e) => setProcessingContent(e.target.value)} placeholder="처리 내용을 입력하면 자동으로 '처리완료' 상태로 저장됩니다." />
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, bgcolor: 'background.paper' }}>
                <Typography variant="subtitle1" gutterBottom fontWeight="bold" sx={{ mb: 2 }}>이미지 첨부</Typography>
                <Button variant="outlined" component="label" startIcon={<PhotoCamera />} fullWidth sx={{ py: 2, borderStyle: 'dashed' }}>
                  파일 선택 (최대 5개)
                  <input type="file" hidden multiple accept="image/*" onChange={handleImageChange} />
                </Button>
                {images.length > 0 && (
                  <Grid container spacing={1.5} sx={{ mt: 1.5 }}>
                    {images.map((img, i) => (
                      <Grid item key={i}><Box sx={{ position: 'relative' }}>
                        <img src={URL.createObjectURL(img)} alt="preview" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                        <IconButton size="small" onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))} sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'white', boxShadow: 1 }}><Delete fontSize="small" /></IconButton>
                      </Box></Grid>
                    ))}
                  </Grid>
                )}
              </Paper>

              {error && <Alert severity="error">{error}</Alert>}
              <Button type="submit" variant="contained" fullWidth size="large" sx={{ py: 1.5, fontWeight: 'bold' }} disabled={submitting}>
                {submitting ? <CircularProgress size={24} color="inherit" /> : "업무 기록 저장하기"}
              </Button>
            </Stack>
          </Box>
        </Grid>

        <Grid item xs={12} md={4}>
          <Stack spacing={3}>
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, bgcolor: 'background.paper' }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <HistoryIcon color="action" /> 최근 등록 이력
              </Typography>
              <List dense>
                {recentRequests.length > 0 ? recentRequests.map((req) => (
                  <ListItem key={req.id} divider sx={{ px: 0 }}>
                    <ListItemText 
                      primary={req.customer_name} 
                      secondary={req.content.substring(0, 30) + '...'} 
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 'bold' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                    <Chip label={req.status === 'completed' ? '완료' : '처리중'} size="small" color={req.status === 'completed' ? 'success' : 'warning'} variant="outlined" sx={{ fontSize: '0.65rem' }} />
                  </ListItem>
                )) : <Typography variant="body2" color="text.secondary">기록이 없습니다.</Typography>}
              </List>
            </Paper>

            <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, bgcolor: 'grey.50', border: '1px dashed', borderColor: 'divider' }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, color: 'text.secondary' }}>
                <InfoIcon fontSize="small" /> 작성 가이드
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8, fontSize: '0.8125rem' }}>
                • 거래처명과 작성자는 필수 선택 사항입니다.<br/>
                • 이미지는 최대 5장까지 업로드 가능합니다.<br/>
                • AI 정돈 기능을 사용하여 메모를 다듬어보세요.<br/>
                • 음성 입력을 통해 더 빠르게 기록할 수 있습니다.
              </Typography>
            </Paper>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
};

export default HomePage;
