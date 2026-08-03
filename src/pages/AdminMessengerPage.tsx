import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  TextField,
  IconButton,
  CircularProgress,
  Tooltip,
  Avatar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
  Container,
  Stack,
  Divider,
} from '@mui/material';
import { Helmet } from 'react-helmet-async';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import SendIcon from '@mui/icons-material/Send';
import ForumIcon from '@mui/icons-material/Forum';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import { supabase, getCurrentStaffId, sendPushNotification } from '../api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ChatRoom {
  id: string;
  created_at: string;
  name: string;
  created_by: string | null;
}

interface Memo {
  id: string;
  created_at: string;
  content: string;
  color: string;
  author_id: string;
  room_id: string;
  author?: {
    name: string;
  };
}

const AVATAR_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ec4899', // pink
  '#a855f7', // purple
  '#64748b', // slate
];

const AdminMessengerPage: React.FC = () => {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMemos, setLoadingMemos] = useState(false);
  const [content, setContent] = useState('');
  
  // 방 개설 관련 상태
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // 모바일 화면용 마스터-디테일 상태 (true: 방 목록, false: 활성 대화창)
  const [mobileShowList, setMobileShowList] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // 초기 사용자 정보 및 방 리스트 로드
  useEffect(() => {
    const role = sessionStorage.getItem('adminRole');
    setUserRole(role);

    const initPage = async () => {
      const staffId = await getCurrentStaffId();
      setCurrentStaffId(staffId);
      await fetchRooms();
    };

    initPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 활성 방이 선택되면 메시지 패치 및 모바일 뷰 전환
  useEffect(() => {
    if (activeRoomId) {
      fetchMemos(activeRoomId);
    } else {
      setMemos([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId]);

  // 실시간 동기화 구독 (방 목록 변경 & 메시지 변경 감지)
  useEffect(() => {
    // 1. 방 변경 리스너
    const roomsChannel = supabase
      .channel('chat-rooms-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_rooms' },
        () => {
          console.log('Realtime chat room list changed');
          fetchRooms();
        }
      )
      .subscribe();

    // 2. 메시지 변경 리스너
    const memosChannel = supabase
      .channel('memos-realtime-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'memos' },
        () => {
          console.log('Realtime chat message changed');
          if (activeRoomId) {
            fetchMemos(activeRoomId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomsChannel);
      supabase.removeChannel(memosChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId]);

  // 메시지 수량 변화에 따라 하단 스크롤 자동 동기화
  useEffect(() => {
    scrollToBottom();
  }, [memos]);

  // 모바일 대화방 팝업이 열릴 때 스크롤 동기화
  useEffect(() => {
    if (isMobile && !mobileShowList && activeRoomId) {
      scrollToBottom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileShowList]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  // 대화방 목록 조회
  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      const fetchedRooms = data || [];
      setRooms(fetchedRooms);

      // 활성화된 방이 없거나 리스트에 존재하지 않을 경우 기본 대화방으로 세팅
      if (fetchedRooms.length > 0) {
        const hasActiveRoom = fetchedRooms.some(r => r.id === activeRoomId);
        if (!activeRoomId || !hasActiveRoom) {
          const defaultRoom = fetchedRooms.find(r => r.id === '00000000-0000-0000-0000-000000000000');
          setActiveRoomId(defaultRoom ? defaultRoom.id : fetchedRooms[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching chat rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  // 특정 방의 메시지 조회
  const fetchMemos = async (roomId: string) => {
    setLoadingMemos(true);
    try {
      const { data, error } = await supabase
        .from('memos')
        .select(`
          id,
          created_at,
          content,
          color,
          author_id,
          room_id,
          author:author_id ( name )
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedMemos: Memo[] = (data || []).map((item: any) => {
        let authorName = '';
        if (item.author) {
          if (Array.isArray(item.author)) {
            authorName = item.author[0]?.name || '';
          } else {
            authorName = item.author.name || '';
          }
        }
        return {
          id: item.id,
          created_at: item.created_at,
          content: item.content,
          color: item.color || '#f8fafc',
          author_id: item.author_id,
          room_id: item.room_id,
          author: { name: authorName }
        };
      });

      setMemos(formattedMemos);
    } catch (err) {
      console.error('Error fetching memos for room:', roomId, err);
    } finally {
      setLoadingMemos(false);
    }
  };

  // 신규 대화방 개설 처리
  const handleCreateRoom = async () => {
    if (!newRoomName.trim() || !currentStaffId) return;
    setSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('chat_rooms')
        .insert({
          name: newRoomName.trim(),
          created_by: currentStaffId
        })
        .select()
        .single();

      if (error) throw error;

      setNewRoomName('');
      setCreateRoomOpen(false);
      
      // 새 대화방으로 활성화 및 즉시 대화창 전환
      if (data) {
        setActiveRoomId(data.id);
        setMobileShowList(false);
      }
      await fetchRooms();
    } catch (err: any) {
      console.error('Error creating chat room:', err);
      alert('대화방 개설에 실패했습니다: ' + (err.message || String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  // 대화방 삭제 (방장 또는 어드민만 가능)
  const handleDeleteRoom = async (roomId: string, roomName: string, event: React.MouseEvent) => {
    event.stopPropagation(); // 클릭 이벤트 전파 차단 (방 선택되지 않도록)
    
    if (roomId === '00000000-0000-0000-0000-000000000000') {
      alert('기본 대화방은 삭제할 수 없습니다.');
      return;
    }

    if (!window.confirm(`[${roomName}] 대화방을 삭제하시겠습니까? 방 안의 모든 메시지도 함께 영구 삭제됩니다.`)) return;

    try {
      const { error } = await supabase.from('chat_rooms').delete().eq('id', roomId);
      if (error) throw error;

      // 현재 띄워진 방이 삭제된 경우 기본 대화방으로 복원
      if (activeRoomId === roomId) {
        setActiveRoomId('00000000-0000-0000-0000-000000000000');
        setMobileShowList(true);
      }
      await fetchRooms();
    } catch (err: any) {
      console.error('Error deleting chat room:', err);
      alert('대화방 삭제에 실패했습니다: ' + (err.message || String(err)));
    }
  };

  // 메시지 전송
  const handleSend = async () => {
    if (!content.trim() || !currentStaffId || !activeRoomId) return;
    setSubmitting(true);

    try {
      const { error } = await supabase.from('memos').insert({
        content: content.trim(),
        color: '#f8fafc',
        author_id: currentStaffId,
        room_id: activeRoomId
      });

      if (error) throw error;

      // 원격 알림 발송 (전체 푸시)
      const myName = sessionStorage.getItem('adminName') || '동료';
      const activeRoom = rooms.find(r => r.id === activeRoomId);
      const roomPrefix = activeRoom ? `[${activeRoom.name}] ` : '';
      const preview = content.trim().substring(0, 40) + (content.trim().length > 40 ? '...' : '');
      await sendPushNotification('새로운 메시지', `${roomPrefix}${myName}: ${preview}`, 'all');

      setContent('');
      await fetchMemos(activeRoomId);
    } catch (err: any) {
      console.error('Error sending message:', err);
      alert('메시지 전송에 실패했습니다: ' + (err.message || String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  // Enter키 전송 처리 (PC에서는 Enter로 전송 / 모바일에서는 가상 키보드 줄바꿈을 위해 기본 개행)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (isMobile) {
        // 모바일 환경에서는 Enter 입력 시 그냥 줄바꿈만 수행하며 전송하지 않음
        return;
      }
      if (!e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  // 메시지 삭제 (본인 또는 어드민)
  const handleDeleteMessage = async (id: string) => {
    if (!window.confirm('이 메시지를 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase.from('memos').delete().eq('id', id);
      if (error) throw error;
      if (activeRoomId) {
        await fetchMemos(activeRoomId);
      }
    } catch (err: any) {
      console.error('Error deleting message:', err);
      alert('메시지 삭제에 실패했습니다: ' + (err.message || String(err)));
    }
  };

  const getAvatarColor = (name: string) => {
    if (!name) return AVATAR_COLORS[0];
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    return AVATAR_COLORS[sum % AVATAR_COLORS.length];
  };

  const activeRoom = rooms.find(r => r.id === activeRoomId);

  // 상단 알약 요약 카드
  const statsItems = [
    {
      label: '활성 대화방',
      count: rooms.length,
      icon: <ForumIcon sx={{ fontSize: { xs: 13, sm: 20 }, color: '#3b82f6' }} />,
      bgColor: 'rgba(59, 130, 246, 0.08)',
    },
    {
      label: '현재 방 대화',
      count: memos.length,
      icon: <ChatBubbleIcon sx={{ fontSize: { xs: 13, sm: 20 }, color: '#10b981' }} />,
      bgColor: 'rgba(16, 185, 129, 0.08)',
    },
    {
      label: '내가 보낸 글',
      count: memos.filter((m) => m.author_id === currentStaffId).length,
      icon: <PersonIcon sx={{ fontSize: { xs: 13, sm: 20 }, color: '#f59e0b' }} />,
      bgColor: 'rgba(245, 158, 11, 0.08)',
    },
  ];

  // 메시지 렌더러
  const renderMessages = () => {
    let lastDateString = '';
    return memos.slice().reverse().map((memo) => {
      const memoDate = new Date(memo.created_at);
      const currentDateString = format(memoDate, 'yyyy년 M월 d일 EEEE', { locale: ko });
      let showDateDivider = false;
      
      if (currentDateString !== lastDateString) {
        showDateDivider = true;
        lastDateString = currentDateString;
      }

      const isMyMemo = memo.author_id === currentStaffId;
      const canDelete = isMyMemo || userRole === 'admin';
      const authorName = memo.author?.name || '알 수 없음';
      const avatarColor = getAvatarColor(authorName);

      return (
        <Box key={memo.id} sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          {/* 날짜 구분선 */}
          {showDateDivider && (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
              <Paper
                variant="outlined"
                sx={{
                  px: 2,
                  py: 0.5,
                  borderRadius: 10,
                  bgcolor: '#e2e8f0',
                  borderColor: 'transparent',
                }}
              >
                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600, fontSize: '0.75rem' }}>
                  {currentDateString}
                </Typography>
              </Paper>
            </Box>
          )}

          {/* 메시지 정렬 */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: isMyMemo ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              mb: 1.5,
              width: '100%',
              gap: 1.25,
            }}
          >
            {!isMyMemo && (
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  fontSize: '0.85rem',
                  bgcolor: avatarColor,
                  color: '#ffffff',
                  fontWeight: 700,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                }}
              >
                {authorName[0]}
              </Avatar>
            )}

            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isMyMemo ? 'flex-end' : 'flex-start',
                maxWidth: { xs: '75%', sm: '65%' },
              }}
            >
              {!isMyMemo && (
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mb: 0.3, ml: 0.5, fontSize: '0.75rem' }}>
                  {authorName}
                </Typography>
              )}

              <Box
                sx={{
                  display: 'flex',
                  flexDirection: isMyMemo ? 'row-reverse' : 'row',
                  alignItems: 'flex-end',
                  gap: 0.75,
                  width: '100%',
                  '&:hover .delete-btn': { opacity: 1 },
                }}
              >
                {/* 말풍선 */}
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: isMyMemo ? '12px 12px 0px 12px' : '12px 12px 12px 0px',
                    bgcolor: isMyMemo ? 'primary.main' : 'background.paper',
                    color: isMyMemo ? '#ffffff' : 'text.primary',
                    borderColor: isMyMemo ? 'primary.main' : '#e2e8f0',
                    borderWidth: '1px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    wordBreak: 'break-all',
                    '&:hover': {
                      boxShadow: '0 4px 8px rgba(0,0,0,0.04)',
                    },
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: '0.875rem',
                      lineHeight: 1.5,
                      fontWeight: 500,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {memo.content}
                  </Typography>
                </Paper>

                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMyMemo ? 'flex-end' : 'flex-start',
                    minWidth: 50,
                  }}
                >
                  {canDelete && (
                    <IconButton
                      className="delete-btn"
                      size="small"
                      onClick={() => handleDeleteMessage(memo.id)}
                      sx={{
                        opacity: 0,
                        transition: 'opacity 0.2s ease',
                        p: 0.25,
                        mb: 0.25,
                        color: 'text.secondary',
                        '&:hover': {
                          color: '#ef4444',
                          bgcolor: 'rgba(239, 68, 68, 0.05)',
                        },
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  )}
                  <Typography variant="caption" sx={{ color: 'text.secondary', opacity: 0.8, fontSize: '0.625rem' }}>
                    {format(memoDate, 'a h:mm', { locale: ko })}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      );
    });
  };

  // 좌측 채팅방 목록 영역 마크업
  const renderRoomList = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.paper' }}>
      {/* 헤더 및 개설 단추 */}
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="body1" sx={{ fontWeight: 800, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
          <ForumIcon sx={{ color: 'primary.main', fontSize: 18 }} />
          채팅방 목록
        </Typography>
        <Tooltip title="새 채팅방 개설" arrow>
          <IconButton
            size="small"
            color="primary"
            onClick={() => setCreateRoomOpen(true)}
            sx={{
              bgcolor: 'rgba(77, 182, 172, 0.1)',
              color: 'primary.main',
              '&:hover': { bgcolor: 'rgba(77, 182, 172, 0.2)' },
            }}
          >
            <AddIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* 목록 리스트 */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {loadingRooms ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
        ) : rooms.length === 0 ? (
          <Typography variant="caption" sx={{ textAlign: 'center', color: 'text.secondary', py: 3 }}>
            개설된 대화방이 없습니다.
          </Typography>
        ) : (
          rooms.map((room) => {
            const isActive = activeRoomId === room.id;
            const isDefaultRoom = room.id === '00000000-0000-0000-0000-000000000000';
            const canDeleteRoom = !isDefaultRoom && (room.created_by === currentStaffId || userRole === 'admin');

            return (
              <Box
                key={room.id}
                onClick={() => {
                  setActiveRoomId(room.id);
                  if (isMobile) {
                    setMobileShowList(false); // 모바일일 경우 상세 대화창으로 뷰 전환
                  }
                }}
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  bgcolor: isActive ? 'rgba(77, 182, 172, 0.12)' : 'transparent',
                  color: isActive ? 'primary.main' : 'text.primary',
                  borderLeft: isActive ? '4px solid #4db6ac' : '4px solid transparent',
                  pl: isActive ? '12px' : '16px',
                  transition: 'all 0.15s ease-in-out',
                  '&:hover': {
                    bgcolor: isActive ? 'rgba(77, 182, 172, 0.18)' : 'rgba(0, 0, 0, 0.03)',
                    '& .del-room-btn': { opacity: 1 }
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, flexGrow: 1 }}>
                  <ChatBubbleIcon sx={{ fontSize: 16, color: isActive ? 'primary.main' : 'text.secondary', opacity: 0.8 }} />
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.85rem',
                    }}
                  >
                    {room.name}
                  </Typography>
                </Box>

                {canDeleteRoom && (
                  <IconButton
                    className="del-room-btn"
                    size="small"
                    onClick={(e) => handleDeleteRoom(room.id, room.name, e)}
                    sx={{
                      opacity: 0,
                      p: 0.25,
                      color: 'text.secondary',
                      transition: 'opacity 0.15s ease',
                      '&:hover': { color: '#ef4444', bgcolor: 'rgba(239, 68, 68, 0.05)' }
                    }}
                  >
                    <DeleteIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                )}
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );

  // 우측 대화방 상세 내용 영역 마크업 (데스크톱 및 모바일 팝업 겸용)
  const renderChatDetail = (isMobileMode: boolean) => (
    <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      {/* 대화방 헤더 */}
      <Box
        sx={{
          p: 1.5,
          px: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        {/* 모바일일 경우 뒤로가기 버튼 노출 */}
        {isMobileMode && (
          <IconButton size="small" onClick={() => setMobileShowList(true)} sx={{ mr: 0.5 }}>
            <ArrowBackIcon />
          </IconButton>
        )}
        <Avatar sx={{ bgcolor: 'primary.main', width: 34, height: 34 }}>
          <ForumIcon sx={{ fontSize: 18 }} />
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>
            {activeRoom ? activeRoom.name : '대화방 선택 안 됨'}
          </Typography>
          <Typography variant="caption" noWrap sx={{ color: 'text.secondary', fontSize: '0.675rem', display: 'block' }}>
            {activeRoom ? '실시간 메시지를 자유롭게 공유합니다.' : '메시지를 나눌 방을 선택하세요.'}
          </Typography>
        </Box>
      </Box>

      {/* 메시지 피드 영역 */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: { xs: 1.5, sm: 2.5 },
          display: 'flex',
          flexDirection: 'column',
          backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      >
        {!activeRoomId ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', opacity: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>선택된 대화방이 없습니다.</Typography>
          </Box>
        ) : loadingMemos ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : memos.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              opacity: 0.6,
            }}
          >
            <ForumIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1, opacity: 0.4 }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              아직 대화가 없습니다.
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', opacity: 0.8, mt: 0.5 }}>
              첫 대화 메시지를 아래에 남겨 공유해 보세요!
            </Typography>
          </Box>
        ) : (
          renderMessages()
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* 메시지 입력 영역 */}
      {activeRoomId && (
        <Box
          sx={{
            p: 2,
            pb: isMobileMode ? 'calc(env(safe-area-inset-bottom) + 12px)' : 2, // 모바일 하단 safe-area 대비
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            gap: 1.5,
            alignItems: 'flex-end',
          }}
        >
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder={isMobileMode ? "메시지를 입력하세요..." : "메시지를 입력하세요... (Enter로 전송, 줄바꿈은 Shift + Enter)"}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            variant="outlined"
            size="small"
            InputProps={{
              style: { fontSize: isMobileMode ? '16px' : '0.875rem', fontWeight: 500, borderRadius: 6 },
            }}
            disabled={submitting}
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!content.trim() || submitting}
            sx={{
              bgcolor: content.trim() ? 'primary.main' : 'transparent',
              color: content.trim() ? '#ffffff' : 'text.disabled',
              p: 1.25,
              borderRadius: 1.5,
              transition: 'all 0.15s ease',
              '&:hover': {
                bgcolor: content.trim() ? 'primary.dark' : 'transparent',
                transform: content.trim() ? 'scale(1.05)' : 'none',
              },
            }}
          >
            <SendIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      )}
    </Box>
  );

  return (
    <Container maxWidth="lg">
      <Helmet><title>메신저 | COMTOOIN</title></Helmet>

      {/* 표준 헤더 섹션 */}
      <Box sx={{ mb: { xs: 1.5, sm: 2, md: 2.5 } }}>
        <Stack direction="row" alignItems="center" spacing={{ xs: 1, sm: 1.25, md: 1.5 }} mb={{ xs: 0.25, sm: 0.5, md: 1 }}>
          <ForumIcon sx={{ fontSize: { xs: '1.6rem', sm: '1.9rem', md: '2.2rem' }, color: 'primary.main' }} />
          <Typography component="h1" sx={{ fontWeight: 'bold', fontSize: { xs: '1.2rem', sm: '1.35rem', md: '1.5rem' } }}>
            메신저
          </Typography>
        </Stack>
        <Typography sx={{ color: 'text.secondary', fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' }, lineHeight: 1.4 }}>
          동료 직원들과 실시간으로 메시지를 공유하며 소통합니다.
        </Typography>
      </Box>

      <Divider sx={{ mb: { xs: 1.5, sm: 2, md: 2.5 } }} />

      {/* 요약 통계 카드 */}
      <Grid container spacing={{ xs: 1, sm: 1.5 }} sx={{ mb: 2.5 }}>
        {statsItems.map((item, idx) => (
          <Grid item xs={4} key={idx}>
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 1, sm: 1.25 },
                borderRadius: 1,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.04)',
                  borderColor: 'primary.light',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1.5 } }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: { xs: 24, sm: 38 },
                    height: { xs: 24, sm: 38 },
                    borderRadius: 1,
                    bgcolor: item.bgColor,
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{
                      fontSize: { xs: '0.625rem', sm: '0.7rem' },
                      fontWeight: 600,
                      color: 'text.secondary',
                      display: 'block',
                      mb: 0.1,
                    }}
                  >
                    {item.label}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: { xs: '0.95rem', sm: '1.15rem' },
                      fontWeight: 800,
                      color: 'text.primary',
                      lineHeight: 1,
                    }}
                  >
                    {item.count}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* 메신저 컨테이너 */}
      <Paper
        variant="outlined"
        sx={{
          borderRadius: 1,
          overflow: 'hidden',
          display: 'flex',
          height: 'calc(100vh - 250px)',
          minHeight: 480,
          bgcolor: '#f8fafc',
          borderColor: 'divider',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)',
        }}
      >
        {isMobile ? (
          <Box sx={{ width: '100%', height: '100%' }}>
            {renderRoomList()}
          </Box>
        ) : (
          <>
            <Box sx={{ width: 260, borderRight: '1px solid', borderColor: 'divider', height: '100%', flexShrink: 0 }}>
              {renderRoomList()}
            </Box>
            {renderChatDetail(false)}
          </>
        )}
      </Paper>

      {/* 모바일 전체화면 대화방 팝업 */}
      <Dialog
        fullScreen
        open={isMobile && !mobileShowList && !!activeRoomId}
        onClose={() => setMobileShowList(true)}
        PaperProps={{
          sx: {
            bgcolor: '#f8fafc',
            height: '100%',
            overflow: 'hidden',
          }
        }}
      >
        {renderChatDetail(true)}
      </Dialog>

      {/* 새 채팅방 개설 모달 다이얼로그 */}
      <Dialog open={createRoomOpen} onClose={() => setCreateRoomOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem', pb: 1 }}>새 채팅방 개설</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            autoFocus
            margin="dense"
            label="채팅방 이름"
            type="text"
            fullWidth
            variant="outlined"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="예: 개발본부 공지방, 점심 수다방"
            size="small"
            InputLabelProps={{ style: { fontSize: '0.85rem' } }}
            InputProps={{ style: { borderRadius: 6, fontSize: '0.9rem' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button size="small" onClick={() => setCreateRoomOpen(false)} sx={{ color: 'text.secondary' }}>
            취소
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleCreateRoom}
            disabled={!newRoomName.trim() || submitting}
            sx={{ bgcolor: 'primary.main', borderRadius: 1, '&:hover': { bgcolor: 'primary.dark' } }}
          >
            개설
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminMessengerPage;
