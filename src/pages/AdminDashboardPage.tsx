import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Box, Paper, CircularProgress, Alert, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, InputLabel, FormControl, Grid,
  ButtonBase, TextField, Stack, Container, Pagination
} from '@mui/material';
import { 
  Dashboard as DashboardIcon, 
  CheckCircle as CheckCircleIcon,
  Assignment as AssignmentIcon,
  AccessTime as AccessTimeIcon,
  Edit as EditIcon
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

const ITEMS_PER_PAGE = 10;

const AdminDashboardPage: React.FC = () => {
  const [requests, setRequests] = useState<IRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedRequest, setSelectedRequest] = useState<IRequest | null>(null);
  const [openDetailModal, setOpenDetailModal] = useState(false);
  
  // 편집 모드 관련 상태
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    customer_name: '',
    requester_name: '',
    content: ''
  });

  const [newStatus, setNewStatus] = useState('');
  const [newComment, setNewComment] = useState('');
  const [saving, setSaving] = useState(false);

  // 필터 관련 상태 추가
  const [customers, setCustomers] = useState<string[]>([]);
  const [allMonths, setAllMonths] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  // 페이지네이션 상태
  const [page, setPage] = useState(1);

  const handleOpenDetail = (req: IRequest) => {
    setSelectedRequest(req);
    setNewStatus(req.status);
    setEditForm({
      customer_name: req.customer_name,
      requester_name: req.requester_name || '',
      content: req.content
    });
    setIsEditing(false);
    setOpenDetailModal(true);
  };

  const [summaryData, setSummaryData] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
  });

  const fetchInitialData = useCallback(async () => {
    try {
      const { data: customerData } = await supabase.from('customers').select('name').order('name', { ascending: true });
      if (customerData) setCustomers(customerData.map(c => c.name));

      const currentYear = new Date().getFullYear();
      const { data: summaryData } = await supabase.rpc('get_monthly_summary', { target_year: currentYear });
      if (summaryData) setAllMonths(summaryData.map((m: any) => m.month));
    } catch (err: any) {
      console.error("Initial data fetch error", err);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('requests')
        .select('*, comments(*)')
        .order('created_at', { ascending: false });

      if (selectedCustomer !== 'all') {
        query = query.eq('customer_name', selectedCustomer);
      }
      
      if (selectedMonth !== 'all') {
        const year = selectedMonth.split('-')[0];
        const month = selectedMonth.split('-')[1];
        const startDate = `${year}-${month}-01T00:00:00.000Z`;
        const endDate = `${year}-${month}-${new Date(Number(year), Number(month), 0).getDate()}T23:59:59.999Z`;
        query = query.gte('created_at', startDate).lte('created_at', endDate);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      
      const allFiltered = data || [];
      
      // 요약 데이터 업데이트 (현재 선택된 거래처/기간 기준)
      setSummaryData({
        total: allFiltered.length,
        pending: allFiltered.filter(req => req.status === 'pending').length,
        processing: allFiltered.filter(req => req.status === 'processing').length,
        completed: allFiltered.filter(req => req.status === 'completed').length,
      });

      // 리스트 데이터 업데이트 (상태 필터 적용)
      if (filterStatus) {
        setRequests(allFiltered.filter(req => req.status === filterStatus));
      } else {
        setRequests(allFiltered);
      }
      // 필터가 바뀌면 페이지를 1로 리셋
      setPage(1);
    } catch (err: any) {
      setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, selectedCustomer, selectedMonth]);

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
      // 기본 정보 및 상태 업데이트
      const updateData: any = { 
        status: newStatus, 
        updated_at: new Date().toISOString(),
        customer_name: editForm.customer_name,
        requester_name: editForm.requester_name,
        content: editForm.content
      };

      const { error: updateError } = await supabase
        .from('requests')
        .update(updateData)
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
      setNewComment('');
      alert('성공적으로 저장되었습니다.');
    } catch (err: any) {
      alert(err.message || '저장 중 오류가 발생했습니다.');
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

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const paginatedRequests = requests.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;
  if (error) return <Container maxWidth="lg" sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Container>;

  return (
    <Container maxWidth="lg">
      <Helmet><title>대시보드</title></Helmet>
      
      {/* 표준 헤더 섹션 */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <DashboardIcon sx={{ fontSize: '2rem', color: 'primary.main' }} />
          <Typography variant="h5" component="h1" fontWeight="bold">
            대시보드
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          전체 유지보수 접수 현황을 실시간으로 확인하고 관리합니다.
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: '총 업무 기록', count: summaryData.total, icon: <AssignmentIcon fontSize="small" color="primary" />, color: '#607d8b', filter: null },
          { label: '처리 중', count: summaryData.processing, icon: <AccessTimeIcon fontSize="small" color="warning" />, color: '#ed6c02', filter: 'processing' },
          { label: '처리 완료', count: summaryData.completed, icon: <CheckCircleIcon fontSize="small" color="success" />, color: '#2e7d32', filter: 'completed' },
        ].map((item, idx) => (
          <Grid item xs={4} sm={4} key={idx}>
            <ButtonBase 
              sx={{ width: '100%', textAlign: 'left', borderRadius: 2, display: 'block' }} 
              onClick={() => setFilterStatus(item.filter)}
            >
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: { xs: 1.5, sm: 2 }, 
                  borderLeft: { xs: `4px solid ${item.color}`, sm: `6px solid ${item.color}` }, 
                  borderRadius: 2,
                  bgcolor: filterStatus === item.filter ? 'action.selected' : 'background.paper',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: 'action.hover', transform: 'translateY(-2px)', boxShadow: '0 4px 12px 0 rgba(0,0,0,0.05)' }
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
            </ButtonBase>
          </Grid>
        ))}
      </Grid>

      {/* 필터 섹션 - 카드 아래로 이동 */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 3, borderRadius: 3, bgcolor: 'background.paper' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <TextField 
              select 
              label="거래처 필터" 
              fullWidth 
              value={selectedCustomer} 
              onChange={(e) => setSelectedCustomer(e.target.value)} 
              size="small"
              InputProps={{ sx: { fontSize: '0.8125rem' } }}
              InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
            >
                <MenuItem value="all" sx={{ fontSize: '0.8125rem' }}><em>전체 거래처</em></MenuItem>
                {customers.map((name: string) => <MenuItem key={name} value={name} sx={{ fontSize: '0.8125rem' }}>{name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField 
              select 
              label="기간(월) 필터" 
              fullWidth 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)} 
              size="small"
              InputProps={{ sx: { fontSize: '0.8125rem' } }}
              InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
            >
                <MenuItem value="all" sx={{ fontSize: '0.8125rem' }}><em>전체 기간</em></MenuItem>
                {allMonths.map(month => <MenuItem key={month} value={month} sx={{ fontSize: '0.8125rem' }}>{month}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: 'background.paper', mb: 2 }}>
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 400, tableLayout: 'fixed' }}>
            <TableHead sx={{ bgcolor: 'grey.50' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', py: 2, pl: 3, pr: 0.5, width: '125px' }}>업무일자</TableCell>
                <TableCell sx={{ fontWeight: 'bold', py: 2, px: 0.5, width: '120px' }}>거래처명</TableCell>
                <TableCell sx={{ fontWeight: 'bold', py: 2, px: 0.5, width: '85px' }}>요청자</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', py: 2, px: 0.5, width: '85px' }}>상태</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedRequests.length > 0 ? paginatedRequests.map((req) => (
                <TableRow 
                  key={req.id} 
                  hover 
                  onClick={() => handleOpenDetail(req)}
                  sx={{ cursor: 'pointer', '&:active': { bgcolor: 'action.selected' } }}
                >
                  <TableCell sx={{ py: 2, pl: 3, pr: 0.5, whiteSpace: 'nowrap', color: 'text.secondary', fontSize: '0.8125rem', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {(() => {
                      const d = new Date(req.created_at);
                      return `${d.getFullYear().toString().substring(2)}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
                    })()}
                  </TableCell>
                  <TableCell sx={{ py: 2, px: 0.5, fontWeight: 'medium', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8125rem', letterSpacing: '-0.01em' }}>
                    {req.customer_name}
                  </TableCell>
                  <TableCell sx={{ py: 2, px: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8125rem', letterSpacing: '-0.01em' }}>
                    {req.requester_name}
                  </TableCell>
                  <TableCell align="center" sx={{ py: 2, px: 0.5 }}>
                    <Chip 
                      label={getStatusLabel(req.status)} 
                      color={getStatusChipColor(req.status)} 
                      size="small" 
                      variant="outlined" 
                      sx={{ fontWeight: 'bold', fontSize: '0.7rem', width: '64px', letterSpacing: '-0.01em' }} 
                    />
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary">표시할 데이터가 없습니다.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* 페이지네이션 추가 */}
      {requests.length > ITEMS_PER_PAGE && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
          <Pagination 
            count={Math.ceil(requests.length / ITEMS_PER_PAGE)} 
            page={page} 
            onChange={handlePageChange} 
            color="primary"
            size="medium"
          />
        </Box>
      )}

      <Dialog open={openDetailModal} onClose={() => setOpenDetailModal(false)} fullWidth maxWidth="md">
        {selectedRequest && (
          <>
            <DialogTitle sx={{ fontWeight: 'bold' }}>
              업무 상세 정보 (번호: {selectedRequest.id})
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2.5}>
                <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 2 }}>
                  {isEditing ? (
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="거래처명"
                          fullWidth size="small"
                          value={editForm.customer_name}
                          onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="요청자명"
                          fullWidth size="small"
                          value={editForm.requester_name}
                          onChange={(e) => setEditForm({ ...editForm, requester_name: e.target.value })}
                        />
                      </Grid>
                    </Grid>
                  ) : (
                    <Typography variant="body2"><b>거래처:</b> {selectedRequest.customer_name} / <b>요청자:</b> {selectedRequest.requester_name}</Typography>
                  )}
                </Box>
                
                <Typography variant="h6" fontWeight="bold">접수내용</Typography>
                {isEditing ? (
                  <TextField
                    multiline rows={6} fullWidth
                    value={editForm.content}
                    onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                    placeholder="접수 내용을 수정하세요."
                  />
                ) : (
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'white' }} dangerouslySetInnerHTML={{ __html: selectedRequest.content }} />
                )}
                
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

                {selectedRequest.images && selectedRequest.images.length > 0 && (
                  <>
                    <Typography variant="h6" fontWeight="bold">첨부 이미지</Typography>
                    <Grid container spacing={2}>
                      {selectedRequest.images.map((image, index) => {
                        let imageUrl = image;
                        if (!image.startsWith('http')) {
                          // 기존 Supabase 이미지 경로 처리 (ID 수정: szwiejswmfivultxxywb)
                          imageUrl = `https://szwiejswmfivultxxywb.supabase.co/storage/v1/object/public/uploads/${image}`;
                        } else if (image.includes('drive.google.com')) {
                          // 구글 드라이브 링크를 안정적인 썸네일 직링으로 변환
                          const fileId = image.match(/\/d\/(.+?)\//)?.[1];
                          if (fileId) {
                            imageUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
                          }
                        }
                        
                        return (
                          <Grid item key={index} xs={6} sm={4}>
                            <Paper 
                              variant="outlined" 
                              sx={{ 
                                overflow: 'hidden', 
                                borderRadius: 2, 
                                cursor: 'pointer',
                                transition: 'transform 0.2s',
                                '&:hover': { transform: 'scale(1.02)', boxShadow: 2 }
                              }}
                              onClick={() => window.open(image.startsWith('http') ? image : imageUrl, '_blank')}
                            >
                              <img src={imageUrl} alt={`attachment ${index}`} style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                            </Paper>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </>
                )}

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
            <DialogActions sx={{ p: 2.5, justifyContent: 'space-between', bgcolor: 'grey.50' }}>
              <Button 
                onClick={handleDeleteRequest} 
                color="error" 
                variant="outlined"
                sx={{ fontWeight: 'bold', px: 2, borderRadius: 1.5 }}
              >
                삭제
              </Button>
              
              <Stack direction="row" spacing={1}>
                <Button 
                  onClick={() => setOpenDetailModal(false)}
                  variant="outlined"
                  color="inherit"
                  sx={{ fontWeight: 'bold', px: 2, borderRadius: 1.5, bgcolor: 'white' }}
                >
                  닫기
                </Button>
                
                <Button 
                  startIcon={<EditIcon />} 
                  variant="outlined" 
                  color="primary" 
                  onClick={() => setIsEditing(!isEditing)}
                  sx={{ fontWeight: 'bold', px: 2, borderRadius: 1.5, bgcolor: 'white' }}
                >
                  {isEditing ? '수정 취소' : '수정'}
                </Button>

                <Button 
                  onClick={handleSaveRequest} 
                  variant="contained" 
                  color="primary"
                  disabled={saving} 
                  sx={{ fontWeight: 'bold', px: 3, borderRadius: 1.5, minWidth: 80 }}
                >
                  {saving ? <CircularProgress size={20} color="inherit" /> : '저장'}
                </Button>
              </Stack>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default AdminDashboardPage;
