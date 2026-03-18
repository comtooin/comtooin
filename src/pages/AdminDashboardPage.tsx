import React, { useState, useEffect, useCallback } from 'react';

import {
  Typography, Box, Paper, CircularProgress, Alert, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Button, TableSortLabel,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Select, MenuItem, InputLabel, FormControl, Grid,
  useMediaQuery, ListItem, ListItemText, Stack, ButtonBase
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Dashboard as DashboardIcon, CheckCircleOutline as CheckCircleOutlineIcon, Category as CategoryIcon, AccessTime as AccessTimeIcon, Sync as SyncIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import { Helmet } from 'react-helmet-async';
import { supabase } from '../api'; // 수정됨: 중앙 API 모듈 임포트

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
  requester_name?: string;
  email: string;
  content: string;
  images: string[];
  status: string;
  created_at: string;
  updated_at: string;
  comments: IComment[];
}

// Helper function to strip HTML tags
const stripHtmlTags = (html: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
};

// Helper function to get status label (reused from CheckRequestPage or central place)
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

const AdminDashboardPage: React.FC = () => {
  const [requests, setRequests] = useState<IRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  // New state for summary data and filter status
  const [summaryData, setSummaryData] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
  });
  const [filterStatus, setFilterStatus] = useState<string | null>(null); // New state for filtering

  const handleDeleteRequest = async () => {
    if (!requestToDelete) return;
    // This might not be needed if RLS is fully set up

    try {
      // 1. Supabase Storage에서 첨부 파일 삭제
      if (requestToDelete.images && requestToDelete.images.length > 0) {
        const filePaths = requestToDelete.images.map(imageUrl => {
          const publicPathIndex = imageUrl.indexOf('/public/uploads/');
          if (publicPathIndex !== -1) {
            return imageUrl.substring(publicPathIndex + '/public/uploads/'.length);
          }
          return null;
        }).filter((path): path is string => path !== null);

        if (filePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('uploads')
            .remove(filePaths);

          if (storageError) {
            console.error("Failed to delete files from storage:", storageError);
            alert(`첨부 파일 삭제 중 오류가 발생했습니다: ${storageError.message}. 요청 자체는 삭제를 시도합니다.`);
          }
        }
      }

      // 2. 데이터베이스에서 요청 삭제
      const { error: deleteError } = await supabase
        .from('requests')
        .delete()
        .eq('id', requestToDelete.id);

      if (deleteError) {
        throw deleteError;
      }

      setRequests(prevRequests => prevRequests.filter(req => req.id !== requestToDelete.id));
      setOpenDeleteConfirm(false);
      setRequestToDelete(null);
      alert('업무 기록이 삭제되었습니다.');
      fetchRequests(); // Re-fetch to update summary
    } catch (err: any) {
      console.error("Failed to delete request or files", err);
      alert(err.message || '삭제 중 오류가 발생했습니다.');
    }
  };

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('requests')
        .select('*, comments(*)')
        .order(orderBy, { ascending: order === 'asc' });

      if (filterStatus) {
        query = query.eq('status', filterStatus);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }
      const fetchedRequests = data || [];
      setRequests(fetchedRequests);

      // Calculate summary data from all requests (ignoring current filter for summary)
      const allRequests = (await supabase.from('requests').select('id, status')).data || [];
      const total = allRequests.length;
      const pending = allRequests.filter(req => req.status === 'pending').length;
      const processing = allRequests.filter(req => req.status === 'processing').length;
      const completed = allRequests.filter(req => req.status === 'completed').length;
      setSummaryData({ total, pending, processing, completed });

    } catch (err: any) {
      console.error("Failed to fetch requests", err);
      setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [order, orderBy, filterStatus]); // Add filterStatus to dependencies

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests, filterStatus]); // Add filterStatus to useEffect dependencies

  const handleStatusFilterClick = (status: string | null) => {
    setFilterStatus(status);
  };

  const getStatusChipColor = (status: string): 'success' | 'warning' | 'info' | 'default' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'warning';
      case 'pending':
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

    try {
      // 1. 요청 상태 업데이트
      const { error: updateError } = await supabase
        .from('requests')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', selectedRequest.id)
        .select();

      if (updateError) {
        throw updateError;
      }

      // 2. 새로운 코멘트 추가 (newComment가 있고, 비어있지 않은 경우)
      if (newComment && newComment.trim()) {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.user?.id) throw new Error('로그인 정보가 없습니다.');

        const { error: commentInsertError } = await supabase
          .from('comments')
          .insert({
            request_id: selectedRequest.id,
            comment: newComment,
            user_id: session.user.id,
          });
        if (commentInsertError) {
          throw commentInsertError;
        }
      }

      fetchRequests();
      handleCloseDetailModal();
      alert('접수 정보가 성공적으로 업데이트되었습니다.');
    } catch (err: any) {
      console.error('Supabase save error:', err);
      setSaveError(err.message || '업데이트 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // Helper function for status border color
  const getStatusBorderColor = (status: string) => {
    switch (status) {
      case 'pending': return theme.palette.info.main;
      case 'processing': return theme.palette.warning.main;
      case 'completed': return theme.palette.success.main;
      default: return theme.palette.grey[300];
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        <Typography variant="body1">{error}</Typography>
        <Typography variant="body2" color="text.secondary">
          데이터를 불러오는 중 오류가 발생했습니다. 관리자에게 문의해주세요.
        </Typography>
      </Alert>
    );
  }

  const renderDesktopView = () => (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} aria-label="simple table">
        <TableHead>
          <TableRow>
            {(
              [
                { id: 'id', label: 'ID' },
                { id: 'created_at', label: '업무일시' },
                { id: 'customer_name', label: '거래처명' },
                { id: 'requester_name', label: '요청자' },
                { id: 'user_name', label: '작성자' },
                { id: 'content', label: '접수내용 요약' },
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
              <TableCell>{request.requester_name}</TableCell>
              <TableCell>{request.user_name}</TableCell>
              <TableCell>{stripHtmlTags(request.content).substring(0, 50)}...</TableCell>
              <TableCell>
                <Chip label={getStatusLabel(request.status)} color={getStatusChipColor(request.status)} size="small" />
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
    <Stack spacing={2}> {/* Use Stack for consistent spacing between cards */}
      {requests.map((request) => (
        <Paper
          key={request.id}
          sx={{
            p: { xs: 2, sm: 3 },
            borderLeft: `8px solid ${getStatusBorderColor(request.status)}`, // Border-left emphasis
          }}
        >
          <ListItem
            button
            onClick={() => handleOpenDetailModal(request)}
            disableGutters
            sx={{ px: 0, flexDirection: 'column', alignItems: 'flex-start' }} // Ensure content aligns left
          >
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', mb: 0.5 }}>
                  <Typography variant="subtitle1" component="h2" fontWeight="bold" sx={{ flexGrow: 1, pr: 1 }}>
                    {request.id}번: {request.customer_name} ({request.user_name})
                  </Typography>
                  <Chip label={getStatusLabel(request.status)} color={getStatusChipColor(request.status)} size="small" />
                </Box>
              }
              secondary={
                <Stack spacing={0.5} sx={{ width: '100%' }}>
                  <Typography component="span" variant="caption" color="text.secondary">
                    업무일시: {new Date(request.created_at).toLocaleDateString()} {new Date(request.created_at).toLocaleTimeString().substring(0, 5)}
                  </Typography>
                  <Typography component="span" variant="body2" sx={{ wordBreak: 'break-word' }}>
                    {stripHtmlTags(request.content).substring(0, 40) + '...'}
                  </Typography>
                </Stack>
              }
            />
          </ListItem>
          <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: 'flex-end', width: '100%' }}>
            <Button variant="outlined" size="small" onClick={(e) => { e.stopPropagation(); handleOpenDetailModal(request); }}>상세보기</Button>
            <Button variant="outlined" size="small" color="error" onClick={(e) => { e.stopPropagation(); setRequestToDelete(request); setOpenDeleteConfirm(true); }}>삭제</Button>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );

  return (
    <>
      <Helmet>
        <title>관리자 대시보드</title>
      </Helmet>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <DashboardIcon sx={{ mr: 1.5, fontSize: '2rem' }} />
        <Typography variant="h4" component="h1">
          관리자 대시보드
        </Typography>
      </Box>
      <Divider sx={{ mb: 3 }} />

      {/* Summary Widgets */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Total Requests */}
        <Grid item xs={12} sm={4}>
          <ButtonBase
            sx={{ width: '100%', textAlign: 'left', borderRadius: theme.shape.borderRadius }}
            onClick={() => handleStatusFilterClick(null)}
          >
            <Paper
              elevation={2}
              sx={{
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                borderLeft: `5px solid ${theme.palette.primary.main}`,
                borderColor: filterStatus === null ? theme.palette.primary.dark : theme.palette.primary.main,
                boxShadow: filterStatus === null ? `0px 0px 8px ${theme.palette.primary.light}` : undefined,
              }}
            >
              <CategoryIcon sx={{ fontSize: '2.5rem', color: theme.palette.primary.main, mr: 1.5 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">총 업무 기록</Typography>
                <Typography variant="h5" fontWeight="bold">{summaryData.total}</Typography>
              </Box>
            </Paper>
          </ButtonBase>
        </Grid>
        {/* Processing Requests */}
        <Grid item xs={12} sm={4}>
          <ButtonBase
            sx={{ width: '100%', textAlign: 'left', borderRadius: theme.shape.borderRadius }}
            onClick={() => handleStatusFilterClick('processing')}
          >
            <Paper
              elevation={2}
              sx={{
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                borderLeft: `5px solid ${theme.palette.warning.main}`,
                borderColor: filterStatus === 'processing' ? theme.palette.warning.dark : theme.palette.warning.main,
                boxShadow: filterStatus === 'processing' ? `0px 0px 8px ${theme.palette.warning.light}` : undefined,
              }}
            >
              <SyncIcon sx={{ fontSize: '2.5rem', color: theme.palette.warning.main, mr: 1.5 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">처리 중</Typography>
                <Typography variant="h5" fontWeight="bold">{summaryData.processing}</Typography>
              </Box>
            </Paper>
          </ButtonBase>
        </Grid>
        {/* Completed Requests */}
        <Grid item xs={12} sm={4}>
          <ButtonBase
            sx={{ width: '100%', textAlign: 'left', borderRadius: theme.shape.borderRadius }}
            onClick={() => handleStatusFilterClick('completed')}
          >
            <Paper
              elevation={2}
              sx={{
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                borderLeft: `5px solid ${theme.palette.success.main}`,
                borderColor: filterStatus === 'completed' ? theme.palette.success.dark : theme.palette.success.main,
                boxShadow: filterStatus === 'completed' ? `0px 0px 8px ${theme.palette.success.light}` : undefined,
              }}
            >
              <CheckCircleIcon sx={{ fontSize: '2.5rem', color: theme.palette.success.main, mr: 1.5 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">처리 완료</Typography>
                <Typography variant="h5" fontWeight="bold">{summaryData.completed}</Typography>
              </Box>
            </Paper>
          </ButtonBase>
        </Grid>
      </Grid>

      {requests.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center', mt: 4 }}>
          <CheckCircleOutlineIcon sx={{ fontSize: '4rem', color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            등록된 유지보수 업무 내역이 없습니다.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            새로운 유지보수 업무를 기록하면 여기에 표시됩니다.
          </Typography>
        </Paper>
      ) : (
        isMobile ? renderMobileView() : renderDesktopView()
      )}

      {/* Admin Request Detail Modal */}
      <Dialog open={openDetailModal} onClose={handleCloseDetailModal} fullWidth maxWidth="md">
        {selectedRequest && (
          <>
            <DialogTitle sx={{ pb: 0 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="h6" component="span" sx={{ mb: { xs: 1, sm: 0 } }}>유지보수 업무 상세내용</Typography>
                <Chip label={getStatusLabel(selectedRequest.status)} color={getStatusChipColor(selectedRequest.status)} />
              </Box>
            </DialogTitle>
            <DialogContent dividers sx={{ pt: 2 }}>
              <Stack spacing={2}>
                <Typography><b>거래처명:</b> {selectedRequest.customer_name}</Typography>
                <Typography><b>요청자:</b> {selectedRequest.requester_name}</Typography>
                <Typography><b>작성자:</b> {selectedRequest.user_name}</Typography>
                <Typography><b>업무일시:</b> {new Date(selectedRequest.created_at).toLocaleString()}</Typography>
                <Typography><b>최종수정일:</b> {new Date(selectedRequest.updated_at).toLocaleString()}</Typography>
              </Stack>
              <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>접수내용</Typography>
              <Paper variant="outlined" sx={{ p: 2, maxHeight: 200, overflow: 'auto' }}>
                <div dangerouslySetInnerHTML={{ __html: selectedRequest.content }} />
              </Paper>

              {(selectedRequest.images?.length || 0) > 0 && (
                <>
                  <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>첨부 이미지</Typography>
                  <Grid container spacing={2}>
                    {selectedRequest.images
                      ?.filter(image => typeof image === 'string' && image.trim() !== '')
                      .map((image, index) => (
                      <Grid item key={index}>
                        <a href={image} target="_blank" rel="noopener noreferrer">
                          <img src={image} alt={`attachment ${index}`} style={{ width: 150, height: 150, objectFit: 'cover', borderRadius: 'inherit' }} />
                        </a>
                      </Grid>
                    ))}
                  </Grid>
                </>
              )}

              <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>처리내용</Typography>
              {selectedRequest.comments.length > 0 ? (
                <Stack spacing={1}>
                  {selectedRequest.comments.map(comment => (
                    <Paper variant="outlined" key={comment.id} sx={{ p: 2 }}>
                      <Typography variant="body2" color="text.secondary">{new Date(comment.created_at).toLocaleString()}</Typography>
                      <Typography dangerouslySetInnerHTML={{ __html: comment.comment }} />
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography color="text.secondary">아직 등록된 처리내용이 없습니다.</Typography>
                </Paper>
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
                    <MenuItem value="processing">{getStatusLabel('processing')}</MenuItem>
                    <MenuItem value="completed">{getStatusLabel('completed')}</MenuItem>
                  </Select>
                </FormControl>
                <Box sx={{ mt: 2, mb: 1, '& .ck-editor__editable': { minHeight: '150px' } }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>처리내용/기타 추가사항</Typography>
                  <CKEditor
                    editor={ClassicEditor}
                    data={newComment}
                    onChange={(event: any, editor: any) => {
                      const data = editor.getData();
                      setNewComment(data);
                    }}
                    config={{
                      toolbar: ['bold', 'italic', 'link', 'bulletedList', 'numberedList', 'blockQuote', '|', 'insertTable', 'undo', 'redo'],
                    }}
                  />
                </Box>
                {saveError && <Alert severity="error" sx={{ mt: 2 }}>{saveError}</Alert>}
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
              <Button onClick={handleCloseDetailModal} variant="outlined">닫기</Button>
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
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>업무 기록 삭제</DialogTitle>
        <DialogContent>
          <DialogContentText>
            선택한 유지보수 업무 기록을 정말로 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDeleteConfirm(false)} variant="outlined">취소</Button>
          <Button onClick={handleDeleteRequest} color="error" variant="contained">삭제</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AdminDashboardPage;