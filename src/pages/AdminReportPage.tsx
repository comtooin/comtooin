import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Box, Paper, CircularProgress, Alert, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Divider, TextField, MenuItem, Grid, Tabs, Tab
} from '@mui/material';
import { BarChart as BarChartIcon } from '@mui/icons-material';
import { supabase } from '../api'; // 수정됨: 중앙 API 모듈 임포트
import { Helmet } from 'react-helmet-async';
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title
} from 'chart.js';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

// 삭제됨: const API_URL = ...

const stripHtmlTags = (html: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
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

// --- COMPONENT START ---
const AdminReportPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filteredRequests, setFilteredRequests] = useState<IRequest[]>([]);


  // Filter states
  const [customers, setCustomers] = useState<string[]>([]);
  const [allMonths, setAllMonths] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [status, setStatus] = useState('all');
  const currentYear = new Date().getFullYear(); // 현재 연도 추가

  // Tab and Chart states
  const [tabValue, setTabValue] = useState(0);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlySummary[]>([]); // 타입 변경

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Fetch data for filters (runs once)
    const fetchInitialData = useCallback(async () => {
        try {
            const { data: rawData, error: customersError } = await supabase
                .from('requests')
                .select('customer_name')
                .neq('customer_name', null);

            if (customersError) {
                throw customersError;
            }
            // 데이터를 가져온 후 JavaScript에서 중복 제거
            const customersData = rawData
                ? Array.from(new Set(rawData.map(item => item.customer_name))).map(name => ({ customer_name: name }))
                : [];
            setCustomers((customersData || []).map((c: { customer_name: string }) => c.customer_name));

            // Fetch monthly summary using a Supabase RPC
            // RPC 함수에 target_year 매개변수 전달
            const { data: summaryData, error: summaryError } = await supabase.rpc('get_monthly_summary', { target_year: currentYear });

            if (summaryError) {
                throw summaryError;
            }
            // summaryData가 null일 경우 빈 배열로 처리
            setAllMonths((summaryData || []).map((m: MonthlySummary) => m.month));

        } catch (err: any) {
            console.error("Failed to fetch initial data", err);
            setError(err.message || '필터 옵션을 불러오는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false); // Set loading to false only after initial data is fetched
        }
    }, [currentYear]); // currentYear를 의존성 배열에 추가

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
        requestsQuery = requestsQuery.eq('status', status);
      }
      if (selectedMonth !== 'all') {
        // Assuming selectedMonth is in 'YYYY-MM' format
        const year = selectedMonth.split('-')[0];
        const month = selectedMonth.split('-')[1];
        const startDate = `${year}-${month}-01T00:00:00.000Z`;
        const endDate = `${year}-${month}-${new Date(Number(year), Number(month), 0).getDate()}T23:59:59.999Z`;
        requestsQuery = requestsQuery.gte('created_at', startDate).lte('created_at', endDate);
      }
      requestsQuery = requestsQuery.order('created_at', { ascending: false });

      const { data: requestsData, error: requestsError } = await requestsQuery;
      if (requestsError) {
        throw requestsError;
      }
      setFilteredRequests(requestsData || []);

      // Fetch summary data using Supabase RPCs
      const { data: statusSummaryData, error: statusSummaryError } = await supabase.rpc('get_status_summary');
      if (statusSummaryError) {
          throw statusSummaryError;
      }
      setStatusData(statusSummaryData || []);

      const { data: monthlySummaryData, error: monthlySummaryError } = await supabase.rpc('get_monthly_summary', { target_year: currentYear });
      if (monthlySummaryError) {
          throw monthlySummaryError;
      }
      setMonthlyData(monthlySummaryData as MonthlySummary[] || []);

    } catch (err: any) {
      console.error("Supabase apply filters error", err);
      setError(err.message || '리포트 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedCustomer, selectedMonth, status, currentYear]);

  // Initial data fetch on component mount
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleExportExcel = async () => {
    try {
        setLoading(true);
        setError('');

        const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
        if (!supabaseUrl) {
            throw new Error("Supabase URL is not defined in environment variables.");
        }
        // Construct the URL for the Edge Function. Assuming 'export-excel' is the function name.
        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/export-excel`;

        const payload = {
            customerName: selectedCustomer === 'all' ? null : selectedCustomer,
            month: selectedMonth === 'all' ? null : parseInt(selectedMonth.split('-')[1]), // Extract month number
            status: status === 'all' ? null : status
        };

        const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`, // Use ANON_KEY for edge functions
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${selectedCustomer}-${selectedMonth}-${status}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err: any) {
        console.error("Failed to export Excel", err);
        setError(err.message || 'Excel 다운로드 중 오류가 발생했습니다.');
    } finally {
        setLoading(false);
    }
  };

  // --- CHART DATA AND OPTIONS ---
  const pieChartData = {
    labels: (statusData || []).map(d => d.status),
    datasets: [{
      data: (statusData || []).map(d => d.count),
      backgroundColor: ['#36A2EB', '#FFCE56', '#4BC0C0', '#FF6384', '#9966FF'],
      hoverBackgroundColor: ['#36A2EB', '#FFCE56', '#4BC0C0', '#FF6384', '#9966FF'],
    }],
  };

  const barChartData = {
    labels: (monthlyData || []).map(d => d.month),
    datasets: [{
      label: '월별 접수 건수',
      data: (monthlyData || []).map(d => d.total_requests), // total_requests 사용
      backgroundColor: 'rgba(54, 162, 235, 0.6)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1,
    }],
  };

  const barChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: '월별 접수 현황' },
    },
  };

  return (
    <>
      <Helmet><title>리포트 및 통계</title></Helmet>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <BarChartIcon sx={{ mr: 1.5, fontSize: '2rem' }} />
        <Typography variant="h4" component="h1">리포트 및 통계</Typography>
      </Box>
      <Divider sx={{ mb: 3 }} />

      {/* --- FILTERS --- */}
      <Box sx={{ mb: 4, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField select label="고객사" value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)} size="small" sx={{ minWidth: 150 }}>
            <MenuItem value="all"><em>전체</em></MenuItem>
            {(customers || []).map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
        </TextField>
        <TextField select label="월 선택" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} size="small" sx={{ minWidth: 120 }}>
            <MenuItem value="all"><em>전체</em></MenuItem>
            {(allMonths || []).map(month => <MenuItem key={month} value={month}>{month}</MenuItem>)}
        </TextField>
        <TextField select label="상태" value={status} onChange={(e) => setStatus(e.target.value)} size="small" sx={{ minWidth: 120 }}>
          <MenuItem value="all"><em>전체</em></MenuItem>
          <MenuItem value="접수완료">접수완료</MenuItem>
          <MenuItem value="처리중">처리중</MenuItem>
          <MenuItem value="처리완료">처리완료</MenuItem>
        </TextField>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="contained" onClick={applyFilters} size="medium">필터 적용</Button>
            <Button variant="outlined" color="secondary" onClick={handleExportExcel} size="medium">Excel 내보내기</Button>
        </Box>
      </Box>

      {/* --- TABS --- */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="report tabs">
          <Tab label="상세 리스트" />
          <Tab label="요약 그래프" />
        </Tabs>
      </Box>

      {/* --- TAB PANELS --- */}
      {loading ? <CircularProgress sx={{mt: 4}} /> : error ? <Alert severity="error" sx={{mt: 4}}>{error}</Alert> : (
        <Box sx={{ pt: 3 }}>
          {tabValue === 0 && (
            <TableContainer component={Paper}>
              <Table stickyHeader>
                <TableHead><TableRow><TableCell>ID</TableCell><TableCell>접수일시</TableCell><TableCell>고객사명</TableCell><TableCell>사용자명</TableCell><TableCell>상태</TableCell><TableCell>처리내용</TableCell></TableRow></TableHead>
                <TableBody>
                  {(filteredRequests || []).length > 0 ? filteredRequests.map((request) => (
                    <TableRow key={request.id} hover>
                      <TableCell>{request.id}</TableCell>
                      <TableCell>{new Date(request.created_at).toLocaleString()}</TableCell>
                      <TableCell>{request.customer_name}</TableCell>
                      <TableCell>{request.user_name}</TableCell>
                      <TableCell><Chip label={request.status} size="small" /></TableCell>
                      <TableCell>{(request.comments || []).length > 0 ? stripHtmlTags(request.comments.map(c => c.comment).join(', ')) : ''}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={6} align="center">표시할 데이터가 없습니다.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {tabValue === 1 && (
            <Grid container spacing={4}>
              <Grid item xs={12} md={5}>
                <Typography variant="h6" align="center" gutterBottom>상태별 접수 현황</Typography>
                <Paper sx={{p: 2}}><Pie data={pieChartData} /></Paper>
              </Grid>
              <Grid item xs={12} md={7}>
                <Typography variant="h6" align="center" gutterBottom>월별 접수 현황</Typography>
                <Paper sx={{p: 2}}><Bar options={barChartOptions} data={barChartData} /></Paper>
              </Grid>
            </Grid>
          )}
        </Box>
      )}
    </>
  );
};

export default AdminReportPage;