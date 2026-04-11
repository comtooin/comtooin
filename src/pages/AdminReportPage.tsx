import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography, Box, Paper, CircularProgress, Alert, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Divider, TextField, MenuItem, Grid, Tabs, Tab, Stack, Card, CardContent
} from '@mui/material';
import { 
  BarChart as BarChartIcon, 
  Assignment as AssignmentIcon,
  AccessTime as AccessTimeIcon,
  CheckCircle as CheckCircleIcon,
  Business as BusinessIcon,
  PieChart as PieChartIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { supabase } from '../api'; 
import { Helmet } from 'react-helmet-async';
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title
} from 'chart.js';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const stripHtmlTags = (html: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
};

const formatMobileDateTime = (dateTimeString: string) => {
  const date = new Date(dateTimeString);
  return `${date.getFullYear().toString().substring(2, 4)}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
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
  const [error, setError] = useState(''); // 에러 상태 복구
  const [filteredRequests, setFilteredRequests] = useState<IRequest[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [allMonths, setAllMonths] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [status, setStatus] = useState('all');
  const [tabValue, setTabValue] = useState(0);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlySummary[]>([]);

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
    <>
      <Helmet><title>유지보수 분석 리포트</title></Helmet>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <AssessmentIcon sx={{ mr: 1.5, fontSize: '1.75rem', color: 'primary.main' }} />
        <Typography variant="h5" component="h1">유지보수 분석 리포트</Typography>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* 에러 알림창 (변수 사용 확인) */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* 요약 위젯 */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined" sx={{ borderLeft: '4px solid #607d8b' }}>
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <AssignmentIcon color="primary" />
                <Typography variant="overline">총 업무 기록</Typography>
              </Stack>
              <Typography variant="h4">{summaryStats.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4}>
          <Card variant="outlined" sx={{ borderLeft: '4px solid #ed6c02' }}>
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <AccessTimeIcon color="warning" />
                <Typography variant="overline">처리중</Typography>
              </Stack>
              <Typography variant="h4">{summaryStats.processing}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4}>
          <Card variant="outlined" sx={{ borderLeft: '4px solid #2e7d32' }}>
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircleIcon color="success" />
                <Typography variant="overline">처리완료</Typography>
              </Stack>
              <Typography variant="h4">{summaryStats.completed}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 필터 섹션 */}
      <Grid container spacing={2} alignItems="center" sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <TextField select label="거래처 선택" fullWidth value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)} size="small">
              <MenuItem value="all"><em>전체 거래처</em></MenuItem>
              {customers.map((name: string) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField select label="기간(월)" fullWidth value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} size="small">
              <MenuItem value="all"><em>전체 기간</em></MenuItem>
              {allMonths.map(month => <MenuItem key={month} value={month}>{month}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField select label="상태" fullWidth value={status} onChange={(e) => setStatus(e.target.value)} size="small">
            <MenuItem value="all"><em>전체 상태</em></MenuItem>
            <MenuItem value="processing">처리중</MenuItem>
            <MenuItem value="completed">처리완료</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={applyFilters} fullWidth>조회</Button>
            <Button variant="outlined" color="secondary" onClick={handleExportExcel} fullWidth>Excel</Button>
          </Stack>
        </Grid>
      </Grid>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="업무 상세 리스트" />
          <Tab label="시각화 분석" />
        </Tabs>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{ pt: 1 }}>
          {tabValue === 0 && (
            <TableContainer component={Paper}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>업무일시</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>거래처명</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>요청자</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>작성자</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>상태</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>접수내용 요약</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRequests.length > 0 ? filteredRequests.map((request) => (
                    <TableRow key={request.id} hover>
                      <TableCell><Typography variant="body2">{formatMobileDateTime(request.created_at)}</Typography></TableCell>
                      <TableCell><Typography variant="body2" fontWeight="medium">{request.customer_name}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{request.requester_name}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{request.user_name}</Typography></TableCell>
                      <TableCell>
                        <Chip label={getStatusLabel(request.status)} color={getStatusChipColor(request.status)} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {stripHtmlTags(request.content).substring(0, 40)}...
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 10 }}>데이터가 없습니다.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {tabValue === 1 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Stack direction="row" spacing={1} justifyContent="center" mb={2}>
                    <PieChartIcon color="action" fontSize="small" />
                    <Typography variant="subtitle2">상태별 업무 비중</Typography>
                  </Stack>
                  <Box sx={{ height: 250, display: 'flex', justifyContent: 'center' }}>
                    <Pie data={statusPieData} options={{ maintainAspectRatio: false }} />
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Stack direction="row" spacing={1} justifyContent="center" mb={2}>
                    <BusinessIcon color="action" fontSize="small" />
                    <Typography variant="subtitle2">거래처별 업무 점유율</Typography>
                  </Stack>
                  <Box sx={{ height: 250, display: 'flex', justifyContent: 'center' }}>
                    <Pie data={customerPieData} options={{ maintainAspectRatio: false }} />
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Stack direction="row" spacing={1} justifyContent="center" mb={2}>
                    <BarChartIcon color="action" fontSize="small" />
                    <Typography variant="subtitle2">월별 업무 추이</Typography>
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
    </>
  );
};

export default AdminReportPage;
