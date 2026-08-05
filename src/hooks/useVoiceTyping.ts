import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../api';

interface UseVoiceTypingProps {
  onTranscriptionComplete: (text: string) => void;
  promptText?: string;
}

export function useVoiceTyping(onTranscriptionComplete: (text: string) => void): {
  isRecording: boolean;
  isListening: boolean;
  isProcessing: boolean;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  toggleRecording: () => void;
  stopRecording: (shouldProcess?: boolean) => void;
  startRecording: () => Promise<void>;
};
export function useVoiceTyping(props: UseVoiceTypingProps): {
  isRecording: boolean;
  isListening: boolean;
  isProcessing: boolean;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  toggleRecording: () => void;
  stopRecording: (shouldProcess?: boolean) => void;
  startRecording: () => Promise<void>;
};
export function useVoiceTyping(
  propsOrCallback: UseVoiceTypingProps | ((text: string) => void)
) {
  const onTranscriptionComplete = typeof propsOrCallback === 'function'
    ? propsOrCallback
    : propsOrCallback.onTranscriptionComplete;
  const promptText = typeof propsOrCallback === 'function'
    ? undefined
    : propsOrCallback.promptText;

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Web Audio VAD (Voice Activity Detection) 참조 객체
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastActiveTimeRef = useRef<number>(0);

  // 리소스 청정화 (Cleanup)
  const cleanup = useCallback(() => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;

    // 미디어 스트림 정지
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // MediaRecorder 정지
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
      mediaRecorderRef.current = null;
    }
  }, []);

  // 서버 API를 통한 Whisper STT 처리
  const uploadAndTranscribe = useCallback(async (blob: Blob) => {
    setIsProcessing(true);
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
      } else {
        throw new Error('변환된 텍스트를 받아오지 못했습니다.');
      }
    } catch (err: any) {
      console.error('Transcription error:', err);
      setError(err.message || '음성 판독 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  }, [onTranscriptionComplete, promptText]);

  // 녹음 정지 핸들러
  const stopRecording = useCallback((shouldProcess = true) => {
    const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
    cleanup();
    setIsRecording(false);

    if (shouldProcess && audioChunksRef.current.length > 0) {
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      if (audioBlob.size > 1000) {
        uploadAndTranscribe(audioBlob);
      }
      audioChunksRef.current = [];
    }
  }, [cleanup, uploadAndTranscribe]);

  // 녹음 시작 핸들러
  const startRecording = useCallback(async () => {
    cleanup();
    setError(null);
    audioChunksRef.current = [];

    if (typeof MediaRecorder === 'undefined') {
      setError('이 브라우저는 오디오 녹음(MediaRecorder) 기능을 지원하지 않습니다. 최신 브라우저를 사용해 주세요.');
      return;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new TypeError('SecureContext Missing');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 브라우저 지원 형식 파악
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

      // 250ms 마다 청크 조각 수집
      recorder.start(250);
      setIsRecording(true);
      lastActiveTimeRef.current = Date.now();

      // Web Audio API를 활용한 VAD (침묵 분석기) 장착
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      audioCtxRef.current = audioContext;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const SILENCE_THRESHOLD = 0.015; // 침묵 여부를 판단할 파동 볼륨 (0~1)
      const SILENCE_DURATION = 1500;  // 1.5초 동안 침묵할 시 자동 녹음 마감

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(dataArray);

        // 실시간 RMS 진폭 볼륨 연산
        let sumSquares = 0.0;
        for (let i = 0; i < bufferLength; i++) {
          const norm = (dataArray[i] - 128) / 128;
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / bufferLength);

        const now = Date.now();
        if (rms > SILENCE_THRESHOLD) {
          // 사용자가 말하고 있으면 침묵 시간 리셋
          lastActiveTimeRef.current = now;
        } else {
          // 침묵 상태가 기준 임계치 시간을 초과했는지 확인
          if (now - lastActiveTimeRef.current > SILENCE_DURATION) {
            // 침묵 자동 마감 -> 업로드 및 전송
            stopRecording(true);
            return;
          }
        }

        animationFrameIdRef.current = requestAnimationFrame(checkVolume);
      };

      animationFrameIdRef.current = requestAnimationFrame(checkVolume);

    } catch (err: any) {
      console.error('마이크 기동 에러:', err);
      if (err instanceof TypeError || !navigator.mediaDevices) {
        setError('보안 연결(HTTPS) 환경이 아니거나 마이크가 지원되지 않는 브라우저입니다.');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('마이크 접근 권한이 거부되었습니다.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('연결된 마이크 장치를 찾을 수 없습니다.');
      } else {
        setError(`마이크 초기화 실패: ${err.message || err.name}`);
      }
      setIsRecording(false);
    }
  }, [cleanup, stopRecording]);

  // 토글 제어
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording(true);
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // 마운트 해제 시 소거
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    isRecording,
    isListening: isRecording,
    isProcessing,
    error,
    setError,
    toggleRecording,
    stopRecording,
    startRecording
  };
}
