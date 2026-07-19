import { format } from 'date-fns';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { RequestDetailModal } from '../components/RequestDetailModal';
import {
  Typography, Box, Paper, CircularProgress, Alert, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Divider, TextField, MenuItem, Grid, Tabs, Tab, Stack, Container, Pagination, useMediaQuery, useTheme, TableSortLabel
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
  Search as SearchIcon
} from '@mui/icons-material';
import { supabase, getCurrentStaffId } from '../api'; 
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
  const [error, setError] = useState('');
  const [allRequests, setAllRequests] = useState<IRequest[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [allMonths, setAllMonths] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('all');
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
    if (status === 'all') return allRequests;
    const dbStatus = status === '처리중' ? 'processing' : status === '처리완료' ? 'completed' : status;
    return allRequests.filter(r => {
      if (dbStatus === 'processing') return r.status === 'processing' || r.status === 'pending' || r.status === '처리중';
      if (dbStatus === 'completed') return r.status === 'completed' || r.status === '처리완료';
      return r.status === dbStatus;
    });
  }, [allRequests, status]);

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

  const fetchInitialData = useCallback(async () => {
      try {
          const { data: customerData } = await supabase.from('customers').select('name').order('name', { ascending: true });
          if (customerData) setCustomers(customerData.map(c => c.name));

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
          padding: 60px 50px 80px 50px;
          box-sizing: border-box;
          font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
          color: #333333;
          position: relative;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .pdf-page-preview h1 { font-size: 24px; font-weight: bold; text-align: center; margin-bottom: 10px; color: #111; }
        .pdf-page-preview .subtitle { font-size: 12px; text-align: center; margin-bottom: 30px; color: #666666; border-bottom: 2px solid #673ab7; padding-bottom: 15px; }
        .pdf-page-preview h2 { font-size: 18px; font-weight: bold; margin-top: 25px; margin-bottom: 12px; color: #673ab7; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
        .pdf-page-preview h3 { font-size: 14px; font-weight: bold; margin-top: 18px; margin-bottom: 8px; color: #333; }
        .pdf-page-preview p { font-size: 13.5px; line-height: 1.7; margin-bottom: 12px; text-align: justify; }
        .pdf-page-preview ul { padding-left: 20px; margin-bottom: 12px; font-size: 13.5px; line-height: 1.7; }
        .pdf-page-preview li { margin-bottom: 6px; }
        .pdf-page-preview table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px; }
        .pdf-page-preview th { background-color: #f5f5f5; border: 1px solid #ddd; padding: 8px; font-weight: bold; text-align: center; }
        .pdf-page-preview td { border: 1px solid #ddd; padding: 8px; line-height: 1.5; }
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
      const MAX_CONTENT_HEIGHT = 860; // 860px로 여유 공간 최적화

      let children = Array.from(parserDiv.childNodes);
      if (children.length === 1 && children[0].nodeType === Node.ELEMENT_NODE) {
        const firstChild = children[0] as HTMLElement;
        if (firstChild.tagName.toLowerCase() === 'div' || firstChild.tagName.toLowerCase() === 'section') {
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
          if (tagName === 'h2') {
            const text = el.innerText || el.textContent || '';
            isNewCategory = /^([2-9]|\d{2,})\./.test(text.trim());
          }

          if (isPageBreak || (isNewCategory && currentPageHasContent)) {
            currentPageNum++;
            currentPage = createNewPage(currentPageNum);
            if (isPageBreak) {
              continue;
            }
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
      let requestsQuery = supabase.from('requests').select('*, comments(*)');

      if (selectedCustomer !== 'all') {
        requestsQuery = requestsQuery.eq('customer_name', selectedCustomer);
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

      const { data: statusSummaryData } = await supabase.rpc('get_status_summary', {});
      setStatusData(statusSummaryData || []);

      const { data: monthlySummaryData } = await supabase.rpc('get_monthly_summary', { target_year: currentYear });
      setMonthlyData(monthlySummaryData as MonthlySummary[] || []);

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
        setLoading(true);
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
        setLoading(false);
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
          padding: 60px 50px 80px 50px;
          box-sizing: border-box;
          font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
          color: #333333;
          position: relative;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .pdf-page h1 { font-size: 24px; font-weight: bold; text-align: center; margin-bottom: 10px; color: #111; }
        .pdf-page .subtitle { font-size: 12px; text-align: center; margin-bottom: 30px; color: #666666; border-bottom: 2px solid #673ab7; padding-bottom: 15px; }
        .pdf-page h2 { font-size: 18px; font-weight: bold; margin-top: 40px; margin-bottom: 20px; color: #673ab7; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
        .pdf-page h3 { font-size: 14px; font-weight: bold; margin-top: 25px; margin-bottom: 15px; color: #333; }
        .pdf-page p { font-size: 14px; line-height: 1.85; margin-bottom: 20px; text-align: justify; }
        .pdf-page ul { padding-left: 20px; margin-bottom: 20px; font-size: 14px; line-height: 1.85; }
        .pdf-page li { margin-bottom: 10px; }
        .pdf-page table { width: 100%; border-collapse: collapse; margin: 25px 0; font-size: 13px; }
        .pdf-page th { background-color: #f5f5f5; border: 1px solid #ddd; padding: 12px; font-weight: bold; text-align: center; }
        .pdf-page td { border: 1px solid #ddd; padding: 12px; line-height: 1.6; }
        .pdf-page .page-number {
          position: absolute;
          bottom: 30px;
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
      const MAX_CONTENT_HEIGHT = 860; // 860px로 여유 공간 최적화

      // 최상위 래퍼 div가 단일로 존재할 경우 내부 자식들을 직접 가져오도록 언래핑
      let children = Array.from(parserDiv.childNodes);
      if (children.length === 1 && children[0].nodeType === Node.ELEMENT_NODE) {
        const firstChild = children[0] as HTMLElement;
        if (firstChild.tagName.toLowerCase() === 'div' || firstChild.tagName.toLowerCase() === 'section') {
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
          if (tagName === 'h2') {
            const text = el.innerText || el.textContent || '';
            isNewCategory = /^([2-9]|\d{2,})\./.test(text.trim());
          }

          if (isPageBreak || (isNewCategory && currentPageHasContent)) {
            currentPageNum++;
            currentPage = createNewPage(currentPageNum);
            if (isPageBreak) {
              continue;
            }
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

  const statusPieData = {
    labels: (statusData || []).filter(d => d.status !== 'pending').map(d => getStatusLabel(d.status)), 
    datasets: [{
      data: (statusData || []).filter(d => d.status !== 'pending').map(d => d.count),
      backgroundColor: ['#ed6c02', '#2e7d32', '#9966FF'],
    }],
  };

  const customerPieData = {
    labels: customerShareData.map(d => d.name),
    datasets: [{
      data: customerShareData.map(d => d.count),
      backgroundColor: ['#36A2EB', '#FFCE56', '#4BC0C0', '#FF6384', '#9966FF', '#C9CBCF'],
    }],
  };

  const barChartData = {
    labels: (monthlyData || []).map(d => d.month),
    datasets: [{
      label: selectedCustomer === 'all' ? '전체 업무 건수' : `${selectedCustomer} 업무 추이`,
      data: (monthlyData || []).map(d => d.total_requests),
      backgroundColor: 'rgba(96, 125, 139, 0.6)',
      borderColor: 'rgba(96, 125, 139, 1)',
      borderWidth: 1,
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

      {/* 요약 위젯 */}
      <Paper variant="outlined" sx={{ mb: 2, borderRadius: 2, display: 'flex', overflow: 'hidden', bgcolor: 'background.paper' }}>
        {[
          { label: '전체', shortLabel: '전체', count: summaryStats.total, statusFilter: 'all', icon: <AssignmentIcon fontSize="small" sx={{ color: '#607d8b' }} /> },
          { label: '처리중', shortLabel: '처리중', count: summaryStats.processing, statusFilter: 'processing', icon: <AccessTimeIcon fontSize="small" sx={{ color: '#ed6c02' }} /> },
          { label: '완료됨', shortLabel: '완료', count: summaryStats.completed, statusFilter: 'completed', icon: <CheckCircleIcon fontSize="small" sx={{ color: '#2e7d32' }} /> },
        ].map((item, idx, arr) => (
          <Box 
            key={idx}
            onClick={() => setStatus(item.statusFilter)}
            sx={{ 
              flex: 1, 
              p: { xs: 1.5, sm: 2 }, 
              borderRight: idx < arr.length - 1 ? '1px solid' : 'none',
              borderColor: 'divider',
              cursor: 'pointer',
              bgcolor: status === item.statusFilter ? 'rgba(0,0,0,0.04)' : 'transparent',
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
              sx={{ '& .MuiInputBase-root': { fontSize: '0.8125rem' } }}
            >
              <MenuItem value="all" sx={{ fontSize: '0.8125rem' }}>전체 거래처</MenuItem>
              {customers.map((name: string) => <MenuItem key={name} value={name} sx={{ fontSize: '0.8125rem' }}>{name}</MenuItem>)}
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
            <Grid item xs={6} sm="auto">
              <Button 
                fullWidth
                variant="contained" 
                onClick={() => applyFilters(true)} 
                startIcon={<SearchIcon sx={{ fontSize: 18 }} />}
                sx={{ fontWeight: 'bold', height: '36px', fontSize: '0.75rem', borderRadius: 1 }}
              >
                조회
              </Button>
            </Grid>
            <Grid item xs={6} sm="auto">
              <Button 
                fullWidth
                variant="outlined" 
                color="secondary" 
                startIcon={isGenerating ? <CircularProgress size={14} color="inherit" /> : <AiIcon />}
                onClick={handleGenerateAiReport}
                disabled={isGenerating || filteredRequests.length === 0}
                sx={{ 
                  fontWeight: 'bold', fontSize: '0.75rem', height: '36px',
                  color: '#673ab7', borderColor: '#673ab7', 
                  '&:hover': { bgcolor: 'rgba(103, 58, 183, 0.04)', borderColor: '#512da8' }, 
                  borderRadius: 1
                }}
              >
                AI 리포트
              </Button>
            </Grid>
            <Grid item xs={4} sm="auto">
              <Button 
                fullWidth
                variant="outlined" 
                color="secondary" 
                startIcon={<FileDownloadIcon sx={{ fontSize: 18, display: { xs: 'none', sm: 'inline-block' } }} />}
                onClick={handleExportExcel}
                sx={{ fontWeight: 'bold', fontSize: { xs: '0.7rem', sm: '0.75rem' }, height: '36px', borderRadius: 1, px: { xs: 0.5, sm: 2 } }}
              >
                다운로드
              </Button>
            </Grid>
            <Grid item xs={4} sm="auto">
              <Button 
                fullWidth
                variant="outlined" 
                color="primary" 
                startIcon={<FileUploadIcon sx={{ fontSize: 18, display: { xs: 'none', sm: 'inline-block' } }} />}
                component="label"
                sx={{ fontWeight: 'bold', fontSize: { xs: '0.7rem', sm: '0.75rem' }, height: '36px', borderRadius: 1, px: { xs: 0.5, sm: 2 } }}
              >
                업로드
                <input type="file" hidden accept=".csv" onChange={handleImportCsv} />
              </Button>
            </Grid>
            <Grid item xs={4} sm="auto">
              <Button 
                fullWidth
                variant="outlined" 
                color="info" 
                startIcon={<DescriptionIcon sx={{ fontSize: 18, display: { xs: 'none', sm: 'inline-block' } }} />}
                onClick={handleDownloadSampleCsv}
                sx={{ fontWeight: 'bold', fontSize: { xs: '0.65rem', sm: '0.75rem' }, height: '36px', borderRadius: 1, px: { xs: 0.5, sm: 2 } }}
              >
                업로드양식
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* 탭 섹션 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} textColor="primary" indicatorColor="primary">
          <Tab label="업무 상세 리스트" sx={{ fontWeight: 'bold' }} />
          <Tab label="시각화 분석" sx={{ fontWeight: 'bold' }} />
        </Tabs>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{ pt: 1 }}>
          {tabValue === 0 && (
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
                        '&:active': { bgcolor: 'action.selected' },
                        borderLeft: `4px solid ${getStatusChipColor(request.status) === 'success' ? '#2e7d32' : getStatusChipColor(request.status) === 'warning' ? '#ed6c02' : '#0288d1'}`
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
                          sx={{ fontWeight: 'bold', fontSize: '0.6rem', height: '18px' }} 
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
                                    sx={{ fontWeight: 'bold', fontSize: '0.7rem', width: '65px', letterSpacing: '-0.01em' }} 
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

          {tabValue === 1 && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 1, height: '100%' }}>
                  <Stack direction="row" spacing={1} justifyContent="center" mb={3}>
                    <PieChartIcon color="action" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight="bold">상태별 업무 비중</Typography>
                  </Stack>
                  <Box sx={{ height: 250, display: 'flex', justifyContent: 'center' }}>
                    <Pie data={statusPieData} options={{ maintainAspectRatio: false }} />
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={4}>
                <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 1, height: '100%' }}>
                  <Stack direction="row" spacing={1} justifyContent="center" mb={3}>
                    <BusinessIcon color="action" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight="bold">거래처별 업무 점유율</Typography>
                  </Stack>
                  <Box sx={{ height: 250, display: 'flex', justifyContent: 'center' }}>
                    <Pie data={customerPieData} options={{ maintainAspectRatio: false }} />
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={4}>
                <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 1, height: '100%' }}>
                  <Stack direction="row" spacing={1} justifyContent="center" mb={3}>
                    <BarChartIcon color="action" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight="bold">월별 업무 추이</Typography>
                  </Stack>
                  <Box sx={{ height: 250 }}>
                    <Bar data={barChartData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                  </Box>
                </Paper>
              </Grid>
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
                  padding: '60px 50px 80px 50px',
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
                  '& h1': { fontSize: '24px', fontWeight: 'bold', textAlign: 'center', mb: 1, color: '#111' },
                  '& .subtitle': { fontSize: '12px', textAlign: 'center', mb: 4, color: '#666666', borderBottom: '2px solid #673ab7', pb: 2 },
                  '& .pdf-header': { fontSize: '11px', color: '#999', borderBottom: '1px solid #eee', pb: 1, mb: 3 },
                  '& h2': { fontSize: '18px', fontWeight: 'bold', mt: 4, mb: 2, color: '#673ab7', borderBottom: '1px solid #ddd', pb: 1 },
                  '& h3': { fontSize: '14px', fontWeight: 'bold', mt: 2.5, mb: 1.5, color: '#333' },
                  '& p': { fontSize: '14px', lineHeight: 1.85, mb: 2, textAlign: 'justify' },
                  '& ul': { pl: 2.5, mb: 2, fontSize: '14px', lineHeight: 1.85 },
                  '& li': { mb: 1 },
                  '& table': { width: '100%', borderCollapse: 'collapse', my: 2.5, fontSize: '13px' },
                  '& th': { bgcolor: '#f5f5f5', border: '1px solid #ddd', p: 1.5, fontWeight: 'bold', textAlign: 'center' },
                  '& td': { border: '1px solid #ddd', p: 1.5, lineHeight: 1.6 }
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
          <Button onClick={() => setAiModalOpen(false)} color="inherit" variant="outlined" sx={{ borderRadius: 2 }}>닫기</Button>
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
        </DialogActions>
      </Dialog>
      
      {/* 엑셀/CSV 업로드 검증 모달 */}
      <Dialog 
        open={validationOpen} 
        onClose={() => !importing && setValidationOpen(false)} 
        maxWidth="lg" 
        fullWidth
        scroll="paper"
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
          <Button onClick={() => setValidationOpen(false)} disabled={importing} color="inherit">
            취소
          </Button>
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
