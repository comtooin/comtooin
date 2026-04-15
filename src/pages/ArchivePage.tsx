import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography, Box, Paper, Divider, Stack, Container, Button, 
  CircularProgress, Alert, List, ListItem, ListItemIcon, ListItemText, 
  IconButton, TextField, InputAdornment, Breadcrumbs, Link, ListItemButton
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
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
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

const getFileIcon = (mimeType: string) => {
  if (mimeType === 'application/vnd.google-apps.folder') return <FolderIcon color="warning" />;
  if (mimeType.includes('pdf')) return <PdfIcon color="error" />;
  if (mimeType.includes('image')) return <ImageIcon color="primary" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <ExcelIcon color="success" />;
  if (mimeType.includes('word') || mimeType.includes('document')) return <FileIcon color="info" />;
  return <UnknownFileIcon color="action" />;
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

const ArchivePage: React.FC = () => {
  const [files, setFiles] = useState<IDriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [currentFolder, setCurrentFolder] = useState<IFolderHistory>({ id: ROOT_FOLDER_ID, name: 'Home' });
  const [folderHistory, setFolderHistory] = useState<IFolderHistory[]>([{ id: ROOT_FOLDER_ID, name: 'Home' }]);

  const fetchFiles = useCallback(async (folderId: string) => {
    setLoading(true);
    setError('');
    try {
      console.log(`Fetching folder: ${folderId}`);
      
      const { data, error: funcError } = await supabase.functions.invoke(`list-drive-files?folderId=${folderId}`, {
        method: 'GET'
      });

      if (funcError) {
        console.error('Functions error:', funcError);
        throw new Error(funcError.message || '서버 함수 호출 중 오류가 발생했습니다.');
      }

      if (data && data.success) {
        const sortedFiles = (data.files || []).sort((a: IDriveFile, b: IDriveFile) => {
          const aIsFolder = a.mimeType === 'application/vnd.google-apps.folder';
          const bIsFolder = b.mimeType === 'application/vnd.google-apps.folder';
          if (aIsFolder && !bIsFolder) return -1;
          if (!aIsFolder && bIsFolder) return 1;
          return a.name.localeCompare(b.name);
        });
        setFiles(sortedFiles);
      } else {
        throw new Error(data?.error || '서버에서 알 수 없는 응답을 보냈습니다.');
      }
    } catch (err: any) {
      console.error('Fetch error details:', err);
      setError(err.message || '파일 목록을 가져오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles(currentFolder.id);
  }, [fetchFiles, currentFolder.id]);

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

  const handleGoBack = () => {
    if (folderHistory.length > 1) {
      handleBreadcrumbClick(folderHistory.length - 2);
    }
  };

  const filteredFiles = useMemo(() => {
    return files.filter(file => 
      file.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [files, searchQuery]);

  return (
    <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 }, pb: 10 }}>
      <Helmet><title>자료실</title></Helmet>

      {/* 헤더 섹션 */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} mb={1}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <CloudDownloadIcon sx={{ fontSize: '2.2rem', color: 'primary.main' }} />
            <Typography variant="h5" component="h1" fontWeight="bold">
              자료실
            </Typography>
          </Stack>
          
          <Button 
            variant="outlined" size="small" startIcon={<RefreshIcon />}
            onClick={() => fetchFiles(currentFolder.id)}
            disabled={loading}
            sx={{ fontWeight: 'bold', borderRadius: 2 }}
          >
            새로고침
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          업무 매뉴얼 및 현장 자료를 안전하게 관리하고 공유합니다.
        </Typography>
      </Box>
      
      <Divider sx={{ mb: 4 }} />

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold">로드 실패</Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
      )}

      {/* 탐색 컨트롤 */}
      <Stack spacing={2} sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          {folderHistory.length > 1 && (
            <IconButton onClick={handleGoBack} size="small" sx={{ bgcolor: 'action.hover' }}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          )}
          <Breadcrumbs 
            separator={<NavigateNextIcon fontSize="small" />} 
            sx={{ 
              bgcolor: 'grey.50', p: '8px 16px', borderRadius: 2, 
              border: '1px solid', borderColor: 'divider', flexGrow: 1 
            }}
          >
            {folderHistory.map((folder, index) => (
              <Link
                key={folder.id}
                underline="hover"
                color={index === folderHistory.length - 1 ? "primary" : "inherit"}
                onClick={() => handleBreadcrumbClick(index)}
                sx={{ 
                  cursor: 'pointer', 
                  fontWeight: index === folderHistory.length - 1 ? 'bold' : 'normal',
                  display: 'flex', alignItems: 'center', fontSize: '0.9rem'
                }}
              >
                {index === 0 && <HomeIcon sx={{ mr: 0.5, fontSize: 18 }} />}
                {folder.name}
              </Link>
            ))}
          </Breadcrumbs>
        </Stack>

        <TextField
          fullWidth placeholder="파일명 검색..." size="small"
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>
            ),
            sx: { borderRadius: 2, bgcolor: 'background.paper' }
          }}
        />
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', minHeight: '300px' }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 12, gap: 2 }}>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary">자료실 목록을 불러오는 중입니다...</Typography>
          </Box>
        ) : (
          <List sx={{ py: 0 }}>
            {filteredFiles.length > 0 ? filteredFiles.map((file, index) => (
              <ListItem 
                key={file.id}
                disablePadding
                divider={index < filteredFiles.length - 1}
                secondaryAction={
                  <Stack direction="row" spacing={0.5}>
                    {file.mimeType !== 'application/vnd.google-apps.folder' && file.webContentLink && (
                      <IconButton component="a" href={file.webContentLink} target="_blank">
                        <DirectDownloadIcon fontSize="small" color="primary" />
                      </IconButton>
                    )}
                    <IconButton component="a" href={file.webViewLink} target="_blank">
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                }
              >
                <ListItemButton 
                  onClick={() => {
                    if (file.mimeType === 'application/vnd.google-apps.folder') {
                      handleFolderClick(file.id, file.name);
                    } else {
                      window.open(file.webViewLink, '_blank');
                    }
                  }}
                  sx={{ px: 2, py: 1.5 }}
                >
                  <ListItemIcon sx={{ minWidth: 44 }}>
                    {getFileIcon(file.mimeType)}
                  </ListItemIcon>
                  <ListItemText 
                    primary={file.name}
                    primaryTypographyProps={{
                      variant: 'body1',
                      fontWeight: file.mimeType === 'application/vnd.google-apps.folder' ? 'bold' : 'medium',
                      noWrap: true, component: 'div'
                    }}
                    secondary={
                      <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" component="span">
                          {new Date(file.modifiedTime).toLocaleDateString()}
                        </Typography>
                        {file.size && (
                          <Typography variant="caption" color="text.secondary" component="span">
                            {formatFileSize(file.size)}
                          </Typography>
                        )}
                      </Box>
                    }
                    secondaryTypographyProps={{ component: 'div' }}
                  />
                </ListItemButton>
              </ListItem>
            )) : (
              <Box sx={{ py: 12, textAlign: 'center' }}>
                <Typography color="text.secondary">표시할 파일이 없습니다.</Typography>
              </Box>
            )}
          </List>
        )}
      </Paper>
    </Container>
  );
};

export default ArchivePage;
