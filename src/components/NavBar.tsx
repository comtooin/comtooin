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
              <ListItemText primary="유지보수 업무기록" />
            </ListItem>
            <ListItem button component={RouterLink} to="/admin/dashboard">
              <ListItemIcon><DashboardIcon /></ListItemIcon>
              <ListItemText primary="대시보드" />
            </ListItem>
            <ListItem button component={RouterLink} to="/admin/reports">
              <ListItemIcon><AssessmentIcon /></ListItemIcon>
              <ListItemText primary="리포트" />
            </ListItem>
            <ListItem button component={RouterLink} to="/admin/archive">
              <ListItemIcon><CloudDownloadIcon /></ListItemIcon>
              <ListItemText primary="자료실" />
            </ListItem>
            <ListItem button component={RouterLink} to="/admin/customers">
              <ListItemIcon><BusinessIcon /></ListItemIcon>
              <ListItemText primary="거래처 관리" />
            </ListItem>
            <ListItem button component={RouterLink} to="/admin/schedule">
              <ListItemIcon><AssessmentIcon /></ListItemIcon>
              <ListItemText primary="일정 관리" />
            </ListItem>
            <ListItem button onClick={handleLogout}>
              <ListItemIcon><LogoutIcon /></ListItemIcon>
              <ListItemText primary="로그아웃" />
            </ListItem>
          </>
        ) : (
          <ListItem button component={RouterLink} to="/admin/login">
            <ListItemIcon><AdminPanelSettingsIcon /></ListItemIcon>
            <ListItemText primary="관리자 로그인" />
          </ListItem>
        )}
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component={RouterLink} to="/" sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none', fontWeight: 'bold' }}>
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
            <Box>
              {isAdminLoggedIn ? (
                <>
                  <Button color="inherit" component={RouterLink} to="/">유지보수 업무기록</Button>
                  <Button color="inherit" component={RouterLink} to="/admin/dashboard">대시보드</Button>
                  <Button color="inherit" component={RouterLink} to="/admin/reports">리포트</Button>
                  <Button color="inherit" component={RouterLink} to="/admin/archive">자료실</Button>
                  <Button color="inherit" component={RouterLink} to="/admin/customers">거래처 관리</Button>
                  <Button color="inherit" component={RouterLink} to="/admin/schedule">일정 관리</Button>
                  <Button color="inherit" onClick={handleLogout}>로그아웃</Button>
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
