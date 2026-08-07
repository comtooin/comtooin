import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography, Box, Paper, Divider, Stack, Container, Button, 
  CircularProgress, Alert, List, ListItem, ListItemIcon, ListItemText, 
  IconButton, TextField, InputAdornment, Breadcrumbs, Link, ListItemButton,
  Grid, Tooltip, Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions, LinearProgress, Menu, MenuItem
} from '@mui/material';
import { 
  CloudDownload as CloudDownloadIcon,
  Description as FileIcon,
  Folder as FolderIcon,
  InsertDriveFile as UnknownFileIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  TableChart as ExcelIcon,
  Search as SearchIcon,
  FileDownload as DirectDownloadIcon,
  NavigateNext as NavigateNextIcon,
  Home as HomeIcon,
  ArrowBack as ArrowBackIcon,
  GridView as GridIcon,
  ViewList as ListIcon,
  CreateNewFolder as CreateFolderIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Helmet } from 'react-helmet-async';
import { supabase } from '../api';

interface IDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  webViewLink: string;
  webContentLink?: string;
}

interface IFolderHistory {
  id: string;
  name: string;
}

const ROOT_FOLDER_ID = '1YV2vEIhNU0rPSiyHUgyDV0pSuBcuOKfJ';

const getFileIconWithWrapper = (mimeType: string, isGrid: boolean = false) => {
  let icon = <UnknownFileIcon sx={{ fontSize: isGrid ? 28 : 20, color: '#64748b' }} />;
  let bgColor = 'rgba(100, 116, 139, 0.08)'; // Slate 500
  
  if (mimeType === 'application/vnd.google-apps.folder') {
    icon = <FolderIcon sx={{ fontSize: isGrid ? 32 : 20, color: '#eab308' }} />;
    bgColor = 'rgba(234, 179, 8, 0.1)'; // Yellow 500
  } else if (mimeType.includes('pdf')) {
    icon = <PdfIcon sx={{ fontSize: isGrid ? 28 : 20, color: '#ef4444' }} />;
    bgColor = 'rgba(239, 68, 68, 0.1)'; // Red 500
  } else if (mimeType.includes('image')) {
    icon = <ImageIcon sx={{ fontSize: isGrid ? 28 : 20, color: '#3b82f6' }} />;
    bgColor = 'rgba(59, 130, 246, 0.1)'; // Blue 500
  } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    icon = <ExcelIcon sx={{ fontSize: isGrid ? 28 : 20, color: '#10b981' }} />;
    bgColor = 'rgba(16, 185, 129, 0.1)'; // Emerald 500
  } else if (mimeType.includes('word') || mimeType.includes('document')) {
    icon = <FileIcon sx={{ fontSize: isGrid ? 28 : 20, color: '#06b6d4' }} />;
    bgColor = 'rgba(6, 182, 212, 0.1)'; // Cyan 500
  }
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        width: isGrid ? 56 : 40, 
        height: isGrid ? 56 : 40, 
        borderRadius: 1, 
        bgcolor: bgColor,
        flexShrink: 0
      }}
    >
      {icon}
    </Box>
  );
};

