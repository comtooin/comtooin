import { format } from 'date-fns';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { RequestDetailModal } from '../components/RequestDetailModal';
import {
  Typography, Box, Paper, CircularProgress, Alert, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Divider, TextField, MenuItem, Grid, Tabs, Tab, Stack, Container, Pagination, useMediaQuery, useTheme, TableSortLabel,
  Autocomplete, InputAdornment, IconButton, Menu, ListItemIcon, ListItemText
} from '@mui/material';
import { 
  BarChart as BarChartIcon, 
  Assignment as AssignmentIcon,
  AccessTime as AccessTimeIcon,
  CheckCircle as CheckCircleIcon,
  Business as BusinessIcon,
  PieChart as PieChartIcon,
  Dashboard as DashboardIcon,
  AutoAwesome as AiIcon,
  FileDownload as FileDownloadIcon,
  FileUpload as FileUploadIcon,
  Description as DescriptionIcon,
  Search as SearchIcon,
  RestartAlt as RestartAltIcon,
  EditNote as EditNoteIcon,
  Mic as MicIcon,
  PhotoCamera as PhotoCameraIcon,
  Delete as DeleteIcon,
  Today as TodayIcon,
  Info as InfoIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon
} from '@mui/icons-material';
import { supabase, getCurrentStaffId, sendPushNotification } from '../api'; 
import { Helmet } from 'react-helmet-async';
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title
} from 'chart.js';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const stripHtmlTags = (html: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    'processing': '처리중',
    'completed': '처리완료',
    'pending': '처리중',
    '처리중': '처리중',
    '처리완료': '처리완료'
  };
  return labels[status] || status;
};

const getStatusChipColor = (status: string): 'success' | 'warning' | 'info' | 'default' => {
  switch (status) {
    case 'completed':
    case '처리완료':
      return 'success';
    case 'processing':
    case 'pending':
    case '처리중':
      return 'warning';
    default:
      return 'default';
  }
};

const ITEMS_PER_PAGE = 10;

// --- TYPE DEFINITIONS ---
interface IComment {
  id: number;
  comment: string;
  created_at: string;
}
interface IRequest {
  id: number;
  customer_name: string;
  user_name: string;
  requester_name?: string;
  content: string;
  status: string;
  created_at: string;
  comments: IComment[];
}
interface MonthlySummary {
    month: string;
    total_requests: number;
    pending_requests: number;
    completed_requests: number;
    cancelled_requests: number;
}

