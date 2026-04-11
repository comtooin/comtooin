import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Typography, Box, Paper, CircularProgress, Alert,
  Grid, Chip, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField, Stack, Divider
} from '@mui/material';
import { 
  CheckCircle as CheckCircleIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import { supabase } from '../api';
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

const getStatusLabel = (status: string): string => {
    switch (status) {
        case 'pending': return '접수완료';
        case 'processing': return '처리중';
        case 'completed': return '처리완료';
        default: return status;
    }
};

const getStatusChipColor = (status: string): 'success' | 'warning' | 'info' => {
    switch (status) {
        case 'completed': return 'success';
        case 'processing': return 'warning';
        case 'pending': return 'info';
        default: return 'info';
    }
};

const SubmissionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<IRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // State for delete dialog
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (!id) return;
    const fetchRequest = async () => {
      setLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('requests')
          .select('*, comments(*)')
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;
        setRequest(data);
      } catch (err: any) {
        setError('접수 내역을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchRequest();
  }, [id]);

  const handleDeleteConfirm = async () => {
    if (!id) return;
    try {
        setDeleteError('');
        const imagesToRemove = request?.images?.map((url: string) => {
            return url.split('/uploads/').pop();
        }).filter(Boolean) as string[];

        const { data: success, error: deleteError } = await supabase.rpc(
            'delete_request_with_password',
            { request_id: id, password_param: deletePassword }
        );

        if (deleteError) throw deleteError;
        if (success === false) {
            setDeleteError('비밀번호가 일치하지 않습니다.');
            return;
        }

        if (imagesToRemove && imagesToRemove.length > 0) {
            await supabase.storage.from('uploads').remove(imagesToRemove);
        }

        alert('성공적으로 삭제되었습니다.');
        setOpenDeleteDialog(false);
        navigate('/');
    } catch (err: any) {
        setDeleteError(err.message || '삭제 중 오류가 발생했습니다.');
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;
  if (error) return <Container maxWidth="md" sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Container>;
  if (!request) return <Container maxWidth="md" sx={{ mt: 4 }}><Alert severity="info">접수 내역을 찾을 수 없습니다.</Alert></Container>;

  return (
    <Container maxWidth="md">
      <Helmet>
        <title>{`접수 상세내용 (접수번호: ${request.id})`}</title>
      </Helmet>

      {/* 표준 헤더 섹션 */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <AssignmentIcon sx={{ fontSize: '2rem', color: 'primary.main' }} />
          <Typography variant="h5" component="h1" fontWeight="bold">
            업무 기록 상세 정보
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          접수된 업무의 상세 내용과 처리 과정을 확인합니다. (접수번호: {request.id})
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 4 }, borderRadius: 3, bgcolor: 'background.paper', boxShadow: '0 4px 20px 0 rgba(0,0,0,0.05)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CheckCircleIcon sx={{ mr: 1, color: 'success.main' }} />
            <Typography variant="h6" fontWeight="bold">상세 현황</Typography>
          </Box>
          <Chip 
            label={getStatusLabel(request.status)} 
            color={getStatusChipColor(request.status)} 
            variant="filled"
            sx={{ fontWeight: 'bold', px: 1 }}
          />
        </Box>

        <Paper variant="outlined" sx={{ p: 3, bgcolor: 'grey.50', borderRadius: 2, mb: 4 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>고객사명</Typography>
              <Typography variant="body1" fontWeight="bold">{request.customer_name}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>사용자명</Typography>
              <Typography variant="body1" fontWeight="bold">{request.user_name}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>접수일시</Typography>
              <Typography variant="body1" fontWeight="medium">{new Date(request.created_at).toLocaleString()}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>이메일</Typography>
              <Typography variant="body1" fontWeight="medium">{request.email || '-'}</Typography>
            </Grid>
          </Grid>
        </Paper>
        
        <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 'bold' }}>접수 내용</Typography>
        <Paper variant="outlined" sx={{ p: 3, mb: 4, bgcolor: 'white', borderRadius: 2, minHeight: 100 }}>
          <div dangerouslySetInnerHTML={{ __html: request.content }} style={{ lineHeight: 1.6 }} />
        </Paper>

        {request.images && request.images.length > 0 && (
          <>
            <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 'bold' }}>첨부 이미지</Typography>
            <Grid container spacing={2} sx={{ mb: 4 }}>
              {request.images
                ?.filter(image => typeof image === 'string' && image.trim() !== '')
                .map((image, index) => (
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
                    onClick={() => window.open(image, '_blank')}
                  >
                    <img src={image} alt={`attachment ${index}`} style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }} />
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </>
        )}

        <Divider sx={{ my: 4 }} />

        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>처리 내용 및 코멘트</Typography>
        {request.comments && request.comments.length > 0 ? (
          <Stack spacing={2} sx={{ mb: 4 }}>
            {request.comments.map(comment => (
              <Paper
                variant="outlined"
                key={comment.id}
                sx={{ p: 2.5, bgcolor: 'grey.50', borderRadius: 2, borderLeft: '6px solid #607d8b' }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  {new Date(comment.created_at).toLocaleString()}
                </Typography>
                <div dangerouslySetInnerHTML={{ __html: comment.comment }} style={{ lineHeight: 1.5 }} />
              </Paper>
            ))}
          </Stack>
        ) : (
          <Paper variant="outlined" sx={{ p: 4, mb: 4, textAlign: 'center', bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography color="text.secondary">등록된 처리 내용이 없습니다.</Typography>
          </Paper>
        )}

        <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button 
              variant="contained" 
              color="primary" 
              size="large"
              onClick={() => navigate(`/admin/request/edit/${id}`)} 
              disabled={request.status !== 'pending'}
              sx={{ minWidth: 140, fontWeight: 'bold', borderRadius: 2 }}
            >
                수정하기
            </Button>
            <Button 
              variant="contained" 
              color="error" 
              size="large"
              onClick={() => setOpenDeleteDialog(true)} 
              disabled={request.status !== 'pending'}
              sx={{ minWidth: 140, fontWeight: 'bold', borderRadius: 2 }}
            >
                삭제하기
            </Button>
            <Button 
              variant="outlined" 
              size="large"
              onClick={() => navigate('/')}
              sx={{ minWidth: 140, fontWeight: 'bold', borderRadius: 2 }}
            >
                목록으로
            </Button>
        </Box>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>접수 내역 삭제</DialogTitle>
        <DialogContent dividers>
          <DialogContentText sx={{ mb: 3 }}>
            이 접수 내역을 삭제하시려면 접수 시 사용했던 비밀번호를 입력해주세요.<br />
            <strong>삭제된 데이터는 복구할 수 없습니다.</strong>
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="비밀번호"
            type="password"
            fullWidth
            variant="outlined"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
          />
          {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenDeleteDialog(false)}>취소</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" sx={{ fontWeight: 'bold' }}>데이터 삭제</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SubmissionDetailPage;
