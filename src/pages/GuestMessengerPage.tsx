import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  IconButton,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
  Container,
  Stack,
  Alert,
  Grid,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import { Helmet } from 'react-helmet-async';
import SendIcon from '@mui/icons-material/Send';
import ForumIcon from '@mui/icons-material/Forum';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import MicIcon from '@mui/icons-material/Mic';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import DeleteIcon from '@mui/icons-material/Delete';
import LogoutIcon from '@mui/icons-material/Logout';
import { supabase, sendPushNotification } from '../api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useVoiceTyping } from '../hooks/useVoiceTyping';

interface CustomerInfo {
  id: string;
  name: string;
}

interface Memo {
  id: string;
  created_at: string;
  content: string;
  color: string;
  author_id: string | null;
  room_id: string;
  author: {
    name: string;
  };
}

const GuestMessengerPage: React.FC = () => {
  const { client_code } = useParams<{ client_code: string }>();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // 거래처 정보 상태
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [checkingClient, setCheckingClient] = useState(true);
  const [clientError, setClientError] = useState('');

  // 세션 가입 정보 상태
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinPrivacyAgreed, setJoinPrivacyAgreed] = useState(false);

  // 채팅방 상태
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loadingMemos, setLoadingMemos] = useState(false);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 기술지원 접수 폼 모달 상태
  const [openRequestModal, setOpenRequestModal] = useState(false);
  const [reqContent, setReqContent] = useState('');
  const [reqImages, setReqImages] = useState<File[]>([]);
  const [reqPreviews, setReqPreviews] = useState<string[]>([]);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 음성 인식 훅 연동 (접수 내용 입력 필드용)
  const voiceRecorder = useVoiceTyping({
    onTranscriptionComplete: (text) => {
      setReqContent(prev => prev + (prev ? ' ' : '') + text);
    },
    promptText: "컴투인, 유지보수, 에러, 고장, 장애, 수리, PC, 인터넷, 모니터, 마우스, 키보드, 네트워크, 부품교체"
  });

  useEffect(() => {
    if (voiceRecorder.error) {
      alert(voiceRecorder.error);
      voiceRecorder.setError(null);
    }
  }, [voiceRecorder.error, voiceRecorder.setError, voiceRecorder]);

  // 1. 거래처 코드 확인 및 세션 검증
  useEffect(() => {
    const initPage = async () => {
      if (!client_code) {
        setClientError('유효하지 않은 주소입니다. 제공받은 링크를 다시 확인해주세요.');
        setCheckingClient(false);
        return;
      }

      try {
        // login_id에 해당하는 고객 정보 조회 (거래처 로그인 아이디 기반 자동 연동)
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .select('id, name')
          .eq('login_id', client_code)
          .single();

        if (customerError || !customerData) {
          setClientError('등록되지 않은 거래처 링크입니다. 관리자가 발급한 거래처 아이디(ID)가 올바른지 확인해 주세요.');
          setCheckingClient(false);
          return;
        }

        setCustomer(customerData);
        sessionStorage.setItem('adminRole', 'customer');
        sessionStorage.setItem('adminCustomerId', customerData.id);

        // 로컬스토리지에 저장된 대화방 ID 확인
        const savedRoomId = localStorage.getItem('comtooin_guest_room_id');
        if (savedRoomId) {
          // 해당 방이 유효하고 현재 거래처 정보와 일치하는지 검증
          const { data: roomData, error: roomError } = await supabase
            .from('chat_rooms')
            .select('id, customer_id, guest_name, guest_phone, guest_email')
            .eq('id', savedRoomId)
            .eq('is_private', true)
            .single();

          if (!roomError && roomData && roomData.customer_id === customerData.id) {
            setActiveRoomId(roomData.id);
            setGuestName(roomData.guest_name || '비회원');
            setGuestPhone(roomData.guest_phone || '');
            setGuestEmail(roomData.guest_email || '');
            fetchMemos(roomData.id);
          } else {
            // 방이 만료되었거나 거래처가 다르면 로컬스토리지 청소 후 새로 가입 폼 유도
            localStorage.removeItem('comtooin_guest_room_id');
            setShowJoinForm(true);
          }
        } else {
          setShowJoinForm(true);
        }
      } catch (err) {
        console.error('Initialization error:', err);
        setClientError('초기화 도중 오류가 발생했습니다.');
      } finally {
        setCheckingClient(false);
      }
    };

    initPage();
  }, [client_code]);

  // 2. 실시간 메시지 변경 리스너 구독
  useEffect(() => {
    if (!activeRoomId) return;

    const memosChannel = supabase
      .channel(`guest-memos-realtime-${activeRoomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'memos', filter: `room_id=eq.${activeRoomId}` },
        (payload: any) => {
          console.log('Realtime guest chat message changed', payload);
          if (payload.eventType === 'INSERT') {
            const newMemo: Memo = {
              id: payload.new.id,
              created_at: payload.new.created_at,
              content: payload.new.content,
              color: payload.new.color || '#ffffff',
              author_id: payload.new.author_id,
              room_id: payload.new.room_id,
              author: { name: payload.new.author_name || '알 수 없음' }
            };
            setMemos(prev => {
              if (prev.some(m => m.id === newMemo.id)) return prev;
              return [newMemo, ...prev];
            });
          } else if (payload.eventType === 'DELETE') {
            setMemos(prev => prev.filter(m => m.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            setMemos(prev => prev.map(m => m.id === payload.new.id ? {
              ...m,
              content: payload.new.content,
              color: payload.new.color || '#ffffff',
            } : m));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(memosChannel);
    };
  }, [activeRoomId]);

  // memos 변화에 따른 스크롤 동기화
  useEffect(() => {
    scrollToBottom();
  }, [memos]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // 3. 메시지 조회
  const fetchMemos = async (roomId: string) => {
    setLoadingMemos(true);
    try {
      const { data, error } = await supabase
        .from('memos')
        .select('id, created_at, content, color, author_id, room_id, author_name')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedMemos: Memo[] = (data || []).map((item: any) => ({
        id: item.id,
        created_at: item.created_at,
        content: item.content,
        color: item.color || '#ffffff',
        author_id: item.author_id,
        room_id: item.room_id,
        author: { name: item.author_name || '알 수 없음' }
      }));

      setMemos(formattedMemos);
    } catch (err) {
      console.error('Error fetching memos:', err);
    } finally {
      setLoadingMemos(false);
    }
  };

  // 4. 비회원 시작 정보 제출 (대화방 생성)
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !guestPhone.trim() || !customer) return;

    setJoining(true);
    try {
      // 1. 이미 동일한 이름과 연락처로 개설된 1:1 비공개 대화방이 있는지 먼저 조회 (기기 변경 대응)
      const { data: existingRoom, error: lookupError } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('customer_id', customer.id)
        .eq('guest_name', guestName.trim())
        .eq('guest_phone', guestPhone.trim())
        .eq('is_private', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!lookupError && existingRoom && existingRoom.length > 0) {
        // 이미 개설된 방이 존재하면 해당 방 ID를 연동하고 웰컴메시지 생략
        const roomId = existingRoom[0].id;
        localStorage.setItem('comtooin_guest_room_id', roomId);
        setActiveRoomId(roomId);
        setShowJoinForm(false);
        await fetchMemos(roomId);
        setJoining(false);
        return;
      }

      // 2. 기존 방이 없다면 신규 개설
      const formattedRoomName = `[${customer.name}] ${guestName.trim()} (${guestPhone.trim()})`;
      const { data: newRoom, error: roomError } = await supabase
        .from('chat_rooms')
        .insert({
          name: formattedRoomName,
          customer_id: customer.id,
          is_private: true,
          guest_name: guestName.trim(),
          guest_phone: guestPhone.trim(),
          guest_email: guestEmail.trim()
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // 신규 대화방 개설 시 이메일 알림 비동기 발송 (사내 직원 전원 및 관리자 메일함)
      supabase.functions.invoke('send-notification-email', {
        body: {
          table: "chat_rooms",
          type: "INSERT",
          record: {
            customer_name: customer.name,
            name: newRoom.name,
            guest_name: guestName.trim(),
            guest_phone: guestPhone.trim(),
            guest_email: guestEmail.trim()
          }
        }
      }).catch(err => console.error('Error invoking email notification function:', err));

      // 웰컴 메시지 작성
      const welcomeContent = `안녕하세요! <b>컴투인 ITSM</b> 실시간 대화창입니다. 😊<br/>기술지원 요청을 등록하시려면 하단의 <b>[기술지원 요청]</b> 버튼을 눌러주세요.<br/>접수하신 건의 처리 상태는 이 대화창을 통해 실시간으로 안내되며, 상세 문의사항은 여기에 바로 타이핑하여 엔지니어와 실시간 소통이 가능합니다.`;
      
      const { error: welcomeError } = await supabase.from('memos').insert({
        content: welcomeContent,
        color: '#f0f9ff', // Light system blue background
        room_id: newRoom.id,
        author_name: '컴투인 (시스템)'
      });

      if (welcomeError) throw welcomeError;

      localStorage.setItem('comtooin_guest_room_id', newRoom.id);
      setActiveRoomId(newRoom.id);
      setShowJoinForm(false);
      await fetchMemos(newRoom.id);
    } catch (err: any) {
      console.error('Error creating session:', err);
      alert('세션 시작에 실패했습니다: ' + (err.message || String(err)));
    } finally {
      setJoining(false);
    }
  };

  // 대화 종료 및 방 폭파 (자진 나가기)
  const handleLeaveRoom = async () => {
    if (!activeRoomId) return;
    if (!window.confirm('기술지원 대화를 종료하고 대화방을 나가시겠습니까?\n대화 내용은 영구 삭제되며, 접수된 요청 내역은 안전하게 보존됩니다.')) return;

    setLoadingMemos(true);
    try {
      // 1. Supabase에서 해당 방 삭제 (memos는 CASCADE 제약으로 자동 삭제)
      const { error } = await supabase
        .from('chat_rooms')
        .delete()
        .eq('id', activeRoomId);

      if (error) throw error;

      // 2. 로컬스토리지 청소 및 상태 초기화
      localStorage.removeItem('comtooin_guest_room_id');
      setActiveRoomId(null);
      setMemos([]);
      setGuestName('');
      setGuestPhone('');
      setGuestEmail('');
      setShowJoinForm(true);
    } catch (err: any) {
      console.error('Error leaving chat room:', err);
      alert('대화방을 나가는 도중 오류가 발생했습니다: ' + (err.message || String(err)));
    } finally {
      setLoadingMemos(false);
    }
  };

  // 5. 일반 메시지 전송
  const handleSend = async () => {
    if (!content.trim() || !activeRoomId) return;
    setSubmitting(true);

    try {
      const { error } = await supabase.from('memos').insert({
        content: content.trim(),
        color: '#ffffff',
        room_id: activeRoomId,
        author_name: `${guestName} (고객)`
      });

      if (error) throw error;

      const preview = content.trim().substring(0, 40) + (content.trim().length > 40 ? '...' : '');
      
      // 비회원 메시지 등록 -> 우리멤버(스태프) 전원 수신 발송
      await sendPushNotification(
        '새로운 메시지',
        `[비회원/1:1상담] ${guestName || '고객'}: ${preview}`,
        'member_only',
        window.location.origin + '/admin/messenger'
      ).catch(e => console.error('Push notification failed:', e));

      setContent('');
      await fetchMemos(activeRoomId);
    } catch (err: any) {
      console.error('Error sending message:', err);
      alert('메시지 전송에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 6. 이미지 압축 헬퍼
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 1200;

          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('이미지 압축 오류'));
          }, 'image/jpeg', 0.8);
        };
        img.onerror = () => reject(new Error('이미지 로딩 실패'));
      };
      reader.onerror = () => reject(new Error('파일 읽기 실패'));
    });
  };

  // 7. 이미지 파일 첨부 핸들러
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const newImageFiles = [...reqImages, ...files].slice(0, 5);
      setReqImages(newImageFiles);
      setReqPreviews(newImageFiles.map(file => URL.createObjectURL(file)));
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = [...reqImages];
    newImages.splice(index, 1);
    setReqImages(newImages);
    setReqPreviews(newImages.map(file => URL.createObjectURL(file)));
  };

  // 8. 간편 기술지원 접수 제출
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqContent.trim() || !customer || !activeRoomId) return;

    setSubmittingRequest(true);
    setRequestError('');
    try {
      // 이미지 업로드 처리
      let uploadedImageUrls: string[] = [];
      if (reqImages.length > 0) {
        const formDataUpload = new FormData();
        for (const image of reqImages) {
          const compressedBlob = await compressImage(image);
          if (compressedBlob.size > 5 * 1024 * 1024) {
            throw new Error(`이미지 용량이 5MB를 초과합니다: ${image.name}`);
          }
          formDataUpload.append('files', compressedBlob, image.name);
        }
        formDataUpload.append('customerName', customer.name);
        formDataUpload.append('userName', guestName);

        const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-daily-log-image', {
          body: formDataUpload,
        });

        if (uploadError) throw uploadError;
        if (uploadData?.urls) {
          uploadedImageUrls = uploadData.urls;
        }
      }

      // requests 테이블에 접수 정보 기록
      const { data: newReq, error: insertError } = await supabase
        .from('requests')
        .insert({
          customer_name: customer.name,
          requester_name: guestName, // 요청자 컬럼에 비회원 이름 대입
          email: guestEmail,
          content: reqContent.trim().replace(/\n/g, '<br/>'),
          images: uploadedImageUrls,
          status: 'pending',
          chat_room_id: activeRoomId
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 대화방에 시스템 접수 알림 전송
      const contentSummary = reqContent.length > 60 ? reqContent.substring(0, 60) + '...' : reqContent;
      const receiptMessage = `🛠️ <b>기술지원 요청이 정상 접수되었습니다.</b><br/>• 접수번호: #${newReq.id}<br/>• 접수자: ${guestName}<br/>• 증상 내용: ${contentSummary}<br/><br/>담당 엔지니어가 접수 내용을 파악하여 신속히 도움을 드리겠습니다. 처리 현황은 이 대화창에서 실시간으로 받아보실 수 있습니다.`;
      
      await supabase.from('memos').insert({
        content: receiptMessage,
        color: '#f0fdf4', // Light system green background for receipts
        room_id: activeRoomId,
        author_name: '컴투인 (시스템)'
      });

      // 새 기술지원 접수 알림 -> 스태프 전체 발송
      await sendPushNotification(
        '새 기술지원 요청 접수',
        `[${customer.name}] ${guestName} 님이 새로운 기술지원을 접수했습니다.`,
        'member_only',
        window.location.origin + '/admin/messenger'
      ).catch(e => console.error('Push notification failed:', e));

      // 폼 초기화 및 닫기
      setReqContent('');
      setReqImages([]);
      setReqPreviews([]);
      setPrivacyAgreed(false);
      setOpenRequestModal(false);
      await fetchMemos(activeRoomId);
    } catch (err: any) {
      console.error('Error submitting technical request:', err);
      setRequestError(err.message || '접수 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  // 모바일 키보드 전송 대응
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isMobile && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 로딩 스크린
  if (checkingClient) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">주소 확인 중입니다...</Typography>
      </Box>
    );
  }

  // 주소 오류
  if (clientError) {
    return (
      <Container maxWidth="xs" sx={{ mt: 10 }}>
        <Alert severity="error" variant="filled" sx={{ borderRadius: 2 }}>{clientError}</Alert>
      </Container>
    );
  }

  return (
    <Box 
      sx={{ 
        height: { xs: '100vh', sm: '85vh' },
        maxHeight: { xs: '100vh', sm: '800px' },
        minHeight: { sm: '500px' },
        display: 'flex', 
        flexDirection: 'column', 
        bgcolor: '#f1f5f9', 
        overflow: 'hidden',
        // PC 화면 접속 시 스마트폰 화면 크기(480px)로 제한하고 중앙 정렬
        maxWidth: '480px',
        width: '100%',
        margin: { xs: '0 auto', sm: '7vh auto' },
        boxShadow: { sm: '0 12px 40px rgba(0,0,0,0.12)' },
        borderRadius: { sm: 1.5 },
        border: { sm: '1px solid #e2e8f0' }
      }}
    >
      <Helmet>
        <title>{customer ? `컴투인 1:1 지원 - ${customer.name}` : '기술지원 메신저'}</title>
      </Helmet>

      {/* 상단바 헤더 */}
      <AppBarHeader 
        customerName={customer?.name || '거래처'} 
        activeRoomId={activeRoomId}
        onLeave={handleLeaveRoom}
      />

      {/* 메인 채팅 내용 */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: { xs: 1.5, sm: 2.5 }, display: 'flex', flexDirection: 'column-reverse' }}>
        <div ref={messagesEndRef} />
        
        {loadingMemos && memos.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
        ) : memos.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
            <Typography variant="body2">대화방이 활성화되었습니다. 기술지원을 요청하거나 대화를 입력해주세요.</Typography>
          </Box>
        ) : (
          <Stack spacing={2} sx={{ width: '100%' }}>
            {[...memos].reverse().map((memo) => {
              const isSystem = memo.author.name.includes('시스템');
              const isMe = memo.author.name.includes('(고객)');
              
              return (
                <Box key={memo.id} sx={{ display: 'flex', justifyContent: isSystem ? 'center' : (isMe ? 'flex-end' : 'flex-start'), width: '100%' }}>
                  {isSystem ? (
                    // 시스템 메시지 UI
                    <Paper 
                      variant="outlined" 
                      sx={{ 
                        p: 1.8, 
                        maxWidth: '90%', 
                        bgcolor: memo.color || '#f8fafc', 
                        borderColor: '#e2e8f0', 
                        borderRadius: 3, 
                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)' 
                      }}
                    >
                      <div dangerouslySetInnerHTML={{ __html: memo.content }} style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.55 }} />
                    </Paper>
                  ) : (
                    // 사용자 / 엔지니어 대화 메시지 UI
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, px: 0.5 }}>
                        {memo.author.name.replace(' (고객)', '')}
                      </Typography>
                      <Paper
                        sx={{
                          p: 1.5,
                          borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                          bgcolor: isMe ? 'primary.main' : '#ffffff',
                          color: isMe ? '#ffffff' : 'text.primary',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                          wordBreak: 'break-word'
                        }}
                      >
                        <div dangerouslySetInnerHTML={{ __html: memo.content }} style={{ lineHeight: 1.5 }} />
                      </Paper>
                      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem', mt: 0.25, px: 0.5 }}>
                        {format(new Date(memo.created_at), 'a hh:mm', { locale: ko })}
                      </Typography>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* 하단 입력바 및 퀵버튼 */}
      <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <Button
            variant="contained"
            color="success"
            startIcon={<ChatBubbleIcon />}
            fullWidth
            onClick={() => setOpenRequestModal(true)}
            sx={{ fontWeight: 'bold', borderRadius: 2, py: 1 }}
          >
            기술지원 요청
          </Button>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            fullWidth
            multiline
            maxRows={4}
            size="small"
            placeholder="메시지 입력 (전송: Enter / 줄바꿈: Shift+Enter)..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={submitting || !activeRoomId}
            sx={{ 
              '& .MuiOutlinedInput-root': {
                borderRadius: 4,
                bgcolor: '#f8fafc'
              } 
            }}
          />
          <IconButton color="primary" onClick={handleSend} disabled={submitting || !content.trim() || !activeRoomId}>
            <SendIcon />
          </IconButton>
        </Stack>
      </Box>

      {/* 가입 정보 작성 대화상자 */}
      <Dialog open={showJoinForm} disableEscapeKeyDown>
        <DialogTitle sx={{ fontWeight: 'bold', textAlign: 'center' }}>
          실시간 기술지원 시작
        </DialogTitle>
        <Box component="form" onSubmit={handleJoin}>
          <DialogContent dividers sx={{ minWidth: { xs: 280, sm: 360 } }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
              접수자 확인을 위해 정보를 입력해 주세요.<br/>이 대화 내역은 본인 기기에만 안전하게 유지됩니다.
            </Typography>
            <Stack spacing={2.5}>
              <TextField
                label="성함"
                required
                fullWidth
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="예: 홍길동"
                size="small"
              />
              <TextField
                label="휴대폰 연락처"
                required
                fullWidth
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="예: 010-1234-5678"
                size="small"
              />
              <TextField
                label="이메일 주소 (선택)"
                fullWidth
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="example@comtooin.com"
                size="small"
              />

              {/* 개인정보 수집 및 이용 동의 안내 Box */}
              <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, p: 1.5, bgcolor: '#f8fafc', fontSize: '0.75rem', color: '#475569' }}>
                <Typography variant="caption" fontWeight="bold" display="block" sx={{ color: '#1e293b', mb: 0.5 }}>
                  [개인정보 수집 및 이용 동의 안내]
                </Typography>
                • 수집항목: 성함, 휴대폰 연락처, 이메일 주소<br/>
                • 수집목적: 1:1 실시간 기술지원 상담 및 유지보수 이력 관리<br/>
                • 보유기간: 상담 완료 및 이력 관리 목적 달성 후 지체 없이 파기
              </Box>

              <FormControlLabel
                control={
                  <Checkbox 
                    size="small"
                    checked={joinPrivacyAgreed}
                    onChange={(e) => setJoinPrivacyAgreed(e.target.checked)}
                  />
                }
                label={
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'medium' }}>
                    개인정보 수집 및 이용에 동의합니다. (필수)
                  </Typography>
                }
                sx={{ ml: -0.5, mt: -0.5 }}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button type="submit" variant="contained" fullWidth disabled={joining || !guestName.trim() || !guestPhone.trim() || !joinPrivacyAgreed}>
              {joining ? '대화방 생성 중...' : '메신저 입장하기'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* AS 요청 작성 다이얼로그 */}
      <Dialog 
        open={openRequestModal} 
        onClose={() => !submittingRequest && setOpenRequestModal(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>간편 기술지원 접수</DialogTitle>
        <Box component="form" onSubmit={handleRequestSubmit}>
          <DialogContent dividers>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
              문제가 생긴 PC의 증상 및 상세 내용을 기록해주세요. 모바일의 경우 첨부 카메라를 통해 문제 화면을 직접 첨부하시면 빠른 처리에 큰 도움이 됩니다.
            </Typography>
            
            {/* 음성 인식 버튼 연동 */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle2" fontWeight="bold">증상 내용 기술</Typography>
              <Button
                variant={voiceRecorder.isListening ? "contained" : "outlined"}
                color={voiceRecorder.isListening ? "error" : "primary"}
                size="small"
                startIcon={<MicIcon />}
                onClick={voiceRecorder.toggleRecording}
                sx={{ borderRadius: 2 }}
              >
                {voiceRecorder.isListening ? '인식 중... (클릭 시 중지)' : '음성 입력'}
              </Button>
            </Stack>

            <TextField
              multiline
              rows={6}
              fullWidth
              required
              variant="outlined"
              placeholder="예: 모니터 화면이 안 켜져요. / 인터넷 연결이 안 됩니다."
              value={reqContent}
              onChange={(e) => setReqContent(e.target.value)}
              disabled={submittingRequest}
              sx={{ mb: 2 }}
            />

            {/* 이미지 파일 첨부 */}
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>사진 첨부 (최대 5장)</Typography>
            <Box sx={{ mb: 2 }}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<PhotoCamera />}
                size="small"
                sx={{ borderRadius: 2, mb: 1.5 }}
                disabled={submittingRequest}
              >
                이미지 추가
                <input type="file" hidden multiple accept="image/*" onChange={handleImageChange} ref={fileInputRef} />
              </Button>

              {reqPreviews.length > 0 && (
                <Grid container spacing={1}>
                  {reqPreviews.map((preview, index) => (
                    <Grid item key={index} xs={4} sm={2.4}>
                      <Paper variant="outlined" sx={{ position: 'relative', pt: '100%', overflow: 'hidden', borderRadius: 1 }}>
                        <img 
                          src={preview} 
                          alt="preview" 
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                        <IconButton
                          size="small"
                          sx={{ position: 'absolute', top: 2, right: 2, bgcolor: 'rgba(255,255,255,0.8)', '&:hover': { bgcolor: 'white' } }}
                          onClick={() => handleRemoveImage(index)}
                          disabled={submittingRequest}
                        >
                          <DeleteIcon fontSize="small" color="error" />
                        </IconButton>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>

            {/* 개인정보 수집 동의 체크박스 */}
            <FormControlLabel
              control={
                <Checkbox 
                  checked={privacyAgreed} 
                  onChange={(e) => setPrivacyAgreed(e.target.checked)} 
                  color="primary" 
                  size="small"
                />
              }
              label={
                <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                  <b>[필수]</b> 기술지원 및 장애 처리를 위한 최소한의 개인정보(이름, 연락처) 수집 및 이용에 동의합니다.
                </Typography>
              }
              sx={{ mt: 2, display: 'flex', alignItems: 'flex-start' }}
            />

            {requestError && <Alert severity="error" sx={{ mt: 1.5 }}>{requestError}</Alert>}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setOpenRequestModal(false)} variant="outlined" color="inherit" disabled={submittingRequest}>
              취소
            </Button>
            <Button type="submit" variant="contained" disabled={submittingRequest || !reqContent.trim() || !privacyAgreed}>
              {submittingRequest ? '접수 처리 중...' : '접수하기'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};

// 헤더 디자인 서브 컴포넌트
interface AppBarHeaderProps {
  customerName: string;
  activeRoomId: string | null;
  onLeave: () => void;
}

const AppBarHeader: React.FC<AppBarHeaderProps> = ({ customerName, activeRoomId, onLeave }) => {
  return (
    <Box 
      sx={{ 
        bgcolor: '#1e293b', 
        color: '#ffffff', 
        p: 2, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', 
        zIndex: 10 
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ width: 4, height: 18, bgcolor: '#4db6ac', borderRadius: 1, mr: 1.5 }} />
        <ForumIcon sx={{ mr: 1, color: '#4db6ac' }} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1.2 }}>
            COMTOOIN <Box component="span" sx={{ fontWeight: 400, color: 'rgba(255, 255, 255, 0.7)' }}>ITSM</Box>
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem' }}>
            {customerName} 기술지원 채널
          </Typography>
        </Box>
      </Box>

      {activeRoomId && (
        <Button
          variant="outlined"
          color="error"
          size="small"
          onClick={onLeave}
          endIcon={<LogoutIcon />}
          sx={{ 
            borderRadius: 2, 
            fontWeight: 'bold', 
            fontSize: '0.75rem',
            borderColor: 'rgba(239, 68, 68, 0.5)',
            color: '#ef4444',
            '&:hover': {
              borderColor: '#ef4444',
              bgcolor: 'rgba(239, 68, 68, 0.08)'
            }
          }}
        >
          대화 종료
        </Button>
      )}
    </Box>
  );
};

export default GuestMessengerPage;