const AdminReportPage: React.FC = () => {

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState('');
  const [allRequests, setAllRequests] = useState<IRequest[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [allMonths, setAllMonths] = useState<string[]>([]);
  const userRole = sessionStorage.getItem('adminRole');
  const [selectedCustomer, setSelectedCustomer] = useState(() => {
    const role = sessionStorage.getItem('adminRole');
    const name = sessionStorage.getItem('adminName');
    if (role === 'customer' && name) return name;
    return 'all';
  });
  const [searchParams] = useSearchParams();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const period = searchParams.get('period');
    if (period === 'today') return 'today';
    if (period === 'month') {
      const d = new Date();
      return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    }
    return 'all';
  });
  const [status, setStatus] = useState('all');
  const [tabValue, setTabValue] = useState(0);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  const showVisualization = userRole === 'customer' ? tabValue === 0 : tabValue === 1;
  const showList = userRole === 'customer' ? tabValue === 1 : tabValue === 0;

  const [statusData, setStatusData] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [openDetailModal, setOpenDetailModal] = useState(false);
  const [monthlyData, setMonthlyData] = useState<MonthlySummary[]>([]);

  // 페이지네이션 상태
  const [page, setPage] = useState(1);

  // 정렬 상태
  const [sortConfig, setSortConfig] = useState<{ key: keyof IRequest, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: keyof IRequest) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // 업무 기록 작성 모달 관련 상태
  const [workLogOpen, setWorkLogOpen] = useState(false);
  const [staffOptions, setStaffOptions] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [userName, setUserName] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [workDate, setWorkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [content, setContent] = useState(''); 
  const [processingContent, setProcessingContent] = useState(''); 
  const [images, setImages] = useState<File[]>([]);
  const [logError, setLogError] = useState('');
  const [isListening, setIsListening] = useState<'content' | 'processingContent' | null>(null);
  const [isPolishing, setIsPolishing] = useState<'content' | 'processingContent' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recognitionInstance, setRecognitionInstance] = useState<any>(null);

  useEffect(() => {
    const storedName = sessionStorage.getItem('adminName');
    if (storedName) {
      setUserName(storedName);
    }
  }, [workLogOpen]);

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
      if (latestIndex <= recognition.lastProcessedResultIndex) return;
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
    if (!textToPolish.trim()) return setLogError("정돈할 내용이 없습니다.");
    
    setIsPolishing(target);
    setLogError('');
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
      setLogError("AI 정돈 중 오류가 발생했습니다.");
    } finally { 
      setIsPolishing(null); 
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (images.length + files.length > 5) return setLogError('이미지는 최대 5개까지 첨부할 수 있습니다.');
      setImages(prevImages => [...prevImages, ...files]);
    }
  };

  const handleSubmitWorkLog = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    setLogError('');
    if (!customerName || !userName || !requesterName || !content) return setLogError('필수 항목을 모두 입력해주세요.');
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
      
      // 스케줄 자동 연동 및 구글 캘린더 동기화 (백그라운드에서 비동기로 실행하여 대기 시간 제거)
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

      // 백그라운드 비동기 태스크 실행
      (async () => {
        try {
          let googleEventId = '';
          try {
            const { data: syncData, error: syncError } = await supabase.functions.invoke('google-calendar-sync', {
              body: syncPayload
            });
            if (syncError) {
              console.warn('Google Calendar Sync Error:', syncError.message);
            } else {
              googleEventId = syncData?.googleEventId || '';
            }
          } catch (err: any) {
            console.warn('Google Calendar Sync invoke failed:', err.message || err);
          }

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
            google_event_id: googleEventId
          };
          
          const { error: scheduleError } = await supabase.from('schedules').insert(scheduleData);
          if (scheduleError) {
            console.error('Schedule auto-insert failed:', scheduleError.message);
          }
        } catch (bgErr) {
          console.error('Background calendar and schedule sync failed:', bgErr);
        }
      })();

      alert('업무 기록이 성공적으로 저장되었습니다.');
      setContent('');
      setProcessingContent('');
      setImages([]);
      setRequesterName('');
      setCustomerName('');
      setWorkDate(format(new Date(), 'yyyy-MM-dd'));
      setWorkLogOpen(false);
      applyFilters(true);
      fetchInitialData();
    } catch (err: any) { 
      setLogError(err.message || '저장 중 오류가 발생했습니다.'); 
    } finally { 
      setSubmitting(false); 
    }
  };

  // 더보기 메뉴 관련 상태
  const [moreAnchorEl, setMoreAnchorEl] = useState<null | HTMLElement>(null);
  const isMoreMenuOpen = Boolean(moreAnchorEl);
  const handleMoreMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setMoreAnchorEl(event.currentTarget);
  };
  const handleMoreMenuClose = () => {
    setMoreAnchorEl(null);
  };

  // 엑셀 업로드 검증 모달 관련 상태
  const [validationOpen, setValidationOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  // AI 리포트 관련 상태
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiReportContent, setAiReportContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewPages, setPreviewPages] = useState<string[]>([]);

  const currentYear = new Date().getFullYear();

  const summaryStats = useMemo(() => {
    const total = allRequests.length;
    const processing = allRequests.filter(r => r.status === 'processing' || r.status === 'pending' || r.status === '처리중').length;
    const completed = allRequests.filter(r => r.status === 'completed' || r.status === '처리완료').length;
    return { total, processing, completed };
  }, [allRequests]);

  const filteredRequests = useMemo(() => {
    let reqs = allRequests;
    
    // 1. 상태 필터링
    if (status !== 'all') {
      const dbStatus = status === '처리중' ? 'processing' : status === '처리완료' ? 'completed' : status;
      reqs = reqs.filter(r => {
        if (dbStatus === 'processing') return r.status === 'processing' || r.status === 'pending' || r.status === '처리중';
        if (dbStatus === 'completed') return r.status === 'completed' || r.status === '처리완료';
        return r.status === dbStatus;
      });
    }

    // 2. 업무 유형 필터링 (차트 드릴다운 클릭 시)
    if (selectedCategoryFilter !== 'all') {
      reqs = reqs.filter(r => {
        const text = (r.content || '').toLowerCase();
        if (selectedCategoryFilter === 'PC / 하드웨어') {
          return text.includes('pc') || text.includes('노트북') || text.includes('데스크탑') || 
                 text.includes('cpu') || text.includes('메모리') || text.includes('ram') || 
                 text.includes('하드') || text.includes('ssd') || text.includes('파워') || 
                 text.includes('부팅') || text.includes('전원') || text.includes('그래픽카드') || 
                 text.includes('gpu') || text.includes('메인보드') || text.includes('바이오스') || 
                 text.includes('bios') || text.includes('본체') || text.includes('모니터') || 
                 text.includes('키보드') || text.includes('마우스') || text.includes('컴퓨터') || 
                 text.includes('디스크') || text.includes('헤드셋') || text.includes('이어폰') || 
                 text.includes('스피커') || text.includes('멀티탭') || text.includes('케이블') || 
                 text.includes('젠더') || text.includes('조립') || text.includes('부품') || 
                 text.includes('쿨러') || text.includes('팬') || text.includes('케이스') || 
                 text.includes('usb') || text.includes('외장하드');
        }
        if (selectedCategoryFilter === '네트워크 / 인터넷') {
          return text.includes('인터넷') || text.includes('네트워크') || text.includes('lan') || 
                 text.includes('공유기') || text.includes('와이파이') || text.includes('wifi') || 
                 text.includes('접속') || text.includes('허브') || text.includes('ip') ||
                 text.includes('dns') || text.includes('방화벽') || text.includes('vpn') || 
                 text.includes('스위치') || text.includes('인터넷전화') || text.includes('인터넷 전화') || 
                 text.includes('랜선') || text.includes('utp') || text.includes('서버') || 
                 text.includes('나스') || text.includes('nas') || text.includes('포트') || 
                 text.includes('ping');
        }
        if (selectedCategoryFilter === '소프트웨어 / OS') {
          return text.includes('윈도우') || text.includes('windows') || text.includes('오피스') || 
                 text.includes('office') || text.includes('한글') || text.includes('엑셀') || 
                 text.includes('excel') || text.includes('워드') || text.includes('word') || 
                 text.includes('파워포인트') || text.includes('ppt') || text.includes('일러스트') || 
                 text.includes('포토샵') || text.includes('오토캐드') || text.includes('autocad') || 
                 text.includes('백신') || text.includes('v3') || text.includes('알약') || 
                 text.includes('카스퍼스키') || text.includes('kaspersky') || text.includes('프로그램') || 
                 text.includes('설치') || text.includes('인증') || text.includes('소프트웨어') ||
                 text.includes('라이센스') || text.includes('업데이트') || text.includes('포맷') || 
                 text.includes('복구') || text.includes('메일') || text.includes('아웃룩') || 
                 text.includes('outlook') || text.includes('계정') || text.includes('오류') || 
                 text.includes('에러') || text.includes('크롬') || text.includes('chrome') || 
                 text.includes('엣지') || text.includes('edge') || text.includes('웨일') || 
                 text.includes('whale') || text.includes('브라우저') || text.includes('압축') || 
                 text.includes('폰트') || text.includes('뷰어') || text.includes('pdf');
        }
        if (selectedCategoryFilter === '프린터 / 복합기') {
          return text.includes('프린터') || text.includes('복합기') || text.includes('토너') || 
                 text.includes('잉크') || text.includes('인쇄') || text.includes('출력') || 
                 text.includes('스캔') || text.includes('팩스') || text.includes('드라이버') || 
                 text.includes('용지') || text.includes('용지걸림') || text.includes('급지') || 
                 text.includes('복사') || text.includes('드럼') || text.includes('스캐너') || 
                 text.includes('출력물');
        }
        if (selectedCategoryFilter === '기타 문의') {
          const isHw = text.includes('pc') || text.includes('노트북') || text.includes('데스크탑') || text.includes('cpu') || text.includes('메모리') || text.includes('ram') || text.includes('하드') || text.includes('ssd') || text.includes('파워') || text.includes('부팅') || text.includes('전원') || text.includes('그래픽카드') || text.includes('gpu') || text.includes('메인보드') || text.includes('바이오스') || text.includes('bios') || text.includes('본체') || text.includes('모니터') || text.includes('키보드') || text.includes('마우스') || text.includes('컴퓨터') || text.includes('디스크') || text.includes('헤드셋') || text.includes('이어폰') || text.includes('스피커') || text.includes('멀티탭') || text.includes('케이블') || text.includes('젠더') || text.includes('조립') || text.includes('부품') || text.includes('쿨러') || text.includes('팬') || text.includes('케이스') || text.includes('usb') || text.includes('외장하드');
          const isNet = text.includes('인터넷') || text.includes('네트워크') || text.includes('lan') || text.includes('공유기') || text.includes('와이파이') || text.includes('wifi') || text.includes('접속') || text.includes('허브') || text.includes('ip') || text.includes('dns') || text.includes('방화벽') || text.includes('vpn') || text.includes('스위치') || text.includes('인터넷전화') || text.includes('인터넷 전화') || text.includes('랜선') || text.includes('utp') || text.includes('서버') || text.includes('나스') || text.includes('nas') || text.includes('포트') || text.includes('ping');
          const isSw = text.includes('윈도우') || text.includes('windows') || text.includes('오피스') || text.includes('office') || text.includes('한글') || text.includes('엑셀') || text.includes('excel') || text.includes('워드') || text.includes('word') || text.includes('파워포인트') || text.includes('ppt') || text.includes('일러스트') || text.includes('포토샵') || text.includes('오토캐드') || text.includes('autocad') || text.includes('백신') || text.includes('v3') || text.includes('알약') || text.includes('카스퍼스키') || text.includes('kaspersky') || text.includes('프로그램') || text.includes('설치') || text.includes('인증') || text.includes('소프트웨어') || text.includes('라이센스') || text.includes('업데이트') || text.includes('포맷') || text.includes('복구') || text.includes('메일') || text.includes('아웃룩') || text.includes('outlook') || text.includes('계정') || text.includes('오류') || text.includes('에러') || text.includes('크롬') || text.includes('chrome') || text.includes('엣지') || text.includes('edge') || text.includes('웨일') || text.includes('whale') || text.includes('브라우저') || text.includes('압축') || text.includes('폰트') || text.includes('뷰어') || text.includes('pdf');
          const isPrinter = text.includes('프린터') || text.includes('복합기') || text.includes('토너') || text.includes('잉크') || text.includes('인쇄') || text.includes('출력') || text.includes('스캔') || text.includes('팩스') || text.includes('드라이버') || text.includes('용지') || text.includes('용지걸림') || text.includes('급지') || text.includes('복사') || text.includes('드럼') || text.includes('스캐너') || text.includes('출력물');
          return !isHw && !isNet && !isSw && !isPrinter;
        }
        return true;
      });
    }

    return reqs;
  }, [allRequests, status, selectedCategoryFilter]);

  const customerShareData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredRequests.forEach(r => {
      counts[r.customer_name] = (counts[r.customer_name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRequests]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setPage(1); // 탭 변경 시 페이지 리셋
  };

  const handleResetAllFilters = () => {
    setSelectedCategoryFilter('all');
    setStatus('all');
    setSelectedMonth('all');
    const role = sessionStorage.getItem('adminRole');
    if (role !== 'customer') {
      setSelectedCustomer('all');
    }
    setPage(1);
  };

  const fetchInitialData = useCallback(async () => {
      try {
          const { data: customerData } = await supabase.from('customers').select('name').order('name', { ascending: true });
          if (customerData) setCustomers(customerData.map(c => c.name));

          const { data: staffData } = await supabase.from('staff').select('name, role').neq('role', 'admin').order('name', { ascending: true });
          if (staffData) setStaffOptions(staffData.map(s => s.name));

          const { data: summaryData } = await supabase.rpc('get_monthly_summary', { target_year: currentYear });
          if (summaryData) setAllMonths(summaryData.map((m: MonthlySummary) => m.month));
      } catch (err: any) {
          console.error("Initial data fetch error", err);
          setError('기본 데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
          setLoading(false);
      }
  }, [currentYear]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (aiModalOpen && aiReportContent) {
      // 1. 임시 컨테이너 생성 (layout 계산용 오프스크린 렌더링)
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '794px';
      container.style.boxSizing = 'border-box';
      
      const styleSheet = document.createElement("style");
      styleSheet.innerText = `
        .pdf-page-preview {
          width: 794px;
          height: 1123px;
          background-color: #ffffff;
          padding: 50px 50px 70px 50px;
          box-sizing: border-box;
          font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
          color: #333333;
          position: relative;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .pdf-page-preview h1 { font-size: 20px; font-weight: bold; text-align: center; margin-top: 0; margin-bottom: 8px; color: #111111; }
        .pdf-page-preview .subtitle { font-size: 11px; text-align: center; margin-bottom: 15px; color: #666666; border-bottom: 2px solid #673ab7; padding-bottom: 8px; }
        .pdf-page-preview h2 { font-size: 15px; font-weight: bold; margin-top: 15px; margin-bottom: 8px; color: #673ab7; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
        .pdf-page-preview h3 { font-size: 13px; font-weight: bold; margin-top: 10px; margin-bottom: 6px; color: #333333; }
        .pdf-page-preview p { font-size: 13px; line-height: 1.65; margin-bottom: 8px; text-align: justify; color: #333333; }
        .pdf-page-preview ul { padding-left: 20px; margin-bottom: 8px; font-size: 13px; line-height: 1.65; color: #333333; }
        .pdf-page-preview li { margin-bottom: 4px; color: #333333; }
        .pdf-page-preview table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12.5px; color: #333333; }
        .pdf-page-preview th { background-color: #f5f5f5; border: 1px solid #ddd; padding: 6px; font-weight: bold; text-align: center; color: #333333; }
        .pdf-page-preview td { border: 1px solid #ddd; padding: 6px; line-height: 1.5; color: #333333; }
        .pdf-page-preview strong, .pdf-page-preview b, .pdf-page-preview span, .pdf-page-preview div { color: #333333; }
        .pdf-page-preview h1 *, .pdf-page-preview h2 *, .pdf-page-preview .pdf-header * { color: inherit; }
      `;
      container.appendChild(styleSheet);
      document.body.appendChild(container);

      const parserDiv = document.createElement('div');
      parserDiv.innerHTML = aiReportContent;

      const pageDivs: HTMLDivElement[] = [];
      const customerNameLabel = selectedCustomer || '전체';
      const monthLabel = selectedMonth || '전체';
      const titleText = `유지보수 분석 리포트 - ${customerNameLabel}`;
      const subtitleText = `대상 기간: ${monthLabel} | 작성 일자: ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}`;

      const createNewPage = (pageNum: number) => {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'pdf-page-preview';
        
        if (pageNum === 1) {
          const title = document.createElement('h1');
          title.innerText = titleText;
          pageDiv.appendChild(title);

          const sub = document.createElement('div');
          sub.className = 'subtitle';
          sub.innerText = subtitleText;
          pageDiv.appendChild(sub);
        } else {
          const header = document.createElement('div');
          header.className = 'pdf-header';
          header.style.fontSize = '11px';
          header.style.color = '#999';
          header.style.borderBottom = '1px solid #eee';
          header.style.paddingBottom = '5px';
          header.style.marginBottom = '20px';
          header.innerText = `${titleText} - 이어짐`;
          pageDiv.appendChild(header);
        }
        
        container.appendChild(pageDiv);
        pageDivs.push(pageDiv);
        return pageDiv;
      };

      const getElementFullHeight = (el: HTMLElement): number => {
        const rectHeight = el.getBoundingClientRect().height;
        const style = window.getComputedStyle(el);
        const marginTop = parseFloat(style.marginTop) || 0;
        const marginBottom = parseFloat(style.marginBottom) || 0;
        return rectHeight + marginTop + marginBottom;
      };

      let currentPageNum = 1;
      let currentPage = createNewPage(currentPageNum);
      const MAX_CONTENT_HEIGHT = 900; // 900px로 여유 공간 최적화
      let hasSeenFirstCategory = false;

      let children = Array.from(parserDiv.childNodes);
      if (children.length === 1 && children[0].nodeType === Node.ELEMENT_NODE) {
        const firstChild = children[0] as HTMLElement;
        const tag = firstChild.tagName.toLowerCase();
        if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'main' || tag === 'body' || tag === 'html') {
          children = Array.from(firstChild.childNodes);
        }
      }

      for (const child of children) {
        if (child.nodeType === Node.TEXT_NODE && !child.textContent?.trim()) {
          continue;
        }

        const currentPageHasContent = Array.from(currentPage.children).some(
          node => {
            const el = node as HTMLElement;
            return el.className !== 'page-number' && 
                   el.tagName.toLowerCase() !== 'h1' && 
                   el.className !== 'subtitle' && 
                   el.className !== 'pdf-header';
          }
        );

        // 1. 수동 page-break 식별 및 카테고리별(2., 3., 4. 등) 강제 페이지 분할
        if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as HTMLElement;
          const tagName = el.tagName.toLowerCase();
          
          const isPageBreak = el.className === 'page-break' || el.tagName.toLowerCase() === 'page-break';
          
          let isNewCategory = false;
          let isFirstCategory = false;
          if (tagName === 'h2') {
            const text = el.innerText || el.textContent || '';
            isFirstCategory = /^(1)\./.test(text.trim());
            isNewCategory = /^([2-9]|\d{2,})\./.test(text.trim());
          }

          if (isFirstCategory) {
            hasSeenFirstCategory = true;
          }

          if (isPageBreak) {
            if (!hasSeenFirstCategory) {
              // 1번 카테고리 시작 전의 page-break는 무시하여 표지와 1번 카테고리가 1페이지에 함께 나오도록 함
              continue;
            } else {
              currentPageNum++;
              currentPage = createNewPage(currentPageNum);
              continue;
            }
          }

          if (isNewCategory && currentPageHasContent) {
            currentPageNum++;
            currentPage = createNewPage(currentPageNum);
          }
        }

        const clone = child.cloneNode(true) as HTMLElement;
        currentPage.appendChild(clone);
        void currentPage.offsetHeight;

        let contentHeight = 0;
        for (const node of Array.from(currentPage.children)) {
          const el = node as HTMLElement;
          contentHeight += getElementFullHeight(el);
        }

        const contentChildrenCount = Array.from(currentPage.children).filter(
          node => {
            const el = node as HTMLElement;
            return el.tagName.toLowerCase() !== 'h1' && 
                   el.className !== 'subtitle' && 
                   el.className !== 'pdf-header';
          }
        ).length;

        if (contentHeight > MAX_CONTENT_HEIGHT && contentChildrenCount > 1) {
          currentPage.removeChild(clone);
          currentPageNum++;
          currentPage = createNewPage(currentPageNum);
          currentPage.appendChild(clone);
          void currentPage.offsetHeight;
        }
      }

      const resultHtmls = pageDivs.map(div => div.innerHTML);
      document.body.removeChild(container);
      setPreviewPages(resultHtmls);
    }
  }, [aiModalOpen, aiReportContent, selectedCustomer, selectedMonth]);

  useEffect(() => {
    const period = searchParams.get('period');
    if (period === 'today') {
      setSelectedMonth('today');
    } else if (period === 'month') {
      const d = new Date();
      setSelectedMonth(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
    } else if (period === 'all') {
      setSelectedMonth('all');
    }
  }, [searchParams]);

  const applyFilters = useCallback(async (resetPage = false) => {
    setLoading(true);
    setError('');

    try {
      const role = sessionStorage.getItem('adminRole');
      const customerName = sessionStorage.getItem('adminName');
      
      let targetCustomer = selectedCustomer;
      if (role === 'customer' && customerName) {
        targetCustomer = customerName;
      }

      let requestsQuery = supabase.from('requests').select('*, comments(*)');

      if (targetCustomer !== 'all') {
        requestsQuery = requestsQuery.eq('customer_name', targetCustomer);
      }
      if (selectedMonth === 'today') {
        const d = new Date();
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const startDate = `${year}-${month}-${day}T00:00:00.000Z`;
        const endDate = `${year}-${month}-${day}T23:59:59.999Z`;
        requestsQuery = requestsQuery.gte('created_at', startDate).lte('created_at', endDate);
      } else if (selectedMonth !== 'all') {
        const year = selectedMonth.split('-')[0];
        const month = selectedMonth.split('-')[1];
        const startDate = `${year}-${month}-01T00:00:00.000Z`;
        const endDate = `${year}-${month}-${new Date(Number(year), Number(month), 0).getDate()}T23:59:59.999Z`;
        requestsQuery = requestsQuery.gte('created_at', startDate).lte('created_at', endDate);
      }
      requestsQuery = requestsQuery.order('created_at', { ascending: false }).order('id', { ascending: false });

      const { data: requestsData, error: requestsError } = await requestsQuery;
      if (requestsError) throw requestsError;
      setAllRequests(requestsData || []);
      if (resetPage === true) {
        setPage(1); // 필터 적용 시에만 페이지 리셋
      }

      if (role === 'customer' || targetCustomer !== 'all') {
        // 거래처인 경우 혹은 특정 거래처 필터가 선택된 경우 다른 거래처 현황 데이터 노출 차단/필터링을 위해 클라이언트 측에서 해당 거래처 데이터만 집계
        const statusCounts: Record<string, number> = {
          'processing': 0,
          'completed': 0
        };
        requestsData?.forEach(r => {
          const s = r.status === 'pending' || r.status === 'processing' || r.status === '처리중' ? 'processing' : 'completed';
          statusCounts[s] = (statusCounts[s] || 0) + 1;
        });
        setStatusData([
          { status: 'processing', count: statusCounts.processing },
          { status: 'completed', count: statusCounts.completed }
        ]);

        const monthCounts: Record<string, { total: number, pending: number, completed: number }> = {};
        requestsData?.forEach(r => {
          if (!r.created_at) return;
          const m = r.created_at.substring(0, 7); // YYYY-MM
          if (currentYear && !m.startsWith(currentYear.toString())) return;
          if (!monthCounts[m]) {
            monthCounts[m] = { total: 0, pending: 0, completed: 0 };
          }
          monthCounts[m].total += 1;
          if (r.status === 'pending' || r.status === 'processing' || r.status === '처리중') {
            monthCounts[m].pending += 1;
          } else {
            monthCounts[m].completed += 1;
          }
        });
        const sortedMonths = Object.keys(monthCounts).sort();
        const clientMonthlyData = sortedMonths.map(m => ({
          month: m,
          total_requests: monthCounts[m].total,
          pending_requests: monthCounts[m].pending,
          completed_requests: monthCounts[m].completed,
          cancelled_requests: 0
        }));
        setMonthlyData(clientMonthlyData);
      } else {
        const { data: statusSummaryData } = await supabase.rpc('get_status_summary', {});
        setStatusData(statusSummaryData || []);

        const { data: monthlySummaryData } = await supabase.rpc('get_monthly_summary', { target_year: currentYear });
        setMonthlyData(monthlySummaryData as MonthlySummary[] || []);
      }

    } catch (err: any) {
      console.error("Filter apply error", err);
      setError('리포트 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedCustomer, selectedMonth, currentYear]);

  useEffect(() => {
    applyFilters(true);
  }, [applyFilters]);

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  const sortedRequests = React.useMemo(() => {
    let sortableItems = [...filteredRequests];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key] || '';
        const bValue = b[sortConfig.key] || '';
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredRequests, sortConfig]);

  const paginatedRequests = sortedRequests.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleExportExcel = async () => {
    try {
        setExportLoading(true);
        setError('');
        
        const supabaseUrl = (supabase as any).supabaseUrl || process.env.REACT_APP_SUPABASE_URL;
        if (!supabaseUrl) {
            throw new Error("Supabase 설정(URL)을 찾을 수 없습니다.");
        }
        
        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/export-excel`; 
        
        const payload = {
            customerName: selectedCustomer,
            month: selectedMonth,
            status: status === 'all' ? 'all' : (status === '처리중' ? 'processing' : status === '처리완료' ? 'completed' : status)
        };

        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        if (!accessToken) {
            throw new Error("인증 세션이 만료되었습니다. 다시 로그인해주세요.");
        }

        const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            throw new Error(errorBody.error || `서버 응답 오류 (${response.status})`);
        }

        let actualFileName = `컴투인_유지보수_리포트_${format(new Date(), 'yyyy-MM-dd')}.csv`; 
        const contentDisposition = response.headers.get('Content-Disposition');
        if (contentDisposition) {
            if (contentDisposition.includes("filename*=")) {
                const parts = contentDisposition.split("filename*=UTF-8''");
                if (parts.length > 1) actualFileName = decodeURIComponent(parts[1].split(';')[0]);
            } else if (contentDisposition.includes("filename=")) {
                const parts = contentDisposition.split('filename=');
                let name = parts[1].split(';')[0].replace(/['"]/g, '');
                actualFileName = decodeURIComponent(name);
            }
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = actualFileName; 
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err: any) {
        console.error("Excel Export Error:", err);
        alert(`엑셀 다운로드 실패: ${err.message}`);
        setError(err.message);
    } finally {
        setExportLoading(false);
    }
  };

  const handleDownloadSampleCsv = () => {
    const headers = ['ID', '업무일시', '거래처명', '요청자', '작성자', '상태', '접수내용', '처리내용'];
    const sampleData = ['', '2026-04-13 14:30', '샘플거래처', '홍길동', '관리자', '처리완료', '샘플 접수 내용입니다.', '샘플 처리 결과입니다.'];
    
    // 엑셀에서 한글 깨짐 방지를 위해 BOM 추가
    const csvContent = "\uFEFF" + [headers.join(','), sampleData.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '유지보수_업로드_양식.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        
        // 데이터 추출 (헤더: ID, 업무일시, 거래처명, 요청자, 작성자, 상태, 접수내용, 처리내용)
        const tempRows: any[] = [];
        let indexCounter = 1;

        lines.slice(1).forEach(line => {
          if (!line.trim()) return;
          const values = line.split(',');
          
          const createdAtRaw = values[1]?.trim();
          const customerName = values[2]?.trim();
          const requesterName = values[3]?.trim();
          const userName = values[4]?.trim();
          const statusRaw = values[5]?.trim();
          const content = values[6]?.trim();
          const processNote = values[7]?.trim() || '';
          
          let dateStrForParse = createdAtRaw;
          if (dateStrForParse) {
            dateStrForParse = dateStrForParse.replace(/\./g, '-').trim();
          }

          const rowErrors: string[] = [];
          if (!customerName) {
            rowErrors.push('거래처명이 누락되었습니다.');
          }
          if (!content) {
            rowErrors.push('접수내용이 누락되었습니다.');
          }
          
          let parsedDateIso = new Date().toISOString();
          if (dateStrForParse) {
            const parsedTime = Date.parse(dateStrForParse);
            if (isNaN(parsedTime)) {
              rowErrors.push('날짜 형식이 올바르지 않습니다.');
            } else {
              parsedDateIso = new Date(parsedTime).toISOString();
            }
          }

          tempRows.push({
            index: indexCounter++,
            rawLine: line,
            createdAt: parsedDateIso,
            createdAtRaw: createdAtRaw || '',
            customerName: customerName || '',
            requesterName: requesterName || '',
            userName: userName || '관리자',
            status: statusRaw === '처리완료' ? 'completed' : 'processing',
            statusRaw: statusRaw || '',
            content: content || '',
            processNote,
            errors: rowErrors
          });
        });

        if (tempRows.length === 0) {
          throw new Error('등록할 유효한 데이터가 없습니다.');
        }

        setParsedRows(tempRows);
        setValidationOpen(true);
      } catch (err: any) {
        console.error("CSV Parse Error:", err);
        alert(`파일 읽기 오류: ${err.message}`);
        setError(err.message);
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    
    reader.readAsText(file); 
  };

  const handleExecuteImport = async () => {
    const hasErrors = parsedRows.some(row => row.errors.length > 0);
    if (hasErrors) {
      alert('오류가 있는 행이 존재합니다. 수정한 후 다시 업로드해주세요.');
      return;
    }

    setImporting(true);
    setError('');
    try {
      const requestsToInsert = parsedRows.map(row => ({
        created_at: row.createdAt,
        customer_name: row.customerName,
        requester_name: row.requesterName,
        user_name: row.userName,
        status: row.status,
        content: row.content,
      }));

      const processNotes = parsedRows.map(row => row.processNote);

      // 1. Requests 삽입
      const { data: insertedRequests, error: insertError } = await supabase
        .from('requests')
        .insert(requestsToInsert)
        .select();

      if (insertError) throw insertError;

      // 2. 처리내용(Comments) 삽입
      if (insertedRequests && insertedRequests.length > 0) {
        const commentsToInsert: any[] = [];
        const staffId = await getCurrentStaffId();

        insertedRequests.forEach((req, index) => {
          const note = processNotes[index];
          if (note) {
            commentsToInsert.push({
              request_id: req.id,
              comment: note,
              user_id: staffId,
            });
          }
        });

        if (commentsToInsert.length > 0) {
          await supabase.from('comments').insert(commentsToInsert);
        }
      }

      alert(`${parsedRows.length}건의 업무 기록이 성공적으로 등록되었습니다.`);
      setValidationOpen(false);
      applyFilters(); 
    } catch (err: any) {
      console.error("Import Execute Error:", err);
      alert(`업로드 실패: ${err.message}`);
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleGenerateAiReport = async () => {
    if (filteredRequests.length === 0) {
      alert('분석할 데이터가 없습니다.');
      return;
    }

    try {
      setIsGenerating(true);
      setError('');
      
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) throw new Error("인증 세션이 만료되었습니다.");

      const response = await fetch(`${(supabase as any).supabaseUrl}/functions/v1/generate-ai-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          customerName: selectedCustomer,
          month: selectedMonth,
          status: status,
          action: 'preview'
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      let cleanReport = data.report || '';
      // 마크다운 코드 블록(```html 또는 ```) 제거
      cleanReport = cleanReport.replace(/^```html\s*/i, '');
      cleanReport = cleanReport.replace(/```\s*$/, '');
      cleanReport = cleanReport.trim();

      cleanReport = cleanReport.replace(/추가적인 기술 지원 및 장애 문의 사항은 서비스 데스크로 즉시 연락해 주시기 바랍니다\.?/gi, '');
      cleanReport = cleanReport.replace(/컴투인 IT 인프라 유지보수 서비스팀 ☎ \(문의: [^)]+\)/gi, '');
      cleanReport = cleanReport.replace(/컴투인 IT 인프라 유지보수 서비스팀 ☎/gi, '');
      cleanReport = cleanReport.replace(/기술지원\s*문의\s*:\s*.*$/gim, '');
      cleanReport = cleanReport.replace(/기술\s*지원\s*문의\s*:\s*.*$/gim, '');
      cleanReport = cleanReport.replace(/기술지원문의\s*:\s*.*$/gim, '');
      cleanReport = cleanReport.replace(/문의\s*:\s*\d{2,4}[-\s]?\d{3,4}[-\s]?(?:\d{4}|XXXX)/gi, '');
      cleanReport = cleanReport.replace(/문의\s*전화\s*:\s*.*$/gim, '');

      setAiReportContent(cleanReport);
      setAiModalOpen(true);
    } catch (err: any) {
      console.error("AI Report Generation Error:", err);
      setError(`AI 리포트 생성 실패: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadAiReport = async () => {
    if (!aiReportContent) return;
    try {
      const customerNameLabel = selectedCustomer || '전체';
      const monthLabel = selectedMonth || '전체';
      const filename = `${customerNameLabel}_유지보수_분석리포트_${monthLabel}.pdf`;

      // 1. 임시 컨테이너 생성 (layout 계산을 위해 absolute 및 left -9999px로 오프스크린 렌더링)
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '794px';
      container.style.boxSizing = 'border-box';
      
      const styleSheet = document.createElement("style");
      styleSheet.innerText = `
        .pdf-page {
          width: 794px;
          height: 1123px;
          background-color: #ffffff;
          padding: 50px 50px 70px 50px;
          box-sizing: border-box;
          font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
          color: #333333;
          position: relative;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .pdf-page h1 { font-size: 20px; font-weight: bold; text-align: center; margin-top: 0; margin-bottom: 8px; color: #111111; }
        .pdf-page .subtitle { font-size: 11px; text-align: center; margin-bottom: 15px; color: #666666; border-bottom: 2px solid #673ab7; padding-bottom: 8px; }
        .pdf-page h2 { font-size: 15px; font-weight: bold; margin-top: 15px; margin-bottom: 8px; color: #673ab7; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
        .pdf-page h3 { font-size: 13px; font-weight: bold; margin-top: 10px; margin-bottom: 6px; color: #333333; }
        .pdf-page p { font-size: 13px; line-height: 1.65; margin-bottom: 8px; text-align: justify; color: #333333; }
        .pdf-page ul { padding-left: 20px; margin-bottom: 8px; font-size: 13px; line-height: 1.65; color: #333333; }
        .pdf-page li { margin-bottom: 4px; color: #333333; }
        .pdf-page table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12.5px; color: #333333; }
        .pdf-page th { background-color: #f5f5f5; border: 1px solid #ddd; padding: 6px; font-weight: bold; text-align: center; color: #333333; }
        .pdf-page td { border: 1px solid #ddd; padding: 6px; line-height: 1.5; color: #333333; }
        .pdf-page strong, .pdf-page b, .pdf-page span, .pdf-page div { color: #333333; }
        .pdf-page h1 *, .pdf-page h2 *, .pdf-page .pdf-header * { color: inherit; }
        .pdf-page .page-number {
          position: absolute;
          bottom: 25px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 11px;
          color: #999999;
        }
      `;
      container.appendChild(styleSheet);
      document.body.appendChild(container);

      // HTML을 임시 파서 엘리먼트에 파싱
      const parserDiv = document.createElement('div');
      parserDiv.innerHTML = aiReportContent;
      
      const pages: HTMLDivElement[] = [];
      const titleText = `유지보수 분석 리포트 - ${customerNameLabel}`;
      const subtitleText = `대상 기간: ${monthLabel} | 작성 일자: ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}`;

      const createNewPage = (pageNum: number) => {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'pdf-page';
        
        if (pageNum === 1) {
          const title = document.createElement('h1');
          title.innerText = titleText;
          pageDiv.appendChild(title);

          const sub = document.createElement('div');
          sub.className = 'subtitle';
          sub.innerText = subtitleText;
          pageDiv.appendChild(sub);
        } else {
          const header = document.createElement('div');
          header.className = 'pdf-header';
          header.style.fontSize = '11px';
          header.style.color = '#999';
          header.style.borderBottom = '1px solid #eee';
          header.style.paddingBottom = '5px';
          header.style.marginBottom = '20px';
          header.innerText = `${titleText} - 이어짐`;
          pageDiv.appendChild(header);
        }
        
        const pageNumDiv = document.createElement('div');
        pageNumDiv.className = 'page-number';
        pageNumDiv.innerText = `- ${pageNum} -`;
        pageDiv.appendChild(pageNumDiv);
        
        container.appendChild(pageDiv);
        pages.push(pageDiv);
        return pageDiv;
      };

      const getElementFullHeight = (el: HTMLElement): number => {
        const rectHeight = el.getBoundingClientRect().height;
        const style = window.getComputedStyle(el);
        const marginTop = parseFloat(style.marginTop) || 0;
        const marginBottom = parseFloat(style.marginBottom) || 0;
        return rectHeight + marginTop + marginBottom;
      };

      let currentPageNum = 1;
      let currentPage = createNewPage(currentPageNum);
      const MAX_CONTENT_HEIGHT = 900; // 900px로 여유 공간 최적화
      let hasSeenFirstCategory = false;

      // 최상위 래퍼 div가 단일로 존재할 경우 내부 자식들을 직접 가져오도록 언래핑
      let children = Array.from(parserDiv.childNodes);
      if (children.length === 1 && children[0].nodeType === Node.ELEMENT_NODE) {
        const firstChild = children[0] as HTMLElement;
        const tag = firstChild.tagName.toLowerCase();
        if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'main' || tag === 'body' || tag === 'html') {
          children = Array.from(firstChild.childNodes);
        }
      }
      
      for (const child of children) {
        if (child.nodeType === Node.TEXT_NODE && !child.textContent?.trim()) {
          continue;
        }

        const currentPageHasContent = Array.from(currentPage.children).some(
          node => {
            const el = node as HTMLElement;
            return el.className !== 'page-number' && 
                   el.tagName.toLowerCase() !== 'h1' && 
                   el.className !== 'subtitle' && 
                   el.className !== 'pdf-header';
          }
        );

        // 1. 수동 page-break 식별 및 카테고리별(2., 3., 4. 등) 강제 페이지 분할
        if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as HTMLElement;
          const tagName = el.tagName.toLowerCase();
          
          const isPageBreak = el.className === 'page-break' || el.tagName.toLowerCase() === 'page-break';
          
          let isNewCategory = false;
          let isFirstCategory = false;
          if (tagName === 'h2') {
            const text = el.innerText || el.textContent || '';
            isFirstCategory = /^(1)\./.test(text.trim());
            isNewCategory = /^([2-9]|\d{2,})\./.test(text.trim());
          }

          if (isFirstCategory) {
            hasSeenFirstCategory = true;
          }

          if (isPageBreak) {
            if (!hasSeenFirstCategory) {
              // 1번 카테고리 시작 전의 page-break는 무시하여 표지와 1번 카테고리가 1페이지에 함께 나오도록 함
              continue;
            } else {
              currentPageNum++;
              currentPage = createNewPage(currentPageNum);
              continue;
            }
          }

          if (isNewCategory && currentPageHasContent) {
            currentPageNum++;
            currentPage = createNewPage(currentPageNum);
          }
        }

        // 2. 임시 렌더 및 자동 높이 초과 여부 측정
        const clone = child.cloneNode(true) as HTMLElement;
        currentPage.appendChild(clone);
        
        // 브라우저 렌더 트리 강제 갱신(reflow)
        void currentPage.offsetHeight;

        let contentHeight = 0;
        for (const node of Array.from(currentPage.children)) {
          const el = node as HTMLElement;
          if (el.className !== 'page-number') {
            contentHeight += getElementFullHeight(el);
          }
        }

        // 현재 페이지에 포함된 실 콘텐츠 개수 측정 (헤더/페이지 번호 제외)
        const contentChildrenCount = Array.from(currentPage.children).filter(
          node => {
            const el = node as HTMLElement;
            return el.className !== 'page-number' && 
                   el.tagName.toLowerCase() !== 'h1' && 
                   el.className !== 'subtitle' && 
                   el.className !== 'pdf-header';
          }
        ).length;

        // 높이가 기준치를 초과하고 페이지에 이미 콘텐츠가 있는 경우에만 다음 페이지로 넘김
        if (contentHeight > MAX_CONTENT_HEIGHT && contentChildrenCount > 1) {
          currentPage.removeChild(clone);
          currentPageNum++;
          currentPage = createNewPage(currentPageNum);
          currentPage.appendChild(clone);
          void currentPage.offsetHeight;
        }
      }

      // 최종 페이지 번호 텍스트 일괄 갱신 (- 1 / 3 -)
      pages.forEach((page, idx) => {
        const pageNumEl = page.querySelector('.page-number') as HTMLDivElement;
        if (pageNumEl) {
          pageNumEl.innerText = `- ${idx + 1} / ${pages.length} -`;
        }
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();
        
        const canvas = await html2canvas(pages[i], {
          scale: 2.2,
          useCORS: true,
          width: 794,
          height: 1123,
          windowWidth: 794,
          windowHeight: 1123,
          backgroundColor: '#ffffff'
        });
        
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }

      document.body.removeChild(container);
      pdf.save(filename);
    } catch (err: any) {
      console.error("AI Report PDF Generation Error:", err);
      alert(`PDF 다운로드 실패: ${err.message}`);
    }
  };

  const categoryData = useMemo(() => {
    let hwCount = 0;
    let netCount = 0;
    let swCount = 0;
    let printerCount = 0;
    let etcCount = 0;

    filteredRequests.forEach(r => {
      const text = (r.content || '').toLowerCase();
      if (
        text.includes('pc') || text.includes('노트북') || text.includes('데스크탑') || 
        text.includes('cpu') || text.includes('메모리') || text.includes('ram') || 
        text.includes('하드') || text.includes('ssd') || text.includes('파워') || 
        text.includes('부팅') || text.includes('전원') || text.includes('그래픽카드') || 
        text.includes('gpu') || text.includes('메인보드') || text.includes('바이오스') || 
        text.includes('bios') || text.includes('본체') || text.includes('모니터') || 
        text.includes('키보드') || text.includes('마우스') || text.includes('컴퓨터') || 
        text.includes('디스크') || text.includes('헤드셋') || text.includes('이어폰') || 
        text.includes('스피커') || text.includes('멀티탭') || text.includes('케이블') || 
        text.includes('젠더') || text.includes('조립') || text.includes('부품') || 
        text.includes('쿨러') || text.includes('팬') || text.includes('케이스') || 
        text.includes('usb') || text.includes('외장하드')
      ) {
        hwCount++;
      } else if (
        text.includes('인터넷') || text.includes('네트워크') || text.includes('lan') || 
        text.includes('공유기') || text.includes('와이파이') || text.includes('wifi') || 
        text.includes('접속') || text.includes('허브') || text.includes('ip') ||
        text.includes('dns') || text.includes('방화벽') || text.includes('vpn') || 
        text.includes('스위치') || text.includes('인터넷전화') || text.includes('인터넷 전화') || 
        text.includes('랜선') || text.includes('utp') || text.includes('서버') || 
        text.includes('나스') || text.includes('nas') || text.includes('포트') || 
        text.includes('ping')
      ) {
        netCount++;
      } else if (
        text.includes('윈도우') || text.includes('windows') || text.includes('오피스') || 
        text.includes('office') || text.includes('한글') || text.includes('엑셀') || 
        text.includes('excel') || text.includes('워드') || text.includes('word') || 
        text.includes('파워포인트') || text.includes('ppt') || text.includes('일러스트') || 
        text.includes('포토샵') || text.includes('오토캐드') || text.includes('autocad') || 
        text.includes('백신') || text.includes('v3') || text.includes('알약') || 
        text.includes('카스퍼스키') || text.includes('kaspersky') || text.includes('프로그램') || 
        text.includes('설치') || text.includes('인증') || text.includes('소프트웨어') ||
        text.includes('라이센스') || text.includes('업데이트') || text.includes('포맷') || 
        text.includes('복구') || text.includes('메일') || text.includes('아웃룩') || 
        text.includes('outlook') || text.includes('계정') || text.includes('오류') || 
        text.includes('에러') || text.includes('크롬') || text.includes('chrome') || 
        text.includes('엣지') || text.includes('edge') || text.includes('웨일') || 
        text.includes('whale') || text.includes('브라우저') || text.includes('압축') || 
        text.includes('폰트') || text.includes('뷰어') || text.includes('pdf')
      ) {
        swCount++;
      } else if (
        text.includes('프린터') || text.includes('복합기') || text.includes('토너') || 
        text.includes('잉크') || text.includes('인쇄') || text.includes('출력') || 
        text.includes('스캔') || text.includes('팩스') || text.includes('드라이버') || 
        text.includes('용지') || text.includes('용지걸림') || text.includes('급지') || 
        text.includes('복사') || text.includes('드럼') || text.includes('스캐너') || 
        text.includes('출력물')
      ) {
        printerCount++;
      } else {
        etcCount++;
      }
    });

    return [
      { name: 'PC / 하드웨어', count: hwCount, color: '#f59e0b' },
      { name: '네트워크 / 인터넷', count: netCount, color: '#3b82f6' },
      { name: '소프트웨어 / OS', count: swCount, color: '#10b981' },
      { name: '프린터 / 복합기', count: printerCount, color: '#ec4899' },
      { name: '기타 문의', count: etcCount, color: '#6b7280' }
    ].filter(item => item.count > 0);
  }, [filteredRequests]);

  const statusPieData = {
    labels: (statusData || []).filter(d => d.status !== 'pending').map(d => getStatusLabel(d.status)), 
    datasets: [{
      data: (statusData || []).filter(d => d.status !== 'pending').map(d => d.count),
      backgroundColor: ['#ff9800', '#10b981', '#8b5cf6'],
    }],
  };

  const customerPieData = {
    labels: customerShareData.map(d => d.name),
    datasets: [{
      data: customerShareData.map(d => d.count),
      backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#94a3b8'],
    }],
  };

  const categoryPieData = {
    labels: categoryData.map(d => d.name),
    datasets: [{
      data: categoryData.map(d => d.count),
      backgroundColor: categoryData.map(d => d.color),
    }],
  };

  const barChartData = {
    labels: (monthlyData || []).map(d => d.month),
    datasets: [{
      label: selectedCustomer === 'all' ? '전체 업무 건수' : `${selectedCustomer} 업무 추이`,
      data: (monthlyData || []).map(d => d.total_requests),
      backgroundColor: 'rgba(103, 58, 183, 0.75)',
      hoverBackgroundColor: 'rgba(103, 58, 183, 0.95)',
      borderColor: '#673ab7',
      borderWidth: 1,
      borderRadius: 6,
      borderSkipped: false,
    }],
  };

  return (
    <Container maxWidth="lg">
      <Helmet><title>대시보드 | COMTOOIN</title></Helmet>
      
      {/* 표준 헤더 섹션 */}
      <Box sx={{ mb: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <DashboardIcon sx={{ fontSize: '2.2rem', color: 'primary.main' }} />
          <Typography variant="h5" component="h1" fontWeight="bold">
            대시보드
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          업무 기록 데이터를 기반으로 기간별, 거래처별 통계를 분석합니다.
        </Typography>
      </Box>

      <Divider sx={{ mb: 2.5 }} />

      {/* 에러 알림창 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={{ xs: 1, sm: 1.5 }} sx={{ mb: 2 }}>
        {[
          { label: '전체', count: summaryStats.total, statusFilter: 'all', icon: <AssignmentIcon sx={{ fontSize: 16, color: 'text.secondary', opacity: 0.7 }} /> },
          { label: '처리중', count: summaryStats.processing, statusFilter: 'processing', icon: <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary', opacity: 0.7 }} /> },
          { label: '완료됨', count: summaryStats.completed, statusFilter: 'completed', icon: <CheckCircleIcon sx={{ fontSize: 16, color: 'text.secondary', opacity: 0.7 }} /> },
        ].map((item, idx) => {
          const isActive = status === item.statusFilter;
          return (
            <Grid item xs={4} key={idx}>
              <Paper 
                variant="outlined" 
                onClick={() => setStatus(item.statusFilter)}
                sx={{ 
                  p: { xs: 1, sm: 1.2 },
                  borderRadius: 1,
                  bgcolor: isActive ? 'action.selected' : 'background.paper',
                  borderColor: isActive ? 'primary.main' : 'divider',
                  borderWidth: isActive ? '1.5px' : '1px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
                  '&:hover': { 
                    borderColor: 'primary.main',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={{ xs: 0.5, sm: 1 }}>
                  <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                    {item.icon}
                  </Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      fontSize: { xs: '0.625rem', sm: '0.7rem' },
                      fontWeight: 700,
                      color: 'text.secondary',
                      letterSpacing: '0.02em',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {item.label}
                  </Typography>
                  <Typography 
                    sx={{ 
                      fontSize: { xs: '0.85rem', sm: '0.95rem' },
                      fontWeight: 800,
                      color: 'text.primary',
                      lineHeight: 1
                    }}
                  >
                    {item.count}
                  </Typography>
                </Stack>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      {/* 필터 및 액션 섹션 */}
      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mb: { xs: 1.5, sm: 2 }, borderRadius: 1, bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1.5, alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between' }}>
          
          {/* 좌측: 필터 영역 */}
          <Box sx={{ display: 'flex', gap: 1, flex: '1 1 auto', flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
            <TextField 
              select 
              label="거래처" 
              size="small"
              fullWidth
              value={selectedCustomer} 
              onChange={(e) => setSelectedCustomer(e.target.value)} 
              disabled={userRole === 'customer'}
              sx={{ '& .MuiInputBase-root': { fontSize: '0.8125rem' } }}
            >
              {userRole === 'customer' && (
                <MenuItem value={selectedCustomer} sx={{ fontSize: '0.8125rem' }}>{selectedCustomer}</MenuItem>
              )}
              {userRole !== 'customer' && (
                <MenuItem value="all" sx={{ fontSize: '0.8125rem' }}>전체 거래처</MenuItem>
              )}
              {userRole !== 'customer' && customers.map((name: string) => (
                <MenuItem key={name} value={name} sx={{ fontSize: '0.8125rem' }}>{name}</MenuItem>
              ))}
            </TextField>
            <TextField 
              select 
              label="기간" 
              size="small"
              fullWidth
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)} 
              sx={{ '& .MuiInputBase-root': { fontSize: '0.8125rem' } }}
            >
              <MenuItem value="all" sx={{ fontSize: '0.8125rem' }}>전체 기간</MenuItem>
              <MenuItem value="today" sx={{ fontSize: '0.8125rem' }}>오늘 (금일)</MenuItem>
              {allMonths.map(month => <MenuItem key={month} value={month} sx={{ fontSize: '0.8125rem' }}>{month}</MenuItem>)}
            </TextField>
            <TextField 
              select 
              label="상태" 
              size="small"
              fullWidth
              value={status} 
              onChange={(e) => setStatus(e.target.value)} 
              sx={{ '& .MuiInputBase-root': { fontSize: '0.8125rem' } }}
            >
              <MenuItem value="all" sx={{ fontSize: '0.8125rem' }}>전체 상태</MenuItem>
              <MenuItem value="processing" sx={{ fontSize: '0.8125rem' }}>처리중</MenuItem>
              <MenuItem value="completed" sx={{ fontSize: '0.8125rem' }}>처리완료</MenuItem>
            </TextField>
          </Box>

          {/* 우측: 버튼 영역 */}
          <Grid container spacing={1} sx={{ width: { xs: '100%', md: 'auto' }, justifyContent: 'flex-end' }}>
            {userRole !== 'customer' && (
              <Grid item xs={12} sm="auto">
                <Button 
                  fullWidth
                  variant="contained" 
                  color="primary"
                  startIcon={<EditNoteIcon />}
                  onClick={() => setWorkLogOpen(true)}
                  sx={{ 
                    fontWeight: 'bold', 
                    height: '38px', 
                    fontSize: '0.75rem', 
                    borderRadius: 1,
                    whiteSpace: 'nowrap'
                  }}
                >
                  새 업무 등록
                </Button>
              </Grid>
            )}
            <Grid item xs={4} sm="auto">
              <Button 
                fullWidth
                variant={userRole === 'customer' ? "contained" : "outlined"} 
                onClick={() => applyFilters(true)} 
                startIcon={isMobile ? null : <SearchIcon sx={{ fontSize: 18 }} />}
                sx={{ 
                  fontWeight: 'bold', 
                  height: '36px', 
                  fontSize: { xs: '0.7rem', sm: '0.75rem' }, 
                  borderRadius: 1,
                  px: { xs: 0.5, sm: 2 },
                  whiteSpace: 'nowrap',
                  ...(userRole === 'customer' ? {
                    bgcolor: 'primary.main',
                    color: '#ffffff',
                    '&:hover': {
                      bgcolor: 'primary.dark'
                    }
                  } : {
                    bgcolor: 'rgba(51, 65, 85, 0.06)',
                    color: '#334155',
                    borderColor: '#334155',
                    '&:hover': {
                      bgcolor: 'rgba(51, 65, 85, 0.12)',
                      borderColor: '#0f172a'
                    }
                  })
                }}
              >
                조회
              </Button>
            </Grid>
            <Grid item xs={4} sm="auto">
              <Button 
                fullWidth
                variant="outlined" 
                color="secondary" 
                startIcon={exportLoading ? <CircularProgress size={16} color="inherit" /> : <FileDownloadIcon sx={{ fontSize: 18, display: { xs: 'none', sm: 'inline-block' } }} />}
                onClick={handleExportExcel}
                disabled={exportLoading}
                sx={{ 
                  fontWeight: 'bold', 
                  fontSize: { xs: '0.7rem', sm: '0.75rem' }, 
                  height: '36px', 
                  borderRadius: 1,
                  px: { xs: 0.5, sm: 2 },
                  whiteSpace: 'nowrap'
                }}
              >
                {exportLoading ? "중..." : "다운로드"}
              </Button>
            </Grid>
            <Grid item xs={4} sm="auto">
              <Button 
                fullWidth
                variant="outlined" 
                onClick={handleMoreMenuClick}
                endIcon={isMobile ? null : <KeyboardArrowDownIcon />}
                sx={{ 
                  fontWeight: 'bold', 
                  height: '36px', 
                  fontSize: { xs: '0.7rem', sm: '0.75rem' }, 
                  borderRadius: 1,
                  color: '#64748b',
                  borderColor: '#cbd5e1',
                  px: { xs: 0.5, sm: 2 },
                  whiteSpace: 'nowrap',
                  '&:hover': {
                    bgcolor: 'rgba(100, 116, 139, 0.04)',
                    borderColor: '#94a3b8'
                  }
                }}
              >
                더보기
              </Button>
              <Menu
                anchorEl={moreAnchorEl}
                open={isMoreMenuOpen}
                onClose={handleMoreMenuClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                sx={{
                  '& .MuiPaper-root': {
                    borderRadius: 1.5,
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                    border: '1px solid',
                    borderColor: 'divider',
                    minWidth: 175
                  }
                }}
              >
                <MenuItem 
                  onClick={() => {
                    handleMoreMenuClose();
                    handleGenerateAiReport();
                  }}
                  disabled={isGenerating || filteredRequests.length === 0}
                  sx={{ py: 1 }}
                >
                  <ListItemIcon sx={{ minWidth: '28px !important', color: '#673ab7' }}>
                    {isGenerating ? <CircularProgress size={16} color="inherit" /> : <AiIcon fontSize="small" />}
                  </ListItemIcon>
                  <ListItemText 
                    primary={isGenerating ? "AI 리포트 생성 중..." : "AI 분석 리포트 생성"} 
                    primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#673ab7' }} 
                  />
                </MenuItem>
                
                {userRole !== 'customer' && [
                  <MenuItem 
                    key="upload"
                    component="label"
                    sx={{ py: 1 }}
                  >
                    <ListItemIcon sx={{ minWidth: '28px !important' }}>
                      <FileUploadIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="데이터 업로드 (.csv)" primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 'bold' }} />
                    <input type="file" hidden accept=".csv" onChange={(e) => {
                      handleMoreMenuClose();
                      handleImportCsv(e);
                    }} />
                  </MenuItem>,
                  <MenuItem 
                    key="sample"
                    onClick={() => {
                      handleMoreMenuClose();
                      handleDownloadSampleCsv();
                    }}
                    sx={{ py: 1 }}
                  >
                    <ListItemIcon sx={{ minWidth: '28px !important' }}>
                      <DescriptionIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="업로드 샘플 다운로드" primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 'bold' }} />
                  </MenuItem>
                ]}
              </Menu>
            </Grid>
          </Grid>
        </Box>
        {(selectedCategoryFilter !== 'all' || 
          status !== 'all' || 
          selectedMonth !== 'all' || 
          (userRole !== 'customer' && selectedCustomer !== 'all')) && (
          <Box sx={{ mt: 1.5, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>활성 필터:</Typography>
            
            {userRole !== 'customer' && selectedCustomer !== 'all' && (
              <Chip 
                label={`거래처: ${selectedCustomer}`} 
                onDelete={() => setSelectedCustomer('all')} 
                color="primary"
                size="small"
                variant="outlined"
                sx={{ borderRadius: 1, fontWeight: 'bold' }}
              />
            )}
            
            {selectedMonth !== 'all' && (
              <Chip 
                label={`기간: ${selectedMonth === 'today' ? '오늘' : selectedMonth}`} 
                onDelete={() => setSelectedMonth('all')} 
                color="primary"
                size="small"
                variant="outlined"
                sx={{ borderRadius: 1, fontWeight: 'bold' }}
              />
            )}
            
            {status !== 'all' && (
              <Chip 
                label={`상태: ${status === 'processing' ? '처리중' : status === 'completed' ? '처리완료' : status}`} 
                onDelete={() => setStatus('all')} 
                color="primary"
                size="small"
                variant="outlined"
                sx={{ borderRadius: 1, fontWeight: 'bold' }}
              />
            )}

            {selectedCategoryFilter !== 'all' && (
              <Chip 
                label={`업무 유형: ${selectedCategoryFilter}`} 
                onDelete={() => setSelectedCategoryFilter('all')} 
                color="primary"
                size="small"
                variant="outlined"
                sx={{ borderRadius: 1, fontWeight: 'bold' }}
              />
            )}

            <Chip 
              icon={<RestartAltIcon sx={{ fontSize: '1rem !important' }} />}
              label="필터 초기화" 
              onClick={handleResetAllFilters} 
              color="error"
              size="small"
              sx={{ borderRadius: 1, fontWeight: 'bold', ml: { xs: 0, sm: 0.5 }, cursor: 'pointer' }}
            />
          </Box>
        )}
      </Paper>

      {/* 탭 섹션 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} textColor="primary" indicatorColor="primary">
          <Tab 
            label={userRole === 'customer' ? "시각화 분석" : "업무 상세 리스트"} 
            sx={{ fontWeight: 'bold' }} 
          />
          <Tab 
            label={userRole === 'customer' ? "업무 상세 리스트" : "시각화 분석"} 
            sx={{ fontWeight: 'bold' }} 
          />
        </Tabs>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{ pt: 1 }}>
          {showList && (
            <Box sx={{ minHeight: 400 }}>
              {isMobile ? (
                <Stack spacing={1.5} sx={{ mb: 2 }}>
                  {paginatedRequests.length > 0 ? paginatedRequests.map((request) => (
                    <Paper 
                      key={request.id} 
                      variant="outlined" 
                      onClick={() => {
                        setSelectedRequest(request);
                        setOpenDetailModal(true);
                      }}
                      sx={{ 
                        p: 1.5, 
                        borderRadius: 1, 
                        cursor: 'pointer',
                        '&:active': { bgcolor: 'action.selected' }
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'medium', fontSize: '0.7rem' }}>
                          {(() => {
                            const d = new Date(request.created_at);
                            return `${d.getFullYear().toString().substring(2)}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`;
                          })()}
                        </Typography>
                        <Chip 
                          label={getStatusLabel(request.status)} 
                          color={getStatusChipColor(request.status)} 
                          size="small" 
                          variant="filled" 
                          sx={{ fontWeight: 'bold', fontSize: '0.6rem', height: '18px', borderRadius: 1 }} 
                        />
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2" fontWeight="bold" sx={{ color: 'text.primary', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {request.customer_name}
                        </Typography>
                        <Typography variant="caption" fontWeight="bold" color="primary.main" sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                          {request.user_name}
                        </Typography>
                      </Box>

                      <Divider sx={{ my: 0.8, opacity: 0.5 }} />

                      <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', lineHeight: 1.4 }}>
                        {stripHtmlTags(request.content)}
                      </Typography>
                    </Paper>
                  )) : (
                    <Paper variant="outlined" sx={{ p: 8, textAlign: 'center', borderRadius: 1, bgcolor: 'background.paper' }}>
                      <Typography color="text.secondary">표시할 데이터가 없습니다.</Typography>
                    </Paper>
                  )}
                </Stack>
              ) : (
                <Paper variant="outlined" sx={{ borderRadius: 1, overflow: 'hidden', mb: 2, bgcolor: 'background.paper' }}>
                  <TableContainer>
                        <Table stickyHeader size="small" sx={{ tableLayout: 'auto', minWidth: 850 }}>
                          <TableHead sx={{ bgcolor: 'grey.50' }}>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold', py: 2, pl: 3, pr: 1, width: '130px' }} sortDirection={sortConfig?.key === 'created_at' ? sortConfig.direction : false}>
                                <TableSortLabel active={sortConfig?.key === 'created_at'} direction={sortConfig?.key === 'created_at' ? sortConfig.direction : 'asc'} onClick={() => handleSort('created_at')}>
                                  업무일자
                                </TableSortLabel>
                              </TableCell>
                              <TableCell sx={{ fontWeight: 'bold', py: 2, px: 1, width: '120px' }} sortDirection={sortConfig?.key === 'customer_name' ? sortConfig.direction : false}>
                                <TableSortLabel active={sortConfig?.key === 'customer_name'} direction={sortConfig?.key === 'customer_name' ? sortConfig.direction : 'asc'} onClick={() => handleSort('customer_name')}>
                                  거래처명
                                </TableSortLabel>
                              </TableCell>
                              <TableCell sx={{ fontWeight: 'bold', py: 2, px: 1, width: '90px' }} sortDirection={sortConfig?.key === 'requester_name' ? sortConfig.direction : false}>
                                <TableSortLabel active={sortConfig?.key === 'requester_name'} direction={sortConfig?.key === 'requester_name' ? sortConfig.direction : 'asc'} onClick={() => handleSort('requester_name')}>
                                  요청자
                                </TableSortLabel>
                              </TableCell>
                              <TableCell sx={{ fontWeight: 'bold', py: 2, px: 1, width: '90px' }} sortDirection={sortConfig?.key === 'user_name' ? sortConfig.direction : false}>
                                <TableSortLabel active={sortConfig?.key === 'user_name'} direction={sortConfig?.key === 'user_name' ? sortConfig.direction : 'asc'} onClick={() => handleSort('user_name')}>
                                  작성자
                                </TableSortLabel>
                              </TableCell>
                              {!isMobile && (
                                <TableCell sx={{ fontWeight: 'bold', py: 2, px: 1 }}>접수내용 요약</TableCell>
                              )}
                              <TableCell align="center" sx={{ fontWeight: 'bold', py: 2, px: 1, width: '85px' }} sortDirection={sortConfig?.key === 'status' ? sortConfig.direction : false}>
                                <TableSortLabel active={sortConfig?.key === 'status'} direction={sortConfig?.key === 'status' ? sortConfig.direction : 'asc'} onClick={() => handleSort('status')}>
                                  상태
                                </TableSortLabel>
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {paginatedRequests.length > 0 ? paginatedRequests.map((request) => (
                              <TableRow 
                                key={request.id} 
                                hover
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setOpenDetailModal(true);
                                }}
                                sx={{ cursor: 'pointer', '&:active': { bgcolor: 'action.selected' } }}
                              >
                                <TableCell sx={{ py: 2, pl: 3, pr: 1, whiteSpace: 'nowrap', color: 'text.secondary', fontSize: '0.8125rem', letterSpacing: '-0.01em' }}>
                                  {(() => {
                                    const d = new Date(request.created_at);
                                    return `${d.getFullYear().toString().substring(2)}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
                                  })()}
                                </TableCell>
                                <TableCell sx={{ py: 2, px: 1, fontWeight: 'medium', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8125rem', letterSpacing: '-0.01em' }}>
                                  {request.customer_name}
                                </TableCell>
                                <TableCell sx={{ py: 2, px: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8125rem', letterSpacing: '-0.01em' }}>
                                  {request.requester_name}
                                </TableCell>
                                <TableCell sx={{ py: 2, px: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8125rem', letterSpacing: '-0.01em' }}>
                                  {request.user_name}
                                </TableCell>
                                {!isMobile && (
                                  <TableCell sx={{ py: 2, px: 1 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '-0.01em', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {stripHtmlTags(request.content)}
                                    </Typography>
                                  </TableCell>
                                )}
                                <TableCell align="center" sx={{ py: 2, px: 1 }}>
                                  <Chip 
                                    label={getStatusLabel(request.status)} 
                                    color={getStatusChipColor(request.status)} 
                                    size="small" 
                                    variant="outlined" 
                                    sx={{ fontWeight: 'bold', fontSize: '0.7rem', width: '65px', letterSpacing: '-0.01em', borderRadius: 1 }} 
                                  />
                                </TableCell>
                              </TableRow>
                            )) : (
                              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 10 }}><Typography color="text.secondary">데이터가 없습니다.</Typography></TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                  </TableContainer>
                </Paper>
              )}
              {/* 페이지네이션 추가 */}
              {filteredRequests.length > ITEMS_PER_PAGE && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2.5 }}>
                  <Pagination 
                    count={Math.ceil(filteredRequests.length / ITEMS_PER_PAGE)} 
                    page={page} 
                    onChange={handlePageChange} 
                    color="primary"
                    size="medium"
                  />
                </Box>
              )}
            </Box>
          )}

          {showVisualization && (
            <Grid container spacing={3}>
              {/* 1. 월별 업무 처리 추이 (Bar) */}
              <Grid item xs={12} md={userRole === 'customer' ? 6 : 6}>
                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, height: '100%', bgcolor: 'background.paper' }}>
                  <Stack direction="row" spacing={1} justifyContent="flex-start" mb={2} alignItems="center">
                    <BarChartIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight="bold">월별 업무 처리 추이</Typography>
                  </Stack>
                  <Box sx={{ height: 260, mt: 1 }}>
                    <Bar data={barChartData} options={{ 
                      maintainAspectRatio: false, 
                      plugins: { 
                        legend: { display: false },
                        tooltip: {
                          backgroundColor: '#1e293b',
                          titleFont: { size: 13, weight: 'bold' },
                          bodyFont: { size: 12 },
                          padding: 10,
                          cornerRadius: 8,
                          displayColors: false
                        }
                      },
                      scales: {
                        y: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b' } },
                        x: { grid: { display: false }, ticks: { color: '#64748b' } }
                      },
                      onClick: (event, elements) => {
                        if (elements.length > 0) {
                          const index = elements[0].index;
                          const label = barChartData.labels[index];
                          setSelectedMonth(label);
                          setTabValue(userRole === 'customer' ? 1 : 0);
                        }
                      }
                    }} />
                  </Box>
                </Paper>
              </Grid>

              {/* 2. 상태별 업무 비중 (Pie) */}
              <Grid item xs={12} md={userRole === 'customer' ? 3 : 3}>
                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, height: '100%', bgcolor: 'background.paper' }}>
                  <Stack direction="row" spacing={1} justifyContent="center" mb={2} alignItems="center">
                    <PieChartIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight="bold">업무 처리 상태</Typography>
                  </Stack>
                  <Box sx={{ height: 260, display: 'flex', justifyContent: 'center', mt: 1 }}>
                    <Pie data={statusPieData} options={{ 
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
                      },
                      onClick: (event, elements) => {
                        if (elements.length > 0) {
                          const index = elements[0].index;
                          const label = statusPieData.labels[index];
                          let filterStatus = 'all';
                          if (label === '처리중') filterStatus = '처리중';
                          else if (label === '완료') filterStatus = '처리완료';
                          else if (label === '취소') filterStatus = 'cancelled';
                          
                          setStatus(filterStatus);
                          setTabValue(userRole === 'customer' ? 1 : 0);
                        }
                      }
                    }} />
                  </Box>
                </Paper>
              </Grid>

              {/* 3. 장애 및 지원 유형 분석 (Doughnut) */}
              <Grid item xs={12} md={userRole === 'customer' ? 3 : 3}>
                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, height: '100%', bgcolor: 'background.paper' }}>
                  <Stack direction="row" spacing={1} justifyContent="center" mb={2} alignItems="center">
                    <PieChartIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight="bold">장애 및 지원 유형</Typography>
                  </Stack>
                  <Box sx={{ height: 260, display: 'flex', justifyContent: 'center', mt: 1 }}>
                    <Pie data={categoryPieData} options={{ 
                      maintainAspectRatio: false,
                      cutout: '60%',
                      plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
                      },
                      onClick: (event, elements) => {
                        if (elements.length > 0) {
                          const index = elements[0].index;
                          const label = categoryPieData.labels[index];
                          setSelectedCategoryFilter(label);
                          setTabValue(userRole === 'customer' ? 1 : 0);
                        }
                      }
                    }} />
                  </Box>
                </Paper>
              </Grid>

              {/* 4. 거래처별 업무 점유율 (Staff 전용) */}
              {userRole !== 'customer' && (
                <Grid item xs={12} md={12}>
                  <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, bgcolor: 'background.paper' }}>
                    <Stack direction="row" spacing={1} justifyContent="flex-start" mb={2} alignItems="center">
                      <BusinessIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" fontWeight="bold">거래처별 업무 분담 비율 (TOP 6)</Typography>
                    </Stack>
                    <Box sx={{ height: 280, display: 'flex', justifyContent: 'center', mt: 1 }}>
                      <Box sx={{ width: '100%', maxWidth: 450 }}>
                        <Pie data={customerPieData} options={{ 
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
                          },
                          onClick: (event, elements) => {
                            if (elements.length > 0) {
                              const index = elements[0].index;
                              const label = customerPieData.labels[index];
                              setSelectedCustomer(label);
                              setTabValue(userRole === 'customer' ? 1 : 0);
                            }
                          }
                        }} />
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              )}
            </Grid>
          )}
        </Box>
      )}

      {/* AI 리포트 미리보기 모달 */}
      <Dialog 
        open={aiModalOpen} 
        onClose={() => setAiModalOpen(false)}
        maxWidth="lg"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '12px 8px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 16px)' },
            maxWidth: { xs: 'calc(100% - 16px)', sm: 'lg' }
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold' }}>
          <AiIcon color="secondary" />
          AI 유지보수 분석 리포트 미리보기 (A4 레이아웃)
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, bgcolor: '#f1f5f9' }}>
          <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, overflowY: 'auto', maxHeight: '70vh' }}>
            {previewPages.map((pageHtml, idx) => (
              <Paper 
                key={idx}
                elevation={3}
                sx={{ 
                  width: '794px',
                  height: '1123px',
                  bgcolor: '#ffffff',
                  padding: '50px 50px 70px 50px',
                  boxSizing: 'border-box',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif",
                  color: '#333333',
                  flexShrink: 0,
                  transformOrigin: 'top center',
                  '@media (max-width: 850px)': {
                    transform: 'scale(0.8)',
                    mb: -25
                  },
                  '@media (max-width: 600px)': {
                    transform: 'scale(0.5)',
                    mb: -56
                  },
                  '& h1': { fontSize: '20px', fontWeight: 'bold', textAlign: 'center', mt: 0, mb: 1, color: '#111111' },
                  '& .subtitle': { fontSize: '11px', textAlign: 'center', mb: 2, color: '#666666', borderBottom: '2px solid #673ab7', pb: 1 },
                  '& .pdf-header': { fontSize: '11px', color: '#999999', borderBottom: '1px solid #eee', pb: 1, mb: 3 },
                  '& h2': { fontSize: '15px', fontWeight: 'bold', mt: 2, mb: 1, color: '#673ab7', borderBottom: '1px solid #ddd', pb: 0.5 },
                  '& h3': { fontSize: '13px', fontWeight: 'bold', mt: 1.5, mb: 1, color: '#333333' },
                  '& p': { fontSize: '13px', lineHeight: 1.7, mb: 1, textAlign: 'justify', color: '#333333' },
                  '& ul': { pl: 2.5, mb: 1, fontSize: '13px', lineHeight: 1.7, color: '#333333' },
                  '& li': { mb: 0.5, color: '#333333' },
                  '& table': { width: '100%', borderCollapse: 'collapse', my: 1.5, fontSize: '12.5px', color: '#333333' },
                  '& th': { bgcolor: '#f5f5f5', border: '1px solid #ddd', p: 1, fontWeight: 'bold', textAlign: 'center', color: '#333333' },
                  '& td': { border: '1px solid #ddd', p: 1, lineHeight: 1.5, color: '#333333' },
                  '& strong, & b, & span, & div': { color: '#333333' },
                  '& h1 *, & h2 *, & .pdf-header *': { color: 'inherit' }
                }}
              >
                {/* Content */}
                <Box sx={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: pageHtml }} />

                {/* Page Number */}
                <Box 
                  sx={{ 
                    position: 'absolute',
                    bottom: '30px',
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    fontSize: '11px',
                    color: '#999999'
                  }}
                >
                  - {idx + 1} / {previewPages.length} -
                </Box>
              </Paper>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button 
            variant="contained" 
            color="success" 
            onClick={handleDownloadAiReport}
            sx={{ fontWeight: 'bold', px: 3, borderRadius: 2 }}
          >
            PC에 다운로드 (PDF)
          </Button>
          <Button 
            variant="contained" 
            color="secondary"
            onClick={() => {
              // HTML 태그 제거하여 텍스트만 복사
              const tempElement = document.createElement('div');
              tempElement.innerHTML = aiReportContent;
              navigator.clipboard.writeText(tempElement.innerText || tempElement.textContent || '');
              alert('리포트 내용이 클립보드에 복사되었습니다.');
            }}
            sx={{ fontWeight: 'bold', px: 3, borderRadius: 2 }}
          >
            내용 복사
          </Button>
          <Button onClick={() => setAiModalOpen(false)} color="inherit" variant="outlined" sx={{ borderRadius: 2 }}>닫기</Button>
        </DialogActions>
      </Dialog>
      
      {/* 엑셀/CSV 업로드 검증 모달 */}
      <Dialog 
        open={validationOpen} 
        onClose={() => !importing && setValidationOpen(false)} 
        maxWidth="lg" 
        fullWidth
        scroll="paper"
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '12px 8px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 16px)' },
            maxWidth: { xs: 'calc(100% - 16px)', sm: 'lg' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <FileUploadIcon color="primary" />
          업로드 데이터 검증 결과
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {/* 요약 밴너 */}
          {(() => {
            const errCount = parsedRows.filter(r => r.errors.length > 0).length;
            const isValid = errCount === 0;
            return (
              <Box sx={{ 
                p: 2, 
                bgcolor: isValid ? 'rgba(46, 125, 50, 0.08)' : 'rgba(211, 47, 47, 0.08)',
                color: isValid ? 'success.main' : 'error.main',
                borderBottom: '1px solid',
                borderColor: isValid ? 'success.light' : 'error.light',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <Typography variant="body2" fontWeight="bold">
                  총 {parsedRows.length}행 중 정상 {parsedRows.length - errCount}행, 오류 {errCount}행 발견
                </Typography>
                {!isValid && (
                  <Typography variant="caption" sx={{ bgcolor: 'error.main', color: 'white', px: 1, py: 0.5, borderRadius: 1, fontWeight: 'bold' }}>
                    가져오기 제한됨 (오류 발생)
                  </Typography>
                )}
              </Box>
            );
          })()}

          {/* 데이터 목록 표 */}
          <TableContainer sx={{ maxHeight: '60vh' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f1f5f9' }}>행</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f1f5f9', minWidth: 100 }}>업무일시</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f1f5f9', minWidth: 120 }}>거래처명</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f1f5f9' }}>요청자</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f1f5f9' }}>작성자</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f1f5f9' }}>상태</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f1f5f9', minWidth: 200 }}>접수내용</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f1f5f9', minWidth: 150 }}>처리내용</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f1f5f9', minWidth: 180 }}>검증결과</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {parsedRows.map((row) => {
                  const hasRowError = row.errors.length > 0;
                  return (
                    <TableRow 
                      key={row.index}
                      sx={{ 
                        bgcolor: hasRowError ? 'rgba(211, 47, 47, 0.04)' : 'inherit',
                        '&:hover': { bgcolor: hasRowError ? 'rgba(211, 47, 47, 0.08)' : 'rgba(0, 0, 0, 0.04)' }
                      }}
                    >
                      <TableCell sx={{ color: hasRowError ? 'error.main' : 'inherit', fontWeight: hasRowError ? 'bold' : 'normal' }}>
                        {row.index}
                      </TableCell>
                      <TableCell sx={{ color: hasRowError ? 'error.main' : 'inherit' }}>
                        {row.createdAtRaw || <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>(자동생성)</span>}
                      </TableCell>
                      <TableCell sx={{ color: hasRowError && !row.customerName ? 'error.main' : 'inherit', fontWeight: hasRowError && !row.customerName ? 'bold' : 'normal' }}>
                        {row.customerName || <span style={{ color: '#ef4444' }}>[누락]</span>}
                      </TableCell>
                      <TableCell>{row.requesterName || '-'}</TableCell>
                      <TableCell>{row.userName}</TableCell>
                      <TableCell>
                        <Chip 
                          label={row.statusRaw || (row.status === 'completed' ? '처리완료' : '처리중')} 
                          size="small"
                          color={row.status === 'completed' ? 'success' : 'warning'}
                          variant="outlined"
                          sx={{ borderRadius: 1 }}
                        />
                      </TableCell>
                      <TableCell sx={{ 
                        color: hasRowError && !row.content ? 'error.main' : 'inherit', 
                        fontWeight: hasRowError && !row.content ? 'bold' : 'normal',
                        maxWidth: 300,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {row.content || <span style={{ color: '#ef4444' }}>[누락]</span>}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.processNote || '-'}
                      </TableCell>
                      <TableCell>
                        {hasRowError ? (
                          <Box sx={{ color: 'error.main', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {row.errors.map((err: string, i: number) => (
                              <span key={i}>⚠️ {err}</span>
                            ))}
                          </Box>
                        ) : (
                          <span style={{ color: '#2e7d32', fontSize: '0.85rem', fontWeight: 'bold' }}>✓ 통과</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleExecuteImport}
            disabled={importing || parsedRows.some(row => row.errors.length > 0)}
            startIcon={importing && <CircularProgress size={16} color="inherit" />}
            sx={{ fontWeight: 'bold' }}
          >
            {importing ? '가져오는 중...' : '가져오기 완료'}
          </Button>
          <Button onClick={() => setValidationOpen(false)} disabled={importing} variant="outlined" color="inherit">
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      {/* 신규 업무 기록 등록 모달 */}
      <Dialog 
        open={workLogOpen} 
        onClose={() => {
          if (!submitting) setWorkLogOpen(false);
        }} 
        maxWidth="md" 
        fullWidth
        transitionDuration={0}
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: 2,
            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditNoteIcon color="action" sx={{ fontSize: '1.25rem' }} />
          <span>신규 업무 기록 등록</span>
        </DialogTitle>
        <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
          <Box component="form" onSubmit={handleSubmitWorkLog}>
            <Stack spacing={3}>
              {/* 기본 정보 */}
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.primary' }}>
                  <InfoIcon color="primary" sx={{ fontSize: '1.1rem' }} /> 기본 정보
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
                      options={customers}
                      value={customerName}
                      onChange={(event, newValue) => {
                        setCustomerName(newValue || '');
                      }}
                      onInputChange={(event, newInputValue) => {
                        setCustomerName(newInputValue || '');
                      }}
                      disabled={submitting}
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
                    <TextField select label="작성자" fullWidth required variant="outlined" size="small" value={userName} onChange={(e) => setUserName(e.target.value)} disabled={submitting}>
                      {staffOptions.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                  </Grid>
                </Grid>
              </Box>

              <Divider />

              {/* 접수 및 처리 내용 */}
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.primary' }}>
                  <AssignmentIcon color="primary" sx={{ fontSize: '1.1rem' }} /> 접수 및 처리 내용
                </Typography>
                <Stack spacing={2.5}>
                  <TextField label="요청자 (고객 담당자)" required fullWidth variant="outlined" size="small" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} disabled={submitting} />
                  
                  <Box>
                    <Box sx={{ 
                      display: "flex", 
                      flexDirection: { xs: 'column', sm: 'row' }, 
                      alignItems: { xs: 'flex-start', sm: 'center' }, 
                      justifyContent: "space-between", 
                      gap: { xs: 1, sm: 0 },
                      mb: 1 
                    }}>
                      <Typography variant="body2" fontWeight="bold" color="text.secondary" noWrap sx={{ flexShrink: 0, mr: 1 }}>접수내용 (필수)</Typography>
                      <Stack direction="row" spacing={1}>
                        <Button 
                          variant="outlined" 
                          size="small" 
                          startIcon={<MicIcon sx={{ fontSize: '0.85rem !important' }} />} 
                          onClick={() => handleVoiceInput('content')} 
                          sx={{ 
                            fontWeight: 'bold',
                            fontSize: '0.7rem', height: '26px', borderRadius: 1,
                            minWidth: '60px', px: 1, whiteSpace: 'nowrap',
                            borderColor: isListening === 'content' ? 'primary.main' : 'divider' 
                          }}
                          color={isListening === 'content' ? 'primary' : 'inherit'}
                          disabled={!!isPolishing || submitting}
                        >
                          {isListening === 'content' ? '인식 중...' : '음성'}
                        </Button>
                        <Button 
                          variant="outlined" 
                          size="small" 
                          startIcon={isPolishing === 'content' ? <CircularProgress size={10} color="inherit" /> : <AiIcon sx={{ fontSize: '0.85rem !important' }} />} 
                          onClick={() => handlePolishText('content')} 
                          sx={{ 
                            fontWeight: 'bold',
                            fontSize: '0.7rem', height: '26px', borderRadius: 1,
                            minWidth: '68px', px: 1, whiteSpace: 'nowrap',
                            color: '#673ab7', borderColor: '#673ab7',
                            '&:hover': { bgcolor: 'rgba(103, 58, 183, 0.04)', borderColor: '#512da8' }
                          }}
                          disabled={!!isPolishing || !!isListening || submitting}
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
                      disabled={submitting}
                      placeholder="업무 요청 내용을 상세히 입력해주세요."
                    />
                  </Box>

                  <Box>
                    <Box sx={{ 
                      display: "flex", 
                      flexDirection: { xs: 'column', sm: 'row' }, 
                      alignItems: { xs: 'flex-start', sm: 'center' }, 
                      justifyContent: "space-between", 
                      gap: { xs: 1, sm: 0 },
                      mb: 1 
                    }}>
                      <Typography variant="body2" fontWeight="bold" color="text.secondary" noWrap sx={{ flexShrink: 0, mr: 1 }}>처리내용 (선택)</Typography>
                      <Stack direction="row" spacing={1}>
                        <Button 
                          variant="outlined" 
                          size="small" 
                          startIcon={<MicIcon sx={{ fontSize: '0.85rem !important' }} />} 
                          onClick={() => handleVoiceInput('processingContent')} 
                          sx={{ 
                            fontWeight: 'bold',
                            fontSize: '0.7rem', height: '26px', borderRadius: 1,
                            minWidth: '60px', px: 1, whiteSpace: 'nowrap',
                            borderColor: isListening === 'processingContent' ? 'primary.main' : 'divider' 
                          }}
                          color={isListening === 'processingContent' ? 'primary' : 'inherit'}
                          disabled={!!isPolishing || submitting}
                        >
                          {isListening === 'processingContent' ? '인식 중...' : '음성'}
                        </Button>
                        <Button 
                          variant="outlined" 
                          size="small" 
                          startIcon={isPolishing === 'processingContent' ? <CircularProgress size={10} color="inherit" /> : <AiIcon sx={{ fontSize: '0.85rem !important' }} />} 
                          onClick={() => handlePolishText('processingContent')} 
                          sx={{ 
                            fontWeight: 'bold',
                            fontSize: '0.7rem', height: '26px', borderRadius: 1,
                            minWidth: '68px', px: 1, whiteSpace: 'nowrap',
                            color: '#673ab7', borderColor: '#673ab7',
                            '&:hover': { bgcolor: 'rgba(103, 58, 183, 0.04)', borderColor: '#512da8' }
                          }}
                          disabled={!!isPolishing || !!isListening || submitting}
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
                      disabled={submitting}
                      placeholder="처리 내용을 입력하면 자동으로 '처리완료' 상태로 저장됩니다." 
                    />
                  </Box>

                  {/* 이미지 첨부 */}
                  <Box sx={{ mt: 1, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                      <Button 
                        variant="outlined" 
                        component="label" 
                        startIcon={<PhotoCameraIcon />} 
                        size="small"
                        disabled={submitting}
                        sx={{ fontWeight: 'bold', height: '36px', fontSize: '0.75rem', borderRadius: 1, color: 'text.secondary', borderColor: 'divider' }}
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
                                disabled={submitting}
                                onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))} 
                                sx={{ position: 'absolute', top: -6, right: -6, bgcolor: 'background.paper', border: '1px solid #e2e8f0', p: 0.2, '&:hover': { bgcolor: 'error.lighter', color: 'error.main' } }}
                              >
                                <DeleteIcon sx={{ fontSize: '0.9rem' }} />
                              </IconButton>
                            </Box>
                          ))}
                        </Stack>
                      )}
                    </Box>
                  </Box>
                </Stack>
              </Box>

              {logError && <Alert severity="error" sx={{ borderRadius: 1.5 }}>{logError}</Alert>}
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button 
            variant="outlined" 
            onClick={() => setWorkLogOpen(false)} 
            disabled={submitting}
            sx={{ fontWeight: 'bold', borderRadius: 1.5 }}
          >
            취소
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSubmitWorkLog} 
            disabled={submitting}
            sx={{ fontWeight: 'bold', borderRadius: 1.5 }}
          >
            {submitting ? <CircularProgress size={20} color="inherit" /> : "저장"}
          </Button>
        </DialogActions>
      </Dialog>

      <RequestDetailModal 
        open={openDetailModal} 
        request={selectedRequest} 
        onClose={() => setOpenDetailModal(false)} 
        onRefresh={applyFilters} 
      />
    </Container>
  );
};

export default AdminReportPage;
