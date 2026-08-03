import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography, Box, Paper, Divider, Stack, Container, Button, 
  CircularProgress, Alert, List, ListItem, ListItemIcon, ListItemText, 
  IconButton, TextField, InputAdornment, Breadcrumbs, Link, ListItemButton,
  Grid
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

const getFileIconWithWrapper = (mimeType: string) => {
  let icon = <UnknownFileIcon sx={{ fontSize: 20, color: '#64748b' }} />;
  let bgColor = 'rgba(100, 116, 139, 0.08)'; // Slate 500
  
  if (mimeType === 'application/vnd.google-apps.folder') {
    icon = <FolderIcon sx={{ fontSize: 20, color: '#eab308' }} />;
    bgColor = 'rgba(234, 179, 8, 0.1)'; // Yellow 500
  } else if (mimeType.includes('pdf')) {
    icon = <PdfIcon sx={{ fontSize: 20, color: '#ef4444' }} />;
    bgColor = 'rgba(239, 68, 68, 0.1)'; // Red 500
  } else if (mimeType.includes('image')) {
    icon = <ImageIcon sx={{ fontSize: 20, color: '#3b82f6' }} />;
    bgColor = 'rgba(59, 130, 246, 0.1)'; // Blue 500
  } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    icon = <ExcelIcon sx={{ fontSize: 20, color: '#10b981' }} />;
    bgColor = 'rgba(16, 185, 129, 0.1)'; // Emerald 500
  } else if (mimeType.includes('word') || mimeType.includes('document')) {
    icon = <FileIcon sx={{ fontSize: 20, color: '#06b6d4' }} />;
    bgColor = 'rgba(6, 182, 212, 0.1)'; // Cyan 500
  }
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        width: 40, 
        height: 40, 
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
        setFiles(sortedFiles);
      } else {
        throw new Error(data?.error || '서버에서 알 수 없는 응답을 보냈습니다.');
      }
    } catch (err: any) {
      setError(err.message || '파일 목록을 가져오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const filteredFiles = useMemo(() => {
    return files.filter(file => file.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [files, searchQuery]);

  return (
    <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 }, pb: 10 }}>
      <Helmet><title>자료실 | COMTOOIN</title></Helmet>

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
            onClick={() => fetchFiles(currentFolder.id)} 
            disabled={loading} 
            sx={{ fontWeight: 'bold', borderRadius: 1, height: '32px' }}
          >
            새로고침
          </Button>
        </Stack>
        <Typography sx={{ color: 'text.secondary', fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' }, lineHeight: 1.4 }}>업무 매뉴얼 및 현장 자료를 안전하게 관리하고 공유합니다.</Typography>
      </Box>
      
      <Divider sx={{ mb: { xs: 1.5, sm: 2, md: 2.5 } }} />

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

      <Stack 
        direction={{ xs: 'column', sm: 'row' }} 
        spacing={1.5} 
        alignItems={{ xs: 'stretch', sm: 'center' }} 
        sx={{ mb: 2.5 }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 1, minWidth: 0 }}>
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
            width: { xs: '100%', sm: '240px' },
            flexShrink: 0
          }} 
        />
      </Stack>

      <Box sx={{ minHeight: '300px' }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 12, gap: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary">자료실 목록을 불러오는 중입니다...</Typography>
          </Box>
        ) : (
          <List sx={{ py: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {filteredFiles.length > 0 ? filteredFiles.map((file, index) => (
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
                <Stack direction="row" spacing={1} sx={{ pr: 1 }}>
                  {file.mimeType !== 'application/vnd.google-apps.folder' && file.webContentLink && (
                    <IconButton 
                      component="a" 
                      href={file.webContentLink} 
                      target="_blank" 
                      sx={{ 
                        bgcolor: 'background.paper', 
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        width: 32,
                        height: 32,
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: 'primary.main',
                          borderColor: 'primary.main',
                          '& svg': { color: 'white !important' }
                        }
                      }}
                      title="직접 다운로드"
                    >
                      <DirectDownloadIcon sx={{ fontSize: 16, color: 'primary.main', transition: 'color 0.2s' }} />
                    </IconButton>
                  )}
                  {file.mimeType !== 'application/vnd.google-apps.folder' && (
                    <IconButton 
                      component="a" 
                      href={file.webViewLink} 
                      target="_blank" 
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
                      title="구글 드라이브에서 보기 (미리보기)"
                    >
                      <OpenInNewIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    </IconButton>
                  )}
                </Stack>
              }>
                <ListItemButton 
                  onClick={() => { 
                    if (file.mimeType === 'application/vnd.google-apps.folder') {
                      handleFolderClick(file.id, file.name);
                    } else {
                      const downloadUrl = file.webContentLink || file.webViewLink;
                      window.open(downloadUrl, '_blank');
                    }
                  }} 
                  sx={{ px: { xs: 2, sm: 3 }, py: 1.5, borderRadius: 1 }}
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
                        <Typography variant="caption" color="text.secondary" component="span" sx={{ fontWeight: 500 }}>
                          {new Date(file.modifiedTime).toLocaleDateString()}
                        </Typography>
                        {file.size && (
                          <Typography variant="caption" color="text.secondary" component="span" sx={{ fontWeight: 500 }}>
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
          </List>
        )}
      </Box>
    </Container>
  );
};

export default ArchivePage;
