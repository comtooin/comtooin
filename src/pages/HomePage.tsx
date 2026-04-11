import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, TextField, Button, Box, Paper, IconButton, Grid, Divider, Stack, Alert, MenuItem, CircularProgress, Tooltip
} from '@mui/material';
import { PhotoCamera, Delete, Assignment as AssignmentIcon, Mic as MicIcon, AutoAwesome as AutoAwesomeIcon, EditNote as EditNoteIcon } from '@mui/icons-material';
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
  const [isPolishing, setIsPolishing] = useState<'content' | 'processingContent' | null>(null);

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

  const handleVoiceInput = (target: 'content' | 'processingContent') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("이 브라우저는 음성 인식을 지원하지 않습니다.");
      return;
    }

    if (isListening) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(target);
    recognition.onend = () => setIsListening(null);
    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error", event.error);
      setIsListening(null);
      if (event.error === 'not-allowed') {
        alert("마이크 사용 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.");
      } else {
        alert("음성 인식 중 오류가 발생했습니다: " + event.error);
      }
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (target === 'content') {
        setContent(prev => prev ? `${prev} ${transcript}` : transcript);
      } else {
        setProcessingContent(prev => prev ? `${prev} ${transcript}` : transcript);
      }
    };

    recognition.start();
  };

  const handlePolishText = async (target: 'content' | 'processingContent') => {
    const textToPolish = target === 'content' ? content : processingContent;
    if (!textToPolish.trim()) {
      setError("정돈할 내용이 없습니다.");
      return;
    }
    setIsPolishing(target);
    setError('');
    try {
      const { data, error: functionError } = await supabase.functions.invoke('polish-text', {
        body: { text: textToPolish },
      });
      if (functionError) throw functionError;
      if (data?.polishedText) {
        if (target === 'content') {
          setContent(data.polishedText);
        } else {
          setProcessingContent(data.polishedText);
        }
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (err: any) {
      console.error("AI Polish error", err);
      setError("AI 정돈 중 오류가 발생했습니다: " + (err.message || "다시 시도해주세요."));
    } finally {
      setIsPolishing(null);
    }
  };

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
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <EditNoteIcon sx={{ mr: 1.5, fontSize: '1.75rem', color: 'primary.main' }} />
        <Typography variant="h5" fontWeight="bold">유지보수 업무내역 작성</Typography>
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
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                <Typography variant="h6">접수내용 (필수)</Typography>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Tooltip title="음성으로 내용을 입력합니다">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={isListening === 'content' ? <CircularProgress size={16} color="inherit" /> : <MicIcon />}
                      onClick={() => handleVoiceInput('content')}
                      disabled={isListening !== null || isPolishing !== null}
                      color={isListening === 'content' ? "secondary" : "primary"}
                    >
                      {isListening === 'content' ? "인식 중..." : "음성 입력"}
                    </Button>
                  </Tooltip>
                  <Tooltip title="AI가 내용을 전문적인 문체로 다듬어줍니다">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={isPolishing === 'content' ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
                      onClick={() => handlePolishText('content')}
                      disabled={isPolishing !== null || isListening !== null || !content.trim()}
                      color="success"
                    >
                      {isPolishing === 'content' ? "정돈 중..." : "AI 정돈"}
                    </Button>
                  </Tooltip>
                </Box>
              </Box>
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
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                <Typography variant="h6">처리내용 (선택)</Typography>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Tooltip title="음성으로 내용을 입력합니다">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={isListening === 'processingContent' ? <CircularProgress size={16} color="inherit" /> : <MicIcon />}
                      onClick={() => handleVoiceInput('processingContent')}
                      disabled={isListening !== null || isPolishing !== null}
                      color={isListening === 'processingContent' ? "secondary" : "primary"}
                    >
                      {isListening === 'processingContent' ? "인식 중..." : "음성 입력"}
                    </Button>
                  </Tooltip>
                  <Tooltip title="AI가 내용을 전문적인 문체로 다듬어줍니다">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={isPolishing === 'processingContent' ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
                      onClick={() => handlePolishText('processingContent')}
                      disabled={isPolishing !== null || isListening !== null || !processingContent.trim()}
                      color="success"
                    >
                      {isPolishing === 'processingContent' ? "정돈 중..." : "AI 정돈"}
                    </Button>
                  </Tooltip>
                </Box>
              </Box>
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
