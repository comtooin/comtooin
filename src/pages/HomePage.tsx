import { format } from 'date-fns';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, TextField, Button, Box, Paper, IconButton, Grid, Divider, Stack, Alert, MenuItem, CircularProgress, Container, List, ListItem, ListItemText, Chip, InputAdornment,
  Autocomplete
} from '@mui/material';
import { 
  PhotoCamera, Delete, Mic as MicIcon, AutoAwesome as AutoAwesomeIcon, EditNote as EditNoteIcon,
  Today as TodayIcon, Assessment as AssessmentIcon, Assignment as AssignmentIcon, History as HistoryIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { supabase, getCurrentStaffId, sendPushNotification } from '../api';
import { Helmet } from 'react-helmet-async';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [customerOptions, setCustomerOptions] = useState<string[]>([]); 
  const [staffOptions, setStaffOptions] = useState<string[]>(() => {
    const storedName = localStorage.getItem('adminName');
    return storedName ? [storedName] : [];
  });
  const [customerName, setCustomerName] = useState('');
  const [userName, setUserName] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [workDate, setWorkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [content, setContent] = useState(''); 
  const [processingContent, setProcessingContent] = useState(''); 
  const [images, setImages] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isListening, setIsListening] = useState<'content' | 'processingContent' | null>(null);
  const [isPolishing, setIsPolishing] = useState<'content' | 'processingContent' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // 최근 기록 상태
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [stats, setStats] = useState({ today: 0, monthly: 0, total: 0 });

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
      const { data: staffData } = await supabase.from('staff').select('name, role').neq('role', 'admin').order('name', { ascending: true });
      if (customerData) setCustomerOptions(customerData.map(c => c.name));
      if (staffData) setStaffOptions(staffData.map(s => s.name));

      const today = format(new Date(), 'yyyy-MM-dd');
      const firstDayOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
      
      const [todayRes, monthlyRes, totalRes, recentRes] = await Promise.all([
        supabase.from('requests').select('id', { count: 'exact' }).gte('created_at', today + 'T00:00:00Z'),
        supabase.from('requests').select('id', { count: 'exact' }).gte('created_at', firstDayOfMonth),
        supabase.from('requests').select('id', { count: 'exact' }),
        supabase.from('requests').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(5)
      ]);

      setStats({
        today: todayRes.count || 0,
        monthly: monthlyRes.count || 0,
        total: totalRes.count || 0
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
    // 로그인한 사용자의 이름을 자동으로 설정
    const storedName = localStorage.getItem('adminName');
    if (storedName) {
      setUserName(storedName);
    }
  }, [fetchData]);

  const [recognitionInstance, setRecognitionInstance] = useState<any>(null);

  const handleVoiceInput = (target: 'content' | 'processingContent') => {
    if (isListening === target) {
      if (recognitionInstance) {
        recognitionInstance.manualStop = true;
        recognitionInstance.stop();
        if (recognitionInstance.silenceTimeout) clearTimeout(recognitionInstance.silenceTimeout);
      }
      setIsListening(null);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("이 브라우저는 음성 인식을 지원하지 않습니다.");
    
    if (recognitionInstance) {
        recognitionInstance.manualStop = true;
        recognitionInstance.stop();
        if (recognitionInstance.silenceTimeout) clearTimeout(recognitionInstance.silenceTimeout);
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = true; 
    recognition.interimResults = false; 
    recognition.manualStop = false;
    recognition.lastProcessedResultIndex = -1;
    
    const resetSilenceTimeout = () => {
      if (recognition.silenceTimeout) clearTimeout(recognition.silenceTimeout);
      recognition.silenceTimeout = setTimeout(() => {
        recognition.manualStop = true;
        recognition.stop();
        setIsListening(null);
      }, 10000); 
    };

    recognition.onstart = () => {
      setIsListening(target);
      resetSilenceTimeout();
    };
    
    recognition.onend = () => {
      if (recognition.silenceTimeout) clearTimeout(recognition.silenceTimeout);
      if (!recognition.manualStop) {
        try { recognition.start(); } catch (e) { setIsListening(null); }
      } else {
        setIsListening(null);
      }
    };

    recognition.onresult = (event: any) => {
      resetSilenceTimeout(); 
      
      const latestIndex = event.results.length - 1;
      if (latestIndex <= recognition.lastProcessedResultIndex) return; // 중복 방지
      recognition.lastProcessedResultIndex = latestIndex;

      const transcript = event.results[latestIndex][0].transcript;
      if (transcript) {
        if (target === 'content') setContent(prev => prev ? `${prev} ${transcript}` : transcript);
        else setProcessingContent(prev => prev ? `${prev} ${transcript}` : transcript);
      }
    };
    
    setRecognitionInstance(recognition);
    recognition.start();
  };

  const handlePolishText = async (target: 'content' | 'processingContent') => {
    const textToPolish = target === 'content' ? content : processingContent;
    if (!textToPolish.trim()) return setError("정돈할 내용이 없습니다.");
    
    setIsPolishing(target);
    setError('');
    try {
      const { data, error: functionError } = await supabase.functions.invoke('polish-text', { 
        body: { text: textToPolish, type: target } 
      });
      if (functionError) throw functionError;
      if (data?.polishedText) {
        if (target === 'content') setContent(data.polishedText);
        else setProcessingContent(data.polishedText);
      }
    } catch (err: any) {
      setError("AI 정돈 중 오류가 발생했습니다.");
    } finally { 
      setIsPolishing(null); 
    }
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
    if (!customerName || !userName || !requesterName || !content) return setError('필수 항목을 모두 입력해주세요.');
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
      
      // 알림 전송 (관리자 제외 모든 직원에게)
      sendPushNotification('새로운 업무기록 등록', `[${customerName}] ${content}`, 'all');

      if (processingContent.trim()) {
        const staffId = await getCurrentStaffId();
        await supabase.from('comments').insert({ 
          request_id: requestData?.[0]?.id, 
          comment: processingContent, 
          user_id: staffId 
        });
      }
      
      // 스케줄 자동 연동 및 구글 캘린더 동기화
      const staffId = await getCurrentStaffId();
      const startTimeStr = `${workDate}T00:00:00`;
      const endTimeStr = `${workDate}T23:59:59`;
      
      const syncPayload = {
        method: 'POST',
        title: `[${customerName}] 업무기록 접수`,
        description: `작성자: ${userName}\n거래처: ${customerName}\n요청자: ${requesterName}\n\n[접수내용]\n${content}\n\n[처리내용]\n${processingContent}`,
        startTime: startTimeStr,
        endTime: endTimeStr,
        allDay: true,
        assigneeEmail: session?.user?.email || ''
      };

      const { data: syncData, error: syncError } = await supabase.functions.invoke('google-calendar-sync', {
        body: syncPayload
      });
      if (syncError) console.warn('Google Calendar Sync Error:', syncError.message);

      const scheduleData = {
        title: `업무기록 접수 (${userName})`,
        content: content,
        staff_id: staffId,
        staff_ids: staffId ? [staffId] : [],
        assignee_name: userName,
        assignee_email: session?.user?.email || '',
        customer_name: customerName,
        start_time: startTimeStr,
        end_time: endTimeStr,
        all_day: true,
        google_event_id: syncData?.googleEventId
      };
      await supabase.from('schedules').insert(scheduleData);

      alert('업무 기록이 성공적으로 저장되었습니다.');
      setContent('');
      setProcessingContent('');
      setImages([]);
      setRequesterName('');
      setCustomerName('');
      fetchData(); // 통계 업데이트
    } catch (err: any) { setError(err.message || '저장 중 오류가 발생했습니다.'); } finally { setSubmitting(false); }
  };

  return (
    <Container maxWidth="lg">
      <Helmet><title>업무 기록 | COMTOOIN</title></Helmet>
      
      <Box sx={{ mb: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <EditNoteIcon sx={{ fontSize: '2.2rem', color: 'primary.main' }} />
          <Typography variant="h5" component="h1" fontWeight="bold">업무 기록</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">유지보수 업무 내용을 상세히 기록하고 보관합니다.</Typography>
      </Box>

      <Divider sx={{ mb: 2.5 }} />

      <Paper variant="outlined" sx={{ mb: 2.5, borderRadius: 2, display: 'flex', overflow: 'hidden', bgcolor: 'background.paper' }}>
        {[
          { label: '금일 기록', shortLabel: '금일', count: stats.today, icon: <TodayIcon fontSize="small" sx={{ color: '#607d8b' }} />, filter: 'today' },
          { label: '이번달 기록', shortLabel: '이번달', count: stats.monthly, icon: <AssessmentIcon fontSize="small" sx={{ color: '#2e7d32' }} />, filter: 'month' },
          { label: '전체 기록', shortLabel: '전체', count: stats.total, icon: <AssignmentIcon fontSize="small" sx={{ color: '#0288d1' }} />, filter: 'all' },
        ].map((item, idx, arr) => (
          <Box 
            key={idx}
            onClick={() => navigate(`/admin/dashboard?period=${item.filter}`)}
            sx={{ 
              flex: 1, 
              p: { xs: 1, sm: 2 }, 
              borderRight: idx < arr.length - 1 ? '1px solid' : 'none',
              borderColor: 'divider',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' }
            }}
          >
            <Stack direction="row" spacing={{ xs: 0.5, sm: 1 }} alignItems="center" justifyContent="center" sx={{ whiteSpace: 'nowrap' }}>
              {item.icon}
              <Typography variant="body2" fontWeight="bold" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                {item.label}
              </Typography>
              <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' }, fontSize: '0.7rem' }}>
                {item.shortLabel}
              </Typography>
              <Typography variant="body1" fontWeight="900" color="text.primary" sx={{ ml: { xs: 0.5, sm: 1 } }}>
                {item.count}
              </Typography>
            </Stack>
          </Box>
        ))}
      </Paper>

      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        <Grid item xs={12} md={8}>
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={{ xs: 1.5, sm: 2 }}>
              <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 1, bgcolor: 'background.paper' }}>
                <Typography variant="subtitle1" gutterBottom fontWeight="bold" sx={{ mb: { xs: 1.5, sm: 2.5 }, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <InfoIcon color="action" sx={{ fontSize: '1.15rem' }} /> 기본 정보
                </Typography>
                <Grid container spacing={{ xs: 1.5, sm: 2 }}>
                  <Grid item xs={12} sm={4}>
                    <TextField 
                      label="업무 일자" 
                      type="date" 
                      fullWidth 
                      required 
                      variant="outlined" 
                      size="small" 
                      value={workDate} 
                      onChange={(e) => setWorkDate(e.target.value)} 
                      InputLabelProps={{ shrink: true }} 
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <TodayIcon fontSize="small" sx={{ pointerEvents: 'none', color: 'action.active' }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        '& input[type="date"]::-webkit-calendar-picker-indicator': {
                          position: 'absolute',
                          right: 0,
                          width: '100%',
                          height: '100%',
                          opacity: 0,
                          cursor: 'pointer',
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Autocomplete
                      freeSolo
                      options={customerOptions}
                      value={customerName}
                      onChange={(event, newValue) => {
                        setCustomerName(newValue || '');
                      }}
                      onInputChange={(event, newInputValue) => {
                        setCustomerName(newInputValue || '');
                      }}
                      disabled={loading || submitting}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="거래처명"
                          required
                          variant="outlined"
                          size="small"
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField select label="작성자" fullWidth required variant="outlined" size="small" value={userName} onChange={(e) => setUserName(e.target.value)} disabled={loading || submitting}>
                      {staffOptions.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                  </Grid>
                </Grid>
              </Paper>

              <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 1, bgcolor: 'background.paper' }}>
                <Stack spacing={{ xs: 1.5, sm: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <AssignmentIcon color="action" sx={{ fontSize: '1.15rem' }} /> 접수 및 처리 내용
                  </Typography>
                  
                  <TextField label="요청자 (고객 담당자)" required fullWidth variant="outlined" size="small" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} />
                  
                  <Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                      <Typography variant="body2" fontWeight="bold" color="text.secondary">접수내용 (필수)</Typography>
                      <Stack direction="row" spacing={1}>
                        <Button 
                          variant="outlined" 
                          size="small" 
                          startIcon={<MicIcon sx={{ fontSize: '1rem !important' }} />} 
                          onClick={() => handleVoiceInput('content')} 
                          sx={{ 
                            fontSize: '0.7rem', py: 0.2, px: 1.2, 
                            minWidth: '75px', whiteSpace: 'nowrap',
                            borderColor: isListening === 'content' ? 'primary.main' : 'divider' 
                          }}
                          color={isListening === 'content' ? 'primary' : 'inherit'}
                          disabled={!!isPolishing}
                        >
                          {isListening === 'content' ? '인식 중...' : '음성'}
                        </Button>
                        <Button 
                          variant="outlined" 
                          size="small" 
                          startIcon={isPolishing === 'content' ? <CircularProgress size={12} color="inherit" /> : <AutoAwesomeIcon sx={{ fontSize: '1rem !important' }} />} 
                          onClick={() => handlePolishText('content')} 
                          sx={{ 
                            fontSize: '0.7rem', py: 0.2, px: 1.2, 
                            minWidth: '85px', whiteSpace: 'nowrap',
                            color: '#673ab7', borderColor: '#673ab7',
                            '&:hover': { bgcolor: 'rgba(103, 58, 183, 0.04)', borderColor: '#512da8' }
                          }}
                          disabled={!!isPolishing || !!isListening}
                        >
                          {isPolishing === 'content' ? '정돈 중...' : 'AI 정돈'}
                        </Button>
                      </Stack>
                    </Box>
                    <TextField 
                      multiline 
                      rows={4} 
                      fullWidth 
                      variant="outlined" 
                      value={content} 
                      onChange={(e) => setContent(e.target.value)} 
                      required 
                      placeholder="업무 요청 내용을 상세히 입력해주세요."
                    />
                  </Box>

                  <Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                      <Typography variant="body2" fontWeight="bold" color="text.secondary">처리내용 (선택)</Typography>
                      <Stack direction="row" spacing={1}>
                        <Button 
                          variant="outlined" 
                          size="small" 
                          startIcon={<MicIcon sx={{ fontSize: '1rem !important' }} />} 
                          onClick={() => handleVoiceInput('processingContent')} 
                          sx={{ 
                            fontSize: '0.7rem', py: 0.2, px: 1.2, 
                            minWidth: '75px', whiteSpace: 'nowrap',
                            borderColor: isListening === 'processingContent' ? 'primary.main' : 'divider' 
                          }}
                          color={isListening === 'processingContent' ? 'primary' : 'inherit'}
                          disabled={!!isPolishing}
                        >
                          {isListening === 'processingContent' ? '인식 중...' : '음성'}
                        </Button>
                        <Button 
                          variant="outlined" 
                          size="small" 
                          startIcon={isPolishing === 'processingContent' ? <CircularProgress size={12} color="inherit" /> : <AutoAwesomeIcon sx={{ fontSize: '1rem !important' }} />} 
                          onClick={() => handlePolishText('processingContent')} 
                          sx={{ 
                            fontSize: '0.7rem', py: 0.2, px: 1.2, 
                            minWidth: '85px', whiteSpace: 'nowrap',
                            color: '#673ab7', borderColor: '#673ab7',
                            '&:hover': { bgcolor: 'rgba(103, 58, 183, 0.04)', borderColor: '#512da8' }
                          }}
                          disabled={!!isPolishing || !!isListening}
                        >
                          {isPolishing === 'processingContent' ? '정돈 중...' : 'AI 정돈'}
                        </Button>
                      </Stack>
                    </Box>
                    <TextField 
                      multiline 
                      rows={4} 
                      fullWidth 
                      variant="outlined" 
                      value={processingContent} 
                      onChange={(e) => setProcessingContent(e.target.value)} 
                      placeholder="처리 내용을 입력하면 자동으로 '처리완료' 상태로 저장됩니다." 
                    />
                  </Box>

                  {/* 콤팩트한 이미지 첨부 영역 */}
                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                      <Button 
                        variant="outlined" 
                        component="label" 
                        startIcon={<PhotoCamera />} 
                        size="small"
                        sx={{ borderRadius: 2, py: 0.5, px: 2, color: 'text.secondary', borderColor: 'divider' }}
                      >
                        이미지 첨부 (최대 5개)
                        <input type="file" hidden multiple accept="image/*" onChange={handleImageChange} />
                      </Button>
                      
                      {images.length > 0 && (
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                          {images.map((img, i) => (
                            <Box key={i} sx={{ position: 'relative', display: 'inline-block' }}>
                              <img src={URL.createObjectURL(img)} alt="preview" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }} />
                              <IconButton 
                                size="small" 
                                onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))} 
                                sx={{ position: 'absolute', top: -6, right: -6, bgcolor: 'background.paper', border: '1px solid #e2e8f0', p: 0.2, '&:hover': { bgcolor: 'error.lighter', color: 'error.main' } }}
                              >
                                <Delete sx={{ fontSize: '0.9rem' }} />
                              </IconButton>
                            </Box>
                          ))}
                        </Stack>
                      )}
                    </Box>
                  </Box>
                </Stack>
              </Paper>

              {error && <Alert severity="error">{error}</Alert>}
              <Button type="submit" variant="contained" fullWidth size="large" sx={{ py: 1.5, fontWeight: 'bold' }} disabled={submitting}>
                {submitting ? <CircularProgress size={24} color="inherit" /> : "업무 기록 저장하기"}
              </Button>
            </Stack>
          </Box>
        </Grid>

        <Grid item xs={12} md={4}>
          <Stack spacing={{ xs: 1.5, sm: 2 }}>
            <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 1, bgcolor: 'background.paper' }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: { xs: 1.5, sm: 2 } }}>
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

            <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 1, bgcolor: 'grey.50', border: '1px dashed', borderColor: 'divider' }}>
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
