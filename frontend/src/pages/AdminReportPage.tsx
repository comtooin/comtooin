import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Box, Paper, CircularProgress, Alert, Button, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Divider, TextField, MenuItem, Grid, Tabs, Tab
} from '@mui/material';
import { BarChart as BarChartIcon } from '@mui/icons-material';
import axios from 'axios';
import { Helmet } from 'react-helmet-async';
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title
} from 'chart.js';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const API_URL = process.env.NODE_ENV === 'production' ? '' : process.env.REACT_APP_API_URL || 'http://localhost:3001';

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
    count: number; 
}

// --- COMPONENT START ---
const AdminReportPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filteredRequests, setFilteredRequests] = useState<IRequest[]>([]);
  const navigate = useNavigate();

  // Filter states
  const [customers, setCustomers] = useState<string[]>([]);
  const [allMonths, setAllMonths] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [status, setStatus] = useState('all');

  // Tab and Chart states
  const [tabValue, setTabValue] = useState(0);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Fetch data for filters (runs once)
  const fetchInitialData = useCallback(async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
      return;
    }
    try {
        const [customersRes, summaryRes] = await Promise.all([
            axios.get(`${API_URL}/api/admin/customers`, { headers: { Authorization: `Bearer ${token}` } }),
            axios.get(`${API_URL}/api/admin/reports/summary`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setCustomers(customersRes.data || []);
        setAllMonths((summaryRes.data.monthly || []).map((m: MonthlySummary) => m.month));
    } catch (err) {
        console.error("Failed to fetch initial data", err);
        setError('필터 옵션을 불러오는 중 오류가 발생했습니다.');
    }
  }, [navigate]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const applyFilters = useCallback(async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
      return;
    }

    const params = {
      customerName: selectedCustomer === 'all' ? null : selectedCustomer,
      month: selectedMonth === 'all' ? null : selectedMonth,
      status: status === 'all' ? null : status,
    };

    try {
      const [requestsRes, summaryRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/requests`, { headers: { Authorization: `Bearer ${token}` }, params }),
        axios.get(`${API_URL}/api/admin/reports/summary`, { headers: { Authorization: `Bearer ${token}` }, params })
      ]);
      
      setFilteredRequests(requestsRes.data || []);
      setStatusData(summaryRes.data.status || []);
      setMonthlyData(summaryRes.data.monthly || []);

    } catch (err: any) {
      console.error("Failed to apply filters", err);
      setError(err.response?.data?.error || '리포트 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [navigate, selectedCustomer, selectedMonth, status]);

  // Initial data fetch on component mount
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleExportExcel = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/api/admin/reports/excel`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { 
          customerName: selectedCustomer === 'all' ? '' : selectedCustomer,
          month: selectedMonth === 'all' ? '' : selectedMonth,
          status: status === 'all' ? '' : status,
        },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const fileName = `Comtooin_Report.xlsx`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Failed to export Excel", err);
      setError(err.response?.data?.error || 'Excel 다운로드 중 오류가 발생했습니다.');
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
      data: (monthlyData || []).map(d => d.count),
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