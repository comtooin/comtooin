import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Typography, Box, Paper, CircularProgress, Alert,
  Grid, Chip, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField
} from '@mui/material';
import { supabase } from '../api';
import { Helmet } from 'react-helmet-async';

// Define types for our data (can be moved to a shared types file later)
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

// 삭제됨: const API_URL = ...

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
        // 수정됨: api 모듈 사용
        const { data, error: fetchError } = await supabase
          .from('requests')
          .select('*, comments(*)') // Assuming 'comments' is a related table and can be fetched with the request
          .eq('id', id)
          .single(); // Assuming 'id' is unique

        if (fetchError) {
          throw fetchError;
        }
        setRequest(data);
      } catch (err: any) {
        setError(err.response?.data?.error || '접수 내역을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchRequest();
  }, [id]);

  const handleDeleteConfirm = async () => {
    if (!id) return; // Keep this check
    try {
        setDeleteError('');
        
        // 1. 삭제 전, 현재 접수건에 연결된 이미지 경로들을 미리 추출합니다.
        // request.images는 ["https://.../uploads/folder/file.png", ...] 형태
        const imagesToRemove = request?.images?.map((url: string) => { // Use 'request' instead of 'selectedRequest'
            return url.split('/uploads/').pop(); // 'folder/file.png' 부분만 추출
        }).filter(Boolean) as string[];

        // 2. Supabase RPC 호출 (DB 레코드 삭제)
        const { data: success, error: deleteError } = await supabase.rpc(
            'delete_request_with_password',
            {
                request_id: id,
                password_param: deletePassword
            }
        );

        if (deleteError) throw deleteError;
        // The user's code has `if (!success)`, but the RPC might return data as null for success,
        // or a boolean true. Assuming `error` being null implies success,
        // or `data` contains a success flag from the RPC.
        // For now, I'll keep `if (!success)` as provided, assuming `data` is a boolean.
        if (success === false) { // Explicitly check for false if success can be null/undefined or a more complex object
            setDeleteError('비밀번호가 일치하지 않습니다.');
            return;
        }

        // 3. DB 삭제가 성공했다면, 이제 실제 Storage 파일을 지웁니다.
        if (imagesToRemove && imagesToRemove.length > 0) {
            const { error: storageError } = await supabase.storage
                .from('uploads')
                .remove(imagesToRemove);

            if (storageError) {
                console.error('Storage 삭제 실패 (DB는 이미 삭제됨):', storageError);
            }
        }

        alert('성공적으로 삭제되었습니다.');
        setOpenDeleteDialog(false);
        navigate('/'); // 메인으로 이동
        
    } catch (err: any) {
        console.error('Delete error:', err);
        setDeleteError(err.message || '삭제 중 오류가 발생했습니다.');
    }
  };

  const getStatusChipColor = (status: string): 'success' | 'warning' | 'info' => {
    switch (status) {
        case '처리완료': return 'success';
        case '처리중': return 'warning';
        default: return 'info';
    }
  };

  if (loading) {
    return <CircularProgress />;
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!request) {
    return <Alert severity="info">접수 내역을 찾을 수 없습니다.</Alert>;
  }

  return (
    <Container maxWidth="md">
      <Helmet>
        <title>{`접수 상세내용 (접수번호: ${request.id})`}</title>
      </Helmet>
      <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          ✅ 정상적으로 접수되었습니다.
        </Typography>
        <Typography variant="h6" gutterBottom>
          접수 상세내용 (접수번호: {request.id})
        </Typography>
        
        <Chip label={request.status === 'pending' ? '접수완료' : request.status} color={getStatusChipColor(request.status)} sx={{ mb: 2 }} />
        <Typography gutterBottom><b>고객사명:</b> {request.customer_name}</Typography>
        <Typography gutterBottom><b>사용자명:</b> {request.user_name}</Typography>
        <Typography gutterBottom><b>접수일시:</b> {new Date(request.created_at).toLocaleString()}</Typography>
        {request.email && <Typography gutterBottom><b>이메일:</b> {request.email}</Typography>}
        
        <Typography variant="h6" sx={{ mt: 3 }}>접수 내용</Typography>
        <Paper variant="outlined" sx={{ p: 2, my: 1, maxHeight: 200, overflow: 'auto' }}>
          <div dangerouslySetInnerHTML={{ __html: request.content }} />
        </Paper>

        {request.images && request.images.length > 0 && (
          <>
            <Typography variant="h6" sx={{ mt: 3 }}>첨부 이미지</Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {request.images.map((image, index) => (
                <Grid item key={index}>
                  <a href={image} target="_blank" rel="noopener noreferrer">
                    <img src={image} alt={`attachment ${index}`} style={{ width: 150, height: 150, objectFit: 'cover', borderRadius: '4px' }} />
                  </a>
                </Grid>
              ))}
            </Grid>
          </>
        )}

        <Typography variant="h6" sx={{ mt: 3 }}>처리내용</Typography>
        {request.comments && request.comments.length > 0 ? (
          request.comments.map(comment => (
            <Paper
              variant="outlined"
              key={comment.id}
              sx={{
                p: 2,
                my: 1,
              }}
            >
              <Typography variant="body2" color="text.secondary">{new Date(comment.created_at).toLocaleString()}</Typography>
              <div dangerouslySetInnerHTML={{ __html: comment.comment }} />
            </Paper>
          ))
        ) : (
          <Typography sx={{ my: 1 }}>-</Typography>
        )}

        <Box sx={{ mt: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button variant="contained" color="primary" onClick={() => navigate(`/edit-request/${id}`)} disabled={request.status !== 'pending'}>
                수정하기
            </Button>
            <Button variant="contained" color="secondary" onClick={() => setOpenDeleteDialog(true)} disabled={request.status !== 'pending'}>
                이 접수 건 삭제하기
            </Button>
            <Button variant="contained" onClick={() => navigate('/')}>
                추가 접수하기
            </Button>
        </Box>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle>접수 내역 삭제</DialogTitle>
        <DialogContent>
          <DialogContentText>
            이 접수 내역을 삭제하시려면 접수 시 사용했던 비밀번호를 입력해주세요. 이 작업은 되돌릴 수 없습니다.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="비밀번호"
            type="password"
            fullWidth
            variant="standard"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
          />
          {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>취소</Button>
          <Button onClick={handleDeleteConfirm}>삭제 확인</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SubmissionDetailPage;