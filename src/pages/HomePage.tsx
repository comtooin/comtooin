import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, TextField, Button, Box, Paper, IconButton, Grid, Divider, Stack, Alert, MenuItem, CircularProgress, Tooltip, Container
} from '@mui/material';
import { PhotoCamera, Delete, Mic as MicIcon, AutoAwesome as AutoAwesomeIcon, EditNote as EditNoteIcon } from '@mui/icons-material';
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
  const [submitting, setSubmitting] = useState(false);

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
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
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

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;
      const userId = session?.user?.id;

      // 1. 이미지 처리 및 일괄 업로드
      let uploadedImageUrls: string[] = [];
      if (images.length > 0) {
        const formData = new FormData();
        for (const image of images) {
          const compressedBlob = await compressImage(image);
          if (compressedBlob.size > 5 * 1024 * 1024) {
            throw new Error(`이미지 용량이 압축 후에도 5MB를 초과합니다: ${image.name}`);
          }
          formData.append('files', compressedBlob, image.name);
        }
        formData.append('customerName', customerName);
        formData.append('userName', userName);

        const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-daily-log-image', {
          body: formData,
        });

        if (uploadError) throw uploadError;
        if (uploadData?.urls) {
          uploadedImageUrls = uploadData.urls;
        }
      }

      // 2. 요청 저장
      const requestPayload = {
        customer_name: customerName,
        user_name: userName,
        requester_name: requesterName,
        password: '',
        content: content,
        status: processingContent ? 'completed' : 'processing',
        created_at: new Date(workDate).toISOString(),
        user_email: userEmail,
        images: uploadedImageUrls, // 이미지 URL 목록 포함
      };

      const { data: requestData, error: insertError } = await supabase.from('requests').insert([requestPayload]).select();
      if (insertError) throw insertError;
      const requestId = requestData?.[0]?.id;

      // 3. 처리내용이 있으면 댓글로 추가
      if (processingContent.trim()) {
        await supabase.from('comments').insert({ request_id: requestId, comment: processingContent, user_id: userId });
      }

      navigate(`/admin/dashboard`);
    } catch (err: any) {
      setError(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Helmet><title>업무 기록</title></Helmet>
      
      {/* 표준 헤더 섹션 */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <EditNoteIcon sx={{ fontSize: '2rem', color: 'primary.main' }} />
          <Typography variant="h5" component="h1" fontWeight="bold">
            업무 기록
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          현장에서 발생한 유지보수 업무 내용을 상세히 기록해 주세요.
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />
      
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, bgcolor: 'background.paper' }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold" sx={{ mb: 1.5 }}>기본 정보</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}><TextField label="업무 일자" type="date" fullWidth required variant="outlined" size="small" value={workDate} onChange={(e) => setWorkDate(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
              <Grid item xs={12} md={4}>
                <TextField select label="거래처명" fullWidth required variant="outlined" size="small" value={customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={loading || submitting}>
                  {customerOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField select label="작성자" fullWidth required variant="outlined" size="small" value={userName} onChange={(e) => setUserName(e.target.value)} disabled={loading || submitting}>
                  {staffOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, bgcolor: 'background.paper' }}>
            <Stack spacing={2}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">접수내용 (필수)</Typography>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Tooltip title="음성으로 내용을 입력합니다">
                    <span>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={isListening === 'content' ? <CircularProgress size={14} color="inherit" /> : <MicIcon sx={{ fontSize: '1rem' }} />}
                        onClick={() => handleVoiceInput('content')}
                        disabled={isListening !== null || isPolishing !== null || submitting}
                        color={isListening === 'content' ? "secondary" : "primary"}
                        sx={{ fontSize: '0.75rem', py: 0.5 }}
                      >
                        {isListening === 'content' ? "인식 중..." : "음성 입력"}
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title="AI가 내용을 전문적인 문체로 다듬어줍니다">
                    <span>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={isPolishing === 'content' ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon sx={{ fontSize: '1rem' }} />}
                        onClick={() => handlePolishText('content')}
                        disabled={isPolishing !== null || isListening !== null || !content.trim() || submitting}
                        color="success"
                        sx={{ fontSize: '0.75rem', py: 0.5 }}
                      >
                        {isPolishing === 'content' ? "정돈 중..." : "AI 정돈"}
                      </Button>
                    </span>
                  </Tooltip>
                </Box>
              </Box>
              <TextField 
                label="요청자 (고객 담당자)" 
                fullWidth variant="outlined" size="small"
                value={requesterName} onChange={(e) => setRequesterName(e.target.value)}
                disabled={submitting}
              />
              <TextField
                label="상세 접수내용"
                multiline rows={5} fullWidth variant="outlined"
                value={content} onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
                disabled={submitting}
                InputProps={{ style: { fontSize: '16px' } }}
              />
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, bgcolor: 'background.paper' }}>
            <Stack spacing={2}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">처리내용 (선택)</Typography>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Tooltip title="음성으로 내용을 입력합니다">
                    <span>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={isListening === 'processingContent' ? <CircularProgress size={14} color="inherit" /> : <MicIcon sx={{ fontSize: '1rem' }} />}
                        onClick={() => handleVoiceInput('processingContent')}
                        disabled={isListening !== null || isPolishing !== null || submitting}
                        color={isListening === 'processingContent' ? "secondary" : "primary"}
                        sx={{ fontSize: '0.75rem', py: 0.5 }}
                      >
                        {isListening === 'processingContent' ? "인식 중..." : "음성 입력"}
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title="AI가 내용을 전문적인 문체로 다듬어줍니다">
                    <span>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={isPolishing === 'processingContent' ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon sx={{ fontSize: '1rem' }} />}
                        onClick={() => handlePolishText('processingContent')}
                        disabled={isPolishing !== null || isListening !== null || !processingContent.trim() || submitting}
                        color="success"
                        sx={{ fontSize: '0.75rem', py: 0.5 }}
                      >
                        {isPolishing === 'processingContent' ? "정돈 중..." : "AI 정돈"}
                      </Button>
                    </span>
                  </Tooltip>
                </Box>
              </Box>
              <TextField
                label="처리내용"
                multiline rows={5} fullWidth variant="outlined"
                value={processingContent} onChange={(e) => setProcessingContent(e.target.value)}
                spellCheck={false}
                disabled={submitting}
                InputProps={{ style: { fontSize: '16px' } }}
              />
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, bgcolor: 'background.paper' }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold" sx={{ mb: 1.5 }}>이미지 첨부</Typography>
            <Button variant="outlined" component="label" startIcon={<PhotoCamera />} fullWidth sx={{ py: 1.5, borderStyle: 'dashed', fontSize: '0.875rem' }} disabled={submitting}>
              파일 선택 (이미지 파일)
              <input type="file" hidden multiple accept="image/*" onChange={handleImageChange} />
            </Button>
            {images.length > 0 && (
              <Grid container spacing={1.5} sx={{ mt: 1 }}>
                {images.map((image, index) => (
                  <Grid item key={index}>
                    <Box sx={{ position: 'relative' }}>
                      <img src={URL.createObjectURL(image)} alt="preview" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                      <IconButton size="small" onClick={() => handleRemoveImage(index)} sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'white', boxShadow: 1, '&:hover': { bgcolor: '#f5f5f5' } }} disabled={submitting}><Delete fontSize="small" /></IconButton>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>

          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" fullWidth size="large" sx={{ py: 1.2, fontSize: '1rem', fontWeight: 'bold', mt: 1 }} disabled={submitting}>
            {submitting ? <><CircularProgress size={20} color="inherit" sx={{ mr: 1 }} /> 저장 중...</> : "저장하기"}
          </Button>
        </Stack>
      </Box>
    </Container>
  );
};

export default HomePage;
