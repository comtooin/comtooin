import { format } from 'date-fns';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Box, Container, Typography, Button, Paper, IconButton, Dialog, DialogTitle, 
  DialogContent, TextField, DialogActions, MenuItem, Select, FormControl, 
  InputLabel, Alert, Divider, Stack, Chip, useMediaQuery, useTheme,
  Checkbox, FormControlLabel, Autocomplete, Grid, Tooltip, CircularProgress
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
  AccessTime as AccessTimeIcon,
  Today as TodayIcon
} from '@mui/icons-material';
import { Helmet } from 'react-helmet-async';
import { supabase, sendPushNotification } from '../api';
import { useVoiceTyping } from '../hooks/useVoiceTyping';

// 타입 정의
interface Staff { id: string; name: string; email: string; }
interface Customer { id: string; name: string; }

// 한국 공휴일 매핑 테이블 (2024년 ~ 2028년)
const KOREAN_HOLIDAYS: Record<string, string> = {
  // 2024년
  '2024-01-01': '신정',
  '2024-02-09': '설날연휴',
  '2024-02-10': '설날',
  '2024-02-11': '설날연휴',
  '2024-02-12': '대체공휴일',
  '2024-03-01': '삼일절',
  '2024-04-10': '선거일',
  '2024-05-05': '어린이날',
  '2024-05-06': '대체공휴일',
  '2024-05-15': '부처님오신날',
  '2024-06-06': '현충일',
  '2024-08-15': '광복절',
  '2024-09-16': '추석연휴',
  '2024-09-17': '추석',
  '2024-09-18': '추석연휴',
  '2024-10-03': '개천절',
  '2024-10-09': '한글날',
  '2024-12-25': '성탄절',

  // 2025년
  '2025-01-01': '신정',
  '2025-01-28': '설날연휴',
  '2025-01-29': '설날',
  '2025-01-30': '설날연휴',
  '2025-03-01': '삼일절',
  '2025-03-03': '대체공휴일',
  '2025-05-05': '어린이날/석탄일',
  '2025-05-06': '대체공휴일',
  '2025-06-06': '현충일',
  '2025-08-15': '광복절',
  '2025-10-03': '개천절',
  '2025-10-05': '추석연휴',
  '2025-10-06': '추석',
  '2025-10-07': '추석연휴',
  '2025-10-08': '대체공휴일',
  '2025-10-09': '한글날',
  '2025-12-25': '성탄절',

  // 2026년
  '2026-01-01': '신정',
  '2026-02-16': '설날연휴',
  '2026-02-17': '설날',
  '2026-02-18': '설날연휴',
  '2026-03-01': '삼일절',
  '2026-03-02': '대체공휴일',
  '2026-05-05': '어린이날',
  '2026-05-24': '부처님오신날',
  '2026-05-25': '대체공휴일',
  '2026-06-06': '현충일',
  '2026-08-15': '광복절',
  '2026-08-17': '대체공휴일',
  '2026-09-24': '추석연휴',
  '2026-09-25': '추석',
  '2026-09-26': '추석연휴',
  '2026-09-28': '대체공휴일',
  '2026-10-03': '개천절',
  '2026-10-05': '대체공휴일',
  '2026-10-09': '한글날',
  '2026-12-25': '성탄절',

  // 2027년
  '2027-01-01': '신정',
  '2027-02-06': '설날연휴',
  '2027-02-07': '설날',
  '2027-02-08': '설날연휴',
  '2027-02-09': '대체공휴일',
  '2027-03-01': '삼일절',
  '2027-05-05': '어린이날',
  '2027-05-13': '부처님오신날',
  '2027-06-06': '현충일',
  '2027-08-15': '광복절',
  '2027-08-16': '대체공휴일',
  '2027-09-14': '추석연휴',
  '2027-09-15': '추석',
  '2027-09-16': '추석연휴',
  '2027-10-03': '개천절',
  '2027-10-04': '대체공휴일',
  '2027-10-09': '한글날',
  '2027-10-11': '대체공휴일',
  '2027-12-25': '성탄절',

  // 2028년
  '2028-01-01': '신정',
  '2028-01-26': '설날연휴',
  '2028-01-27': '설날',
  '2028-01-28': '설날연휴',
  '2028-03-01': '삼일절',
  '2028-05-02': '부처님오신날',
  '2028-05-05': '어린이날',
  '2028-06-06': '현충일',
  '2028-08-15': '광복절',
  '2028-10-02': '추석연휴',
  '2028-10-03': '개천절/추석',
  '2028-10-04': '추석연휴',
  '2028-10-05': '대체공휴일',
  '2028-10-09': '한글날',
  '2028-12-25': '성탄절',
};

