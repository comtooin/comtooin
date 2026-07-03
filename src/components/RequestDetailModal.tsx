import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, Box, Paper, CircularProgress, Button,
  Select, MenuItem, InputLabel, FormControl, Grid, TextField, Stack, Divider
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Assignment as AssignmentIcon,
  AccessTime as AccessTimeIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { supabase, getCurrentStaffId } from '../api';



export const RequestDetailModal = ({ open, request, onClose, onRefresh }: any) => {
  const [selectedRequest, setSelectedRequest] = useState<any>(request);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ content: '', comments: [] as any[] });
  const [newComment, setNewComment] = useState('');
  const [newStatus, setNewStatus] = useState(request?.status || 'processing');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && request) {
      setSelectedRequest(request);
      setNewStatus(request.status);
      setNewComment('');
      setIsEditing(false);
      setEditForm({
        content: request.content || '',
        comments: request.comments ? JSON.parse(JSON.stringify(request.comments)) : []
      });
    }
  }, [open, request]);

  const handleDeleteRequest = async () => {
    if (!selectedRequest) return;
    if (!window.confirm('정말로 이 기록을 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('requests').delete().eq('id', selectedRequest.id);
      if (error) throw error;
      alert('업무 기록이 삭제되었습니다.');
      onClose();
      onRefresh();
    } catch (err: any) {
      alert(err.message || '삭제 중 오류가 발생했습니다.');
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
      if (isEditing) updatePayload.content = editForm.content;
      const { error: updateError } = await supabase.from('requests').update(updatePayload).eq('id', selectedRequest.id);
      if (updateError) throw updateError;

      if (isEditing && editForm.comments && editForm.comments.length > 0) {
        for (const c of editForm.comments) {
          const original = selectedRequest.comments.find((oc: any) => oc.id === c.id);
          if (original && original.comment !== c.comment) {
            await supabase.from('comments').update({ comment: c.comment }).eq('id', c.id);
          }
        }
      }

      if (!isEditing && newComment.trim()) {
        const staffId = await getCurrentStaffId();
        await supabase.from('comments').insert({
          request_id: selectedRequest.id,
          comment: newComment.trim(),
          user_id: staffId,
        });
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 'bold' }}>업무 상세 정보 (번호: {selectedRequest.id})</DialogTitle>
      <DialogContent dividers sx={{ p: { xs: 1.5, sm: 3 } }}>
        <Stack spacing={1.5}>
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50', display: 'flex', flexWrap: 'wrap', columnGap: 3, rowGap: 1, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" color="text.secondary" fontWeight="bold">거래처</Typography>
              <Typography variant="subtitle1" fontWeight="bold" color="text.primary">{selectedRequest.customer_name}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" color="text.secondary" fontWeight="bold">요청자</Typography>
              <Typography variant="subtitle1" fontWeight="bold" color="text.primary">{selectedRequest.requester_name || '-'}</Typography>
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
              {isEditing ? (
                editForm.comments.map((c: any, idx: number) => (
                  <Paper key={c.id} variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>{new Date(c.created_at).toLocaleString()}</Typography>
                    <TextField multiline rows={2} fullWidth size="small" value={c.comment} onChange={(e) => {
                        const updated = editForm.comments.map((item, i) => i === idx ? { ...item, comment: e.target.value } : item);
                        setEditForm({ ...editForm, comments: updated });
                      }} />
                  </Paper>
                ))
              ) : (
                selectedRequest.comments?.map((c: any) => (
                  <Paper key={c.id} variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>{new Date(c.created_at).toLocaleString()}</Typography>
                    <div dangerouslySetInnerHTML={{ __html: c.comment }} />
                  </Paper>
                ))
              )}
              {(!isEditing && (!selectedRequest.comments || selectedRequest.comments.length === 0)) && <Typography variant="body2" color="text.disabled" align="center" sx={{ py: 2 }}>등록된 코멘트가 없습니다.</Typography>}
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
          
          <FormControl fullWidth>
            <InputLabel>상태 변경</InputLabel>
            <Select value={newStatus} label="상태 변경" onChange={(e) => setNewStatus(e.target.value as string)}>
              <MenuItem value="processing">처리중</MenuItem>
              <MenuItem value="completed">처리완료</MenuItem>
            </Select>
          </FormControl>
          {!isEditing && (
            <TextField label="새로운 처리내용 입력" multiline rows={3} fullWidth variant="outlined" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="추가할 처리 내용을 입력해 주세요." />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'grey.50', justifyContent: 'space-between', display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={handleDeleteRequest} color="error" variant="outlined" sx={{ fontWeight: 'bold' }}>삭제</Button>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button onClick={onClose} variant="outlined" color="inherit" sx={{ fontWeight: 'bold', bgcolor: 'white' }}>닫기</Button>
          <Button startIcon={<EditIcon sx={{ display: { xs: 'none', sm: 'inline-block' } }} />} variant="outlined" color="primary" onClick={() => setIsEditing(!isEditing)} sx={{ fontWeight: 'bold', bgcolor: 'white' }}>{isEditing ? '취소' : '수정'}</Button>
          <Button onClick={handleSaveRequest} variant="contained" color="primary" disabled={saving} sx={{ fontWeight: 'bold' }}>
            {saving ? <CircularProgress size={16} color="inherit" /> : '저장'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};
