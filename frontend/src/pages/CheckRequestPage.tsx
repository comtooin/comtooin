import React, { useState, useEffect } from 'react';
import {
  Typography, TextField, Button, Box, Paper, CircularProgress, Alert, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, Chip, List, ListItem, ListItemText
} from '@mui/material';
import { ReceiptLong as ReceiptLongIcon } from '@mui/icons-material';
import axios from 'axios';
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

const API_URL = '';

const CheckRequestPage: React.FC = () => {
  const navigate = useNavigate(); // Hook for navigation
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
  }, []); // Empty array ensures this runs only once on mount

  const fetchRequests = async (name: string, pw: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/api/requests/auth`, {
        user_name: name,
        password: pw,
      });
      const parsedRequests = response.data.map((req: any) => ({
        ...req,
        images: Array.isArray(req.images) ? req.images : (req.images && typeof req.images === 'string' && req.images.trim() !== '') ? JSON.parse(req.images) : [],
      }));
      setRequests(parsedRequests);
      setIsLoggedIn(true);
      // Save user info to session storage on successful login
      sessionStorage.setItem('comtooin_user', JSON.stringify({ name, pw }));
    } catch (err: any) {
      setError(err.response?.data?.error || '조회 중 오류가 발생했습니다.');
      // Clear session storage on failure
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
      await axios.delete(`${API_URL}/api/requests/${selectedRequest.id}`, {
        data: { password: deletePassword },
      });
      alert('접수 건이 성공적으로 삭제되었습니다.');
      navigate('/');
    } catch (err: any) {
      setDeleteError(err.response?.data?.error || '삭제 중 오류가 발생했습니다.');
    }
  };

  const getStatusChipColor = (status: string): 'success' | 'warning' | 'info' => {
    switch (status) {
      case '처리완료':
        return 'success';
      case '처리중':
        return 'warning';
      default:
        return 'info';
    }
  };

  if (loading) {
    return <CircularProgress />;
  }

  if (!isLoggedIn) {
    return (
      <Paper sx={{ p: 3 }}>
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
          <TextField label="사용자명" fullWidth required margin="normal" variant="outlined" size="small" value={userName} onChange={(e) => setUserName(e.target.value)} />
          <TextField label="접수 확인용 비밀번호" type="password" fullWidth required margin="normal" variant="outlined" size="small" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          <Button type="submit" variant="contained" fullWidth size="large" sx={{ mt: 2 }}>
            조회하기
          </Button>
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
          <ReceiptLongIcon sx={{ mr: 1.5, fontSize: '2rem' }} />
          <Typography variant="h4" component="h1">
            {userName}님의 접수 내역
          </Typography>
        </Box>
        <Button variant="outlined" onClick={handleLogout}>다른 이름으로 조회</Button>
      </Box>
      <Divider sx={{ mb: 3 }} />
      {requests.length === 0 ? (
        <Typography>접수된 내역이 없습니다.</Typography>
      ) : (
        <List component={Paper} sx={{ width: '100%', bgcolor: 'background.paper' }}>
          {requests.map(req => (
            <ListItem key={req.id} divider>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">접수번호: {req.id}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label={req.status} color={getStatusChipColor(req.status)} />
                      <Button variant="outlined" size="small" onClick={() => handleOpenModal(req)}>
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
                    <Typography component="span" variant="body1" sx={{ wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: req.content.substring(0, 100) + '...' }} />
                  </>
                }
              />

            </ListItem>
          ))}
        </List>
      )}

      {/* Detail View Dialog */}
      <Dialog open={selectedRequest !== null} onClose={handleCloseModal} fullWidth maxWidth="md">
        {selectedRequest && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                접수 상세내용 (접수번호: {selectedRequest.id})
                <Chip label={selectedRequest.status} color={getStatusChipColor(selectedRequest.status)} />
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Typography gutterBottom><b>고객사명:</b> {selectedRequest.customer_name}</Typography>
              <Typography gutterBottom><b>사용자명:</b> {selectedRequest.user_name}</Typography>
              <Typography gutterBottom><b>접수일시:</b> {new Date(selectedRequest.created_at).toLocaleString()}</Typography>
              <Typography gutterBottom><b>최종수정일:</b> {new Date(selectedRequest.updated_at).toLocaleString()}</Typography>
              <Typography variant="h6" sx={{ mt: 2 }}>접수 내용</Typography>
              <Paper variant="outlined" sx={{ p: 2, my: 1, maxHeight: 200, overflow: 'auto' }}>
                <div dangerouslySetInnerHTML={{ __html: selectedRequest.content }} />
              </Paper>

              {selectedRequest.images.length > 0 && (
                <>
                  <Typography variant="h6" sx={{ mt: 2 }}>첨부 이미지</Typography>
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    {selectedRequest.images.map((image, index) => (
                      <Grid item key={index}>
                        <a href={`${API_URL}/uploads/${image}`} target="_blank" rel="noopener noreferrer">
                          <img src={`${API_URL}/uploads/${image}`} alt={`attachment ${index}`} style={{ width: 150, height: 150, objectFit: 'cover', borderRadius: '4px' }} />
                        </a>
                      </Grid>
                    ))}
                  </Grid>
                </>
              )}

              <Typography variant="h6" sx={{ mt: 2 }}>처리내용</Typography>
              {selectedRequest.comments.length > 0 ? (
                selectedRequest.comments.map(comment => (
                  <Paper variant="outlined" key={comment.id} sx={{ p: 2, my: 1 }}>
                    <Typography variant="body2" color="text.secondary">{new Date(comment.created_at).toLocaleString()}</Typography>
                    <Typography dangerouslySetInnerHTML={{ __html: comment.comment }} />
                  </Paper>
                ))
              ) : (
                <Typography>아직 등록된 코멘트가 없습니다.</Typography>
              )}
            </DialogContent>
            <DialogActions>
              {selectedRequest.status === '접수완료' && (
                <Button 
                  variant="contained"
                  onClick={() => navigate(`/edit-request/${selectedRequest.id}`)}
                >
                  수정하기
                </Button>
              )}
              {selectedRequest.status === '접수완료' && (
                <Button 
                  variant="contained"
                  color="secondary"
                  onClick={() => setOpenDeleteDialog(true)}
                >
                  삭제하기
                </Button>
              )}
              <Button onClick={handleCloseModal}>닫기</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
};

export default CheckRequestPage;