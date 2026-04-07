import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Box, Paper, CircularProgress, Alert, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, InputLabel, FormControl, Grid,
  ButtonBase, TextField, Stack
} from '@mui/material';
import { Dashboard as DashboardIcon, Category as CategoryIcon, Sync as SyncIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { Helmet } from 'react-helmet-async';
import { supabase } from '../api';

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
  email: string;
  content: string;
  images: string[];
  status: string;
  created_at: string;
  updated_at: string;
  comments: IComment[];
}

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'pending': return '접수완료';
    case 'processing': return '처리중';
    case 'completed': return '처리완료';
    default: return status;
  }
};

const AdminDashboardPage: React.FC = () => {
  const [requests, setRequests] = useState<IRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedRequest, setSelectedRequest] = useState<IRequest | null>(null);
  const [openDetailModal, setOpenDetailModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [newComment, setNewComment] = useState('');
  const [saving, setSaving] = useState(false);

  const [summaryData, setSummaryData] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
  });
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('requests')
        .select('*, comments(*)')
        .order('created_at', { ascending: false });

      if (filterStatus) {
        query = query.eq('status', filterStatus);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setRequests(data || []);

      const { data: allRequests } = await supabase.from('requests').select('status');
      if (allRequests) {
        setSummaryData({
          total: allRequests.length,
          pending: allRequests.filter(req => req.status === 'pending').length,
          processing: allRequests.filter(req => req.status === 'processing').length,
          completed: allRequests.filter(req => req.status === 'completed').length,
        });
      }
    } catch (err: any) {
      setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleDeleteRequest = async () => {
    if (!selectedRequest) return;
    try {
      const { error: deleteError } = await supabase.from('requests').delete().eq('id', selectedRequest.id);
      if (deleteError) throw deleteError;
      setOpenDetailModal(false);
      fetchRequests();
      alert('업무 기록이 삭제되었습니다.');
    } catch (err: any) {
      alert(err.message || '삭제 중 오류가 발생했습니다.');
    }
  };

  const handleSaveRequest = async () => {
    if (!selectedRequest) return;
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('requests')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', selectedRequest.id);
      if (updateError) throw updateError;

      if (newComment.trim()) {
        const { data: { session } } = await supabase.auth.getSession();
        await supabase.from('comments').insert({
          request_id: selectedRequest.id,
          comment: newComment,
          user_id: session?.user?.id,
        });
      }
      fetchRequests();
      setOpenDetailModal(false);
      alert('성공적으로 업데이트되었습니다.');
    } catch (err: any) {
      alert(err.message || '업데이트 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const getStatusChipColor = (status: string): 'success' | 'warning' | 'info' | 'default' => {
    switch (status) {
      case 'completed': return 'success';
      case 'processing': return 'warning';
      case 'pending': return 'info';
      default: return 'default';
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <>
      <Helmet><title>관리자 대시보드</title></Helmet>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <DashboardIcon sx={{ mr: 1.5, fontSize: '2rem' }} />
        <Typography variant="h4" component="h1">관리자 대시보드</Typography>
      </Box>
      <Divider sx={{ mb: 3 }} />

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { label: '총 업무 기록', count: summaryData.total, icon: <CategoryIcon />, color: '#607d8b', filter: null },
          { label: '처리 중', count: summaryData.processing, icon: <SyncIcon />, color: '#ed6c02', filter: 'processing' },
          { label: '처리 완료', count: summaryData.completed, icon: <CheckCircleIcon />, color: '#2e7d32', filter: 'completed' },
        ].map((item, idx) => (
          <Grid item xs={12} sm={4} key={idx}>
            <ButtonBase sx={{ width: '100%', borderRadius: 1 }} onClick={() => setFilterStatus(item.filter)}>
              <Paper elevation={2} sx={{ p: 2, display: 'flex', alignItems: 'center', width: '100%', borderLeft: `5px solid ${item.color}`, bgcolor: filterStatus === item.filter ? 'action.selected' : 'background.paper' }}>
                <Box sx={{ color: item.color, mr: 2 }}>{item.icon}</Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                  <Typography variant="h5" fontWeight="bold">{item.count}</Typography>
                </Box>
              </Paper>
            </ButtonBase>
          </Grid>
        ))}
      </Grid>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>업무일시</TableCell>
              <TableCell>거래처명</TableCell>
              <TableCell>요청자</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>액션</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.map((req) => (
              <TableRow key={req.id} hover>
                <TableCell>{new Date(req.created_at).toLocaleString()}</TableCell>
                <TableCell>{req.customer_name}</TableCell>
                <TableCell>{req.requester_name}</TableCell>
                <TableCell><Chip label={getStatusLabel(req.status)} color={getStatusChipColor(req.status)} size="small" /></TableCell>
                <TableCell>
                  <Button size="small" variant="outlined" onClick={() => { setSelectedRequest(req); setNewStatus(req.status); setOpenDetailModal(true); }}>상세</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDetailModal} onClose={() => setOpenDetailModal(false)} fullWidth maxWidth="md">
        {selectedRequest && (
          <>
            <DialogTitle>업무 상세 (번호: {selectedRequest.id})</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                <Typography><b>거래처:</b> {selectedRequest.customer_name} / <b>요청자:</b> {selectedRequest.requester_name}</Typography>
                <Typography variant="h6">접수내용</Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }} dangerouslySetInnerHTML={{ __html: selectedRequest.content }} />
                
                <Typography variant="h6">처리내용 기록</Typography>
                {selectedRequest.comments.map(c => (
                  <Paper key={c.id} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">{new Date(c.created_at).toLocaleString()}</Typography>
                    <div dangerouslySetInnerHTML={{ __html: c.comment }} />
                  </Paper>
                ))}

                <Divider />
                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel>상태 변경</InputLabel>
                  <Select value={newStatus} label="상태 변경" onChange={(e) => setNewStatus(e.target.value)}>
                    <MenuItem value="processing">처리중</MenuItem>
                    <MenuItem value="completed">처리완료</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="새로운 처리내용 입력"
                  multiline rows={4} fullWidth variant="outlined"
                  value={newComment} onChange={(e) => setNewComment(e.target.value)}
                  spellCheck={false}
                  InputProps={{ style: { fontSize: '16px' } }}
                  sx={{ mt: 2 }}
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenDetailModal(false)}>취소</Button>
              <Button onClick={handleDeleteRequest} color="error">삭제</Button>
              <Button onClick={handleSaveRequest} variant="contained" disabled={saving}>저장</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
};

export default AdminDashboardPage;
