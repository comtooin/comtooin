import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Button, Box, Paper, IconButton, CircularProgress, Alert, Divider, Stack
} from '@mui/material';
import { Edit, Delete, ListAlt as ListAltIcon, AutoStoriesOutlined as AutoStoriesOutlinedIcon } from '@mui/icons-material'; // Added AutoStoriesOutlinedIcon
import { supabase } from '../api'; // 수정됨: 중앙 API 모듈 임포트
import { Helmet } from 'react-helmet-async';
import { Accordion, AccordionSummary, AccordionDetails, useTheme } from '@mui/material'; // Added useTheme
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface IGuide {
  id: number;
  title: string;
  content: string;
}

const AdminGuideListPage: React.FC = () => {
  const [guides, setGuides] = useState<IGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<number | false>(false); // State for controlled accordion
  const navigate = useNavigate();
  const theme = useTheme(); // Use theme for border radius

  const handleChange = (panelId: number) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panelId : false);
  };

  const fetchGuides = async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase.from('guides').select('*');
      if (fetchError) {
        throw fetchError;
      }
      setGuides(data || []);
    } catch (err) {
      setError('가이드 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuides();
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm(`${id}번 가이드를 정말로 삭제하시겠습니까?`)) return;

    try {
      const { error: deleteError } = await supabase
        .from('guides')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw deleteError;
      }
      setGuides(guides.filter(g => g.id !== id));
      alert('가이드가 삭제되었습니다.');
    } catch (err: any) {
      console.error('Supabase delete error:', err);
      alert(err.message || '가이드 삭제 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <>
      <Helmet>
        <title>가이드 관리</title>
      </Helmet>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <ListAltIcon sx={{ mr: 1.5, fontSize: '2rem' }} />
          <Typography variant="h4" component="h1">
            가이드 관리
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => navigate('/admin/guide/new')}>
          새 가이드 작성
        </Button>
      </Box>
      <Divider sx={{ mb: 3 }} />
      <Paper sx={{ p: { xs: 2, sm: 3 } }}> {/* Added responsive padding */}
        {guides.length > 0 ? (
          <Stack spacing={1}> {/* Stack for spacing between accordions */}
            {guides.map((guide) => (
              <Accordion
                key={guide.id}
                disableGutters
                expanded={expanded === guide.id}
                onChange={handleChange(guide.id)}
                sx={{
                  border: `1px solid ${theme.palette.divider}`, // Keep subtle border
                  borderRadius: 0, // Apply global border radius
                  '&:not(:last-child)': {
                    mb: 1, // Margin bottom for spacing
                  },
                  '&:before': {
                    display: 'none',
                  },
                  '&.Mui-expanded': {
                    backgroundColor: theme.palette.action.hover,
                    margin: '0 !important', // Override default Accordion margin when expanded
                  },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls={`panel${guide.id}-content`}
                  id={`panel${guide.id}-header`}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 2, flexWrap: 'wrap' }}>
                    <Typography variant="h6" component="h2" sx={{ mr: 2, mb: { xs: 1, sm: 0 } }}>{guide.title}</Typography>
                    <Box onClick={(event) => event.stopPropagation()}> {/* Prevent accordion collapse when clicking buttons */}
                      <IconButton edge="end" aria-label="edit" onClick={() => navigate(`/admin/guide/edit/${guide.id}`)}>
                        <Edit />
                      </IconButton>
                      <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(guide.id)}>
                        <Delete />
                      </IconButton>
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <div dangerouslySetInnerHTML={{ __html: guide.content }} />
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        ) : (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <AutoStoriesOutlinedIcon sx={{ fontSize: '4rem', color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              등록된 가이드가 없습니다.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              새로운 가이드를 작성하려면 "새 가이드 작성" 버튼을 클릭하세요.
            </Typography>
          </Box>
        )}
      </Paper>
    </>
  );
};

export default AdminGuideListPage;