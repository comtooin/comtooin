import React, { useState, useEffect } from 'react';
import {
  Typography, TextField, Button, Box, Paper, CircularProgress, Alert, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, Chip, List, ListItem, ListItemText, DialogContentText, Stack, Container
} from '@mui/material';
import { ReceiptLong as ReceiptLongIcon, SearchOff as SearchOffIcon } from '@mui/icons-material';
import { supabase } from '../api';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

// Define types for our data
interface IComment {
  id: number;
  comment: string;
  created_at: string;
}

interface IRequest {
  id: number;
  customer_name: string;
  user_name: string;
  email: string;
  content: string;
  images: string[];
  status: string;
  created_at: string;
  updated_at: string;
  comments: IComment[];
}

const CheckRequestPage: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [requests, setRequests] = useState<IRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [selectedRequest, setSelectedRequest] = useState<IRequest | null>(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const savedUser = sessionStorage.getItem('comtooin_user');
    if (savedUser) {
      const { name, pw } = JSON.parse(savedUser);
      setUserName(name);
      setPassword(pw);
      fetchRequests(name, pw);
    }
  }, []);

  const fetchRequests = async (name: string, pw: string) => {
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('authenticate_and_get_requests', {
        _user_name: name,
        _password: pw,
      });

      if (rpcError) throw rpcError;

      const parsedRequests = (data || []).map((req: any) => ({
        ...req,
        images: Array.isArray(req.images) ? req.images : (req.images && typeof req.images === 'string' && req.images.trim() !== '') ? JSON.parse(req.images) : [],
        comments: Array.isArray(req.comments) ? req.comments : [],
      }));
      setRequests(parsedRequests);
      setIsLoggedIn(true);
      sessionStorage.setItem('comtooin_user', JSON.stringify({ name, pw }));
    } catch (err: any) {
      setError(err.message || '조회 중 오류가 발생했습니다. 사용자명 또는 비밀번호를 확인해주세요.');
      sessionStorage.removeItem('comtooin_user');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRequests(userName, password);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('comtooin_user');
    setIsLoggedIn(false);
    setUserName('');
    setPassword('');
    setRequests([]);
    setError('');
  };

  const getStatusChipColor = (status: string): 'success' | 'warning' | 'info' => {
    switch (status) {
      case 'completed': return 'success';
      case 'processing': return 'warning';
      case 'pending': return 'info';
      default: return 'info';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'pending': return '접수완료';
      case 'processing': return '처리중';
      case 'completed': return '처리완료';
      default: return status;
    }
  };

  if (loading && !isLoggedIn) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

  return (
    <Container maxWidth="md">
      <Helmet>
        <title>{isLoggedIn ? `${userName}님의 접수 내역` : '내 접수 내역 확인'}</title>
      </Helmet>

      {/* 표준 헤더 섹션 */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <ReceiptLongIcon sx={{ fontSize: '2rem', color: 'primary.main' }} />
            <Typography variant="h5" component="h1" fontWeight="bold">
              {isLoggedIn ? `${userName}님의 접수 내역` : '내 접수 내역 확인'}
            </Typography>
          </Stack>
          {isLoggedIn && (
            <Button variant="outlined" onClick={handleLogout} size="small" sx={{ fontWeight: 'bold' }}>다른 이름으로 조회</Button>
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {isLoggedIn ? '접수하신 유지보수 업무의 처리 현황을 실시간으로 확인하실 수 있습니다.' : '접수 시 입력했던 사용자명과 비밀번호를 입력해 주세요.'}
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {!isLoggedIn ? (
        <Paper variant="outlined" sx={{ p: { xs: 3, md: 5 }, borderRadius: 3, bgcolor: 'background.paper', boxShadow: '0 4px 20px 0 rgba(0,0,0,0.05)' }}>
          <Box component="form" onSubmit={handleLogin}>
            <Stack spacing={3}>
              <TextField 
                label="사용자명" 
                fullWidth required 
                variant="outlined" 
                value={userName} 
                onChange={(e) => setUserName(e.target.value)}
                placeholder="예: 홍길동"
                helperText="기술 지원 요청 시 입력했던 이름" 
              />
              <TextField 
                label="접수 비밀번호" 
                type="password" 
                fullWidth required 
                variant="outlined" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                placeholder="****"
                helperText="기술 지원 요청 시 설정했던 비밀번호" 
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Button type="submit" variant="contained" fullWidth size="large" sx={{ py: 1.5, fontWeight: 'bold', fontSize: '1.1rem' }}>
                내역 조회하기
              </Button>
            </Stack>
          </Box>
        </Paper>
      ) : (
        <Box>
          {requests.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 8, textAlign: 'center', borderRadius: 3, bgcolor: 'background.paper' }}>
              <SearchOffIcon sx={{ fontSize: '4rem', color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom fontWeight="bold">
                접수된 내역이 없습니다.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                새로운 기술 지원 요청을 접수하려면 홈 페이지를 이용해 주세요.
              </Typography>
              <Button variant="contained" onClick={() => navigate('/')} sx={{ mt: 3, px: 4 }}>홈으로 이동</Button>
            </Paper>
          ) : (
            <Stack spacing={2}>
              {requests.map(req => (
                <Paper key={req.id} variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, transition: 'all 0.2s', '&:hover': { boxShadow: 2, transform: 'translateY(-2px)' } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" fontWeight="bold">접수번호: {req.id}</Typography>
                      <Typography variant="caption" color="text.secondary">접수일시: {new Date(req.created_at).toLocaleString()}</Typography>
                    </Box>
                    <Chip 
                      label={getStatusLabel(req.status)} 
                      color={getStatusChipColor(req.status)} 
                      size="small" 
                      variant="filled" 
                      sx={{ fontWeight: 'bold' }} 
                    />
                  </Box>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      wordBreak: 'break-word', 
                      mb: 2, 
                      color: 'text.primary',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }} 
                    dangerouslySetInnerHTML={{ __html: req.content.substring(0, 150) + (req.content.length > 150 ? '...' : '') }} 
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant="outlined" size="small" onClick={() => setSelectedRequest(req)} sx={{ fontWeight: 'bold' }}>
                      상세보기
                    </Button>
                  </Box>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      )}

      {/* 상세 보기 다이얼로그 (표준화) */}
      <Dialog open={selectedRequest !== null} onClose={() => setSelectedRequest(null)} fullWidth maxWidth="md">
        {selectedRequest && (
          <>
            <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              접수 상세내용
              <Chip label={getStatusLabel(selectedRequest.status)} color={getStatusChipColor(selectedRequest.status)} size="small" />
            </DialogTitle>
            <DialogContent dividers>
              <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">고객사명</Typography>
                    <Typography variant="body2" fontWeight="bold">{selectedRequest.customer_name}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">접수번호</Typography>
                    <Typography variant="body2" fontWeight="bold">{selectedRequest.id}</Typography>
                  </Grid>
                </Grid>
              </Paper>

              <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>접수 내용</Typography>
              <Paper variant="outlined" sx={{ p: 2, mb: 3, minHeight: 100, bgcolor: 'white' }}>
                <div dangerouslySetInnerHTML={{ __html: selectedRequest.content }} style={{ lineHeight: 1.6 }} />
              </Paper>

              {selectedRequest.images.length > 0 && (
                <>
                  <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>첨부 이미지</Typography>
                  <Grid container spacing={1} sx={{ mb: 3 }}>
                    {selectedRequest.images.map((image, index) => (
                      <Grid item key={index} xs={6} sm={4}>
                        <Paper 
                          variant="outlined" 
                          sx={{ overflow: 'hidden', borderRadius: 2, cursor: 'pointer' }}
                          onClick={() => window.open(image, '_blank')}
                        >
                          <img src={image} alt={`attachment ${index}`} style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </>
              )}

              <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>처리내역</Typography>
              <Stack spacing={1.5}>
                {selectedRequest.comments.length > 0 ? (
                  selectedRequest.comments.map(comment => (
                    <Paper variant="outlined" key={comment.id} sx={{ p: 2, bgcolor: 'grey.50', borderLeft: '4px solid #607d8b' }}>
                      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>{new Date(comment.created_at).toLocaleString()}</Typography>
                      <div dangerouslySetInnerHTML={{ __html: comment.comment }} style={{ lineHeight: 1.5 }} />
                    </Paper>
                  ))
                ) : (
                  <Typography color="text.secondary" variant="body2" align="center" sx={{ py: 2 }}>아직 등록된 코멘트가 없습니다.</Typography>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2.5 }}>
              {selectedRequest.status === 'pending' && (
                <Button variant="contained" onClick={() => navigate(`/admin/request/edit/${selectedRequest.id}`)} sx={{ fontWeight: 'bold' }}>수정하기</Button>
              )}
              <Button onClick={() => setSelectedRequest(null)} variant="outlined" sx={{ fontWeight: 'bold' }}>닫기</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default CheckRequestPage;
