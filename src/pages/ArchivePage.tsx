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

      <Box sx={{ mb: 2.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} mb={1}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <CloudDownloadIcon sx={{ fontSize: '2.2rem', color: 'primary.main' }} />
            <Typography variant="h5" component="h1" fontWeight="bold">자료실</Typography>
          </Stack>
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={() => fetchFiles(currentFolder.id)} disabled={loading} sx={{ fontWeight: 'bold', borderRadius: 1 }}>새로고침</Button>
        </Stack>
        <Typography variant="body2" color="text.secondary">업무 매뉴얼 및 현장 자료를 안전하게 관리하고 공유합니다.</Typography>
      </Box>
      
      <Divider sx={{ mb: 2.5 }} />

      <Paper variant="outlined" sx={{ mb: 2.5, borderRadius: 2, display: 'flex', overflow: 'hidden', bgcolor: 'background.paper' }}>
        {[
          { label: '총 파일', shortLabel: '총파일', count: stats.totalFiles, icon: <FileIcon fontSize="small" sx={{ color: '#607d8b' }} /> },
          { label: '신규 파일', shortLabel: '신규', count: stats.recentUploads, icon: <RefreshIcon fontSize="small" sx={{ color: '#2e7d32' }} /> },
          { label: '전체 폴더', shortLabel: '폴더', count: stats.totalFolders, icon: <FolderIcon fontSize="small" sx={{ color: '#ffa000' }} /> },
        ].map((item, idx, arr) => (
          <Box 
            key={idx}
            sx={{ 
              flex: 1, 
              p: { xs: 1.5, sm: 2 }, 
              borderRight: idx < arr.length - 1 ? '1px solid' : 'none',
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" spacing={{ xs: 0.5, sm: 1 }} alignItems="center" justifyContent="center" sx={{ whiteSpace: 'nowrap' }}>
              {item.icon}
              <Typography variant="body2" fontWeight="bold" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                {item.label}
              </Typography>
              <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' }, fontSize: '0.7rem' }}>
                {item.shortLabel}
              </Typography>
              <Typography variant="body1" fontWeight="900" color="text.primary" sx={{ ml: { xs: 0.5, sm: 1 } }}>
                {item.count}
              </Typography>
            </Stack>
          </Box>
        ))}
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>{error}</Alert>}

      <Stack spacing={2} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          {folderHistory.length > 1 && (
            <IconButton onClick={() => handleBreadcrumbClick(folderHistory.length - 2)} size="small" sx={{ bgcolor: 'action.hover', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}><ArrowBackIcon fontSize="small" /></IconButton>
          )}
          <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ bgcolor: 'background.paper', p: '10px 16px', borderRadius: 2, border: '1px solid', borderColor: 'divider', flexGrow: 1, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
            {folderHistory.map((folder, index) => (
              <Link key={folder.id} underline="hover" color={index === folderHistory.length - 1 ? "primary" : "inherit"} onClick={() => handleBreadcrumbClick(index)} sx={{ cursor: 'pointer', fontWeight: index === folderHistory.length - 1 ? 'bold' : 'normal', display: 'flex', alignItems: 'center', fontSize: '0.9rem' }}>
                {index === 0 && <HomeIcon sx={{ mr: 0.5, fontSize: 18 }} />}{folder.name}
              </Link>
            ))}
          </Breadcrumbs>
        </Stack>
        <TextField fullWidth placeholder="파일명 검색..." size="small" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>), sx: { borderRadius: 2, bgcolor: 'background.paper', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' } }} />
      </Stack>

      <Box sx={{ minHeight: '300px' }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 12, gap: 2, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
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
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': { 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                    borderColor: 'primary.light',
                    transform: 'translateY(-2px)'
                  }
                }}
                secondaryAction={
                <Stack direction="row" spacing={0.5} sx={{ pr: 1 }}>
                  {file.mimeType !== 'application/vnd.google-apps.folder' && file.webContentLink && (
                    <IconButton component="a" href={file.webContentLink} target="_blank" sx={{ bgcolor: 'action.hover' }}><DirectDownloadIcon fontSize="small" color="primary" /></IconButton>
                  )}
                  <IconButton component="a" href={file.webViewLink} target="_blank" sx={{ bgcolor: 'action.hover' }}><OpenInNewIcon fontSize="small" /></IconButton>
                </Stack>
              }>
                <ListItemButton onClick={() => { if (file.mimeType === 'application/vnd.google-apps.folder') handleFolderClick(file.id, file.name); else window.open(file.webViewLink, '_blank'); }} sx={{ px: { xs: 2, sm: 3 }, py: 2, borderRadius: 2 }}>
                  <ListItemIcon sx={{ minWidth: { xs: 40, sm: 50 } }}>{getFileIcon(file.mimeType)}</ListItemIcon>
                  <ListItemText 
                    primary={file.name} 
                    primaryTypographyProps={{ variant: 'body1', fontWeight: file.mimeType === 'application/vnd.google-apps.folder' ? 'bold' : 'medium', noWrap: true, component: 'div', sx: { fontSize: { xs: '0.9rem', sm: '1rem' } } }} 
                    secondary={<Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}><Typography variant="caption" color="text.secondary" component="span" sx={{ fontWeight: 'medium' }}>{new Date(file.modifiedTime).toLocaleDateString()}</Typography>{file.size && (<Typography variant="caption" color="text.secondary" component="span" sx={{ fontWeight: 'medium' }}>{formatFileSize(file.size)}</Typography>)}</Box>} 
                    secondaryTypographyProps={{ component: 'div' }} 
                  />
                </ListItemButton>
              </ListItem>
            )) : (
              <Paper variant="outlined" sx={{ py: 12, textAlign: 'center', borderRadius: 2, bgcolor: 'background.paper', borderStyle: 'dashed' }}>
                <Typography color="text.secondary" fontWeight="medium">표시할 파일이 없습니다.</Typography>
              </Paper>
            )}
          </List>
        )}
      </Box>
    </Container>
  );
};

export default ArchivePage;
