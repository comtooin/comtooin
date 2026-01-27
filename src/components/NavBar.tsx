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
import HomeIcon from '@mui/icons-material/Home';
import ReceiptIcon from '@mui/icons-material/Receipt';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AssessmentIcon from '@mui/icons-material/Assessment';
import EditNoteIcon from '@mui/icons-material/EditNote';
import SettingsIcon from '@mui/icons-material/Settings';
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
  }, [location]); // Re-check on every route change

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAdminLoggedIn(false);
    navigate('/'); // Navigate to home page after logout
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
            <ListItem button component={RouterLink} to="/admin/dashboard">
              <ListItemIcon><DashboardIcon /></ListItemIcon>
              <ListItemText primary="대시보드" />
            </ListItem>
            <ListItem button component={RouterLink} to="/admin/reports">
              <ListItemIcon><AssessmentIcon /></ListItemIcon>
              <ListItemText primary="리포트" />
            </ListItem>
            <ListItem button component={RouterLink} to="/admin/guides">
              <ListItemIcon><EditNoteIcon /></ListItemIcon>
              <ListItemText primary="가이드 수정" />
            </ListItem>

            <ListItem button onClick={handleLogout}>
              <ListItemIcon><LogoutIcon /></ListItemIcon>
              <ListItemText primary="로그아웃" />
            </ListItem>
          </>
        ) : (
          <>
            <ListItem button component={RouterLink} to="/">
              <ListItemIcon><HomeIcon /></ListItemIcon>
              <ListItemText primary="기술지원 요청" />
            </ListItem>
            <ListItem button component={RouterLink} to="/check-request">
              <ListItemIcon><ReceiptIcon /></ListItemIcon>
              <ListItemText primary="내 접수내역 확인" />
            </ListItem>
            <ListItem button component={RouterLink} to="/self-check-guide">
              <ListItemIcon><HelpOutlineIcon /></ListItemIcon>
              <ListItemText primary="빠른 자가 점검 가이드" />
            </ListItem>
            <ListItem button component="a" href="https://367.co.kr" target="_blank" rel="noopener noreferrer">
              <ListItemIcon><SupportAgentIcon /></ListItemIcon>
              <ListItemText primary="원격지원 바로가기" />
            </ListItem>
            <ListItem button component={RouterLink} to="/admin/login">
              <ListItemIcon><AdminPanelSettingsIcon /></ListItemIcon>
              <ListItemText primary="관리자" />
            </ListItem>
          </>
        )}
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component={RouterLink} to="/" sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none' }}>
            COMTOOIN
          </Typography>
          {isMobile ? (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
            >
              <MenuIcon />
            </IconButton>
          ) : (
            <Box>
              {isAdminLoggedIn ? (
                <>
                  <Button color="inherit" component={RouterLink} to="/admin/dashboard">
                    대시보드
                  </Button>
                  <Button color="inherit" component={RouterLink} to="/admin/reports">
                    리포트
                  </Button>
                  <Button color="inherit" component={RouterLink} to="/admin/guides">
                    빠른 자가 점검 가이드 수정
                  </Button>

                  <Button color="inherit" onClick={handleLogout}>
                    로그아웃
                  </Button>
                </>
              ) : (
                <>
                  <Button color="inherit" component={RouterLink} to="/">
                    기술지원 요청
                  </Button>
                  <Button color="inherit" component={RouterLink} to="/check-request">
                    내 접수내역 확인
                  </Button>
                  <Button color="inherit" component={RouterLink} to="/self-check-guide">
                    빠른 자가 점검 가이드
                  </Button>
                  <Button color="inherit" component="a" href="https://367.co.kr" target="_blank" rel="noopener noreferrer">
                    원격지원 바로가기
                  </Button>
                  <Button color="inherit" component={RouterLink} to="/admin/login">
                    관리자
                  </Button>
                </>
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