const formatFileSize = (bytes?: string) => {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = parseInt(bytes, 10);
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

// 컴포넌트 외부에 캐시 정의하여 마운트 해제되어도 탭 활성 동안 유지
const cacheStorage: { [folderId: string]: { files: IDriveFile[]; timestamp: number } } = {};
const CACHE_TTL = 3 * 60 * 1000; // 3분 캐시 유효

const ArchivePage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [files, setFiles] = useState<IDriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFolder, setCurrentFolder] = useState<IFolderHistory>({ id: ROOT_FOLDER_ID, name: 'Home' });
  const [folderHistory, setFolderHistory] = useState<IFolderHistory[]>([{ id: ROOT_FOLDER_ID, name: 'Home' }]);

  // 리스트 뷰를 기본 상태로 설정 (사용자 피드백 반영)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  // 삭제 제어 관련 상태
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<IDriveFile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 다운로드 제어 관련 상태
  const [downloadingFile, setDownloadingFile] = useState<IDriveFile | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  // 팝업 더보기 메뉴 관련 상태
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [activeMenuFile, setActiveMenuFile] = useState<IDriveFile | null>(null);

  const handleMenuOpen = (file: IDriveFile, event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setActiveMenuFile(file);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setActiveMenuFile(null);
  };

  const handleDeleteClick = (file: IDriveFile, e: React.MouseEvent) => {
    e.stopPropagation();
    setFileToDelete(file);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;
    setDeleting(true);
    setError('');
    try {
      const { data, error: deleteError } = await supabase.functions.invoke('upload-drive-file', {
        body: {
          deleteFileOnly: true,
          fileIdToDelete: fileToDelete.id
        }
      });
      if (deleteError) throw new Error(deleteError.message || "구글 드라이브 파일 삭제에 실패했습니다.");
      if (data && data.success) {
        setDeleteConfirmOpen(false);
        setFileToDelete(null);
        alert("삭제가 완료되었습니다.");
        fetchFiles(currentFolder.id, true);
      } else {
        throw new Error(data?.error || "구글 드라이브 파일 삭제에 실패했습니다.");
      }
    } catch (err: any) {
      console.error("Delete error:", err);
      setError(err.message || "삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  const executeFetch = useCallback(async (folderId: string): Promise<IDriveFile[]> => {
    const { data, error: funcError } = await supabase.functions.invoke(`list-drive-files?folderId=${folderId}`, {
      method: 'GET'
    });
    if (funcError) throw new Error(funcError.message || '서버 함수 호출 중 오류가 발생했습니다.');
    if (data && data.success) {
      const sortedFiles = (data.files || []).sort((a: IDriveFile, b: IDriveFile) => {
        const aIsFolder = a.mimeType === 'application/vnd.google-apps.folder';
        const bIsFolder = b.mimeType === 'application/vnd.google-apps.folder';
        if (aIsFolder && !bIsFolder) return -1;
        if (!aIsFolder && bIsFolder) return 1;
        return a.name.localeCompare(b.name);
      });
      return sortedFiles;
    } else {
      throw new Error(data?.error || '서버에서 알 수 없는 응답을 보냈습니다.');
    }
  }, []);

  const fetchBackground = useCallback(async (folderId: string) => {
    setBackgroundLoading(true);
    try {
      const remoteData = await executeFetch(folderId);
      setFiles(prev => {
        const isSame = JSON.stringify(prev) === JSON.stringify(remoteData);
        if (isSame) return prev;
        return remoteData;
      });
      cacheStorage[folderId] = { files: remoteData, timestamp: Date.now() };
    } catch (err) {
      console.warn('Background sync failed:', err);
    } finally {
      setBackgroundLoading(false);
    }
  }, [executeFetch]);

  const fetchFiles = useCallback(async (folderId: string, forceRefresh = false) => {
    const cached = cacheStorage[folderId];
    const now = Date.now();

    if (cached && (now - cached.timestamp < CACHE_TTL) && !forceRefresh) {
      setFiles(cached.files);
      setLoading(false);
      fetchBackground(folderId);
      return;
    }

    if (cached && !forceRefresh) {
      setFiles(cached.files);
      setLoading(false);
      fetchBackground(folderId);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const remoteData = await executeFetch(folderId);
      setFiles(remoteData);
      cacheStorage[folderId] = { files: remoteData, timestamp: now };
    } catch (err: any) {
      setError(err.message || '파일 목록을 가져오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [executeFetch, fetchBackground]);

  useEffect(() => {
    fetchFiles(currentFolder.id);
  }, [fetchFiles, currentFolder.id]);

  const stats = useMemo(() => {
    const totalFiles = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder').length;
    const totalFolders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder').length;
    const recentUploads = files.filter(f => {
      const modified = new Date(f.modifiedTime);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return modified > sevenDaysAgo && f.mimeType !== 'application/vnd.google-apps.folder';
    }).length;
    return { totalFiles, totalFolders, recentUploads };
  }, [files]);

  const handleFolderClick = (id: string, name: string) => {
    setCurrentFolder({ id, name });
    setFolderHistory(prev => [...prev, { id, name }]);
    setSearchQuery('');
  };

  const handleBreadcrumbClick = (index: number) => {
    const target = folderHistory[index];
    setCurrentFolder(target);
    setFolderHistory(prev => prev.slice(0, index + 1));
    setSearchQuery('');
  };

  const downloadFileWithProgress = async (file: IDriveFile) => {
    setDownloadingFile(file);
    setDownloadProgress(0);
    try {
      const downloadUrl = `https://szwiejswmfivultxxywb.supabase.co/functions/v1/download-drive-file?fileId=${file.id}&fileName=${encodeURIComponent(file.name)}&mimeType=${encodeURIComponent(file.mimeType)}`;
      
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error("파일 다운로드에 실패했습니다.");
      
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      if (total === 0 || !response.body) {
        const blob = await response.blob();
        triggerBlobDownload(blob, file.name);
        return;
      }
      
      const reader = response.body.getReader();
      let loaded = 0;
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        if (value) {
          chunks.push(value);
          loaded += value.length;
          setDownloadProgress(total > 0 ? Math.round((loaded / total) * 100) : 0);
        }
      }
      
      const allChunks = new Uint8Array(loaded);
      let position = 0;
      for (const chunk of chunks) {
        allChunks.set(chunk, position);
        position += chunk.length;
      }
      
      const blob = new Blob([allChunks], { type: file.mimeType });
      triggerBlobDownload(blob, file.name);
    } catch (err: any) {
      console.error("Download progress error:", err);
      alert(err.message || "다운로드 중 오류가 발생했습니다.");
    } finally {
      setDownloadingFile(null);
      setDownloadProgress(0);
    }
  };

  const triggerBlobDownload = (blob: Blob, fileName: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // 모바일/데스크톱 뷰포트 고려한 다운로드 링크 분기 처리
  const handleFileClick = (file: IDriveFile) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      handleFolderClick(file.id, file.name);
    } else {
      if (file.webContentLink) {
        downloadFileWithProgress(file);
      } else {
        window.open(file.webViewLink, '_blank');
      }
    }
  };

  // Drag & Drop 이벤트 제어 (구글 드라이브식 화면 오버레이)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e);
  };

  // 비동기 파일 업로드 (Base64 인코딩)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement> | React.DragEvent<any>) => {
    let fileList: FileList | null = null;
    if ('files' in event.target && event.target.files) {
      fileList = event.target.files;
    } else if ('dataTransfer' in event) {
      event.preventDefault();
      fileList = event.dataTransfer.files;
    }
    
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    
    // 최대 50MB 크기 제한
    if (file.size > 50 * 1024 * 1024) {
      alert("파일 용량이 너무 큽니다. 최대 50MB 파일까지만 업로드할 수 있습니다.");
      return;
    }

    setUploading(true);
    setUploadProgress(20);
    setError('');
    
    try {
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = (err) => reject(err);
      });

      setUploadProgress(50);

      const { data, error: uploadError } = await supabase.functions.invoke('upload-drive-file', {
        body: {
          folderId: currentFolder.id,
          fileName: file.name,
          fileData: base64Content,
          mimeType: file.type
        }
      });

      setUploadProgress(80);

      if (uploadError) throw new Error(uploadError.message || "구글 드라이브 업로드에 실패했습니다.");
      if (data && data.success) {
        setUploadProgress(100);
        setTimeout(() => {
          alert("파일 업로드가 완료되었습니다!");
          fetchFiles(currentFolder.id, true);
        }, 300);
      } else {
        throw new Error(data?.error || "구글 드라이브 업로드에 실패했습니다.");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "파일 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // 새 폴더 동적 생성 연동
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      alert("폴더명을 입력해주세요.");
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data, error: createError } = await supabase.functions.invoke('upload-drive-file', {
        body: {
          createFolderOnly: true,
          newFolderName: newFolderName.trim(),
          folderId: currentFolder.id
        }
      });

      if (createError) throw new Error(createError.message || "폴더 생성에 실패했습니다.");
      if (data && data.success) {
        setCreateFolderOpen(false);
        setNewFolderName('');
        alert("폴더가 생성되었습니다.");
        fetchFiles(currentFolder.id, true);
      } else {
        throw new Error(data?.error || "폴더 생성에 실패했습니다.");
      }
    } catch (err: any) {
      console.error("Create folder error:", err);
      setError(err.message || "폴더 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const filteredFiles = useMemo(() => {
    return files.filter(file => file.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [files, searchQuery]);

  return (
    <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 }, pb: 10 }}>
      <Helmet><title>자료실 | COMTOOIN</title></Helmet>

      {/* 헤더 타이틀 바 */}
      <Box sx={{ mb: { xs: 1.5, sm: 2, md: 2.5 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={{ xs: 1, sm: 1.5, md: 2 }} mb={{ xs: 0.25, sm: 0.5, md: 1 }}>
          <Stack direction="row" alignItems="center" spacing={{ xs: 1, sm: 1.25, md: 1.5 }}>
            <CloudDownloadIcon sx={{ fontSize: { xs: '1.6rem', sm: '1.9rem', md: '2.2rem' }, color: 'primary.main' }} />
            <Typography component="h1" sx={{ fontWeight: 'bold', fontSize: { xs: '1.2rem', sm: '1.35rem', md: '1.5rem' } }}>자료실</Typography>
          </Stack>
          <Button 
            variant="outlined" 
            size="small" 
            startIcon={<RefreshIcon />} 
            onClick={() => fetchFiles(currentFolder.id, true)} 
            disabled={loading} 
            sx={{ fontWeight: 'bold', borderRadius: 1, height: '32px' }}
          >
            새로고침
          </Button>
        </Stack>
        <Typography sx={{ color: 'text.secondary', fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' }, lineHeight: 1.4 }}>업무 매뉴얼 및 현장 자료를 안전하게 관리하고 공유합니다.</Typography>
      </Box>
      
      <Divider sx={{ mb: { xs: 1.5, sm: 2, md: 2.5 } }} />

      {/* 통계 요약 카드 현황 */}
      <Grid container spacing={{ xs: 1, sm: 1.5 }} sx={{ mb: 3 }}>
        {[
          { 
            label: '총 파일', 
            count: stats.totalFiles, 
            icon: <FileIcon sx={{ fontSize: { xs: 13, sm: 20 }, color: '#3b82f6' }} />, 
            bgColor: 'rgba(59, 130, 246, 0.08)' 
          },
          { 
            label: '신규 파일', 
            count: stats.recentUploads, 
            icon: <RefreshIcon sx={{ fontSize: { xs: 13, sm: 20 }, color: '#10b981' }} />, 
            bgColor: 'rgba(16, 185, 129, 0.08)' 
          },
          { 
            label: '전체 폴더', 
            count: stats.totalFolders, 
            icon: <FolderIcon sx={{ fontSize: { xs: 13, sm: 20 }, color: '#f59e0b' }} />, 
            bgColor: 'rgba(245, 158, 11, 0.08)' 
          },
        ].map((item, idx) => (
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
                }
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
                    flexShrink: 0
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
                      mb: 0.1
                    }}
                  >
                    {item.label}
                  </Typography>
                  <Typography 
                    sx={{ 
                      fontSize: { xs: '0.95rem', sm: '1.15rem' },
                      fontWeight: 800,
                      color: 'text.primary',
                      lineHeight: 1
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

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>{error}</Alert>}

      {/* 액션 및 검색 바 */}
      <Stack 
        direction={{ xs: 'column', md: 'row' }} 
        spacing={2} 
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        {/* 네비게이션 브레드크럼 */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ width: { xs: '100%', md: 'auto' }, flexGrow: 1, minWidth: 0 }}>
          {folderHistory.length > 1 && (
            <IconButton 
              onClick={() => handleBreadcrumbClick(folderHistory.length - 2)} 
              size="medium" 
              sx={{ 
                bgcolor: 'background.paper', 
                border: '1px solid', 
                borderColor: 'divider', 
                borderRadius: 1,
                width: 38,
                height: 38,
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: 'action.hover',
                  borderColor: 'primary.light',
                }
              }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          )}
          <Breadcrumbs 
            separator={<NavigateNextIcon fontSize="small" sx={{ opacity: 0.5 }} />} 
            sx={{ 
              bgcolor: 'background.paper', 
              p: '6px 16px', 
              borderRadius: 1, 
              border: '1px solid', 
              borderColor: 'divider', 
              flexGrow: 1,
              minHeight: 38,
              display: 'flex',
              alignItems: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              '& .MuiBreadcrumbs-ol': {
                flexWrap: 'nowrap',
              }
            }}
          >
            {folderHistory.map((folder, index) => (
              <Link 
                key={folder.id} 
                underline="none" 
                color={index === folderHistory.length - 1 ? "primary.main" : "text.secondary"} 
                onClick={() => handleBreadcrumbClick(index)} 
                sx={{ 
                  cursor: 'pointer', 
                  fontWeight: index === folderHistory.length - 1 ? 700 : 500, 
                  display: 'flex', 
                  alignItems: 'center', 
                  fontSize: '0.85rem',
                  transition: 'color 0.2s',
                  '&:hover': { 
                    color: 'primary.main' 
                  }
                }}
              >
                {index === 0 && <HomeIcon sx={{ mr: 0.5, fontSize: 16 }} />}{folder.name}
              </Link>
            ))}
          </Breadcrumbs>
        </Stack>

        {/* 검색창, 업로드/새폴더 버튼 및 레이아웃 토글 그룹 */}
        <Stack 
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5} 
          alignItems="center" 
          sx={{ width: { xs: '100%', md: 'auto' }, justifyContent: 'flex-end' }}
        >
          <TextField 
            placeholder="파일명 검색..." 
            size="small" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            InputProps={{ 
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" sx={{ fontSize: 18 }} />
                </InputAdornment>
              ), 
              sx: { 
                borderRadius: 1, 
                bgcolor: 'background.paper',
                height: 38,
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              } 
            }} 
            sx={{ 
              width: { xs: '100%', sm: '180px', md: '200px' }
            }} 
          />
          
          <Stack 
            direction="row" 
            spacing={1} 
            alignItems="center" 
            justifyContent={{ xs: 'space-between', sm: 'flex-end' }}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            <Stack direction="row" spacing={1} sx={{ flexGrow: { xs: 1, sm: 0 } }}>
              {/* 업로드 버튼 */}
              <Button
                variant="contained"
                color="primary"
                component="label"
                startIcon={<CloudUploadIcon />}
                sx={{ 
                  height: 38, 
                  fontWeight: 'bold', 
                  borderRadius: 1,
                  boxShadow: 'none',
                  flexGrow: { xs: 1, sm: 0 },
                  whiteSpace: 'nowrap',
                  '&:hover': { boxShadow: 'none' }
                }}
              >
                업로드
                <input
                  type="file"
                  hidden
                  onChange={handleFileUpload}
                />
              </Button>

              {/* 새 폴더 버튼 */}
              <Button
                variant="outlined"
                color="primary"
                onClick={() => setCreateFolderOpen(true)}
                startIcon={<CreateFolderIcon />}
                sx={{ 
                  height: 38, 
                  fontWeight: 'bold', 
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                  borderColor: 'divider',
                  color: 'text.secondary',
                  flexGrow: { xs: 1, sm: 0 },
                  whiteSpace: 'nowrap',
                  '&:hover': {
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    bgcolor: 'action.hover'
                  }
                }}
              >
                새 폴더
              </Button>
            </Stack>
            
            <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
              <Tooltip title="그리드 뷰">
                <IconButton 
                  onClick={() => setViewMode('grid')}
                  color={viewMode === 'grid' ? 'primary' : 'default'}
                  sx={{ 
                    height: 38,
                    width: 38,
                    borderRadius: 1, 
                    border: '1px solid',
                    borderColor: viewMode === 'grid' ? 'primary.light' : 'divider',
                    bgcolor: viewMode === 'grid' ? 'rgba(77, 182, 172, 0.05)' : 'background.paper'
                  }}
                >
                  <GridIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="리스트 뷰">
                <IconButton 
                  onClick={() => setViewMode('list')}
                  color={viewMode === 'list' ? 'primary' : 'default'}
                  sx={{ 
                    height: 38,
                    width: 38,
                    borderRadius: 1, 
                    border: '1px solid',
                    borderColor: viewMode === 'list' ? 'primary.light' : 'divider',
                    bgcolor: viewMode === 'list' ? 'rgba(77, 182, 172, 0.05)' : 'background.paper'
                  }}
                >
                  <ListIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Stack>
      </Stack>

      {/* 파일 및 폴더 브라우저 본체 (구글 드라이브식 Drag & Drop 오버레이 지원) */}
      <Box 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{ 
          minHeight: '400px',
          position: 'relative',
          borderRadius: 2,
          border: dragOver ? '2px dashed' : '1px solid transparent',
          borderColor: dragOver ? 'primary.main' : 'transparent',
          bgcolor: dragOver ? 'rgba(77, 182, 172, 0.03)' : 'transparent',
          transition: 'all 0.2s ease',
          p: dragOver ? 1 : 0
        }}
      >
        {/* 백그라운드 동기화 시 얇은 progress bar 표출 */}
        {!loading && backgroundLoading && (
          <LinearProgress 
            color="primary" 
            sx={{ 
              height: 2, 
              width: '100%', 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              zIndex: 6,
              borderRadius: '4px 4px 0 0'
            }} 
          />
        )}
        {/* 드래그 오버 시 화면 전역 가이드 오버레이 */}
        {dragOver && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(255, 255, 255, 0.92)',
              zIndex: 10,
              borderRadius: 2,
              pointerEvents: 'none'
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" fontWeight="bold" color="primary.main">
              여기에 파일을 드롭하여 업로드
            </Typography>
            <Typography variant="body2" color="text.secondary">
              현재 폴더에 바로 저장됩니다.
            </Typography>
          </Box>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 12, gap: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary">자료실 목록을 불러오는 중입니다...</Typography>
          </Box>
        ) : (
          <>
            {filteredFiles.length > 0 ? (
              <>
                {/* 1. 그리드 뷰 */}
                {viewMode === 'grid' && (
                  <Grid container spacing={2}>
                    {filteredFiles.map((file) => {
                      const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                      return (
                        <Grid item xs={6} sm={4} md={3} lg={2.4} key={file.id}>
                          <Paper
                            variant="outlined"
                            onClick={() => handleFileClick(file)}
                            sx={{
                              p: 2,
                              height: 160,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textAlign: 'center',
                              borderRadius: 2,
                              cursor: 'pointer',
                              position: 'relative',
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                borderColor: 'primary.light',
                                transform: 'translateY(-4px)',
                                boxShadow: '0 8px 16px rgba(0,0,0,0.06)',
                                '& .action-buttons': {
                                  opacity: 1
                                }
                              }
                            }}
                          >
                            {getFileIconWithWrapper(file.mimeType, true)}
                            
                            <Typography
                              variant="body2"
                              fontWeight={isFolder ? 700 : 500}
                              sx={{
                                mt: 1.5,
                                width: '100%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontSize: '0.85rem',
                                color: 'text.primary'
                              }}
                              title={file.name}
                            >
                              {file.name}
                            </Typography>

                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ mt: 0.5, fontSize: '0.75rem' }}
                            >
                              {isFolder ? '폴더' : formatFileSize(file.size)}
                            </Typography>
                            
                            {/* 데스크톱 마우스 호버 시 퀵다운로드/뷰/삭제 단추 노출 */}
                            {!isMobile && (
                              <Box
                                className="action-buttons"
                                onClick={(e) => e.stopPropagation()}
                                sx={{
                                  position: 'absolute',
                                  top: 8,
                                  right: 8,
                                  opacity: 0,
                                  transition: 'opacity 0.2s',
                                  display: 'flex',
                                  gap: 0.5,
                                  bgcolor: 'rgba(255, 255, 255, 0.95)',
                                  borderRadius: 1.5,
                                  p: 0.25,
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                                  zIndex: 5
                                }}
                              >
                                {!isFolder && file.webContentLink && (
                                  <Tooltip title="직접 다운로드">
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        downloadFileWithProgress(file);
                                      }}
                                      sx={{
                                        p: 0.5,
                                        '&:hover': { color: 'primary.main' }
                                      }}
                                    >
                                      <DirectDownloadIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                <Tooltip title="구글 뷰어 보기">
                                  <IconButton
                                    size="small"
                                    component="a"
                                    href={file.webViewLink}
                                    target="_blank"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                    sx={{
                                      p: 0.5,
                                      '&:hover': { color: 'text.primary' }
                                    }}
                                  >
                                    <OpenInNewIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="삭제">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => handleDeleteClick(file, e)}
                                    sx={{
                                      p: 0.5,
                                      '&:hover': { color: 'error.main' }
                                    }}
                                  >
                                    <DeleteIcon sx={{ fontSize: 16, color: 'error.main' }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            )}

                            {/* 모바일 터치 환경 전용 상시 노출 삭제 단추 */}
                            {isMobile && (
                              <IconButton
                                size="small"
                                onClick={(e) => handleDeleteClick(file, e)}
                                sx={{
                                  position: 'absolute',
                                  top: 6,
                                  right: 6,
                                  bgcolor: 'rgba(255, 255, 255, 0.9)',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  borderRadius: '50%',
                                  width: 28,
                                  height: 28,
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                  zIndex: 5,
                                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 1)' }
                                }}
                              >
                                <DeleteIcon sx={{ fontSize: 14, color: 'error.main' }} />
                              </IconButton>
                            )}
                          </Paper>
                        </Grid>
                      );
                    })}
                  </Grid>
                )}

                {/* 2. 클래식 리스트 뷰 (기본 뷰) */}
                {viewMode === 'list' && (
                  <List sx={{ py: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {filteredFiles.map((file) => (
                      <ListItem 
                        key={file.id} 
                        disablePadding 
                        sx={{ 
                          bgcolor: 'background.paper',
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': { 
                            boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                            borderColor: 'primary.light',
                            transform: 'translateY(-2px)'
                          }
                        }}
                        secondaryAction={
                          <IconButton 
                            onClick={(e) => handleMenuOpen(file, e)}
                            sx={{ 
                              bgcolor: 'background.paper', 
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1,
                              width: 32,
                              height: 32,
                              transition: 'all 0.2s',
                              '&:hover': {
                                bgcolor: 'action.hover',
                                borderColor: 'text.primary',
                              }
                            }}
                            title="더보기"
                          >
                            <MoreVertIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                          </IconButton>
                        }
                      >
                        <ListItemButton 
                          onClick={() => handleFileClick(file)} 
                          sx={{ px: { xs: 2, sm: 3 }, py: 1.5, pr: 8, borderRadius: 1 }}
                          title={file.mimeType === 'application/vnd.google-apps.folder' ? "폴더 열기" : "클릭하여 바로 다운로드"}
                        >
                          <ListItemIcon sx={{ minWidth: 'auto', mr: 2 }}>
                            {getFileIconWithWrapper(file.mimeType)}
                          </ListItemIcon>
                          <ListItemText 
                            primary={file.name} 
                            primaryTypographyProps={{ 
                              variant: 'body1', 
                              fontWeight: file.mimeType === 'application/vnd.google-apps.folder' ? 700 : 500, 
                              noWrap: true, 
                              component: 'div', 
                              sx: { 
                                fontSize: { xs: '0.875rem', sm: '0.95rem' },
                                color: 'text.primary'
                              } 
                            }} 
                            secondary={
                              <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                                  {new Date(file.modifiedTime).toLocaleDateString()}
                                </Typography>
                                {file.size && (
                                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                                    {formatFileSize(file.size)}
                                  </Typography>
                                )}
                              </Box>
                            } 
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                )}
              </>
            ) : (
              <Paper 
                variant="outlined" 
                sx={{ 
                  py: 10, 
                  px: 2,
                  textAlign: 'center', 
                  borderRadius: 1, 
                  bgcolor: 'background.paper', 
                  borderStyle: 'dashed',
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1.5
                }}
              >
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: 56, 
                    height: 56, 
                    borderRadius: '50%', 
                    bgcolor: 'action.hover',
                    color: 'text.disabled'
                  }}
                >
                  <FileIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold" color="text.primary" sx={{ mb: 0.5 }}>
                    표시할 파일이 없습니다.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    이 폴더에 저장된 파일이 없거나 검색 결과와 일치하는 파일이 없습니다.
                  </Typography>
                </Box>
              </Paper>
            )}
          </>
        )}
      </Box>

      {/* 다운로드 로딩 대화상자 (심플 미니 UI) */}
      <Dialog open={Boolean(downloadingFile)} disableEscapeKeyDown maxWidth="xs" fullWidth>
        <DialogContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0, gap: 1.5 }}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap sx={{ color: 'text.primary', flexGrow: 1, minWidth: 0 }}>
              {downloadingFile?.name}
            </Typography>
            <Typography variant="caption" color="primary" fontWeight="bold" sx={{ flexShrink: 0 }}>
              {downloadProgress > 0 ? `${downloadProgress}%` : '준비 중...'}
            </Typography>
          </Box>
          <LinearProgress 
            variant={downloadProgress > 0 ? "determinate" : "indeterminate"} 
            value={downloadProgress} 
            sx={{ height: 4, borderRadius: 2 }} 
          />
        </DialogContent>
      </Dialog>

      {/* 업로드 로딩 대화상자 */}
      <Dialog open={uploading} disableEscapeKeyDown>
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>파일 업로드 중</DialogTitle>
        <DialogContent sx={{ minWidth: 280, pt: 1 }}>
          <DialogContentText sx={{ mb: 2, fontSize: '0.875rem' }}>
            선택한 파일을 구글 드라이브로 암호화 전송하는 중입니다. 잠시만 기다려 주십시오...
          </DialogContentText>
          <Box sx={{ width: '100%', mr: 1 }}>
            <LinearProgress variant="determinate" value={uploadProgress} sx={{ height: 6, borderRadius: 3 }} />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'right' }}>
            {uploadProgress}% 완료
          </Typography>
        </DialogContent>
      </Dialog>

      {/* 새 폴더 만들기 대화상자 */}
      <Dialog 
        open={createFolderOpen} 
        onClose={(event, reason) => {
          if (reason !== 'backdropClick') {
            setCreateFolderOpen(false);
          }
        }} 
        disableEscapeKeyDown
        maxWidth="xs" 
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem', pb: 1 }}>새 폴더 생성</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <DialogContentText sx={{ mb: 1.5, fontSize: '0.85rem' }}>
            현재 폴더 위치에 생성할 새 폴더명을 입력해 주세요.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="폴더 이름"
            type="text"
            fullWidth
            variant="outlined"
            size="small"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            InputProps={{ style: { fontSize: '0.875rem' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateFolderOpen(false)} size="small" sx={{ fontWeight: 'bold' }}>취소</Button>
          <Button onClick={handleCreateFolder} variant="contained" size="small" sx={{ fontWeight: 'bold' }}>생성</Button>
        </DialogActions>
      </Dialog>

      {/* 삭제 확인 대화상자 */}
      <Dialog 
        open={deleteConfirmOpen} 
        onClose={(event, reason) => {
          if (reason !== 'backdropClick') {
            setDeleteConfirmOpen(false);
          }
        }} 
        disableEscapeKeyDown
        maxWidth="xs" 
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem', pb: 1, color: 'error.main' }}>자료 삭제 (휴지통 이동)</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <DialogContentText sx={{ mb: 1.5, fontSize: '0.875rem', color: 'text.primary', fontWeight: 500 }}>
            정말로 '{fileToDelete?.name}'을(를) 휴지통으로 이동하시겠습니까?
          </DialogContentText>
          <DialogContentText sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
            삭제된 자료는 구글 드라이브 휴지통에 임시 보관되며 필요 시 구글 드라이브에서 복구할 수 있습니다.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} size="small" sx={{ fontWeight: 'bold' }}>취소</Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error" size="small" disabled={deleting} sx={{ fontWeight: 'bold' }}>
            {deleting ? '이동 중...' : '휴지통 이동'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 파일별 더보기 컨텍스트 메뉴 */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          elevation: 2,
          sx: { 
            minWidth: 140,
            borderRadius: 1.5,
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
          }
        }}
      >
        {activeMenuFile?.mimeType !== 'application/vnd.google-apps.folder' && activeMenuFile?.webContentLink && (
          <MenuItem 
            onClick={() => {
              handleMenuClose();
              downloadFileWithProgress(activeMenuFile);
            }}
            sx={{ gap: 1.5, py: 1 }}
          >
            <DirectDownloadIcon fontSize="small" color="primary" />
            <ListItemText primary="다운로드" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500 }} />
          </MenuItem>
        )}
        {activeMenuFile?.mimeType !== 'application/vnd.google-apps.folder' && (
          <MenuItem 
            component="a"
            href={activeMenuFile?.webViewLink}
            target="_blank"
            onClick={handleMenuClose}
            sx={{ gap: 1.5, py: 1, textDecoration: 'none', color: 'inherit' }}
          >
            <OpenInNewIcon fontSize="small" color="action" />
            <ListItemText primary="미리보기" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500 }} />
          </MenuItem>
        )}
        <MenuItem 
          onClick={(e) => {
            handleMenuClose();
            handleDeleteClick(activeMenuFile!, e as any);
          }}
          sx={{ gap: 1.5, py: 1, color: 'error.main' }}
        >
          <DeleteIcon fontSize="small" color="error" />
          <ListItemText primary="삭제" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500, color: 'error.main' }} />
        </MenuItem>
      </Menu>
    </Container>
  );
};

export default ArchivePage;
