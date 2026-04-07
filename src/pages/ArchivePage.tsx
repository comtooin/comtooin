import React from 'react';
import {
  Typography, Box, Paper, Divider, Alert, Stack
} from '@mui/material';
import { 
  FolderShared as FolderSharedIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { Helmet } from 'react-helmet-async';

const ArchivePage: React.FC = () => {
  // 구글 드라이브 폴더 ID: 1YV2vEIhNU0rPSiyHUgyDV0pSuBcuOKfJ
  const FOLDER_ID = '1YV2vEIhNU0rPSiyHUgyDV0pSuBcuOKfJ'; // TODO: 구글 드라이브 폴더 ID 입력
  const embedUrl = `https://drive.google.com/embeddedfolderview?id=${FOLDER_ID}#list`;

  return (
    <>
      <Helmet>
        <title>통합 자료실 - 컴투인</title>
      </Helmet>

      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
        <FolderSharedIcon sx={{ mr: 1.5, fontSize: '2.2rem', color: 'primary.main' }} />
        <Stack direction="row" alignItems="baseline" spacing={1}>
          <Typography variant="h4" component="h1" fontWeight="bold">
            통합 자료실
          </Typography>
          <Typography variant="body2" color="text.secondary">
            매뉴얼, 드라이버, 현장 사진 공유
          </Typography>
        </Stack>
      </Box>
      
      <Divider sx={{ mb: 3 }} />

      <Paper 
        elevation={0} 
        variant="outlined" 
        sx={{ 
          p: 0, 
          overflow: 'hidden', 
          borderRadius: 2,
          bgcolor: 'background.paper',
          mb: 3
        }}
      >
        <iframe
          src={embedUrl}
          width="100%"
          height="800px"
          frameBorder="0"
          style={{ border: 0, display: 'block' }}
          title="Google Drive Archive"
        ></iframe>
      </Paper>

      <Alert 
        severity="info" 
        icon={<InfoIcon fontSize="inherit" />}
        sx={{ borderRadius: 2 }}
      >
        파일 업로드 및 권한 문의는 관리자에게 연락 바랍니다.
      </Alert>
    </>
  );
};

export default ArchivePage;
