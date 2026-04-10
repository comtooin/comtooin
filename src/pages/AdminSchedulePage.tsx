import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, Container, Typography, Button, Paper, IconButton, Dialog, DialogTitle, 
  DialogContent, TextField, DialogActions, MenuItem, Select, FormControl, 
  InputLabel, CircularProgress, Alert, Divider, Stack, Chip, useMediaQuery, useTheme
} from '@mui/material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { 
  Mic as MicIcon, 
  AutoFixHigh as AIPIcon, 
  Event as EventIcon,
  Delete as DeleteIcon,
  CalendarMonth as CalendarMonthIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Notes as NotesIcon
} from '@mui/icons-material';
import { Helmet } from 'react-helmet-async';
import { supabase } from '../api';

// 타입 정의
interface Staff { id: string; name: string; email: string; }
interface Customer { id: string; name: string; }

const AdminSchedulePage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [events, setEvents] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSTTActive, setIsSTTActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 팝업 상태 관리
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  // 폼 데이터 상태
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    assignee: null as Staff | null,
    customer: null as Customer | null,
    date: ''
  });

  // 1. 데이터 로드
  const fetchData = useCallback(async () => {
    const [staffRes, customerRes] = await Promise.all([
      supabase.from('staff').select('id, name, email').order('name'),
      supabase.from('customers').select('id, name').order('name')
    ]);
    if (staffRes.data) {
      setStaffList(staffRes.data);
      if (staffRes.data.length > 0) setFormData(prev => ({ ...prev, assignee: staffRes.data[0] }));
    }
    if (customerRes.data) setCustomerList(customerRes.data);
  }, []);

  const fetchSchedules = useCallback(async () => {
    const { data } = await supabase.from('schedules').select('*');
    if (data) {
      const formatted = data.map(item => ({
        id: item.id,
        title: isMobile ? item.title : `[${item.customer_name || '일반'}] ${item.title}`,
        start: item.start_time,
        extendedProps: { ...item }
      }));
      setEvents(formatted);
    }
  }, [isMobile]);

  useEffect(() => {
    fetchData();
    fetchSchedules();
  }, [fetchData, fetchSchedules]);

  const handleDateClick = (arg: any) => {
    setFormData(prev => ({ ...prev, date: arg.dateStr, title: '', content: '' }));
    setOpen(true);
  };

  const handleEventClick = (info: any) => {
    setSelectedEvent(info.event.extendedProps);
    setDetailOpen(true);
  };

  const handleSTT = () => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) return alert('음성 인식을 지원하지 않는 브라우저입니다.');
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.onstart = () => setIsSTTActive(true);
    recognition.onend = () => setIsSTTActive(false);
    recognition.onresult = (e: any) => setFormData(p => ({ ...p, content: p.content + ' ' + e.results[0][0].transcript }));
    recognition.start();
  };

  const handleAIPolish = async () => {
    if (!formData.content.trim()) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('polish-text', { body: { text: formData.content } });
      if (data?.polishedText) setFormData(p => ({ ...p, content: data.polishedText }));
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.date || !formData.assignee) return alert('제목, 날짜, 담당자는 필수입니다.');
    setLoading(true);
    try {
      const { data: syncData, error: syncError } = await supabase.functions.invoke('google-calendar-sync', {
        body: {
          title: `[${formData.customer?.name || '업무'}] ${formData.title}`,
          description: `거래처: ${formData.customer?.name || '없음'}\n내용: ${formData.content}`,
          startTime: `${formData.date}T09:00:00`,
          assigneeEmail: formData.assignee.email
        }
      });
      if (syncError) {
        let msg = syncError.message;
        if (syncError.context) {
          const body = await syncError.context.json();
          if (body.error) msg = `${body.error} (단계: ${body.step})`;
        }
        throw new Error(msg);
      }
      await supabase.from('schedules').insert([{
        title: formData.title,
        content: formData.content,
        staff_id: formData.assignee.id,
        assignee_name: formData.assignee.name,
        assignee_email: formData.assignee.email,
        customer_id: formData.customer?.id,
        customer_name: formData.customer?.name,
        start_time: formData.date,
        google_event_id: syncData?.googleEventId
      }]);
      alert('일정이 등록되었습니다.');
      setOpen(false);
      fetchSchedules();
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('이 일정을 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) throw error;
      alert('일정이 삭제되었습니다.');
      setDetailOpen(false);
      fetchSchedules();
    } catch (err: any) {
      alert('삭제 중 오류 발생: ' + err.message);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 }, bgcolor: '#f5f7fa', minHeight: '100vh', px: { xs: 1, sm: 2 } }}>
      <Helmet><title>일정 관리</title></Helmet>
      
      <style>{`
        .fc-day-sun .fc-col-header-cell-cushion, 
        .fc-day-sun .fc-daygrid-day-number { color: #d32f2f !important; }
        .fc-day-sat .fc-col-header-cell-cushion, 
        .fc-day-sat .fc-daygrid-day-number { color: #1976d2 !important; }
        .fc-event { cursor: pointer; transition: transform 0.1s; }
        .fc-event:hover { transform: scale(1.02); }
        
        /* 모바일 헤더 겹침 방지 및 줄바꿈 최적화 */
        @media (max-width: 600px) {
          .fc .fc-toolbar {
            display: flex;
            flex-wrap: wrap;
            justify-content: center !important;
            gap: 8px;
            margin-bottom: 1em !important;
          }
          .fc .fc-toolbar-chunk {
            display: flex;
            justify-content: center;
            align-items: center;
          }
          /* 제목을 최상단 중앙에 배치 */
          .fc .fc-toolbar-title { 
            width: 100%; 
            text-align: center; 
            font-size: 1.15rem !important;
            margin-bottom: 2px !important;
          }
          .fc .fc-button { padding: 4px 8px !important; font-size: 0.8rem !important; }
        }
      `}</style>
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <CalendarMonthIcon sx={{ mr: 1.5, fontSize: { xs: '2rem', md: '2.5rem' }, color: 'primary.main' }} />
        <Typography variant={isMobile ? "h5" : "h4"} component="h1" fontWeight="bold">일정 관리</Typography>
      </Box>
      <Divider sx={{ mb: { xs: 2, md: 3 } }} />

      {error && <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-line' }}>{error}</Alert>}

      <Paper elevation={3} sx={{ p: { xs: 1, md: 2 }, borderRadius: 3, bgcolor: '#ffffff' }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
          }}
          buttonText={{
            today: '오늘',
            month: '월',
            week: '주',
            day: '일'
          }}
          height={isMobile ? "auto" : "75vh"}
          aspectRatio={isMobile ? 0.85 : 1.35}
          locale="ko"
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          selectable={true}
          dayMaxEvents={isMobile ? 2 : true}
        />
      </Paper>

      {/* 등록 팝업 */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>{formData.date} 일정 등록</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>거래처 선택</InputLabel>
              <Select
                value={formData.customer?.id || ''}
                label="거래처 선택"
                onChange={(e) => {
                  const cust = customerList.find(c => c.id === e.target.value);
                  setFormData({...formData, customer: cust || null});
                }}
              >
                <MenuItem value="">거래처 없음</MenuItem>
                {customerList.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField fullWidth label="일정 제목" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField fullWidth multiline rows={3} label="상세 메모" value={formData.content} onChange={(e) => setFormData({...formData, content: e.target.value})} />
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <IconButton color={isSTTActive ? "secondary" : "default"} onClick={handleSTT}><MicIcon /></IconButton>
                <IconButton color="primary" onClick={handleAIPolish} disabled={loading}><AIPIcon /></IconButton>
              </Box>
            </Box>
            <FormControl fullWidth>
              <InputLabel>담당자 지정 (Staff)</InputLabel>
              <Select
                value={formData.assignee?.id || ''}
                label="담당자 지정 (Staff)"
                onChange={(e) => {
                  const staff = staffList.find(s => s.id === e.target.value);
                  setFormData({...formData, assignee: staff || null});
                }}
              >
                {staffList.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleSave} disabled={loading} startIcon={loading ? <CircularProgress size={20} /> : <EventIcon />}>
            저장 및 알림 발송
          </Button>
        </DialogActions>
      </Dialog>

      {/* 상세 보기 팝업 */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        {selectedEvent && (
          <>
            <DialogTitle sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              일정 상세
              <Chip label={selectedEvent.start_time} size="small" color="primary" variant="outlined" />
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <BusinessIcon color="action" />
                  <Box>
                    <Typography variant="caption" color="text.secondary">거래처</Typography>
                    <Typography variant="body1" fontWeight="medium">{selectedEvent.customer_name || '미지정'}</Typography>
                  </Box>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <CalendarMonthIcon color="action" />
                  <Box>
                    <Typography variant="caption" color="text.secondary">제목</Typography>
                    <Typography variant="body1" fontWeight="bold">{selectedEvent.title}</Typography>
                  </Box>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <NotesIcon color="action" sx={{ mt: 0.5 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">상세 내용</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{selectedEvent.content || '내용 없음'}</Typography>
                  </Box>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <PersonIcon color="action" />
                  <Box>
                    <Typography variant="caption" color="text.secondary">담당자</Typography>
                    <Typography variant="body1">{selectedEvent.assignee_name}</Typography>
                  </Box>
                </Box>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
              <Button color="error" startIcon={<DeleteIcon />} onClick={() => handleDelete(selectedEvent.id)}>삭제</Button>
              <Button variant="outlined" onClick={() => setDetailOpen(false)}>닫기</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default AdminSchedulePage;
