import React from 'react';
import {
  Typography, Box, Paper, Divider, Stack, Container
} from '@mui/material';
import { 
  InfoOutlined as InfoOutlinedIcon,
  CloudDownload as CloudDownloadIcon
} from '@mui/icons-material';
import { Helmet } from 'react-helmet-async';

const ArchivePage: React.FC = () => {
  // 구글 드라이브 폴더 ID: 1YV2vEIhNU0rPSiyHUgyDV0pSuBcuOKfJ
  const FOLDER_ID = '1YV2vEIhNU0rPSiyHUgyDV0pSuBcuOKfJ'; 
  const embedUrl = `https://drive.google.com/embeddedfolderview?id=${FOLDER_ID}#list`;

  return (
    <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
      <Helmet>
        <title>통합 자료실 - 컴투인</title>
      </Helmet>

      {/* 표준 헤더 섹션 */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <CloudDownloadIcon sx={{ fontSize: '2rem', color: 'primary.main' }} />
          <Typography variant="h5" component="h1" fontWeight="bold">
            통합 자료실
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          매뉴얼, 드라이버 및 업무 관련 사진을 안전하게 공유하고 관리합니다.
        </Typography>
      </Box>
      
      <Divider sx={{ mb: 4 }} />

      {/* 메인 콘텐츠 영역 */}
      <Paper 
        variant="outlined" 
        sx={{ 
          p: 0, 
          overflow: 'hidden', 
          borderRadius: 3,
          bgcolor: 'background.paper',
          boxShadow: '0 4px 20px 0 rgba(0,0,0,0.05)',
          maxWidth: '100%',
          position: 'relative'
        }}
      >
        <iframe
          src={embedUrl}
          width="100%"
          height="750px"
          frameBorder="0"
          style={{ border: 0, display: 'block', maxWidth: '100%', width: '100%' }}
          title="Google Drive Archive"
        ></iframe>
      </Paper>

      {/* 푸터 가이드 */}
      <Stack 
        direction="row" 
        spacing={1} 
        alignItems="center" 
        sx={{ mt: 3, px: 1, color: 'text.secondary' }}
      >
        <InfoOutlinedIcon sx={{ fontSize: 18 }} />
        <Typography variant="caption" sx={{ fontSize: '0.85rem' }}>
          파일 업로드 및 삭제 권한은 관리자에게 문의해 주세요. 구글 드라이브 앱을 사용하면 모바일에서도 실시간 업로드가 가능합니다.
        </Typography>
      </Stack>
    </Container>
  );
};

export default ArchivePage;
