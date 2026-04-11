import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  useMediaQuery,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import MenuIcon from '@mui/icons-material/Menu';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import EditNoteIcon from '@mui/icons-material/EditNote';
import BusinessIcon from '@mui/icons-material/Business';
import LogoutIcon from '@mui/icons-material/Logout';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';

const NavBar: React.FC = () => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    setIsAdminLoggedIn(!!token);
  }, [location]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAdminLoggedIn(false);
    navigate('/admin/login');
  };

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const drawer = (
    <Box
      sx={{ width: 250 }}
      role="presentation"
      onClick={handleDrawerToggle}
      onKeyDown={handleDrawerToggle}
    >
      <List>
        {isAdminLoggedIn ? (
          <>
            <ListItem button component={RouterLink} to="/">
              <ListItemIcon><EditNoteIcon /></ListItemIcon>
              <ListItemText
                primary="유지보수 업무기록"
                primaryTypographyProps={{ fontWeight: 500, fontSize: '1rem' }}
              />
            </ListItem>
            <ListItem button component={RouterLink} to="/admin/dashboard">
              <ListItemIcon><DashboardIcon /></ListItemIcon>
              <ListItemText
                primary="대시보드"
                primaryTypographyProps={{ fontWeight: 500, fontSize: '1rem' }}
              />
            </ListItem>
            <ListItem button component={RouterLink} to="/admin/reports">
              <ListItemIcon><AssessmentIcon /></ListItemIcon>
              <ListItemText
                primary="리포트"
                primaryTypographyProps={{ fontWeight: 500, fontSize: '1rem' }}
              />
            </ListItem>
            <ListItem button component={RouterLink} to="/admin/archive">
              <ListItemIcon><CloudDownloadIcon /></ListItemIcon>
              <ListItemText
                primary="자료실"
                primaryTypographyProps={{ fontWeight: 500, fontSize: '1rem' }}
              />
            </ListItem>
            <ListItem button component={RouterLink} to="/admin/customers">
              <ListItemIcon><BusinessIcon /></ListItemIcon>
              <ListItemText
                primary="거래처 관리"
                primaryTypographyProps={{ fontWeight: 500, fontSize: '1rem' }}
              />
            </ListItem>
            <ListItem button component={RouterLink} to="/admin/schedule">
              <ListItemIcon><CalendarMonthIcon /></ListItemIcon>
              <ListItemText
                primary="일정 관리"
                primaryTypographyProps={{ fontWeight: 500, fontSize: '1rem' }}
              />
            </ListItem>
            <ListItem button onClick={handleLogout}>
              <ListItemIcon><LogoutIcon /></ListItemIcon>
              <ListItemText
                primary="로그아웃"
                primaryTypographyProps={{ fontWeight: 500, fontSize: '1rem' }}
              />
            </ListItem>
          </>
        ) : (
          <ListItem button component={RouterLink} to="/admin/login">
            <ListItemIcon><AdminPanelSettingsIcon /></ListItemIcon>
            <ListItemText
              primary="관리자 로그인"
              primaryTypographyProps={{ fontWeight: 500, fontSize: '1rem' }}
            />
          </ListItem>
        )}
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{
              flexGrow: 1,
              color: 'inherit',
              textDecoration: 'none',
              fontWeight: 800,
              letterSpacing: '0.5px',
              fontSize: { xs: '1.2rem', sm: '1.4rem' }
            }}
          >
            COMTOOIN
          </Typography>
          {isMobile ? (
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
            >
              <MenuIcon />
            </IconButton>
          ) : (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {isAdminLoggedIn ? (
                <>
                  <Button color="inherit" component={RouterLink} to="/" sx={{ px: 1.5 }}>유지보수 업무기록</Button>
                  <Button color="inherit" component={RouterLink} to="/admin/dashboard" sx={{ px: 1.5 }}>대시보드</Button>
                  <Button color="inherit" component={RouterLink} to="/admin/reports" sx={{ px: 1.5 }}>리포트</Button>
                  <Button color="inherit" component={RouterLink} to="/admin/archive" sx={{ px: 1.5 }}>자료실</Button>
                  <Button color="inherit" component={RouterLink} to="/admin/customers" sx={{ px: 1.5 }}>거래처 관리</Button>
                  <Button color="inherit" component={RouterLink} to="/admin/schedule" sx={{ px: 1.5 }}>일정 관리</Button>
                  <Button color="inherit" onClick={handleLogout} sx={{ px: 1.5, ml: 1, bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>로그아웃</Button>
                </>
              ) : (
                <Button color="inherit" component={RouterLink} to="/admin/login">관리자 로그인</Button>
              )}
            </Box>
          )}
        </Toolbar>
      </AppBar>
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={handleDrawerToggle}
      >
        {drawer}
      </Drawer>
    </>
  );
};

export default NavBar;
