import React from 'react';
import {
  Typography, Box, Paper, Divider, Stack, Container
} from '@mui/material';
import { 
  InfoOutlined as InfoOutlinedIcon
} from '@mui/icons-material';
import { Helmet } from 'react-helmet-async';

const ArchivePage: React.FC = () => {
  // 구글 드라이브 폴더 ID: 1YV2vEIhNU0rPSiyHUgyDV0pSuBcuOKfJ
  const FOLDER_ID = '1YV2vEIhNU0rPSiyHUgyDV0pSuBcuOKfJ'; 
  const embedUrl = `https://drive.google.com/embeddedfolderview?id=${FOLDER_ID}#list`;

  return (
    <Box sx={{ bgcolor: 'grey.50', minHeight: '100vh', p: { xs: 2, md: 4 }, mx: { xs: -2, sm: -3 } }}>
      <Container maxWidth="lg" sx={{ maxWidth: '1200px !important' }}>
        <Helmet>
          <title>통합 자료실 - 컴투인</title>
        </Helmet>

        {/* 헤더 섹션 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h4" component="h1" fontWeight="bold" color="text.primary">
            통합 자료실
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            매뉴얼, 드라이버 및 업무 관련 사진을 안전하게 공유하고 관리합니다.
          </Typography>
        </Box>
        
        <Divider sx={{ mb: 4 }} />

        {/* 메인 카드 UI */}
        <Paper 
          variant="outlined" 
          elevation={0} 
          sx={{ 
            p: 0, 
            overflow: 'hidden', 
            borderRadius: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <iframe
            src={embedUrl}
            width="100%"
            height="750px"
            frameBorder="0"
            style={{ border: 0, display: 'block' }}
            title="Google Drive Archive"
          ></iframe>
        </Paper>

        {/* 푸터 가이드 */}
        <Stack 
          direction="row" 
          spacing={1} 
          alignItems="center" 
          sx={{ mt: 2, px: 1, color: 'text.secondary' }}
        >
          <InfoOutlinedIcon sx={{ fontSize: 16 }} />
          <Typography variant="caption">
            파일 업로드 및 삭제 권한은 관리자에게 문의해 주세요. 구글 드라이브 앱을 사용하면 모바일에서도 실시간 업로드가 가능합니다.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
};

export default ArchivePage;