const AdminSchedulePage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [events, setEvents] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const voiceRecorder = useVoiceTyping({
    onTranscriptionComplete: (text) => {
      setFormData(p => ({ ...p, content: p.content + (p.content ? ' ' : '') + text }));
    },
    promptText: "컴투인, 유지보수, 일정등록, 스케줄, 담당자, 거래처, 업무기록, 방문점검"
  });

  useEffect(() => {
    if (voiceRecorder.error) {
      alert(voiceRecorder.error);
      voiceRecorder.setError(null);
    }
  }, [voiceRecorder.error, voiceRecorder.setError, voiceRecorder]);
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
    const todayStr = format(now, 'yyyy-MM-dd');
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
      supabase.from('staff').select('id, name, email, role').neq('role', 'admin').order('name'),
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
    if (voiceRecorder.isListening) {
      voiceRecorder.stopRecording(false);
    } else {
      voiceRecorder.startRecording();
    }
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
        
        // 새 스케줄 알림 전송 (지정된 멤버에게)
        if (staffIds.length > 0) {
          sendPushNotification('새로운 일정 등록', `[${formData.title}] 일정이 배정되었습니다.`, staffIds, window.location.origin + '/admin/schedule');
        }
      }

      await fetchSchedules();
      setOpen(false);
    } catch (err: any) {
      console.error('Save Schedule Error:', err);
      setError(err.message || '일정 저장 중 오류가 발생했습니다.');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('일정을 삭제하시겠습니까?')) return;
    setLoading(true);
    try {
      // 구글 캘린더 연동 삭제가 필요한 경우 처리
      if (selectedEvent?.google_event_id) {
        const { error: syncError } = await supabase.functions.invoke('google-calendar-sync', {
          body: {
            method: 'DELETE',
            googleEventId: selectedEvent.google_event_id
          }
        });
        if (syncError) {
          console.warn('Google Calendar Sync Delete Error:', syncError.message);
        }
      }

      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) throw error;
      alert('일정이 삭제되었습니다.');
      setDetailOpen(false);
      fetchSchedules();
    } catch (err: any) {
      alert('일정 삭제 중 오류 발생: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg">
      <Helmet><title>스케줄 | COMTOOIN</title></Helmet>
      
      <style>{`
        /* 캘린더 전체 테두리 및 격자 */
        .fc {
          --fc-border-color: #e2e8f0 !important;
          font-family: inherit !important;
        }
        .fc-theme-standard .fc-scrollgrid {
          border: 1px solid #e2e8f0 !important;
          border-radius: 6px !important;
          overflow: hidden !important;
        }
        
        /* 요일 헤더 영역 */
        .fc .fc-col-header-cell {
          background-color: #f8fafc !important;
          padding: 8px 0 !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }
        .fc .fc-col-header-cell-cushion {
          font-size: 0.75rem !important;
          font-weight: 700 !important;
          color: #475569 !important;
          text-decoration: none !important;
          letter-spacing: 0.05em !important;
        }
        
        /* 날짜 숫자 */
        .fc .fc-daygrid-day-number {
          font-size: 0.75rem !important;
          font-weight: 600 !important;
          color: #64748b !important;
          text-decoration: none !important;
          padding: 6px 8px !important;
        }
        
        /* 토요일/일요일/공휴일 색상 */
        .fc-day-sun .fc-col-header-cell-cushion, 
        .fc-day-sun .fc-daygrid-day-number { color: #ef4444 !important; }
        .fc-day-sat .fc-col-header-cell-cushion, 
        .fc-day-sat .fc-daygrid-day-number { color: #2563eb !important; }
        .fc-holiday .fc-daygrid-day-number { color: #ef4444 !important; }
        
        /* 오늘 날짜 셀 하이라이트 */
        .fc .fc-day-today {
          background-color: rgba(51, 65, 85, 0.04) !important;
        }
        .fc .fc-day-today .fc-daygrid-day-number {
          color: #334155 !important;
          font-weight: 800 !important;
        }
        
        /* 헤더 툴바 버튼 스타일 변경 */
        .fc .fc-toolbar-title {
          font-size: 1.2rem !important;
          font-weight: 700 !important;
          color: #0f172a !important;
        }
        .fc .fc-button-primary {
          background-color: #ffffff !important;
          border-color: #cbd5e1 !important;
          color: #334155 !important;
          font-weight: 600 !important;
          font-size: 0.75rem !important;
          border-radius: 4px !important;
          text-transform: none !important;
          box-shadow: none !important;
          padding: 5px 10px !important;
          transition: all 0.15s ease-in-out !important;
        }
        .fc .fc-button-primary:hover {
          background-color: #f8fafc !important;
          border-color: #94a3b8 !important;
          color: #1e293b !important;
        }
        .fc .fc-button-primary:active, 
        .fc .fc-button-primary:focus, 
        .fc .fc-button-primary.fc-button-active {
          background-color: #f1f5f9 !important;
          border-color: #64748b !important;
          color: #0f172a !important;
          box-shadow: none !important;
        }
        .fc .fc-button-primary:disabled {
          background-color: #ffffff !important;
          border-color: #e2e8f0 !important;
          color: #cbd5e1 !important;
          opacity: 0.6 !important;
        }
        
        /* 일정 바(블록) 스타일 - 고대비 솔리드 스타일 */
        .fc-daygrid-block-event {
          background-color: #475569 !important;
          color: #ffffff !important;
          border-radius: 4px !important;
          border: none !important;
          padding: 3px 6px !important;
          margin: 2px 4px !important;
          transition: all 0.15s ease-in-out !important;
          cursor: pointer !important;
        }
        .fc-daygrid-block-event:hover {
          background-color: #334155 !important;
          transform: translateY(-1px) !important;
        }
        .fc-daygrid-block-event .fc-event-title {
          font-size: 0.75rem !important;
          font-weight: 700 !important;
          color: #ffffff !important;
        }
        
        /* 일반/시간선 일정(점) 스타일 - 고대비 솔리드 스타일로 변환 */
        .fc-daygrid-dot-event {
          background-color: #475569 !important;
          color: #ffffff !important;
          border-radius: 4px !important;
          border: none !important;
          padding: 3px 6px !important;
          margin: 2px 4px !important;
          transition: all 0.15s ease-in-out !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
        }
        .fc-daygrid-dot-event:hover {
          background-color: #334155 !important;
          transform: translateY(-1px) !important;
        }
        .fc-daygrid-dot-event .fc-event-title {
          font-size: 0.75rem !important;
          font-weight: 700 !important;
          color: #ffffff !important;
        }
        .fc-daygrid-dot-event .fc-event-time {
          font-size: 0.7rem !important;
          font-weight: 700 !important;
          color: rgba(255, 255, 255, 0.85) !important;
          margin-right: 6px !important;
        }
        .fc-daygrid-event-dot {
          display: none !important;
        }
        
        /* 더보기 버튼 */
        .fc .fc-more-link {
          font-size: 0.65rem !important;
          font-weight: 700 !important;
          color: #334155 !important;
          text-decoration: none !important;
          padding-left: 4px !important;
        }
        
        @media (max-width: 600px) {
          /* 모바일에서 툴바 간격 조율 및 단일 행 유지 */
          .fc .fc-toolbar { 
            display: flex !important;
            flex-direction: row !important;
            justify-content: space-between !important; 
            align-items: center !important;
            margin-bottom: 0.6em !important; 
            gap: 4px !important;
            flex-wrap: nowrap !important;
          }
          .fc .fc-toolbar-title { 
            font-size: 0.95rem !important; 
            font-weight: 800 !important;
            text-align: center !important;
            width: auto !important;
            margin-bottom: 0 !important;
          }
          .fc .fc-button { 
            padding: 3px 6px !important; 
            font-size: 0.7rem !important; 
          }
          /* 모바일에서 날짜 셀 내부 패딩 및 크기 축소 */
          .fc .fc-daygrid-day-number {
            padding: 2px 4px !important;
            font-size: 0.7rem !important;
          }
          /* 모바일에서 요일 셀 패딩 축소 */
          .fc .fc-col-header-cell {
            padding: 4px 0 !important;
          }
          .fc .fc-col-header-cell-cushion {
            font-size: 0.65rem !important;
          }
          /* 모바일에서 일정 뱃지 높이와 패딩 압축 */
          .fc-daygrid-block-event, .fc-daygrid-dot-event {
            padding: 1px 3px !important;
            margin: 1px 2px !important;
            border-radius: 2px !important;
          }
          .fc-daygrid-block-event .fc-event-title,
          .fc-daygrid-dot-event .fc-event-title {
            font-size: 0.65rem !important;
            line-height: 1.1 !important;
          }
          .fc-daygrid-dot-event .fc-event-time {
            font-size: 0.6rem !important;
            margin-right: 2px !important;
          }
          /* 공휴일 라벨 크기 축소 */
          .fc-holiday-label {
            font-size: 0.55rem !important;
            padding-left: 2px !important;
          }
        }
      `}</style>
      
      <Helmet><title>스케줄 관리 | COMTOOIN</title></Helmet>
      
      <Box sx={{ mb: { xs: 1.5, sm: 2, md: 2.5 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={{ xs: 1, sm: 1.5, md: 2 }} mb={{ xs: 0.25, sm: 0.5, md: 1 }}>
          <Stack direction="row" alignItems="center" spacing={{ xs: 1, sm: 1.25, md: 1.5 }}>
            <CalendarMonthIcon sx={{ fontSize: { xs: '1.6rem', sm: '1.9rem', md: '2.2rem' }, color: 'primary.main' }} />
            <Typography component="h1" sx={{ fontWeight: 'bold', fontSize: { xs: '1.2rem', sm: '1.35rem', md: '1.5rem' } }}>
              스케줄
            </Typography>
          </Stack>
        </Stack>
        <Typography sx={{ color: 'text.secondary', fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' }, lineHeight: 1.4 }}>
          유지보수 일정 및 사내 주요 이벤트를 통합 관리합니다.
        </Typography>
      </Box>

      <Divider sx={{ mb: { xs: 1.5, sm: 2, md: 2.5 } }} />

      {error && <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-line' }}>{error}</Alert>}

      <Grid container spacing={{ xs: 1, sm: 1.5 }} sx={{ mb: 2.5 }}>
        {[
          { 
            label: '금일 일정', 
            count: stats.today, 
            icon: <TodayIcon sx={{ fontSize: { xs: 13, sm: 20 }, color: '#3b82f6' }} />, 
            bgColor: 'rgba(59, 130, 246, 0.08)' 
          },
          { 
            label: '이번달 일정', 
            count: stats.monthly, 
            icon: <CalendarMonthIcon sx={{ fontSize: { xs: 13, sm: 20 }, color: '#10b981' }} />, 
            bgColor: 'rgba(16, 185, 129, 0.08)' 
          },
          { 
            label: '예정된 일정', 
            count: stats.upcoming, 
            icon: <EventIcon sx={{ fontSize: { xs: 13, sm: 20 }, color: '#f59e0b' }} />, 
            bgColor: 'rgba(245, 158, 11, 0.08)' 
          },
        ].map((item, idx) => (
          <Grid item xs={4} key={idx}>
            <Paper 
              variant="outlined" 
              sx={{ 
                p: { xs: 1, sm: 1.25 },
                borderRadius: 1,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.04)',
                  borderColor: 'primary.light',
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1.5 } }}>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: { xs: 24, sm: 38 }, 
                    height: { xs: 24, sm: 38 }, 
                    borderRadius: 1, 
                    bgcolor: item.bgColor,
                    flexShrink: 0
                  }}
                >
                  {item.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography 
                    variant="caption" 
                    noWrap
                    sx={{ 
                      fontSize: { xs: '0.625rem', sm: '0.7rem' },
                      fontWeight: 600,
                      color: 'text.secondary',
                      display: 'block',
                      mb: 0.1
                    }}
                  >
                    {item.label}
                  </Typography>
                  <Typography 
                    sx={{ 
                      fontSize: { xs: '0.95rem', sm: '1.15rem' },
                      fontWeight: 800,
                      color: 'text.primary',
                      lineHeight: 1
                    }}
                  >
                    {item.count}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 3 }, borderRadius: 1, bgcolor: 'background.paper', boxShadow: '0 4px 20px 0 rgba(0,0,0,0.05)' }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={isMobile ? {
            left: 'prev,next',
            center: 'title',
            right: 'today'
          } : {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
          }}
          buttonText={{ today: '오늘', month: '월', week: '주', day: '일' }}
          events={events}
          height={isMobile ? "480px" : "70vh"}
          aspectRatio={isMobile ? 1.05 : 1.35}
          locale="ko"
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          selectable={true}
          dayMaxEvents={isMobile ? 2 : true}
          dayCellContent={(arg) => arg.dayNumberText.replace('일', '')}
          dayCellDidMount={(info) => {
            const year = info.date.getFullYear();
            const month = String(info.date.getMonth() + 1).padStart(2, '0');
            const day = String(info.date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const holidayName = KOREAN_HOLIDAYS[dateStr];
            
            if (holidayName) {
              info.el.classList.add('fc-holiday');
              
              if (!info.el.querySelector('.fc-holiday-label')) {
                const label = document.createElement('div');
                label.className = 'fc-holiday-label';
                label.innerText = holidayName;
                label.style.color = '#d32f2f';
                label.style.fontSize = '0.65rem';
                label.style.fontWeight = 'bold';
                label.style.textAlign = 'left';
                label.style.paddingLeft = '6px';
                label.style.whiteSpace = 'nowrap';
                label.style.overflow = 'hidden';
                label.style.textOverflow = 'ellipsis';
                
                const topEl = info.el.querySelector('.fc-daygrid-day-top');
                if (topEl) {
                  topEl.appendChild(label);
                  (topEl as HTMLElement).style.display = 'flex';
                  (topEl as HTMLElement).style.flexDirection = 'row-reverse';
                  (topEl as HTMLElement).style.justifyContent = 'space-between';
                  (topEl as HTMLElement).style.alignItems = 'center';
                  (topEl as HTMLElement).style.width = '100%';
                }
              }
            }
          }}
        />
      </Paper>

      {/* 등록 팝업 */}
      <Dialog 
        open={open} 
        onClose={(event, reason) => {
          if (reason !== 'backdropClick') {
            setOpen(false);
          }
        }} 
        disableEscapeKeyDown
        maxWidth="md" 
        fullWidth
        transitionDuration={0}
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '20px 16px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 40px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 32px)' },
            maxWidth: { xs: 'calc(100% - 32px)', sm: 'md' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarMonthIcon color="action" sx={{ fontSize: '1.25rem' }} />
          <span>{formData.id ? '일정 수정' : `${formData.date} 일정 등록`}</span>
        </DialogTitle>
        <DialogContent dividers sx={{ p: { xs: 1.5, sm: 3 } }}>
          <Box sx={{ mt: 1 }}>
            <Grid container spacing={{ xs: 1.5, sm: 2 }}>
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
                  <TextField 
                    fullWidth 
                    multiline 
                    rows={4} 
                    label={
                      voiceRecorder.isListening 
                        ? "상세 메모 (음성 인식 녹음 중...)" 
                        : voiceRecorder.isProcessing
                        ? "상세 메모 (음성 변환 중...)"
                        : "상세 메모"
                    }
                    placeholder={
                      voiceRecorder.isListening 
                        ? "말씀이 끝나면 자동으로 음성이 텍스트로 채워집니다..." 
                        : ""
                    }
                    value={formData.content} 
                    onChange={(e) => setFormData({...formData, content: e.target.value})} 
                  />
                  <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Tooltip title={voiceRecorder.isListening ? "음성 인식 중 (클릭 시 중단)" : "음성 입력"}>
                      <IconButton 
                        color={voiceRecorder.isListening ? "error" : "default"} 
                        onClick={handleSTT}
                        disabled={voiceRecorder.isProcessing}
                        sx={{
                          animation: voiceRecorder.isListening ? 'pulse 1.5s infinite alternate' : 'none',
                          '@keyframes pulse': {
                            '0%': { opacity: 0.6, transform: 'scale(1.0)' },
                            '100%': { opacity: 1.0, transform: 'scale(1.15)' }
                          },
                          color: voiceRecorder.isListening ? 'error.main' : 'inherit'
                        }}
                      >
                        {voiceRecorder.isProcessing ? (
                          <CircularProgress size={20} color="inherit" />
                        ) : (
                          <MicIcon />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="AI 문장 정돈"><IconButton sx={{ color: '#673ab7' }} onClick={handleAIPolish} disabled={loading}><AIPIcon /></IconButton></Tooltip>
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
                  renderTags={(value, getTagProps) => value.map((option, index) => <Chip label={option.name} size="small" color="primary" {...getTagProps({ index })} sx={{ borderRadius: 1 }} />)}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'grey.50', display: 'flex', flexDirection: 'row', gap: 1, justifyContent: 'flex-end' }}>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleSave} 
            disabled={loading} 
            sx={{ fontWeight: 'bold', height: '36px', fontSize: '0.75rem', borderRadius: 1, flex: { xs: 1, sm: 'initial' }, width: { sm: 'auto' } }}
          >
            저장
          </Button>
          <Button 
            onClick={() => setOpen(false)} 
            variant="outlined" 
            color="inherit" 
            sx={{ fontWeight: 'bold', bgcolor: 'white', height: '36px', fontSize: '0.75rem', borderRadius: 1, flex: { xs: 1, sm: 'initial' }, width: { sm: 'auto' } }}
          >
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      {/* 상세 보기 팝업 */}
      <Dialog 
        open={detailOpen} 
        onClose={(event, reason) => {
          if (reason !== 'backdropClick') {
            setDetailOpen(false);
          }
        }} 
        disableEscapeKeyDown
        maxWidth="md" 
        fullWidth
        transitionDuration={0}
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '20px 16px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 40px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 32px)' },
            maxWidth: { xs: 'calc(100% - 32px)', sm: 'md' }
          }
        }}
      >
        {selectedEvent && (
          <>
            <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarMonthIcon color="action" sx={{ fontSize: '1.25rem' }} />
                <span>일정 상세</span>
              </Box>
              <Chip 
                icon={<AccessTimeIcon sx={{ fontSize: '0.85rem !important', color: '#ffffff !important' }} />}
                label={selectedEvent.all_day ? selectedEvent.start_time.split('T')[0] : `${selectedEvent.start_time.split('T')[0]} ${selectedEvent.start_time.split('T')[1].substring(0, 5)}`} 
                size="small" 
                color="primary" 
                variant="filled" 
                sx={{ 
                  borderRadius: 1, 
                  fontWeight: 'bold', 
                  fontSize: '0.75rem',
                  height: '26px',
                  px: 0.5,
                  '& .MuiChip-label': {
                    color: '#ffffff'
                  }
                }} 
              />
            </DialogTitle>
            <DialogContent dividers sx={{ p: { xs: 1.5, sm: 3 } }}>
              <Stack spacing={{ xs: 1.5, sm: 2 }} sx={{ pt: 1 }}>
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
            <DialogActions sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'grey.50', display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center' }}>
              <Button 
                onClick={() => handleDelete(selectedEvent.id)} 
                color="error" 
                variant="outlined" 
                sx={{ fontWeight: 'bold', height: '36px', fontSize: '0.75rem', borderRadius: 1, mr: 'auto', minWidth: '60px' }}
              >
                삭제
              </Button>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleEdit} 
                sx={{ fontWeight: 'bold', height: '36px', fontSize: '0.75rem', borderRadius: 1, minWidth: '60px' }}
              >
                수정
              </Button>
              <Button 
                onClick={() => setDetailOpen(false)} 
                variant="outlined" 
                color="inherit" 
                sx={{ fontWeight: 'bold', bgcolor: 'white', height: '36px', fontSize: '0.75rem', borderRadius: 1, minWidth: '60px' }}
              >
                닫기
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* VoiceRecorderDialog Removed - inline transcription used */}
    </Container>
  );
};

export default AdminSchedulePage;
