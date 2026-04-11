import React, { useState, useEffect } from 'react';
import {
  Typography, TextField, Button, Box, Paper, CircularProgress, Alert, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, Chip, List, ListItem, ListItemText, DialogContentText, Stack // Added Stack
} from '@mui/material';
import { ReceiptLong as ReceiptLongIcon, SearchOff as SearchOffIcon } from '@mui/icons-material'; // Added SearchOffIcon
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
  // State for delete dialog
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const savedUser = sessionStorage.getItem('comtooin_user');
    if (savedUser) {
      const { name, pw } = JSON.parse(savedUser);
      setUserName(name);
      setPassword(pw);
      // Trigger fetch automatically
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

      if (rpcError) {
        throw rpcError;
      }

      const parsedRequests = data.map((req: any) => ({
        ...req,
        images: Array.isArray(req.images) ? req.images : (req.images && typeof req.images === 'string' && req.images.trim() !== '') ? JSON.parse(req.images) : [],
        comments: Array.isArray(req.comments) ? req.comments : [],
      }));
      setRequests(parsedRequests);
      setIsLoggedIn(true);
      sessionStorage.setItem('comtooin_user', JSON.stringify({ name, pw }));
    } catch (err: any) {
      console.error('Supabase RPC error:', err);
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

  const handleOpenModal = (request: IRequest) => {
    setSelectedRequest(request);
  };

  const handleCloseModal = () => {
    setSelectedRequest(null);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('comtooin_user');
    setIsLoggedIn(false);
    setUserName('');
    setPassword('');
    setRequests([]);
    setError('');
  };

  const handleDeleteConfirm = async () => {
    if (!selectedRequest?.id) return;
    setDeleteError('');
    try {
      const { error: rpcError } = await supabase.rpc('delete_request_with_password', {
        request_id: selectedRequest.id,
        _password: deletePassword,
      });

      if (rpcError) {
        throw rpcError;
      }
      alert('접수 건이 성공적으로 삭제되었습니다.');
      navigate('/');
    } catch (err: any) {
      console.error('Supabase RPC error:', err);
      setDeleteError(err.message || '삭제 중 오류가 발생했습니다. 비밀번호를 확인해주세요.');
    }
  };

  const getStatusChipColor = (status: string): 'success' | 'warning' | 'info' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'warning';
      case 'pending':
        return 'info';
      default:
        return 'info';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'pending':
        return '접수완료';
      case 'processing':
        return '처리중';
      case 'completed':
        return '처리완료';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isLoggedIn) {
    return (
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Helmet>
          <title>내 접수 내역 확인</title>
        </Helmet>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <ReceiptLongIcon sx={{ mr: 1.5, fontSize: '2rem' }} />
          <Typography variant="h5" component="h1">
            내 접수 내역 확인
          </Typography>
        </Box>
        <Divider sx={{ mb: 3 }} />
        <Box component="form" onSubmit={handleLogin}>
          <Stack spacing={2}> {/* Stack for consistent spacing */}
            <TextField 
              label="사용자명" 
              fullWidth required 
              margin="normal" 
              variant="outlined" 
              size="small" 
              value={userName} 
              onChange={(e) => setUserName(e.target.value)}
              helperText="기술 지원 요청 시 입력했던 사용자 이름을 입력해주세요." 
            />
            <TextField 
              label="접수 확인용 비밀번호" 
              type="password" 
              fullWidth required 
              margin="normal" 
              variant="outlined" 
              size="small" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              helperText="기술 지원 요청 시 설정했던 비밀번호를 입력해주세요." 
            />
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            <Button type="submit" variant="contained" fullWidth size="large" sx={{ mt: 2 }}>
              조회하기
            </Button>
          </Stack>
        </Box>
      </Paper>
    );
  }

  return (
    <>
      <Helmet>
        <title>{userName}님의 접수 내역</title>
      </Helmet>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <ReceiptLongIcon sx={{ mr: 1.5, fontSize: '1.75rem', color: 'primary.main' }} />
          <Typography variant="h5" component="h1" fontWeight="bold">
            {userName}님의 접수 내역
          </Typography>
        </Box>
        <Button variant="outlined" onClick={handleLogout} size="small">다른 이름으로 조회</Button>
      </Box>
      <Divider sx={{ mb: 3 }} />
      {requests.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center', mt: 4 }}>
          <SearchOffIcon sx={{ fontSize: '4rem', color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            아직 접수된 내역이 없습니다.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            새로운 기술 지원 요청을 접수하려면 홈 페이지를 이용해주세요.
          </Typography>
        </Paper>
      ) : (
        <List sx={{ width: '100%' }}>
          {requests.map(req => (
            <Paper key={req.id} sx={{ mb: 2, p: { xs: 2, sm: 3 } }}> {/* Wrapped ListItem in Paper */}
              <ListItem disableGutters>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Typography variant="h6" component="h2" sx={{ mb: { xs: 1, sm: 0 } }}>접수번호: {req.id}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Chip label={getStatusLabel(req.status)} color={getStatusChipColor(req.status)} />
                        <Button variant="contained" size="small" onClick={() => handleOpenModal(req)}>
                          상세보기
                        </Button>
                      </Box>
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography component="span" variant="body2" color="text.secondary">
                        접수일시: {new Date(req.created_at).toLocaleString()}
                      </Typography>
                      <br />
                      <Typography component="span" variant="body1" sx={{ wordBreak: 'break-word', mt: 1 }} dangerouslySetInnerHTML={{ __html: req.content.substring(0, 100) + '...' }} />
                    </>
                  }
                />
              </ListItem>
            </Paper>
          ))}
        </List>
      )}

      {/* Detail View Dialog */}
      <Dialog open={selectedRequest !== null} onClose={handleCloseModal} fullWidth maxWidth="md">
        {selectedRequest && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" component="span">접수 상세내용 (접수번호: {selectedRequest.id})</Typography>
                <Chip label={getStatusLabel(selectedRequest.status)} color={getStatusChipColor(selectedRequest.status)} />
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                <Typography><b>고객사명:</b> {selectedRequest.customer_name}</Typography>
                <Typography><b>사용자명:</b> {selectedRequest.user_name}</Typography>
                <Typography><b>접수일시:</b> {new Date(selectedRequest.created_at).toLocaleString()}</Typography>
                <Typography><b>최종수정일:</b> {new Date(selectedRequest.updated_at).toLocaleString()}</Typography>
              </Stack>
              <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>접수 내용</Typography>
              <Paper variant="outlined" sx={{ p: 2, maxHeight: 200, overflow: 'auto' }}>
                <div dangerouslySetInnerHTML={{ __html: selectedRequest.content }} />
              </Paper>

              {selectedRequest.images.length > 0 && (
                <>
                  <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>첨부 이미지</Typography>
                  <Grid container spacing={2}>
                    {selectedRequest.images.map((image, index) => (
                      <Grid item key={index}>
                        <a href={image} target="_blank" rel="noopener noreferrer">
                          <img src={image} alt={`attachment ${index}`} style={{ width: 150, height: 150, objectFit: 'cover', borderRadius: 'inherit' }} /> {/* Changed to inherit */}
                        </a>
                      </Grid>
                    ))}
                  </Grid>
                </>
              )}

              <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>처리내용</Typography>
              {selectedRequest.comments.length > 0 ? (
                selectedRequest.comments.map(comment => (
                  <Paper variant="outlined" key={comment.id} sx={{ p: 2, my: 1 }}>
                    <Typography variant="body2" color="text.secondary">{new Date(comment.created_at).toLocaleString()}</Typography>
                    <Typography dangerouslySetInnerHTML={{ __html: comment.comment }} />
                  </Paper>
                ))
              ) : (
                <Paper variant="outlined" sx={{ p: 2, my: 1 }}>
                  <Typography color="text.secondary">아직 등록된 코멘트가 없습니다.</Typography>
                </Paper>
              )}
            </DialogContent>
            <DialogActions sx={{ p: 3 }}> {/* Adjusted padding for actions */}
              {selectedRequest.status === 'pending' && ( // Check for pending status from DB
                <Button
                  variant="contained"
                  onClick={() => navigate(`/edit-request/${selectedRequest.id}`)}
                >
                  수정하기
                </Button>
              )}
              {selectedRequest.status === 'pending' && ( // Check for pending status from DB
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={() => setOpenDeleteDialog(true)}
                >
                  삭제하기
                </Button>
              )}
              <Button onClick={handleCloseModal} variant="outlined">닫기</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>접수 내역 삭제</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            이 접수 내역을 삭제하시려면 접수 시 사용했던 비밀번호를 입력해주세요. 이 작업은 되돌릴 수 없습니다.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="비밀번호"
            type="password"
            fullWidth
            variant="outlined" // Changed to outlined
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
          />
          {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>취소</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">삭제</Button> {/* Changed color and variant */}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CheckRequestPage;