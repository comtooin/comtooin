import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, CircularProgress, IconButton
} from '@mui/material';
import {
  Mic as MicIcon,
  Stop as StopIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { supabase } from '../api';

interface VoiceRecorderDialogProps {
  open: boolean;
  onClose: () => void;
  onTranscriptionComplete: (text: string) => void;
  promptText?: string;
}

export const VoiceRecorderDialog: React.FC<VoiceRecorderDialogProps> = ({
  open,
  onClose,
  onTranscriptionComplete,
  promptText
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 1. 정리(Cleanup) 헬퍼
  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    streamRef.current = null;
    mediaRecorderRef.current = null;
  };

  // 2. 판독 중계 프록시 API 호출 헬퍼
  const uploadAndTranscribe = async (blob: Blob) => {
    setProcessing(true);
    setError(null);
    try {
      const fileExt = blob.type.includes('mp4') ? 'm4a' : 'webm';
      const file = new File([blob], `recording.${fileExt}`, { type: blob.type });

      const formData = new FormData();
      formData.append('file', file);
      if (promptText) {
        formData.append('prompt', promptText);
      }

      const { data, error: functionError } = await supabase.functions.invoke('transcribe-audio', {
        body: formData
      });

      if (functionError) throw functionError;

      if (data?.text) {
        onTranscriptionComplete(data.text);
        onClose();
      } else {
        throw new Error('변환된 텍스트를 받아오지 못했습니다.');
      }
    } catch (err: any) {
      console.error('Transcription API Error:', err);
      setError(err.message || '음성 판독 처리 중 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  // 3. 녹음 시작 헬퍼 (getUserMedia 획득 및 캡처)
  const startRecording = async () => {
    setError(null);
    audioChunksRef.current = [];

    // MediaRecorder 지원 여부 원천 검증
    if (typeof MediaRecorder === 'undefined') {
      setError('이 브라우저는 오디오 녹음(MediaRecorder) 기능을 지원하지 않습니다. Chrome, Safari 등 최신 브라우저를 이용해 주세요.');
      setIsRecording(false);
      return;
    }

    try {
      // 주소창 보안성 체크 (HTTP 차단 대비)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new TypeError('SecureContext Missing');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 브라우저 포맷 적응
      let options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 16000 };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'audio/webm', audioBitsPerSecond: 16000 };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'audio/mp4', audioBitsPerSecond: 16000 };
      }

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (_) {
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        if (audioBlob.size > 1000 && !error) {
          await uploadAndTranscribe(audioBlob);
        }
      };

      recorder.start(500);
      setIsRecording(true);
      setRecordingTime(0);
    } catch (err: any) {
      console.error('마이크 인식 상세 에러:', err);
      
      // 원인 분기 가이드 출력
      if (err instanceof TypeError || !navigator.mediaDevices) {
        setError('보안 연결(HTTPS 또는 localhost) 환경이 아닙니다. 브라우저 보안 규정상 HTTP 주소에서는 마이크 사용이 제한됩니다.');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('마이크 권한이 거부되었습니다. 브라우저 주소창 왼쪽의 자물쇠 아이콘을 눌러 마이크 권한을 "허용"으로 변경해 주세요.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('연결된 마이크 하드웨어를 찾을 수 없습니다. 마이크 연결선 및 장치 관리자 상태를 확인해 주세요.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('마이크가 다른 프로그램(화상회의 등)에서 이미 사용 중입니다. 마이크 사용 프로그램을 종료한 후 재시도해 주세요.');
      } else {
        setError(`마이크 초기화 실패: ${err.message || err.name}`);
      }
      setIsRecording(false);
    }
  };

  // 4. 녹음 수동 중지 헬퍼
  const stopRecording = (shouldProcess = true) => {
    if (!shouldProcess) {
      setError('녹음이 취소되었습니다.');
    }
    cleanup();
    setIsRecording(false);
  };

  // 5. 다이얼로그 오픈 즉시 녹음 자동 개시 (원스텝 연동)
  useEffect(() => {
    if (open) {
      setIsRecording(false);
      setRecordingTime(0);
      setProcessing(false);
      setError(null);
      audioChunksRef.current = [];
      
      // 원스텝: 마운트 시 즉각 녹음 가동
      startRecording();
    } else {
      cleanup();
    }
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 6. 녹음 시간 카운트 타이머 효과
  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onClose={processing ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 'bold', textAlign: 'center', pb: 1 }}>음성 인식 입력</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, gap: 2 }}>
        {processing ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, gap: 2 }}>
            <CircularProgress size={48} />
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              음성을 텍스트로 고정밀 분석하는 중입니다...
            </Typography>
          </Box>
        ) : (
          <>
            {isRecording ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Box sx={{ 
                  width: 72, 
                  height: 72, 
                  borderRadius: '50%', 
                  bgcolor: 'error.main', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  animation: 'pulse 1.5s infinite ease-in-out',
                  '@keyframes pulse': {
                    '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.7)' },
                    '70%': { transform: 'scale(1)', boxShadow: '0 0 0 16px rgba(211, 47, 47, 0)' },
                    '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(211, 47, 47, 0)' }
                  }
                }}>
                  <IconButton onClick={() => stopRecording(true)} sx={{ color: 'white' }}>
                    <StopIcon sx={{ fontSize: 32 }} />
                  </IconButton>
                </Box>
                <Typography variant="h5" fontWeight="bold" color="error.main">
                  {formatTime(recordingTime)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  음성 녹음이 진행 중입니다. 완료 시 정지 버튼을 누르세요.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Box sx={{ 
                  width: 72, 
                  height: 72, 
                  borderRadius: '50%', 
                  bgcolor: 'primary.main', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center'
                }}>
                  <IconButton onClick={startRecording} sx={{ color: 'white' }}>
                    <MicIcon sx={{ fontSize: 32 }} />
                  </IconButton>
                </Box>
                <Typography variant="body1" fontWeight="bold">
                  다시 녹음하기
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center">
                  마이크 아이콘을 클릭하여 음성 인식을 다시 시작하세요.
                </Typography>
              </Box>
            )}

            {error && (
              <Typography variant="caption" color="error" align="center" sx={{ mt: 1, fontWeight: 600, px: 2, display: 'block', lineHeight: 1.5 }}>
                {error}
              </Typography>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', pb: 2, gap: 1 }}>
        {!processing && (
          <>
            <Button 
              onClick={onClose} 
              variant="outlined" 
              color="inherit" 
              size="small"
              startIcon={<CancelIcon />}
              sx={{ fontWeight: 'bold' }}
            >
              닫기
            </Button>
            {isRecording && (
              <Button 
                onClick={() => stopRecording(true)} 
                variant="contained" 
                color="primary" 
                size="small"
                startIcon={<CheckCircleIcon />}
                sx={{ fontWeight: 'bold' }}
              >
                완료
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};
