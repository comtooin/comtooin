import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, Box, Paper, CircularProgress, Button,
  Select, MenuItem, InputLabel, FormControl, Grid, TextField, Stack, Divider
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  AccessTime as AccessTimeIcon
} from '@mui/icons-material';
import { supabase, getCurrentStaffId, sendPushNotification } from '../api';



export const RequestDetailModal = ({ open, request, onClose, onRefresh }: any) => {
  const userRole = localStorage.getItem('adminRole');
  const [selectedRequest, setSelectedRequest] = useState<any>(request);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ content: '', requester_name: '', comments: [] as any[] });
  const [newComment, setNewComment] = useState('');
  const [newStatus, setNewStatus] = useState(request?.status || 'processing');
  const [saving, setSaving] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');

  useEffect(() => {
    if (open && request) {
      setSelectedRequest(request);
      setNewStatus(request.status);
      setNewComment('');
      setIsEditing(false);
      setEditingCommentId(null);
      setEditForm({
        content: request.content || '',
        requester_name: request.requester_name || '',
        comments: []
      });
    }
  }, [open, request]);

  const handleDeleteRequest = async () => {
    if (!selectedRequest) return;
    if (!window.confirm('정말로 이 기록을 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('requests').delete().eq('id', selectedRequest.id);
      if (error) throw error;
      
      // 관련 스케줄 및 구글 캘린더 자동 삭제 시도
      try {
        const scheduleTitle = `업무기록 접수 (${selectedRequest.user_name})`;
        const startTimeStr = `${selectedRequest.created_at.split('T')[0]}T00:00:00`;
        const { data: matchedSchedules } = await supabase.from('schedules')
          .select('*')
          .eq('title', scheduleTitle)
          .eq('start_time', startTimeStr)
          .eq('content', selectedRequest.content)
          .limit(1);

        if (matchedSchedules && matchedSchedules.length > 0) {
          const schedule = matchedSchedules[0];
          await supabase.from('schedules').delete().eq('id', schedule.id);
          if (schedule.google_event_id) {
            await supabase.functions.invoke('google-calendar-sync', {
              body: { method: 'DELETE', googleEventId: schedule.google_event_id }
            });
          }
        }
      } catch (scheduleErr) {
        console.warn('연동된 스케줄 삭제 실패:', scheduleErr);
      }

      alert('업무 기록이 삭제되었습니다.');
      onClose();
      onRefresh();
    } catch (err: any) {
      alert(err.message || '삭제 중 오류가 발생했습니다.');
    }
  };

  const handleEditComment = async (commentId: number) => {
    if (!editingCommentContent.trim()) return;
    try {
      const { error } = await supabase.from('comments').update({ comment: editingCommentContent }).eq('id', commentId);
      if (error) throw error;
      
      const { data: refreshedData } = await supabase.from('requests').select('*, comments(*)').eq('id', selectedRequest.id).single();
      if (refreshedData) setSelectedRequest(refreshedData);
      
      setEditingCommentId(null);
      setEditingCommentContent('');
      onRefresh(); 
    } catch (err: any) {
      alert(err.message || '처리내용 수정 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!window.confirm('이 처리내용을 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('comments').delete().eq('id', commentId);
      if (error) throw error;
      
      const { data: refreshedData } = await supabase.from('requests').select('*, comments(*)').eq('id', selectedRequest.id).single();
      if (refreshedData) setSelectedRequest(refreshedData);
      onRefresh();
    } catch (err: any) {
      alert(err.message || '처리내용 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleSaveRequest = async () => {
    if (!selectedRequest) return;
    setSaving(true);
    try {
      const updatePayload: any = { 
        status: newStatus, 
        updated_at: new Date().toISOString()
      };
      if (isEditing) {
        updatePayload.content = editForm.content;
        updatePayload.requester_name = editForm.requester_name;
      }
      const { error: updateError } = await supabase.from('requests').update(updatePayload).eq('id', selectedRequest.id);
      if (updateError) throw updateError;

      if (newComment.trim()) {
        const staffId = await getCurrentStaffId();
        await supabase.from('comments').insert({
          request_id: selectedRequest.id,
          comment: newComment.trim(),
          user_id: staffId,
        });

        const { data: requestAuthor } = await supabase.from('requests').select('user_email, customer_name').eq('id', selectedRequest.id).single();
        if (requestAuthor?.user_email) {
          const { data: authorStaff } = await supabase.from('staff').select('id').eq('email', requestAuthor.user_email).single();
          if (authorStaff && authorStaff.id !== staffId) {
             sendPushNotification('새 코멘트 등록 알림', `[${requestAuthor.customer_name}] 업무기록에 코멘트가 달렸습니다.`, [authorStaff.id]);
          }
        }
      }

      const { data: refreshedData } = await supabase.from('requests').select('*, comments(*)').eq('id', selectedRequest.id).single();
      if (refreshedData) setSelectedRequest(refreshedData);
      
      setNewComment('');
      setIsEditing(false);
      alert('성공적으로 저장되었습니다.');
      onRefresh();
    } catch (err: any) {
      alert('저장 실패: ' + (err.message || '오류가 발생했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  if (!selectedRequest) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      fullWidth 
      maxWidth="md"
      sx={{
        '& .MuiDialog-paper': {
          m: { xs: '12px 8px', sm: 3 },
          maxHeight: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' },
          width: { xs: 'calc(100% - 16px)' },
          maxWidth: { xs: 'calc(100% - 16px)', sm: 'md' }
        }
      }}
    >
      <DialogTitle sx={{ fontWeight: 'bold' }}>업무 상세 정보</DialogTitle>
      <DialogContent dividers sx={{ p: { xs: 1.5, sm: 3 } }}>
        <Stack spacing={1.5}>
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50', display: 'flex', flexWrap: 'wrap', columnGap: 3, rowGap: 1, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" color="text.secondary" fontWeight="bold">거래처</Typography>
              <Typography variant="subtitle1" fontWeight="bold" color="text.primary">{selectedRequest.customer_name}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" color="text.secondary" fontWeight="bold">요청자</Typography>
              {isEditing ? (
                <TextField size="small" variant="outlined" value={editForm.requester_name} onChange={(e) => setEditForm({ ...editForm, requester_name: e.target.value })} sx={{ minWidth: 120 }} />
              ) : (
                <Typography variant="subtitle1" fontWeight="bold" color="text.primary">{selectedRequest.requester_name || '-'}</Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" color="text.secondary" fontWeight="bold">작성자</Typography>
              <Typography variant="subtitle1" fontWeight="bold" color="text.primary">{selectedRequest.user_name}</Typography>
            </Box>
          </Paper>
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssignmentIcon fontSize="small" color="action" /> 접수 내용
            </Typography>
            <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'background.paper' }}>
              {isEditing ? (
                <TextField multiline rows={4} fullWidth value={editForm.content} onChange={(e) => setEditForm({ ...editForm, content: e.target.value })} />
              ) : (
                <div dangerouslySetInnerHTML={{ __html: selectedRequest.content }} style={{ lineHeight: 1.6, wordBreak: 'break-word', fontSize: '0.95rem' }} />
              )}
            </Paper>
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTimeIcon fontSize="small" color="action" /> 처리내용 기록
            </Typography>
            <Stack spacing={1}>
              {selectedRequest.comments?.map((c: any) => (
                <Paper key={c.id} variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">{new Date(c.created_at).toLocaleString()}</Typography>
                    {userRole !== 'customer' && (
                      <Stack direction="row" spacing={0.5}>
                        {editingCommentId === c.id ? (
                          <>
                            <Button size="small" variant="text" color="primary" onClick={() => handleEditComment(c.id)} sx={{ minWidth: 'auto', p: 0.5 }}>저장</Button>
                            <Button size="small" variant="text" color="inherit" onClick={() => setEditingCommentId(null)} sx={{ minWidth: 'auto', p: 0.5 }}>취소</Button>
                          </>
                        ) : (
                          <>
                            <Button size="small" variant="text" color="primary" onClick={() => { setEditingCommentId(c.id); setEditingCommentContent(c.comment); }} sx={{ minWidth: 'auto', p: 0.5 }}>수정</Button>
                            <Button size="small" variant="text" color="error" onClick={() => handleDeleteComment(c.id)} sx={{ minWidth: 'auto', p: 0.5 }}>삭제</Button>
                          </>
                        )}
                      </Stack>
                    )}
                  </Stack>
                  {editingCommentId === c.id ? (
                    <TextField multiline rows={2} fullWidth size="small" value={editingCommentContent} onChange={(e) => setEditingCommentContent(e.target.value)} />
                  ) : (
                    <div dangerouslySetInnerHTML={{ __html: c.comment }} style={{ wordBreak: 'break-word', fontSize: '0.9rem' }} />
                  )}
                </Paper>
              ))}
              {(!selectedRequest.comments || selectedRequest.comments.length === 0) && <Typography variant="body2" color="text.disabled" align="center" sx={{ py: 2 }}>등록된 코멘트가 없습니다.</Typography>}
            </Stack>
          </Box>
          
          {selectedRequest.images && selectedRequest.images.length > 0 && (
            <Box>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>첨부 이미지</Typography>
              <Grid container spacing={1}>
                {selectedRequest.images.map((image: string, index: number) => {
                  let imageUrl = image;
                  if (!image.startsWith('http')) imageUrl = `https://szwiejswmfivultxxywb.supabase.co/storage/v1/object/public/uploads/${image}`;
                  else if (image.includes('drive.google.com')) {
                    const fileId = image.match(/\/d\/(.+?)\//)?.[1];
                    if (fileId) imageUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
                  }
                  return (
                    <Grid item key={index} xs={6} sm={4}>
                      <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 1, cursor: 'pointer', '&:hover': { transform: 'scale(1.02)' } }} onClick={() => window.open(image.startsWith('http') ? image : imageUrl, '_blank')}>
                        <img src={imageUrl} alt={`attachment ${index}`} style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          )}

          <Divider sx={{ my: 0.5 }} />
          
          {userRole !== 'customer' && (
            <>
              <FormControl fullWidth>
                <InputLabel>상태 변경</InputLabel>
                <Select value={newStatus} label="상태 변경" onChange={(e) => setNewStatus(e.target.value as string)}>
                  <MenuItem value="processing">처리중</MenuItem>
                  <MenuItem value="completed">처리완료</MenuItem>
                </Select>
              </FormControl>
              <TextField 
                label={(!selectedRequest.comments || selectedRequest.comments.length === 0) ? "처리내용 입력" : "새로운 처리내용 추가"} 
                multiline rows={3} fullWidth variant="outlined" value={newComment} onChange={(e) => setNewComment(e.target.value)} 
                placeholder={(!selectedRequest.comments || selectedRequest.comments.length === 0) ? "처리 내용을 입력해 주세요." : "추가할 처리 내용을 입력해 주세요."} 
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'grey.50', justifyContent: 'center' }}>
        <Stack direction="row" spacing={{ xs: 1.5, sm: 2 }} sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          {userRole === 'customer' ? (
            <Button onClick={onClose} variant="contained" color="primary" sx={{ fontWeight: 'bold', minWidth: 100 }}>닫기</Button>
          ) : (
            <>
              <Button onClick={handleDeleteRequest} color="error" variant="outlined" sx={{ fontWeight: 'bold', minWidth: 'auto' }}>삭제</Button>
              <Button variant="outlined" color="primary" onClick={() => setIsEditing(!isEditing)} sx={{ fontWeight: 'bold', bgcolor: 'white', minWidth: 'auto' }}>{isEditing ? '취소' : '수정'}</Button>
              <Button onClick={handleSaveRequest} variant="contained" color="primary" disabled={saving} sx={{ fontWeight: 'bold', minWidth: 'auto' }}>
                {saving ? <CircularProgress size={16} color="inherit" /> : '저장'}
              </Button>
              <Button onClick={onClose} variant="outlined" color="inherit" sx={{ fontWeight: 'bold', bgcolor: 'white', minWidth: 'auto' }}>닫기</Button>
            </>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  );
};
