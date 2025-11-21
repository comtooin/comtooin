import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Button, Box, Paper, IconButton, CircularProgress, Alert, Divider 
} from '@mui/material';
import { Edit, Delete, ListAlt as ListAltIcon } from '@mui/icons-material';
import axios from 'axios';
import { Helmet } from 'react-helmet-async';
import { Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const API_URL = process.env.NODE_ENV === 'production' ? '' : process.env.REACT_APP_API_URL || 'http://localhost:3001';

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

  const handleChange = (panelId: number) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panelId : false);
  };

  const fetchGuides = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/guide`);
      setGuides(response.data);
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

    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/guide/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGuides(guides.filter(g => g.id !== id));
      alert('가이드가 삭제되었습니다.');
    } catch (err) {
      alert('가이드 삭제 중 오류가 발생했습니다.');
    }
  };

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;

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
      <Paper>
        {guides.length > 0 ? (
          guides.map((guide) => (
            <Accordion
              key={guide.id}
              disableGutters
              expanded={expanded === guide.id}
              onChange={handleChange(guide.id)}
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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 2 }}>
                  <Typography variant="h6">{guide.title}</Typography>
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
          ))
        ) : (
          <Typography sx={{ p: 2 }}>표시할 가이드가 없습니다.</Typography>
        )}
      </Paper>
    </>
  );
};

export default AdminGuideListPage;
