import React, { useState, useEffect } from 'react';
import { Typography, Paper, CircularProgress, Alert, Accordion, AccordionSummary, AccordionDetails, Divider, Box } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Quiz as QuizIcon } from '@mui/icons-material';
import api from '../api'; // 수정됨: 중앙 API 모듈 임포트
import { Helmet } from 'react-helmet-async';

// 삭제됨: const API_URL = ...

interface IGuide {
  id: number;
  title: string;
  content: string;
}

const SelfCheckGuidePage: React.FC = () => {
  const [guides, setGuides] = useState<IGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<number | false>(false); // State for controlled accordion

  const handleChange = (panelId: number) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panelId : false);
  };

  useEffect(() => {
    const fetchGuides = async () => {
      try {
        const { data, error: fetchError } = await supabase.from('guide').select('*');
        if (fetchError) {
          throw fetchError;
        }
        setGuides(data || []);
      } catch (err: any) {
        console.error('Supabase fetch guides error:', err);
        setError(err.message || '가이드 목록을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchGuides();
  }, []);

  return (
    <Paper sx={{ p: 3 }}>
      <Helmet>
        <title>빠른 자가 점검 가이드</title>
      </Helmet>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <QuizIcon sx={{ mr: 1.5, fontSize: '2rem' }} />
        <Typography variant="h5" component="h1">
          빠른 자가 점검 가이드
        </Typography>
      </Box>
      <Divider />
      <Typography variant="subtitle1" color="text.secondary" sx={{ my: 2 }}>
        자주 묻는 문제에 대한 해결 방법을 확인해 보세요.
      </Typography>
      
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      
      {!loading && !error && (
        <div>
          {guides.length > 0 ? (
            guides.map((guide, index) => (
              <Accordion
                key={guide.id}
                disableGutters
                expanded={expanded === guide.id} // Controlled expansion
                onChange={handleChange(guide.id)} // Handle change
                sx={{
                  border: (theme) => `1px solid ${theme.palette.divider}`,
                  '&:not(:last-child)': {
                    borderBottom: 0,
                  },
                  '&:before': {
                    display: 'none',
                  },
                  '&.Mui-expanded': {
                    backgroundColor: (theme) => theme.palette.action.hover,
                  }
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls={`panel${guide.id}-content`}
                  id={`panel${guide.id}-header`}
                >
                  <Typography variant="h6">{guide.title}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <div dangerouslySetInnerHTML={{ __html: guide.content }} />
                </AccordionDetails>
              </Accordion>
            ))
          ) : (
            <Typography>표시할 가이드가 없습니다.</Typography>
          )}
        </div>
      )}
    </Paper>
  );
};

export default SelfCheckGuidePage;