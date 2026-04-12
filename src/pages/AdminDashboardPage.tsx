import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Box, Paper, CircularProgress, Alert, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, InputLabel, FormControl, Grid,
  ButtonBase, TextField, Stack, Container
} from '@mui/material';
import { 
  Dashboard as DashboardIcon, 
  CheckCircle as CheckCircleIcon,
  Assignment as AssignmentIcon,
  AccessTime as AccessTimeIcon
} from '@mui/icons-material';
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
    if (!window.confirm('정말로 이 기록을 삭제하시겠습니까?')) return;
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
  if (error) return <Container maxWidth="lg" sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Container>;

  return (
    <Container maxWidth="lg">
      <Helmet><title>관리자 대시보드</title></Helmet>
      
      {/* 표준 헤더 섹션 */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <DashboardIcon sx={{ fontSize: '2rem', color: 'primary.main' }} />
          <Typography variant="h5" component="h1" fontWeight="bold">
            관리자 대시보드
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          전체 유지보수 접수 현황을 실시간으로 확인하고 관리합니다.
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { label: '총 업무 기록', count: summaryData.total, icon: <AssignmentIcon color="primary" />, color: '#607d8b', filter: null },
          { label: '처리 중', count: summaryData.processing, icon: <AccessTimeIcon color="warning" />, color: '#ed6c02', filter: 'processing' },
          { label: '처리 완료', count: summaryData.completed, icon: <CheckCircleIcon color="success" />, color: '#2e7d32', filter: 'completed' },
        ].map((item, idx) => (
          <Grid item xs={12} sm={4} key={idx}>
            <ButtonBase 
              sx={{ width: '100%', textAlign: 'left', borderRadius: 3, display: 'block' }} 
              onClick={() => setFilterStatus(item.filter)}
            >
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 3, 
                  borderLeft: `6px solid ${item.color}`, 
                  borderRadius: 3,
                  bgcolor: filterStatus === item.filter ? 'action.selected' : 'background.paper',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: 'action.hover', transform: 'translateY(-2px)', boxShadow: '0 4px 20px 0 rgba(0,0,0,0.05)' }
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  {item.icon}
                  <Typography variant="overline" fontWeight="bold" color="text.secondary">
                    {item.label}
                  </Typography>
                </Stack>
                <Typography variant="h4" fontWeight="bold" sx={{ mt: 1 }}>
                  {item.count}
                </Typography>
              </Paper>
            </ButtonBase>
          </Grid>
        ))}
      </Grid>

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: 'background.paper' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: 'grey.50' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>업무일시</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>거래처명</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>요청자</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>상태</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>액션</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.length > 0 ? requests.map((req) => (
                <TableRow key={req.id} hover>
                  <TableCell>{new Date(req.created_at).toLocaleString()}</TableCell>
                  <TableCell sx={{ fontWeight: 'medium' }}>{req.customer_name}</TableCell>
                  <TableCell>{req.requester_name}</TableCell>
                  <TableCell><Chip label={getStatusLabel(req.status)} color={getStatusChipColor(req.status)} size="small" variant="outlined" sx={{ fontWeight: 'bold' }} /></TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined" onClick={() => { setSelectedRequest(req); setNewStatus(req.status); setOpenDetailModal(true); }}>상세보기</Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary">표시할 데이터가 없습니다.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={openDetailModal} onClose={() => setOpenDetailModal(false)} fullWidth maxWidth="md">
        {selectedRequest && (
          <>
            <DialogTitle sx={{ fontWeight: 'bold' }}>업무 상세 (번호: {selectedRequest.id})</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2.5}>
                <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 2 }}>
                  <Typography variant="body2"><b>거래처:</b> {selectedRequest.customer_name} / <b>요청자:</b> {selectedRequest.requester_name}</Typography>
                </Box>
                
                <Typography variant="h6" fontWeight="bold">접수내용</Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'white' }} dangerouslySetInnerHTML={{ __html: selectedRequest.content }} />
                
                <Typography variant="h6" fontWeight="bold">처리내용 기록</Typography>
                <Stack spacing={1}>
                  {selectedRequest.comments.map(c => (
                    <Paper key={c.id} variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>{new Date(c.created_at).toLocaleString()}</Typography>
                      <div dangerouslySetInnerHTML={{ __html: c.comment }} />
                    </Paper>
                  ))}
                  {selectedRequest.comments.length === 0 && (
                    <Typography variant="body2" color="text.disabled" align="center" sx={{ py: 2 }}>등록된 코멘트가 없습니다.</Typography>
                  )}
                </Stack>

                <Divider sx={{ my: 1 }} />
                
                <FormControl fullWidth>
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
                  placeholder="추가할 처리 내용을 입력해 주세요."
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2.5 }}>
              <Button onClick={() => setOpenDetailModal(false)}>취소</Button>
              <Button onClick={handleDeleteRequest} color="error" sx={{ ml: 'auto', mr: 1 }}>삭제</Button>
              <Button onClick={handleSaveRequest} variant="contained" disabled={saving} sx={{ fontWeight: 'bold' }}>
                {saving ? <CircularProgress size={24} color="inherit" /> : '변경사항 저장'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default AdminDashboardPage;
