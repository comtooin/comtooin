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
import { supabase, assetBaseURL } from '../api';
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
        case 'pending':
        case 'processing': 
            return '처리중';
        case 'completed': 
            return '처리완료';
        default: 
            return status;
    }
};

const getStatusChipStyle = (status: string) => {
    const isCompleted = status === 'completed' || status === '처리완료';
    const isProcessing = status === 'processing' || status === 'pending' || status === '처리중';
    
    if (isCompleted) {
        return {
            bgcolor: 'rgba(245, 158, 11, 0.1)', // Soft amber background
            color: '#d97706', // Amber 600 text
            border: '1px solid rgba(245, 158, 11, 0.2)',
            fontWeight: 'bold',
        };
    } else if (isProcessing) {
        return {
            bgcolor: 'rgba(16, 185, 129, 0.1)', // Soft emerald background
            color: '#059669', // Emerald 600 text
            border: '1px solid rgba(16, 185, 129, 0.2)',
            fontWeight: 'bold',
        };
    } else {
        return {
            bgcolor: 'rgba(148, 163, 184, 0.1)', // Soft slate background
            color: '#64748b', // Slate 600 text
            border: '1px solid rgba(148, 163, 184, 0.2)',
            fontWeight: 'bold',
        };
    }
};

const SubmissionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<IRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const userRole = sessionStorage.getItem('adminRole');
  const isCustomer = userRole === 'customer';

  // State for delete dialog
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const handleCancelRequest = async () => {
    if (!id || !request) return;
    if (!window.confirm('정말로 이 기술지원 요청을 취소하시겠습니까?')) return;
    setLoading(true);
    try {
        // 1. Supabase Storage에 저장된 이미지 경로 추출
        const imagesToRemove = request.images
            ?.filter(url => typeof url === 'string' && url.includes('/uploads/'))
            .map((url: string) => {
                return url.split('/uploads/').pop();
            }).filter(Boolean) as string[];

        // 2. 구글 드라이브에 저장된 이미지 파일 ID 추출
        const driveFileIds = request.images
            ?.filter(url => typeof url === 'string' && url.includes('drive.google.com'))
            ?.map((url: string) => {
                const decodedUrl = decodeURIComponent(url);
                let match = decodedUrl.match(/[?&]id=([^&]+)/);
                if (match) return match[1];
                match = decodedUrl.match(/\/d\/([^/]+)/);
                if (match) return match[1];
                return null;
            }).filter(Boolean) as string[];

        // 3. 다이렉트 requests 테이블 삭제 쿼리 실행
        const { error: deleteError } = await supabase
            .from('requests')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        // DB 삭제 성공 후 실물 파일들 정리
        if (imagesToRemove && imagesToRemove.length > 0) {
            await supabase.storage.from('uploads').remove(imagesToRemove);
        }

        if (driveFileIds && driveFileIds.length > 0) {
            console.log("Starting deletion of drive files on direct cancel:", driveFileIds);
            await Promise.all(
                driveFileIds.map(async (fileId) => {
                    try {
                        const { data, error: funcErr } = await supabase.functions.invoke('upload-drive-file', {
                            headers: {
                                Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY || ''}`
                            },
                            body: {
                                deleteFileOnly: true,
                                fileIdToDelete: fileId
                            }
                        });
                        if (funcErr) throw funcErr;
                        if (data && data.error) throw new Error(data.error);
                    } catch (driveErr: any) {
                        console.error(`Failed to delete drive file ${fileId} on request cancel:`, driveErr.message || driveErr);
                    }
                })
            );
        }

        alert('성공적으로 취소되었습니다.');
        navigate('/admin/dashboard');
    } catch (err: any) {
        alert(err.message || '취소 중 오류가 발생했습니다.');
    } finally {
        setLoading(false);
    }
  };

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

        // 이미지 및 코멘트 데이터의 2중 안전 JSON 파싱 가드 이식
        let parsedImages: string[] = [];
        if (data.images) {
          if (Array.isArray(data.images)) {
            // 이미 배열인 경우 내부 원소들이 JSON 문자열인지 방어적으로 2차 검증
            parsedImages = data.images.map((img: any) => {
              if (typeof img === 'string' && img.startsWith('[')) {
                try {
                  const arr = JSON.parse(img);
                  return Array.isArray(arr) ? arr[0] : img;
                } catch {
                  return img;
                }
              }
              return img;
            });
          } else if (typeof data.images === 'string' && data.images.trim() !== '') {
            try {
              const parsed = JSON.parse(data.images);
              parsedImages = Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) {
              parsedImages = [data.images];
            }
          }
        }

        setRequest({
          ...data,
          images: parsedImages,
          comments: Array.isArray(data.comments) ? data.comments : []
        });
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
        // 1. Supabase Storage에 저장된 이미지인 경우 경로 추출
        const imagesToRemove = request?.images
            ?.filter(url => typeof url === 'string' && url.includes('/uploads/'))
            .map((url: string) => {
                return url.split('/uploads/').pop();
            }).filter(Boolean) as string[];

        // 2. 구글 드라이브에 저장된 이미지 파일 ID 추출 (이중 인코딩 방어용 decode 처리 추가)
        const driveFileIds = request?.images
            ?.filter(url => typeof url === 'string' && url.includes('drive.google.com'))
            ?.map((url: string) => {
                const decodedUrl = decodeURIComponent(url);
                let match = decodedUrl.match(/[?&]id=([^&]+)/);
                if (match) return match[1];
                match = decodedUrl.match(/\/d\/([^/]+)/);
                if (match) return match[1];
                return null;
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

        // DB 삭제 성공 후 실물 파일들 정리
        if (imagesToRemove && imagesToRemove.length > 0) {
            await supabase.storage.from('uploads').remove(imagesToRemove);
        }

        if (driveFileIds && driveFileIds.length > 0) {
            console.log("Starting deletion of drive files:", driveFileIds);
            await Promise.all(
                driveFileIds.map(async (fileId) => {
                    try {
                        const { data, error: funcErr } = await supabase.functions.invoke('upload-drive-file', {
                            headers: {
                                Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY || ''}`
                            },
                            body: {
                                deleteFileOnly: true,
                                fileIdToDelete: fileId
                            }
                        });
                        if (funcErr) throw funcErr;
                        if (data && data.error) throw new Error(data.error);
                        console.log(`Successfully deleted drive file: ${fileId}`, data);
                    } catch (driveErr: any) {
                        console.error(`Failed to delete drive file ${fileId} on request deletion:`, driveErr.message || driveErr);
                    }
                })
            );
        }

        alert('성공적으로 삭제되었습니다.');
        setOpenDeleteDialog(false);
        navigate('/admin/dashboard');
    } catch (err: any) {
        setDeleteError(err.message || '삭제 중 오류가 발생했습니다.');
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;
  if (error) return <Container maxWidth="md" sx={{ mt: 2.5 }}><Alert severity="error">{error}</Alert></Container>;
  if (!request) return <Container maxWidth="md" sx={{ mt: 2.5 }}><Alert severity="info">접수 내역을 찾을 수 없습니다.</Alert></Container>;

  return (
    <Container maxWidth="md">
      <Helmet>
        <title>{`접수 상세내용 (접수번호: ${request.id})`}</title>
      </Helmet>

      {/* 표준 헤더 섹션 */}
      <Box sx={{ mb: { xs: 1.5, sm: 2, md: 2.5 } }}>
        <Stack direction="row" alignItems="center" spacing={{ xs: 1, sm: 1.25, md: 1.5 }} mb={{ xs: 0.25, sm: 0.5, md: 1 }}>
          <AssignmentIcon sx={{ fontSize: { xs: '1.6rem', sm: '1.9rem', md: '2.2rem' }, color: 'primary.main' }} />
          <Typography component="h1" sx={{ fontWeight: 'bold', fontSize: { xs: '1.2rem', sm: '1.35rem', md: '1.5rem' } }}>
            업무 기록 상세 정보
          </Typography>
        </Stack>
        <Typography sx={{ color: 'text.secondary', fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' }, lineHeight: 1.4 }}>
          접수된 업무의 상세 내용과 처리 과정을 확인합니다. (접수번호: {request.id})
        </Typography>
      </Box>

      <Divider sx={{ mb: { xs: 1.5, sm: 2, md: 2.5 } }} />

      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2.5 }, borderRadius: 1, bgcolor: 'background.paper', boxShadow: '0 4px 20px 0 rgba(0,0,0,0.05)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CheckCircleIcon sx={{ mr: 1, color: 'success.main' }} />
            <Typography variant="h6" fontWeight="bold">상세 현황</Typography>
          </Box>
          <Chip 
            label={getStatusLabel(request.status)} 
            size="small"
            sx={{ px: 1, borderRadius: 1, ...getStatusChipStyle(request.status) }}
          />
        </Box>

        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'grey.50', borderRadius: 1, mb: 2.5 }}>
          <Grid container spacing={{ xs: 1.5, sm: 2 }}>
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
        <Paper variant="outlined" sx={{ p: 2, mb: 2.5, bgcolor: 'white', borderRadius: 1, minHeight: 100 }}>
          <div dangerouslySetInnerHTML={{ __html: request.content }} style={{ lineHeight: 1.6 }} />
        </Paper>

        {request.images && request.images.length > 0 && (
          <>
            <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 'bold' }}>첨부 이미지</Typography>
            <Grid container spacing={2} sx={{ mb: 2.5 }}>
              {request.images
                ?.filter(image => typeof image === 'string' && image.trim() !== '')
                .map((image, index) => {
                  let imageUrl = image;
                  if (!image.startsWith('http')) {
                    imageUrl = `${assetBaseURL}/uploads/${image}`;
                  } else if (image.includes('drive.google.com')) {
                    let fileId = image.match(/[?&]id=([^&]+)/)?.[1];
                    if (!fileId) {
                      fileId = image.match(/\/d\/([^/]+)/)?.[1];
                    }
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
                          borderRadius: 1, 
                          cursor: 'pointer',
                          transition: 'transform 0.2s',
                          '&:hover': { transform: 'scale(1.02)', boxShadow: 2 }
                        }}
                        onClick={() => window.open(image.startsWith('http') ? image : imageUrl, '_blank')}
                      >
                        <img src={imageUrl} alt={`attachment ${index}`} referrerPolicy="no-referrer" style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }} />
                      </Paper>
                    </Grid>
                  );
                })}
            </Grid>
          </>
        )}

        <Divider sx={{ my: 2.5 }} />

        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>처리 내용 및 코멘트</Typography>
        {request.comments && request.comments.length > 0 ? (
          <Stack spacing={2} sx={{ mb: 2.5 }}>
            {request.comments.map(comment => (
              <Paper
                variant="outlined"
                key={comment.id}
                sx={{ p: 2.5, bgcolor: 'grey.50', borderRadius: 1, borderLeft: '6px solid #607d8b' }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  {new Date(comment.created_at).toLocaleString()}
                </Typography>
                <div dangerouslySetInnerHTML={{ __html: comment.comment }} style={{ lineHeight: 1.5 }} />
              </Paper>
            ))}
          </Stack>
        ) : (
          <Paper variant="outlined" sx={{ p: 4, mb: 2.5, textAlign: 'center', bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography color="text.secondary">등록된 처리 내용이 없습니다.</Typography>
          </Paper>
        )}

        <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
            {isCustomer ? (
              <>
                {request && request.status !== 'completed' && (
                  <Button 
                    variant="contained" 
                    color="error" 
                    size="large"
                    onClick={handleCancelRequest} 
                    sx={{ minWidth: 120, fontWeight: 'bold', borderRadius: 1 }}
                  >
                      요청 취소
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button 
                  variant="contained" 
                  color="primary" 
                  size="large"
                  onClick={() => navigate(`/admin/request/edit/${id}`)} 
                  sx={{ minWidth: 120, fontWeight: 'bold', borderRadius: 1 }}
                >
                    수정
                </Button>
                <Button 
                  variant="contained" 
                  color="error" 
                  size="large"
                  onClick={() => setOpenDeleteDialog(true)} 
                  sx={{ minWidth: 120, fontWeight: 'bold', borderRadius: 1 }}
                >
                    삭제
                </Button>
              </>
            )}
            <Button 
              variant="outlined" 
              size="large"
              onClick={() => navigate('/admin/dashboard')}
              sx={{ minWidth: 120, fontWeight: 'bold', borderRadius: 1 }}
            >
                목록
            </Button>
        </Box>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={openDeleteDialog} 
        onClose={(event, reason) => {
          if (reason !== 'backdropClick') {
            setOpenDeleteDialog(false);
          }
        }} 
        disableEscapeKeyDown
        maxWidth="sm" 
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '20px 16px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 40px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 32px)' },
            maxWidth: { xs: 'calc(100% - 32px)', sm: 'sm' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>접수 내역 삭제</DialogTitle>
        <DialogContent dividers>
          <DialogContentText sx={{ mb: 2 }}>
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
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" sx={{ fontWeight: 'bold' }}>데이터 삭제</Button>
          <Button onClick={() => setOpenDeleteDialog(false)} variant="outlined" color="inherit">닫기</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SubmissionDetailPage;
