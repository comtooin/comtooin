import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography, Box, Paper, CircularProgress, Alert, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Divider, TextField, MenuItem, Grid, Tabs, Tab, Stack, Container, Pagination
} from '@mui/material';
import { 
  BarChart as BarChartIcon, 
  Assignment as AssignmentIcon,
  AccessTime as AccessTimeIcon,
  CheckCircle as CheckCircleIcon,
  Business as BusinessIcon,
  PieChart as PieChartIcon,
  Assessment as AssessmentIcon,
  AutoAwesome as AiIcon,
  FileDownload as FileDownloadIcon,
  FileUpload as FileUploadIcon,
  Description as DescriptionIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { supabase } from '../api'; 
import { Helmet } from 'react-helmet-async';
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title
} from 'chart.js';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filteredRequests, setFilteredRequests] = useState<IRequest[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [allMonths, setAllMonths] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [status, setStatus] = useState('all');
  const [tabValue, setTabValue] = useState(0);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlySummary[]>([]);

  // 페이지네이션 상태
  const [page, setPage] = useState(1);

  // AI 리포트 관련 상태
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiReportContent, setAiReportContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentYear = new Date().getFullYear();

  const summaryStats = useMemo(() => {
    const total = filteredRequests.length;
    const processing = filteredRequests.filter(r => r.status === 'processing' || r.status === 'pending' || r.status === '처리중').length;
    const completed = filteredRequests.filter(r => r.status === 'completed' || r.status === '처리완료').length;
    return { total, processing, completed };
  }, [filteredRequests]);

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

  const applyFilters = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      let requestsQuery = supabase.from('requests').select('*, comments(*)');

      if (selectedCustomer !== 'all') {
        requestsQuery = requestsQuery.eq('customer_name', selectedCustomer);
      }
      if (status !== 'all') {
        const dbStatus = status === '처리중' ? 'processing' : status === '처리완료' ? 'completed' : status;
        requestsQuery = requestsQuery.eq('status', dbStatus);
      }
      if (selectedMonth !== 'all') {
        const year = selectedMonth.split('-')[0];
        const month = selectedMonth.split('-')[1];
        const startDate = `${year}-${month}-01T00:00:00.000Z`;
        const endDate = `${year}-${month}-${new Date(Number(year), Number(month), 0).getDate()}T23:59:59.999Z`;
        requestsQuery = requestsQuery.gte('created_at', startDate).lte('created_at', endDate);
      }
      requestsQuery = requestsQuery.order('created_at', { ascending: false });

      const { data: requestsData, error: requestsError } = await requestsQuery;
      if (requestsError) throw requestsError;
      setFilteredRequests(requestsData || []);
      setPage(1); // 필터 적용 시 페이지 리셋

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
  }, [selectedCustomer, selectedMonth, status, currentYear]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  const paginatedRequests = filteredRequests.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

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

        let actualFileName = `컴투인_유지보수_리포트_${new Date().toISOString().split('T')[0]}.csv`; 
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

    if (!window.confirm('선택한 파일의 데이터를 대량 등록하시겠습니까?\n기존 형식과 일치해야 합니다.')) return;

    setLoading(true);
    setError('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        
        // 데이터 추출 (헤더: ID, 업무일시, 거래처명, 요청자, 작성자, 상태, 접수내용, 처리내용)
        const requestsToInsert: any[] = [];
        const processNotes: string[] = []; // 처리내용 임시 보관

        lines.slice(1).forEach(line => {
          if (!line.trim()) return;
          const values = line.split(',');
          
          const customerName = values[2]?.trim();
          const content = values[6]?.trim();

          // 거래처명(2)과 접수내용(6)이 모두 있는 경우만 진짜 데이터로 인정
          if (customerName && content) {
            requestsToInsert.push({
              created_at: values[1] ? new Date(values[1]).toISOString() : new Date().toISOString(),
              customer_name: customerName,
              requester_name: values[3]?.trim(),
              user_name: values[4]?.trim() || '관리자',
              status: values[5]?.trim() === '처리완료' ? 'completed' : 'processing',
              content: content,
            });
            processNotes.push(values[7]?.trim() || '');
          }
        });

        if (requestsToInsert.length === 0) {
          throw new Error('등록할 유효한 데이터가 없습니다.');
        }

        // 1. Requests 삽입
        const { data: insertedRequests, error: insertError } = await supabase
          .from('requests')
          .insert(requestsToInsert)
          .select();

        if (insertError) throw insertError;

        // 2. 처리내용(Comments) 삽입
        if (insertedRequests && insertedRequests.length > 0) {
          const commentsToInsert: any[] = [];
          const { data: { session } } = await supabase.auth.getSession();

          insertedRequests.forEach((req, index) => {
            const note = processNotes[index];
            if (note) {
              commentsToInsert.push({
                request_id: req.id,
                comment: note,
                user_id: session?.user?.id,
              });
            }
          });

          if (commentsToInsert.length > 0) {
            await supabase.from('comments').insert(commentsToInsert);
          }
        }

        alert(`${requestsToInsert.length}건의 업무 기록이 성공적으로 등록되었습니다.`);
        applyFilters(); 
      } catch (err: any) {
        console.error("CSV Import Error:", err);
        alert(`업로드 실패: ${err.message}`);
        setError(err.message);
      } finally {
        setLoading(false);
        if (e.target) e.target.value = '';
      }
    };
    
    // 인코딩 감지 시도 (기본적으로 UTF-8로 읽고 실패하면 EUC-KR 고려)
    reader.readAsText(file); 
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

      setAiReportContent(data.report);
      setAiModalOpen(true);
    } catch (err: any) {
      console.error("AI Report Generation Error:", err);
      setError(`AI 리포트 생성 실패: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveAiReport = async () => {
    try {
      setIsSaving(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const response = await fetch(`${(supabase as any).supabaseUrl}/functions/v1/generate-ai-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          customerName: selectedCustomer,
          month: selectedMonth,
          action: 'save',
          content: aiReportContent
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      alert('리포트가 자료실에 성공적으로 저장되었습니다.');
      setAiModalOpen(false);
    } catch (err: any) {
      console.error("AI Report Save Error:", err);
      alert(`저장 실패: ${err.message}`);
    } finally {
      setIsSaving(false);
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
      <Helmet><title>리포트</title></Helmet>
      
      {/* 표준 헤더 섹션 */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <AssessmentIcon sx={{ fontSize: '2rem', color: 'primary.main' }} />
          <Typography variant="h5" component="h1" fontWeight="bold">
            리포트
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          업무 기록 데이터를 기반으로 기간별, 거래처별 통계를 분석합니다.
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* 에러 알림창 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* 요약 위젯 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: '총 업무 기록', count: summaryStats.total, icon: <AssignmentIcon fontSize="small" color="primary" />, color: '#607d8b' },
          { label: '처리 중', count: summaryStats.processing, icon: <AccessTimeIcon fontSize="small" color="warning" />, color: '#ed6c02' },
          { label: '처리 완료', count: summaryStats.completed, icon: <CheckCircleIcon fontSize="small" color="success" />, color: '#2e7d32' },
        ].map((item, idx) => (
          <Grid item xs={4} sm={4} key={idx}>
            <Paper 
              variant="outlined" 
              sx={{ 
                p: { xs: 1.5, sm: 2 }, 
                borderLeft: { xs: `4px solid ${item.color}`, sm: `6px solid ${item.color}` }, 
                borderRadius: 2,
                height: '100%'
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                {item.icon}
                <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                  {item.label}
                </Typography>
                <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' }, fontSize: '0.65rem' }}>
                  {item.label.replace(' 업무 기록', '').replace(' ', '')}
                </Typography>
              </Stack>
              <Typography variant="h6" fontWeight="bold" sx={{ mt: 0.5, ml: 0.5 }}>
                {item.count}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* 필터 및 액션 섹션 */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 3, bgcolor: 'background.paper' }}>
        <Stack spacing={2}>
          {/* 첫 번째 줄: 필터 및 조회 버튼 */}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', gap: 1, flexGrow: 1, width: '100%' }}>
              <TextField 
                select 
                label="거래처" 
                size="small"
                fullWidth
                value={selectedCustomer} 
                onChange={(e) => setSelectedCustomer(e.target.value)} 
                sx={{ '& .MuiInputBase-root': { fontSize: '0.8125rem' } }}
              >
                <MenuItem value="all" sx={{ fontSize: '0.8125rem' }}><em>전체 거래처</em></MenuItem>
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
                <MenuItem value="all" sx={{ fontSize: '0.8125rem' }}><em>전체 기간</em></MenuItem>
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
                <MenuItem value="all" sx={{ fontSize: '0.8125rem' }}><em>전체 상태</em></MenuItem>
                <MenuItem value="processing" sx={{ fontSize: '0.8125rem' }}>처리중</MenuItem>
                <MenuItem value="completed" sx={{ fontSize: '0.8125rem' }}>처리완료</MenuItem>
              </TextField>
            </Box>
            <Button 
              variant="contained" 
              onClick={applyFilters} 
              startIcon={<SearchIcon sx={{ fontSize: 18 }} />}
              sx={{ 
                fontWeight: 'bold', height: '36px', fontSize: '0.75rem', 
                minWidth: '90px', borderRadius: 2, width: { xs: '100%', md: 'auto' } 
              }}
            >
              조회
            </Button>
          </Box>

          <Divider />

          {/* 두 번째 줄: 액션 버튼들 (우측 정렬) */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            {/* 리포트 그룹 */}
            <Stack direction="row" spacing={1}>
              <Button 
                variant="outlined" 
                color="secondary" 
                startIcon={isGenerating ? <CircularProgress size={14} color="inherit" /> : <AiIcon />}
                onClick={handleGenerateAiReport}
                disabled={isGenerating || filteredRequests.length === 0}
                sx={{ 
                  fontWeight: 'bold', minWidth: '140px', fontSize: '0.75rem', height: '36px',
                  color: '#673ab7', borderColor: '#673ab7', 
                  '&:hover': { bgcolor: 'rgba(103, 58, 183, 0.04)', borderColor: '#512da8' }, 
                  borderRadius: 2
                }}
              >
                AI 분석 리포트
              </Button>
              <Button 
                variant="outlined" 
                color="secondary" 
                startIcon={<FileDownloadIcon sx={{ fontSize: 18 }} />}
                onClick={handleExportExcel}
                sx={{ fontWeight: 'bold', minWidth: '100px', fontSize: '0.75rem', height: '36px', borderRadius: 2 }}
              >
                내보내기
              </Button>
            </Stack>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, height: 24, my: 'auto', display: { xs: 'none', sm: 'block' } }} />

            {/* 데이터 그룹 */}
            <Stack direction="row" spacing={1}>
              <Button 
                variant="outlined" 
                color="info" 
                startIcon={<DescriptionIcon sx={{ fontSize: 18 }} />}
                onClick={handleDownloadSampleCsv}
                sx={{ fontWeight: 'bold', minWidth: '110px', fontSize: '0.75rem', height: '36px', borderRadius: 2 }}
              >
                샘플
              </Button>
              <Button 
                variant="outlined" 
                color="primary" 
                startIcon={<FileUploadIcon sx={{ fontSize: 18 }} />}
                component="label"
                sx={{ fontWeight: 'bold', minWidth: '90px', fontSize: '0.75rem', height: '36px', borderRadius: 2 }}
              >
                업로드
                <input type="file" hidden accept=".csv" onChange={handleImportCsv} />
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Paper>

      {/* 탭 섹션 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
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
            <>
              <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', mb: 2 }}>
                <TableContainer>
                      <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', minWidth: 850 }}>
                        <TableHead sx={{ bgcolor: 'grey.50' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', py: 2, pl: 3, pr: 1, width: '140px' }}>업무일자</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', py: 2, px: 1, width: '110px' }}>거래처명</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', py: 2, px: 1, width: '100px' }}>요청자</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', py: 2, px: 1, width: '95px' }}>작성자</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold', py: 2, px: 1, width: '85px' }}>상태</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', py: 2, px: 1 }}>접수내용 요약</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {paginatedRequests.length > 0 ? paginatedRequests.map((request) => (
                            <TableRow key={request.id} hover>
                              <TableCell sx={{ py: 2, pl: 3, pr: 1, whiteSpace: 'nowrap', color: 'text.secondary', fontSize: '0.8125rem', letterSpacing: '-0.01em' }}>
                                {(() => {
                                  const d = new Date(request.created_at);
                                  return `${d.getFullYear().toString().substring(2)}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
                                })()}
                              </TableCell>
                              <TableCell sx={{ py: 2, px: 1, fontWeight: 'medium', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8125rem', letterSpacing: '-0.01em' }}>
                                {request.customer_name}
                              </TableCell>
                              <TableCell sx={{ py: 2, px: 1, whiteSpace: 'nowrap', fontSize: '0.8125rem', letterSpacing: '-0.01em' }}>
                                {request.requester_name}
                              </TableCell>
                              <TableCell sx={{ py: 2, px: 1, whiteSpace: 'nowrap', fontSize: '0.8125rem', letterSpacing: '-0.01em' }}>
                                {request.user_name}
                              </TableCell>
                              <TableCell align="center" sx={{ py: 2, px: 1 }}>
                                <Chip 
                                  label={getStatusLabel(request.status)} 
                                  color={getStatusChipColor(request.status)} 
                                  size="small" 
                                  variant="outlined" 
                                  sx={{ fontWeight: 'bold', fontSize: '0.7rem', width: '65px', letterSpacing: '-0.01em' }} 
                                />
                              </TableCell>
                              <TableCell sx={{ py: 2, px: 1 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '-0.01em', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {stripHtmlTags(request.content)}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )) : (
                            <TableRow><TableCell colSpan={6} align="center" sx={{ py: 10 }}><Typography color="text.secondary">데이터가 없습니다.</Typography></TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                </TableContainer>
              </Paper>
              {/* 페이지네이션 추가 */}
              {filteredRequests.length > ITEMS_PER_PAGE && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
                  <Pagination 
                    count={Math.ceil(filteredRequests.length / ITEMS_PER_PAGE)} 
                    page={page} 
                    onChange={handlePageChange} 
                    color="primary"
                    size="medium"
                  />
                </Box>
              )}
            </>
          )}

          {tabValue === 1 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 3, height: '100%' }}>
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
                <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 3, height: '100%' }}>
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
                <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 3, height: '100%' }}>
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
        onClose={() => !isSaving && setAiModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold' }}>
          <AiIcon color="secondary" />
          AI 분석 리포트 초안 (미리보기)
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            * AI가 생성한 내용입니다. 필요시 내용을 수정한 후 저장하세요. 자료실(Google Drive)에 Google Doc 형식으로 저장됩니다.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={15}
            value={aiReportContent}
            onChange={(e) => setAiReportContent(e.target.value)}
            variant="outlined"
            sx={{ 
              '& .MuiOutlinedInput-root': { fontSize: '0.9rem', lineHeight: 1.6, fontFamily: 'monospace' }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setAiModalOpen(false)} disabled={isSaving}>취소</Button>
          <Button 
            variant="contained" 
            color="secondary" 
            onClick={handleSaveAiReport}
            disabled={isSaving}
            startIcon={isSaving && <CircularProgress size={16} color="inherit" />}
            sx={{ fontWeight: 'bold', px: 3, bgcolor: '#673ab7', '&:hover': { bgcolor: '#512da8' } }}
          >
            {isSaving ? '저장 중...' : '자료실에 저장'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminReportPage;
