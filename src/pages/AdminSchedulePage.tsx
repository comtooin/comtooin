import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Box, Container, Typography, Button, Paper, IconButton, Dialog, DialogTitle, 
  DialogContent, TextField, DialogActions, MenuItem, Select, FormControl, 
  InputLabel, CircularProgress, Alert, Divider, Stack, Chip, useMediaQuery, useTheme,
  Checkbox, FormControlLabel, Autocomplete, Grid, Tooltip
} from '@mui/material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { 
  Mic as MicIcon, 
  AutoFixHigh as AIPIcon, 
  Event as EventIcon,
  CalendarMonth as CalendarMonthIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Notes as NotesIcon,
  Edit as EditIcon,
  AccessTime as AccessTimeIcon,
  Today as TodayIcon
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
    id: null as string | null,
    title: '',
    content: '',
    assignees: [] as Staff[],
    customer: null as Customer | null,
    date: '',
    allDay: true,
    startTime: '09:00',
    endTime: '10:00'
  });

  // 통계 계산
  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const monthStr = todayStr.substring(0, 7);

    return {
      today: events.filter(e => {
        const start = typeof e.start === 'string' ? e.start.split('T')[0] : '';
        return start === todayStr;
      }).length,
      monthly: events.filter(e => {
        const start = typeof e.start === 'string' ? e.start : '';
        return start.startsWith(monthStr);
      }).length,
      upcoming: events.filter(e => {
        const start = typeof e.start === 'string' ? e.start.split('T')[0] : '';
        return start > todayStr;
      }).length
    };
  }, [events]);

  // 1. 데이터 로드
  const fetchData = useCallback(async () => {
    const [staffRes, customerRes] = await Promise.all([
      supabase.from('staff').select('id, name, email').order('name'),
      supabase.from('customers').select('id, name').order('name')
    ]);

    if (staffRes.data) setStaffList(staffRes.data);
    if (customerRes.data) setCustomerList(customerRes.data);
  }, []);

  const fetchSchedules = useCallback(async () => {
    const { data, error } = await supabase.from('schedules').select('*');
    if (error) {
      console.error('Fetch Schedules Error:', error);
      return;
    }
    if (data) {
      const formatted = data.map(item => {
        const startStr = item.all_day ? (item.start_time?.includes('T') ? item.start_time.split('T')[0] : item.start_time) : item.start_time;
        const endStr = item.all_day ? undefined : item.end_time;
        
        return {
          id: item.id,
          title: isMobile ? item.title : `[${item.customer_name || '일반'}] ${item.title}`,
          start: startStr,
          end: endStr,
          allDay: item.all_day,
          extendedProps: { ...item }
        };
      });
      setEvents(formatted);
    }
  }, [isMobile]);

  useEffect(() => {
    fetchData();
    fetchSchedules();
  }, [fetchData, fetchSchedules]);

  const handleDateClick = (arg: any) => {
    setFormData({
      id: null,
      date: arg.dateStr,
      title: '',
      content: '',
      assignees: [],
      customer: null,
      allDay: true,
      startTime: '09:00',
      endTime: '10:00'
    });
    setOpen(true);
  };

  const handleEventClick = (info: any) => {
    setSelectedEvent(info.event.extendedProps);
    setDetailOpen(true);
  };

  const handleEdit = () => {
    if (!selectedEvent) return;
    
    let selectedAssignees: Staff[] = [];
    if (selectedEvent.staff_ids && selectedEvent.staff_ids.length > 0) {
      selectedAssignees = staffList.filter(s => selectedEvent.staff_ids.includes(s.id));
    } else if (selectedEvent.staff_id) {
      const single = staffList.find(s => s.id === selectedEvent.staff_id);
      if (single) selectedAssignees = [single];
    }

    setFormData({
      id: selectedEvent.id,
      title: selectedEvent.title,
      content: selectedEvent.content,
      assignees: selectedAssignees,
      customer: customerList.find(c => c.id === selectedEvent.customer_id) || null,
      date: selectedEvent.start_time.split('T')[0],
      allDay: selectedEvent.all_day ?? true,
      startTime: !selectedEvent.all_day && selectedEvent.start_time.includes('T') ? selectedEvent.start_time.split('T')[1].substring(0, 5) : '09:00',
      endTime: !selectedEvent.all_day && selectedEvent.end_time?.includes('T') ? selectedEvent.end_time.split('T')[1].substring(0, 5) : '10:00'
    });
    
    setDetailOpen(false);
    setOpen(true);
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
    if (!formData.title || !formData.date || formData.assignees.length === 0) return alert('제목, 날짜, 멤버는 필수입니다.');
    setLoading(true);
    setError(null);
    try {
      const startTimeStr = formData.allDay ? `${formData.date}T00:00:00` : `${formData.date}T${formData.startTime}:00`;
      const endTimeStr = formData.allDay ? `${formData.date}T23:59:59` : `${formData.date}T${formData.endTime}:00`;

      const assigneeNames = formData.assignees.map(s => s.name).join(', ');
      const assigneeEmails = formData.assignees.map(s => s.email).join(', ');
      const staffIds = formData.assignees.map(s => s.id);

      const syncPayload = {
        method: formData.id ? 'PATCH' : 'POST',
        googleEventId: selectedEvent?.google_event_id,
        title: `[${formData.customer?.name || '업무'}] ${formData.title}`,
        description: `거래처: ${formData.customer?.name || '없음'}\n내용: ${formData.content}\n담당 멤버: ${assigneeNames}`,
        startTime: startTimeStr,
        endTime: endTimeStr,
        allDay: formData.allDay,
        assigneeEmail: assigneeEmails
      };

      const { data: syncData, error: syncError } = await supabase.functions.invoke('google-calendar-sync', {
        body: syncPayload
      });

      if (syncError) console.warn('Google Calendar Sync Error:', syncError.message);

      const scheduleData = {
        title: formData.title,
        content: formData.content,
        staff_id: staffIds[0],
        staff_ids: staffIds,
        assignee_name: assigneeNames,
        assignee_email: assigneeEmails,
        customer_id: formData.customer?.id,
        customer_name: formData.customer?.name,
        start_time: startTimeStr,
        end_time: endTimeStr,
        all_day: formData.allDay,
        google_event_id: syncData?.googleEventId || selectedEvent?.google_event_id
      };

      if (formData.id) {
        const { error: updateError } = await supabase.from('schedules').update(scheduleData).eq('id', formData.id);
        if (updateError) throw updateError;
        alert('일정이 수정되었습니다.');
      } else {
        const { error: insertError } = await supabase.from('schedules').insert([scheduleData]);
        if (insertError) throw insertError;
        alert('일정이 등록되었습니다.');
      }

      await fetchSchedules();
      setOpen(false);
    } catch (err: any) {
      console.error('Save Schedule Error:', err);
      setError(err.message || '일정 저장 중 오류가 발생했습니다.');
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
    <Container maxWidth="lg">
      <Helmet><title>스케줄 | COMTOOIN</title></Helmet>
      
      <style>{`
        .fc-day-sun .fc-col-header-cell-cushion, 
        .fc-day-sun .fc-daygrid-day-number { color: #d32f2f !important; }
        .fc-day-sat .fc-col-header-cell-cushion, 
        .fc-day-sat .fc-daygrid-day-number { color: #1976d2 !important; }
        .fc-event { cursor: pointer; transition: transform 0.1s; }
        .fc-event:hover { transform: scale(1.02); }
        
        @media (max-width: 600px) {
          .fc .fc-toolbar { display: flex; flex-wrap: wrap; justify-content: center !important; gap: 8px; margin-bottom: 1em !important; }
          .fc .fc-toolbar-title { width: 100%; text-align: center; font-size: 1.15rem !important; margin-bottom: 2px !important; }
          .fc .fc-button { padding: 4px 8px !important; font-size: 0.8rem !important; }
        }
      `}</style>
      
      {/* 표준 헤더 섹션 */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <CalendarMonthIcon sx={{ fontSize: '2.2rem', color: 'primary.main' }} />
          <Typography variant="h5" component="h1" fontWeight="bold">
            스케줄
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          유지보수 일정 및 사내 주요 이벤트를 통합 관리합니다.
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {error && <Alert severity="error" sx={{ mb: 3, whiteSpace: 'pre-line' }}>{error}</Alert>}

      {/* 상단 요약 위젯 섹션 */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { label: '오늘 일정', count: stats.today, icon: <TodayIcon color="primary" fontSize="small" />, color: '#607d8b' },
          { label: '이번달 전체', count: stats.monthly, icon: <CalendarMonthIcon color="success" fontSize="small" />, color: '#2e7d32' },
          { label: '예정된 업무', count: stats.upcoming, icon: <EventIcon color="info" fontSize="small" />, color: '#0288d1' },
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

      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 3 }, borderRadius: 3, bgcolor: 'background.paper', boxShadow: '0 4px 20px 0 rgba(0,0,0,0.05)' }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
          buttonText={{ today: '오늘', month: '월', week: '주', day: '일' }}
          events={events}
          height={isMobile ? "auto" : "70vh"}
          aspectRatio={isMobile ? 0.85 : 1.35}
          locale="ko"
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          selectable={true}
          dayMaxEvents={isMobile ? 2 : true}
        />
      </Paper>

      {/* 등록 팝업 */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          {formData.id ? '일정 수정' : `${formData.date} 일정 등록`}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ pt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4} sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControlLabel control={<Checkbox checked={formData.allDay} onChange={(e) => setFormData({...formData, allDay: e.target.checked})} />} label="하루종일" />
              </Grid>
              <Grid item xs={12} md={8}>
                {!formData.allDay && (
                  <Stack direction="row" spacing={2}>
                    <TextField label="시작시간" type="time" value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} InputLabelProps={{ shrink: true }} fullWidth size="small" />
                    <TextField label="종료시간" type="time" value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} InputLabelProps={{ shrink: true }} fullWidth size="small" />
                  </Stack>
                )}
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
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
              </Grid>
              <Grid item xs={12} md={8}>
                <TextField fullWidth label="일정 제목" size="small" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField fullWidth multiline rows={4} label="상세 메모" value={formData.content} onChange={(e) => setFormData({...formData, content: e.target.value})} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Tooltip title="음성 입력"><IconButton color={isSTTActive ? "secondary" : "default"} onClick={handleSTT}><MicIcon /></IconButton></Tooltip>
                    <Tooltip title="AI 문장 정돈"><IconButton color="primary" onClick={handleAIPolish} disabled={loading}><AIPIcon /></IconButton></Tooltip>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 'bold' }}>담당 멤버 지정</Typography>
                <Autocomplete
                  multiple id="staff-autocomplete" options={staffList} getOptionLabel={(option) => option.name} value={formData.assignees}
                  onChange={(event, newValue) => setFormData({ ...formData, assignees: newValue })}
                  isOptionEqualToValue={(option, value) => option.id === value.id} filterSelectedOptions
                  renderInput={(params) => <TextField {...params} size="small" placeholder="멤버 이름 검색..." variant="outlined" />}
                  renderTags={(value, getTagProps) => value.map((option, index) => <Chip label={option.name} size="small" color="primary" {...getTagProps({ index })} />)}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleSave} disabled={loading} startIcon={loading ? <CircularProgress size={20} /> : <EventIcon />}>
            {formData.id ? '수정 사항 저장' : '저장 및 알림 발송'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 상세 보기 팝업 */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        {selectedEvent && (
          <>
            <DialogTitle sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              일정 상세
              <Chip label={selectedEvent.all_day ? selectedEvent.start_time.split('T')[0] : `${selectedEvent.start_time.split('T')[0]} ${selectedEvent.start_time.split('T')[1].substring(0, 5)}`} size="small" color="primary" variant="outlined" />
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <AccessTimeIcon color="action" />
                  <Box>
                    <Typography variant="caption" color="text.secondary">시간</Typography>
                    <Typography variant="body1">{selectedEvent.all_day ? '하루종일' : `${selectedEvent.start_time.split('T')[1].substring(0, 5)} ~ ${selectedEvent.end_time?.split('T')[1].substring(0, 5)}`}</Typography>
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
                    <Typography variant="caption" color="text.secondary">담당 멤버</Typography>
                    <Typography variant="body1">{selectedEvent.assignee_name}</Typography>
                  </Box>
                </Box>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: { xs: 1.5, sm: 2.5 }, bgcolor: 'grey.50', justifyContent: 'space-between', display: 'flex' }}>
              <Button onClick={() => handleDelete(selectedEvent.id)} color="error" variant="outlined" sx={{ fontWeight: 'bold', borderRadius: 2 }}>삭제</Button>
              <Stack direction="row" spacing={1.5}>
                <Button onClick={() => setDetailOpen(false)} variant="outlined" color="inherit" sx={{ fontWeight: 'bold', borderRadius: 2, bgcolor: 'white' }}>닫기</Button>
                <Button variant="contained" color="primary" onClick={handleEdit} sx={{ fontWeight: 'bold', borderRadius: 2 }}>수정</Button>
              </Stack>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default AdminSchedulePage;
