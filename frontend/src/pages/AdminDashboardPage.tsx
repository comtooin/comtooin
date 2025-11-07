import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Box, Paper, CircularProgress, Alert, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Button, TableSortLabel,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Select, MenuItem, InputLabel, FormControl, Grid,
  useMediaQuery, List, ListItem, ListItemText
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Dashboard as DashboardIcon } from '@mui/icons-material';
import axios from 'axios';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Helmet } from 'react-helmet-async';

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

const API_URL = process.env.NODE_ENV === 'production' ? '' : process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Helper function to strip HTML tags
const stripHtmlTags = (html: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
};

const AdminDashboardPage: React.FC = () => {
  const [requests, setRequests] = useState<IRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [selectedRequest, setSelectedRequest] = useState<IRequest | null>(null);
  const [openDetailModal, setOpenDetailModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [newComment, setNewComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [orderBy, setOrderBy] = useState('created_at');

  const [requestToDelete, setRequestToDelete] = useState<IRequest | null>(null);
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleDeleteRequest = async () => {
    if (!requestToDelete) return;
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/admin/requests/${requestToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setRequests(prevRequests => prevRequests.filter(req => req.id !== requestToDelete.id));
      setOpenDeleteConfirm(false);
      setRequestToDelete(null);
      alert('접수 건이 성공적으로 삭제되었습니다.');
    } catch (err: any) {
      console.error("Failed to delete request", err);
      alert(err.response?.data?.error || '삭제 중 오류가 발생했습니다.');
    }
  };

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
      return;
    }
    try {
      const response = await axios.get(`${API_URL}/api/admin/requests`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { _sort: orderBy, _order: order },
      });
      setRequests(response.data);
    } catch (err: any) {
      console.error("Failed to fetch requests", err);
      setError(err.response?.data?.error || '데이터를 불러오는 중 오류가 발생했습니다.');
      if ((err as any).response?.status === 401 || (err as any).response?.status === 403) {
        navigate('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate, order, orderBy]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const getStatusChipColor = (status: string): 'success' | 'warning' | 'info' | 'default' | 'primary' | 'secondary' | 'error' => {
    switch (status) {
      case 'completed':
      case '처리완료':
        return 'success';
      case 'processing':
      case '처리중':
        return 'warning';
      case 'pending':
      case '접수완료':
        return 'info';
      default:
        return 'default';
    }
  };

  const handleOpenDetailModal = (request: IRequest) => {
    setSelectedRequest(request);
    setNewStatus(request.status);
    setNewComment('');
    setSaveError('');
    setOpenDetailModal(true);
  };

  const handleCloseDetailModal = () => {
    setOpenDetailModal(false);
    setSelectedRequest(null);
  };

  const handleSaveRequest = async () => {
    if (!selectedRequest) return;
    setSaving(true);
    setSaveError('');
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
      return;
    }

    try {
      const response = await axios.put(`${API_URL}/api/admin/requests/${selectedRequest.id}`,
        { status: newStatus, comment: newComment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRequests(prevRequests =>
        prevRequests.map(req => (req.id === selectedRequest.id ? response.data : req))
      );
      handleCloseDetailModal();
      alert('접수 정보가 성공적으로 업데이트되었습니다.');
    } catch (err: any) {
      setSaveError(err.response?.data?.error || '업데이트 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  if (loading) {
    return <CircularProgress />;
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  const renderDesktopView = () => (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} aria-label="simple table">
        <TableHead>
          <TableRow>
            {(
              [
                { id: 'id', label: 'ID' },
                { id: 'created_at', label: '접수일시' },
                { id: 'customer_name', label: '고객사명' },
                { id: 'user_name', label: '사용자명' },
                { id: 'content', label: '내용 요약' },
                { id: 'status', label: '상태' },
              ] as const
            ).map((headCell) => (
              <TableCell
                key={headCell.id}
                sortDirection={orderBy === headCell.id ? order : false}
              >
                <TableSortLabel
                  active={orderBy === headCell.id}
                  direction={orderBy === headCell.id ? order : 'asc'}
                  onClick={() => handleSort(headCell.id)}
                >
                  {headCell.label}
                </TableSortLabel>
              </TableCell>
            ))}
            <TableCell>액션</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {requests.map((request) => (
            <TableRow
              key={request.id}
              sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              hover
            >
              <TableCell component="th" scope="row">{request.id}</TableCell>
              <TableCell>{new Date(request.created_at).toLocaleString()}</TableCell>
              <TableCell>{request.customer_name}</TableCell>
              <TableCell>{request.user_name}</TableCell>
              <TableCell>{stripHtmlTags(request.content).substring(0, 50)}...</TableCell>
              <TableCell>
                <Chip label={request.status} color={getStatusChipColor(request.status)} size="small" />
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button variant="outlined" size="small" onClick={() => handleOpenDetailModal(request)}>상세보기</Button>
                  <Button variant="outlined" size="small" color="error" onClick={() => { setRequestToDelete(request); setOpenDeleteConfirm(true); }}>삭제</Button>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderMobileView = () => (
    <List component={Paper}>
      {requests.map((request) => (
        <React.Fragment key={request.id}>
          <ListItem
            button
            onClick={() => handleOpenDetailModal(request)}
            secondaryAction={
              <Chip label={request.status} color={getStatusChipColor(request.status)} size="small" />
            }
          >
            <ListItemText
              primary={`${stripHtmlTags(request.content).substring(0, 40)}...`}
              secondary={`${request.customer_name} - ${request.user_name} (${new Date(request.created_at).toLocaleDateString()})`}
            />
          </ListItem>
          <Divider variant="inset" component="li" />
        </React.Fragment>
      ))}
    </List>
  );

  return (
    <>
      <Helmet>
        <title>대시보드</title>
      </Helmet>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <DashboardIcon sx={{ mr: 1.5, fontSize: '2rem' }} />
        <Typography variant="h4" component="h1">
          대시보드
        </Typography>
      </Box>
      <Divider sx={{ mb: 3 }} />
      {requests.length === 0 ? (
        <Typography>접수된 AS 요청이 없습니다.</Typography>
      ) : (
        isMobile ? renderMobileView() : renderDesktopView()
      )}

      {/* Admin Request Detail Modal */}
      <Dialog open={openDetailModal} onClose={handleCloseDetailModal} fullWidth maxWidth="md">
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

              <Box sx={{ mt: 3 }}>
                <FormControl fullWidth margin="normal">
                  <InputLabel id="status-select-label">상태 변경</InputLabel>
                  <Select
                    labelId="status-select-label"
                    value={newStatus}
                    label="상태 변경"
                    onChange={(e) => setNewStatus(e.target.value as string)}
                  >
                    <MenuItem value={"접수완료"}>접수완료</MenuItem>
                    <MenuItem value={"처리중"}>처리중</MenuItem>
                    <MenuItem value={"처리완료"}>처리완료</MenuItem>
                  </Select>
                </FormControl>
                <ReactQuill
                  theme="snow"
                  value={newComment}
                  onChange={setNewComment}
                  style={{ height: '150px', marginTop: '16px', marginBottom: '16px' }}
                />
                {saveError && <Alert severity="error" sx={{ mt: 2 }}>{saveError}</Alert>}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDetailModal}>닫기</Button>
              <Button onClick={handleSaveRequest} variant="contained" disabled={saving}>
                {saving ? <CircularProgress size={24} /> : '저장'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={openDeleteConfirm}
        onClose={() => setOpenDeleteConfirm(false)}
      >
        <DialogTitle>정말로 삭제하시겠습니까?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            접수번호 {requestToDelete?.id}번 (고객사: {requestToDelete?.customer_name}, 사용자: {requestToDelete?.user_name}) 접수 건을 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteConfirm(false)}>취소</Button>
          <Button onClick={handleDeleteRequest} color="error">삭제 확인</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AdminDashboardPage;