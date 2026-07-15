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
  Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import MenuIcon from '@mui/icons-material/Menu';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import EditNoteIcon from '@mui/icons-material/EditNote';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import LogoutIcon from '@mui/icons-material/Logout';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ReceiptIcon from '@mui/icons-material/Receipt';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

const NavBar: React.FC = () => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    const role = localStorage.getItem('adminRole');
    const name = localStorage.getItem('adminName');
    setIsAdminLoggedIn(!!token);
    setUserRole(role);
    setUserName(name);
  }, [location]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminSessionExpiresAt');
    localStorage.removeItem('adminRole');
    localStorage.removeItem('adminName');
    setIsAdminLoggedIn(false);
    setUserRole(null);
    setUserName(null);
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
            <ListItem button component={RouterLink} to="/admin/profile">
              <ListItemIcon><AccountCircleIcon /></ListItemIcon>
              <ListItemText
                primary={`${userName}님 (내 정보)`}
                primaryTypographyProps={{ fontWeight: 600, fontSize: '1rem', color: 'primary.main' }}
              />
            </ListItem>
            <Divider sx={{ my: 1 }} />
            <ListItem button component={RouterLink} to="/">
              <ListItemIcon><EditNoteIcon /></ListItemIcon>
              <ListItemText
                primary="업무 기록"
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

            <ListItem button component={RouterLink} to="/admin/schedule">
              <ListItemIcon><CalendarMonthIcon /></ListItemIcon>
              <ListItemText
                primary="스케줄"
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
                primary="거래처"
                primaryTypographyProps={{ fontWeight: 500, fontSize: '1rem' }}
              />
            </ListItem>
            <ListItem button component={RouterLink} to="/admin/quote">
              <ListItemIcon><ReceiptIcon /></ListItemIcon>
              <ListItemText
                primary="간편견적"
                primaryTypographyProps={{ fontWeight: 500, fontSize: '1rem' }}
              />
            </ListItem>
            {userRole === 'admin' && (
              <ListItem button component={RouterLink} to="/admin/staff">
                <ListItemIcon><PeopleIcon /></ListItemIcon>
                <ListItemText
                  primary="멤버"
                  primaryTypographyProps={{ fontWeight: 500, fontSize: '1rem' }}
                />
              </ListItem>
            )}
            <ListItem button component={RouterLink} to="/admin/help">
              <ListItemIcon><HelpOutlineIcon /></ListItemIcon>
              <ListItemText
                primary="시스템 도움말"
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
              primary="로그인"
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
          {isMobile && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{
              flexGrow: 1,
              color: 'inherit',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {/* 세련된 포인트 바 */}
            <Box 
              sx={{ 
                width: 4, 
                height: 20, 
                bgcolor: '#4db6ac', // 차분한 민트 포인트
                borderRadius: 1,
                mr: 1.5,
                boxShadow: '0px 0px 8px rgba(77, 182, 172, 0.4)'
              }} 
            />
            
            <Box 
              component="span" 
              sx={{ 
                fontWeight: 900, 
                letterSpacing: '-0.01em', 
                fontSize: { xs: '1.25rem', sm: '1.45rem' },
                color: '#ffffff',
              }}
            >
              COMTOOIN
            </Box>
            <Box 
              component="span" 
              sx={{ 
                fontWeight: 500, 
                color: 'rgba(255, 255, 255, 0.85)', 
                fontSize: { xs: '1.05rem', sm: '1.15rem' }, 
                ml: 1,
                mt: 0.2 
              }}
            >
              ITSM
            </Box>
            <Box 
              component="span" 
              sx={{ 
                fontWeight: 300, 
                color: 'rgba(255, 255, 255, 0.6)', 
                fontSize: '0.8rem', 
                ml: 0.8, 
                mt: 0.5,
                display: { xs: 'none', md: 'inline' } 
              }}
            >
              (IT Service Management)
            </Box>
          </Typography>
          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {isAdminLoggedIn ? (
                <>
                  <Button color="inherit" component={RouterLink} to="/" sx={{ px: 1.5 }}>업무 기록</Button>
                  <Button color="inherit" component={RouterLink} to="/admin/dashboard" sx={{ px: 1.5 }}>대시보드</Button>

                  <Button color="inherit" component={RouterLink} to="/admin/schedule" sx={{ px: 1.5 }}>스케줄</Button>
                  <Button color="inherit" component={RouterLink} to="/admin/archive" sx={{ px: 1.5 }}>자료실</Button>
                  <Button color="inherit" component={RouterLink} to="/admin/customers" sx={{ px: 1.5 }}>거래처</Button>
                  <Button color="inherit" component={RouterLink} to="/admin/quote" sx={{ px: 1.5 }}>간편견적</Button>
                  {userRole === 'admin' && (
                    <Button color="inherit" component={RouterLink} to="/admin/staff" sx={{ px: 1.5 }}>멤버</Button>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', ml: 1, pl: 1.5, borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
                    <Typography 
                      variant="body2" 
                      component={RouterLink}
                      to="/admin/profile"
                      sx={{ 
                        mr: 1, 
                        fontWeight: 500, 
                        color: 'inherit', 
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' }
                      }}
                    >
                      {userName}님
                    </Typography>
                    <IconButton 
                      color="inherit" 
                      component={RouterLink}
                      to="/admin/help"
                      size="small" 
                      title="도움말"
                      sx={{ mr: 1, bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
                    >
                      <HelpOutlineIcon fontSize="small" />
                    </IconButton>
                    <IconButton 
                      color="inherit" 
                      onClick={handleLogout} 
                      size="small" 
                      title="로그아웃"
                      sx={{ bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
                    >
                      <LogoutIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </>
              ) : (
                <Button color="inherit" component={RouterLink} to="/admin/login">로그인</Button>
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
