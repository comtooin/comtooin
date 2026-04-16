import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, Container, Typography, Button, Paper, IconButton, Dialog, DialogTitle, 
  DialogContent, TextField, DialogActions, MenuItem, Select, FormControl, 
  InputLabel, CircularProgress, Alert, Divider, Stack, Chip, useMediaQuery, useTheme,
  Checkbox, FormControlLabel
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
  Notes as NotesIcon,
  Edit as EditIcon,
  AccessTime as AccessTimeIcon
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

  const [staffSearch, setStaffSearch] = useState('');
  const [recentStaffIds, setRecentStaffIds] = useState<string[]>([]);

  // 1. 데이터 로드
  const fetchData = useCallback(async () => {
    const [staffRes, customerRes, recentSchedulesRes] = await Promise.all([
      supabase.from('staff').select('id, name, email').order('name'),
      supabase.from('customers').select('id, name').order('name'),
      supabase.from('schedules').select('staff_id, staff_ids').order('id', { ascending: false }).limit(20)
    ]);

    if (staffRes.data) {
      setStaffList(staffRes.data);
    }
    if (customerRes.data) setCustomerList(customerRes.data);

    // 최근 담당자 5명 추출
    if (recentSchedulesRes.data) {
      const ids: string[] = [];
      recentSchedulesRes.data.forEach(item => {
        if (item.staff_ids && Array.isArray(item.staff_ids)) {
          item.staff_ids.forEach(id => { if (id && !ids.includes(id)) ids.push(id); });
        } else if (item.staff_id && !ids.includes(item.staff_id)) {
          ids.push(item.staff_id);
        }
      });
      setRecentStaffIds(ids.slice(0, 5));
    }
  }, []);

  const fetchSchedules = useCallback(async () => {
    const { data, error } = await supabase.from('schedules').select('*');
    if (error) {
      console.error('Fetch Schedules Error:', error);
      return;
    }
    if (data) {
      const formatted = data.map(item => {
        // FullCalendar는 allDay: true일 때 'YYYY-MM-DD' 형식을 선호함
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
      assignees: staffList.length > 0 ? [staffList[0]] : [],
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
    
    // staff_ids 가 있으면 그것을 사용, 없으면 기존 staff_id 사용
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
    if (!formData.title || !formData.date || formData.assignees.length === 0) return alert('제목, 날짜, 담당자는 필수입니다.');
    setLoading(true);
    setError(null);
    try {
      const startTimeStr = formData.allDay ? `${formData.date}T00:00:00` : `${formData.date}T${formData.startTime}:00`;
      const endTimeStr = formData.allDay ? `${formData.date}T23:59:59` : `${formData.date}T${formData.endTime}:00`;

      // 담당자 정보 합치기
      const assigneeNames = formData.assignees.map(s => s.name).join(', ');
      const assigneeEmails = formData.assignees.map(s => s.email).join(', ');
      const staffIds = formData.assignees.map(s => s.id);

      // 구글 캘린더 동기화
      const syncPayload = {
        method: formData.id ? 'PATCH' : 'POST',
        googleEventId: selectedEvent?.google_event_id,
        title: `[${formData.customer?.name || '업무'}] ${formData.title}`,
        description: `거래처: ${formData.customer?.name || '없음'}\n내용: ${formData.content}\n담당자: ${assigneeNames}`,
        startTime: startTimeStr,
        endTime: endTimeStr,
        allDay: formData.allDay,
        assigneeEmail: assigneeEmails // Edge Function에서 콤마로 구분하여 처리하도록 수정 예정
      };

      const { data: syncData, error: syncError } = await supabase.functions.invoke('google-calendar-sync', {
        body: syncPayload
      });

      if (syncError) {
        console.warn('Google Calendar Sync Error:', syncError.message);
      }

      const scheduleData = {
        title: formData.title,
        content: formData.content,
        staff_id: staffIds[0], // 하위 호환성을 위해 첫 번째 담당자 ID 저장
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
      <Helmet><title>스케줄</title></Helmet>
      
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
      
      {/* 표준 헤더 섹션 */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <CalendarMonthIcon sx={{ fontSize: '2rem', color: 'primary.main' }} />
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

      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 3 }, borderRadius: 3, bgcolor: 'background.paper', boxShadow: '0 4px 20px 0 rgba(0,0,0,0.05)' }}>
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
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          {formData.id ? '일정 수정' : `${formData.date} 일정 등록`}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControlLabel
              control={
                <Checkbox 
                  checked={formData.allDay} 
                  onChange={(e) => setFormData({...formData, allDay: e.target.checked})} 
                />
              }
              label="하루종일"
            />
            
            {!formData.allDay && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="시작시간"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField
                  label="종료시간"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Box>
            )}

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
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block', fontWeight: 'bold' }}>
                담당자 지정
              </Typography>
              
              {/* 선택된 담당자 (상단 고정) */}
              {formData.assignees.length > 0 && (
                <Box sx={{ mb: 2, p: 1, bgcolor: '#e3f2fd', borderRadius: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {formData.assignees.map(s => (
                    <Chip 
                      key={s.id} 
                      label={s.name} 
                      color="primary" 
                      onDelete={() => setFormData({ ...formData, assignees: formData.assignees.filter(as => as.id !== s.id) })}
                    />
                  ))}
                </Box>
              )}

              {/* 필터링된 전체 명단 */}
              <Box sx={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: 1, 
                p: 1.5, 
                border: '1px solid #e0e0e0', 
                borderRadius: 1, 
                bgcolor: '#f9f9f9',
                maxHeight: '200px',
                overflowY: 'auto',
                mb: 1
              }}>
                {staffList
                  .filter(s => {
                    const matchSearch = s.name.toLowerCase().includes(staffSearch.toLowerCase());
                    if (staffSearch.trim() === '') {
                      // 검색어가 없을 때는 최근 담당자 5명만 표시
                      return recentStaffIds.includes(s.id);
                    }
                    return matchSearch;
                  })
                  .map(s => {
                    const isSelected = formData.assignees.some(as => as.id === s.id);
                    if (isSelected) return null; // 선택된 사람은 위에서 보여주므로 아래에선 제외
                    return (
                      <Chip
                        key={s.id}
                        label={s.name}
                        onClick={() => setFormData({ ...formData, assignees: [...formData.assignees, s] })}
                        variant="outlined"
                        sx={{ transition: 'all 0.2s', '&:hover': { bgcolor: '#eceff1' } }}
                      />
                    );
                  })}
              </Box>

              {/* 검색 도구 */}
              <Box>
                <TextField 
                  size="small" 
                  placeholder="담당자 이름 검색..." 
                  value={staffSearch} 
                  onChange={(e) => setStaffSearch(e.target.value)}
                  fullWidth
                />
              </Box>
            </Box>
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
              <Chip 
                label={selectedEvent.all_day ? selectedEvent.start_time.split('T')[0] : `${selectedEvent.start_time.split('T')[0]} ${selectedEvent.start_time.split('T')[1].substring(0, 5)}`} 
                size="small" 
                color="primary" 
                variant="outlined" 
              />
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
                {selectedEvent.all_day ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <AccessTimeIcon color="action" />
                    <Box>
                      <Typography variant="caption" color="text.secondary">시간</Typography>
                      <Typography variant="body1">하루종일</Typography>
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <AccessTimeIcon color="action" />
                    <Box>
                      <Typography variant="caption" color="text.secondary">시간</Typography>
                      <Typography variant="body1">
                        {selectedEvent.start_time.split('T')[1].substring(0, 5)} ~ {selectedEvent.end_time?.split('T')[1].substring(0, 5)}
                      </Typography>
                    </Box>
                  </Box>
                )}
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
            <DialogActions 
              sx={{ 
                p: { xs: 1.5, sm: 2.5 }, 
                bgcolor: 'grey.50',
                justifyContent: 'space-between',
                display: 'flex'
              }}
            >
              <Button 
                onClick={() => handleDelete(selectedEvent.id)}
                color="error" 
                variant="outlined"
                sx={{ 
                  fontWeight: 'bold', 
                  borderRadius: 2,
                  fontSize: { xs: '0.875rem', sm: '0.875rem' },
                  px: { xs: 1.5, sm: 2 },
                  py: { xs: 1, sm: 0.8 },
                  minWidth: 'auto'
                }}
              >
                삭제
              </Button>
              
              <Stack direction="row" spacing={{ xs: 1, sm: 1.5 }}>
                <Button 
                  onClick={() => setDetailOpen(false)}
                  variant="outlined"
                  color="inherit"
                  sx={{ 
                    fontWeight: 'bold', 
                    borderRadius: 2, 
                    bgcolor: 'white',
                    fontSize: { xs: '0.875rem', sm: '0.875rem' },
                    px: { xs: 1.5, sm: 2 },
                    py: { xs: 1, sm: 0.8 },
                    minWidth: 'auto'
                  }}
                >
                  닫기
                </Button>
                
                <Button 
                  startIcon={<EditIcon sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />} 
                  variant="contained" 
                  color="primary" 
                  onClick={handleEdit}
                  sx={{ 
                    fontWeight: 'bold', 
                    borderRadius: 2, 
                    fontSize: { xs: '0.875rem', sm: '0.875rem' },
                    px: { xs: 2, sm: 3 },
                    py: { xs: 1, sm: 0.8 },
                    minWidth: { xs: 'auto', sm: 80 }
                  }}
                >
                  수정
                </Button>
              </Stack>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default AdminSchedulePage;
