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
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import LogoutIcon from '@mui/icons-material/Logout';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ReceiptIcon from '@mui/icons-material/Receipt';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ForumIcon from '@mui/icons-material/Forum';
import AdminProfilePage from '../pages/AdminProfilePage';
import AdminHelpPage from '../pages/AdminHelpPage';
import OneSignal from 'react-onesignal';
import { supabase } from '../api';

const NavBar: React.FC = () => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('adminToken');
    const role = sessionStorage.getItem('adminRole');
    const name = sessionStorage.getItem('adminName');
    const custId = sessionStorage.getItem('adminCustomerId');
    setIsAdminLoggedIn(!!token);
    setUserRole(role);
    setUserName(name);
    setCustomerId(custId);
  }, [location]);

  const handleLogout = async () => {
    try {
      const role = sessionStorage.getItem('adminRole') || userRole;
      const pushId = OneSignal?.User?.PushSubscription?.id;
      
      if (pushId) {
        if (role === 'customer') {
          const customerId = sessionStorage.getItem('adminCustomerId');
          if (customerId) {
            await supabase
              .from('customers')
              .update({ onesignal_id: null })
              .eq('id', customerId);
            console.log('Successfully cleared OneSignal push ID for customer on logout');
          }
        } else {
          const staffId = sessionStorage.getItem('adminStaffId');
          if (staffId) {
            await supabase
              .from('staff')
              .update({ onesignal_id: null })
              .eq('id', staffId);
            console.log('Successfully cleared OneSignal push ID for staff on logout');
          }
        }
      }
    } catch (pushClearErr) {
      console.error('Error clearing OneSignal push ID on logout:', pushClearErr);
    }

    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminSessionExpiresAt');
    sessionStorage.removeItem('adminRole');
    sessionStorage.removeItem('adminName');
    sessionStorage.removeItem('adminCustomerId');
    sessionStorage.removeItem('adminStaffId');
    setIsAdminLoggedIn(false);
    setUserRole(null);
    setUserName(null);
    navigate('/admin/login');
  };

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  // 사이드바 메뉴 스타일 헬퍼
  const getMenuItemStyle = (selected: boolean) => ({
    borderRadius: 2,
    mb: 0.5,
    color: selected ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
    bgcolor: selected ? 'rgba(77, 182, 172, 0.25)' : 'transparent',
    borderLeft: selected ? '4px solid #4db6ac' : '4px solid transparent',
    pl: selected ? '12px' : '16px',
    transition: 'all 0.2s',
    '&:hover': {
      bgcolor: selected ? 'rgba(77, 182, 172, 0.3)' : 'rgba(255, 255, 255, 0.05)',
      color: '#ffffff',
      '& .MuiListItemIcon-root': {
        color: '#ffffff'
      }
    },
    '& .MuiListItemIcon-root': {
      color: selected ? '#4db6ac' : 'rgba(255, 255, 255, 0.6)',
      transition: 'color 0.2s'
    }
  });

  // 모바일 사이드바 서랍(Drawer) 내부 구성
  const drawer = (
    <Box
      sx={{ 
        width: 250, 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        bgcolor: '#1e293b', 
        color: '#f8fafc' 
      }}
      role="presentation"
      onClick={handleDrawerToggle}
      onKeyDown={handleDrawerToggle}
    >
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Box sx={{ width: 4, height: 18, bgcolor: '#4db6ac', borderRadius: 1, mr: 1.5 }} />
        <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.02em', color: 'inherit' }}>
          COMTOOIN <Box component="span" sx={{ fontWeight: 400, color: 'rgba(255, 255, 255, 0.7)' }}>ITSM</Box>
        </Typography>
      </Box>

      <Box sx={{ flexGrow: 1, py: 2, px: 1.5, overflowY: 'auto' }}>
        <List>
          {isAdminLoggedIn ? (
            <>
              <ListItem button onClick={() => { setProfileOpen(true); setDrawerOpen(false); }} sx={{ borderRadius: 2, mb: 1, bgcolor: 'rgba(255,255,255,0.03)' }}>
                <ListItemIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }}><AccountCircleIcon /></ListItemIcon>
                <ListItemText
                  primary={`${userName}님`}
                  secondary="내 정보"
                  primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem', color: '#ffffff' }}
                  secondaryTypographyProps={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}
                />
              </ListItem>
              <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.08)' }} />
              {userRole === 'customer' ? (
                <>
                  <ListItem 
                    button 
                    component={RouterLink} 
                    to="/admin/dashboard"
                    selected={location.pathname === '/admin/dashboard'}
                    sx={getMenuItemStyle(location.pathname === '/admin/dashboard')}
                    onClick={(e) => {
                      if (location.pathname === '/admin/dashboard') {
                        e.preventDefault();
                        window.location.reload();
                      }
                    }}
                  >
                    <ListItemIcon><DashboardIcon /></ListItemIcon>
                    <ListItemText primary="대시보드" primaryTypographyProps={{ fontWeight: 500 }} />
                  </ListItem>
                  {customerId && (
                    <ListItem 
                      button 
                      component={RouterLink} 
                      to={`/admin/customers/${customerId}/inventory`}
                      selected={location.pathname.includes('/inventory')}
                      sx={getMenuItemStyle(location.pathname.includes('/inventory'))}
                    >
                      <ListItemIcon><BusinessIcon /></ListItemIcon>
                      <ListItemText primary="자산관리" primaryTypographyProps={{ fontWeight: 500 }} />
                    </ListItem>
                  )}
                  <ListItem 
                    button 
                    component={RouterLink} 
                    to="/admin/messenger"
                    selected={location.pathname === '/admin/messenger'}
                    sx={getMenuItemStyle(location.pathname === '/admin/messenger')}
                  >
                    <ListItemIcon><ForumIcon /></ListItemIcon>
                    <ListItemText primary="메신저" primaryTypographyProps={{ fontWeight: 500 }} />
                  </ListItem>
                </>
              ) : (
                <>

                  <ListItem 
                    button 
                    component={RouterLink} 
                    to="/admin/dashboard"
                    selected={location.pathname === '/admin/dashboard'}
                    sx={getMenuItemStyle(location.pathname === '/admin/dashboard')}
                    onClick={(e) => {
                      if (location.pathname === '/admin/dashboard') {
                        e.preventDefault();
                        window.location.reload();
                      }
                    }}
                  >
                    <ListItemIcon><DashboardIcon /></ListItemIcon>
                    <ListItemText primary="대시보드" primaryTypographyProps={{ fontWeight: 500 }} />
                  </ListItem>
                  <ListItem 
                    button 
                    component={RouterLink} 
                    to="/admin/schedule"
                    selected={location.pathname === '/admin/schedule'}
                    sx={getMenuItemStyle(location.pathname === '/admin/schedule')}
                  >
                    <ListItemIcon><CalendarMonthIcon /></ListItemIcon>
                    <ListItemText primary="스케줄" primaryTypographyProps={{ fontWeight: 500 }} />
                  </ListItem>
                  <ListItem 
                    button 
                    component={RouterLink} 
                    to="/admin/customers"
                    selected={location.pathname.startsWith('/admin/customers')}
                    sx={getMenuItemStyle(location.pathname.startsWith('/admin/customers'))}
                  >
                    <ListItemIcon><BusinessIcon /></ListItemIcon>
                    <ListItemText primary="거래처" primaryTypographyProps={{ fontWeight: 500 }} />
                  </ListItem>
                  <ListItem 
                    button 
                    component={RouterLink} 
                    to="/admin/quote"
                    selected={location.pathname === '/admin/quote'}
                    sx={getMenuItemStyle(location.pathname === '/admin/quote')}
                  >
                    <ListItemIcon><ReceiptIcon /></ListItemIcon>
                    <ListItemText primary="간편견적" primaryTypographyProps={{ fontWeight: 500 }} />
                  </ListItem>
                  <ListItem 
                    button 
                    component={RouterLink} 
                    to="/admin/archive"
                    selected={location.pathname === '/admin/archive'}
                    sx={getMenuItemStyle(location.pathname === '/admin/archive')}
                  >
                    <ListItemIcon><CloudDownloadIcon /></ListItemIcon>
                    <ListItemText primary="자료실" primaryTypographyProps={{ fontWeight: 500 }} />
                  </ListItem>
                  <ListItem 
                    button 
                    component={RouterLink} 
                    to="/admin/messenger"
                    selected={location.pathname === '/admin/messenger'}
                    sx={getMenuItemStyle(location.pathname === '/admin/messenger')}
                  >
                    <ListItemIcon><ForumIcon /></ListItemIcon>
                    <ListItemText primary="메신저" primaryTypographyProps={{ fontWeight: 500 }} />
                  </ListItem>
                  {userRole === 'admin' && (
                    <ListItem 
                      button 
                      component={RouterLink} 
                      to="/admin/staff"
                      selected={location.pathname === '/admin/staff'}
                      sx={getMenuItemStyle(location.pathname === '/admin/staff')}
                    >
                      <ListItemIcon><PeopleIcon /></ListItemIcon>
                      <ListItemText primary="멤버" primaryTypographyProps={{ fontWeight: 500 }} />
                    </ListItem>
                  )}
                </>
              )}
            </>
          ) : (
            <ListItem button component={RouterLink} to="/admin/login" sx={getMenuItemStyle(location.pathname === '/admin/login')}>
              <ListItemIcon><AdminPanelSettingsIcon /></ListItemIcon>
              <ListItemText primary="로그인" primaryTypographyProps={{ fontWeight: 500 }} />
            </ListItem>
          )}
        </List>
      </Box>

      {isAdminLoggedIn && (
        <Box sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <ListItem button onClick={() => { setHelpOpen(true); setDrawerOpen(false); }} sx={{ borderRadius: 2, mb: 1, color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#ffffff' } }}>
            <ListItemIcon sx={{ color: 'inherit', minWidth: 35 }}><HelpOutlineIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="도움말" primaryTypographyProps={{ fontSize: '0.85rem' }} />
          </ListItem>
          <ListItem button onClick={handleLogout} sx={{ borderRadius: 2, color: 'rgba(244,63,94,0.8)', '&:hover': { color: '#fda4af' } }}>
            <ListItemIcon sx={{ color: 'inherit', minWidth: 35 }}><LogoutIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="로그아웃" primaryTypographyProps={{ fontSize: '0.85rem' }} />
          </ListItem>
        </Box>
      )}
    </Box>
  );

  // 1. 모바일 화면일 때 (Top Header + Drawer)
  if (isMobile) {
    return (
      <>
        <AppBar position="static" sx={{ bgcolor: '#1e293b' }}>
          <Toolbar>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
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
              <Box sx={{ width: 4, height: 18, bgcolor: '#4db6ac', borderRadius: 1, mr: 1 }} />
              <Box component="span" sx={{ fontWeight: 900, fontSize: '1.15rem' }}>COMTOOIN</Box>
              <Box component="span" sx={{ fontWeight: 400, color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', ml: 0.5 }}>ITSM</Box>
            </Typography>
            {isAdminLoggedIn && (
              <IconButton
                color="inherit"
                component={RouterLink}
                to="/admin/messenger"
                sx={{
                  color: location.pathname === '/admin/messenger' ? '#4db6ac' : 'inherit',
                  transition: 'color 0.2s ease',
                  '&:hover': {
                    color: '#4db6ac',
                  },
                }}
              >
                <ForumIcon />
              </IconButton>
            )}
          </Toolbar>
        </AppBar>
        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={handleDrawerToggle}
          PaperProps={{ sx: { border: 'none' } }}
        >
          {drawer}
        </Drawer>
        {profileOpen && <AdminProfilePage isDialog onClose={() => setProfileOpen(false)} />}
        {helpOpen && <AdminHelpPage isDialog onClose={() => setHelpOpen(false)} />}
      </>
    );
  }

  // 2. 데스크톱 화면일 때 (Sleek 좌측 고정 사이드바)
  return (
    <>
      <Box 
        sx={{ 
          width: 250, 
          minWidth: 250,
          bgcolor: '#1e293b', 
          color: '#f8fafc',
          display: 'flex', 
          flexDirection: 'column', 
          height: '100vh', 
          position: 'sticky', 
          top: 0,
          boxShadow: '4px 0 10px rgba(0, 0, 0, 0.05)',
          zIndex: 1100
        }}
      >
        {/* 브랜딩 헤더 */}
        <Box sx={{ p: 3, display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Box 
            sx={{ 
              width: 4, 
              height: 20, 
              bgcolor: '#4db6ac', 
              borderRadius: 1,
              mr: 1.5,
              boxShadow: '0px 0px 8px rgba(77, 182, 172, 0.8)'
            }} 
          />
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{
              color: 'inherit',
              textDecoration: 'none',
              fontWeight: 900,
              fontSize: '1.2rem',
              letterSpacing: '0.02em',
            }}
          >
            COMTOOIN <Box component="span" sx={{ fontWeight: 400, color: 'rgba(255, 255, 255, 0.7)' }}>ITSM</Box>
          </Typography>
        </Box>

        {/* 내비게이션 리스트 */}
        <Box sx={{ flexGrow: 1, py: 2, overflowY: 'auto', px: 2 }}>
          {isAdminLoggedIn ? (
            <List sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {userRole === 'customer' ? (
                <>
                  <ListItem 
                    button 
                    component={RouterLink} 
                    to="/admin/dashboard"
                    selected={location.pathname === '/admin/dashboard'}
                    sx={getMenuItemStyle(location.pathname === '/admin/dashboard')}
                    onClick={(e) => {
                      if (location.pathname === '/admin/dashboard') {
                        e.preventDefault();
                        window.location.reload();
                      }
                    }}
                  >
                    <ListItemIcon><DashboardIcon /></ListItemIcon>
                    <ListItemText primary="대시보드" primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }} />
                  </ListItem>
                  {customerId && (
                    <ListItem 
                      button 
                      component={RouterLink} 
                      to={`/admin/customers/${customerId}/inventory`}
                      selected={location.pathname.includes('/inventory')}
                      sx={getMenuItemStyle(location.pathname.includes('/inventory'))}
                    >
                      <ListItemIcon><BusinessIcon /></ListItemIcon>
                      <ListItemText primary="자산관리" primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }} />
                    </ListItem>
                  )}
                  <ListItem 
                    button 
                    component={RouterLink} 
                    to="/admin/messenger"
                    selected={location.pathname === '/admin/messenger'}
                    sx={getMenuItemStyle(location.pathname === '/admin/messenger')}
                  >
                    <ListItemIcon><ForumIcon /></ListItemIcon>
                    <ListItemText primary="메신저" primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }} />
                  </ListItem>
                </>
              ) : (
                <>

                  <ListItem 
                    button 
                    component={RouterLink} 
                    to="/admin/dashboard"
                    selected={location.pathname === '/admin/dashboard'}
                    sx={getMenuItemStyle(location.pathname === '/admin/dashboard')}
                    onClick={(e) => {
                      if (location.pathname === '/admin/dashboard') {
                        e.preventDefault();
                        window.location.reload();
                      }
                    }}
                  >
                    <ListItemIcon><DashboardIcon /></ListItemIcon>
                    <ListItemText primary="대시보드" primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }} />
                  </ListItem>
                  <ListItem 
                    button 
                    component={RouterLink} 
                    to="/admin/schedule"
                    selected={location.pathname === '/admin/schedule'}
                    sx={getMenuItemStyle(location.pathname === '/admin/schedule')}
                  >
                    <ListItemIcon><CalendarMonthIcon /></ListItemIcon>
                    <ListItemText primary="스케줄" primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }} />
                  </ListItem>
                  <ListItem 
                    button 
                    component={RouterLink} 
                    to="/admin/customers"
                    selected={location.pathname.startsWith('/admin/customers')}
                    sx={getMenuItemStyle(location.pathname.startsWith('/admin/customers'))}
                  >
                    <ListItemIcon><BusinessIcon /></ListItemIcon>
                    <ListItemText primary="거래처" primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }} />
                  </ListItem>
                  <ListItem 
                    button 
                    component={RouterLink} 
                    to="/admin/quote"
                    selected={location.pathname === '/admin/quote'}
                    sx={getMenuItemStyle(location.pathname === '/admin/quote')}
                  >
                    <ListItemIcon><ReceiptIcon /></ListItemIcon>
                    <ListItemText primary="간편견적" primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }} />
                  </ListItem>
                  <ListItem 
                    button 
                    component={RouterLink} 
                    to="/admin/archive"
                    selected={location.pathname === '/admin/archive'}
                    sx={getMenuItemStyle(location.pathname === '/admin/archive')}
                  >
                    <ListItemIcon><CloudDownloadIcon /></ListItemIcon>
                    <ListItemText primary="자료실" primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }} />
                  </ListItem>
                  <ListItem 
                    button 
                    component={RouterLink} 
                    to="/admin/messenger"
                    selected={location.pathname === '/admin/messenger'}
                    sx={getMenuItemStyle(location.pathname === '/admin/messenger')}
                  >
                    <ListItemIcon><ForumIcon /></ListItemIcon>
                    <ListItemText primary="메신저" primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }} />
                  </ListItem>
                  {userRole === 'admin' && (
                    <ListItem 
                      button 
                      component={RouterLink} 
                      to="/admin/staff"
                      selected={location.pathname === '/admin/staff'}
                      sx={getMenuItemStyle(location.pathname === '/admin/staff')}
                    >
                      <ListItemIcon><PeopleIcon /></ListItemIcon>
                      <ListItemText primary="멤버" primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }} />
                    </ListItem>
                  )}
                </>
              )}
            </List>
          ) : (
            <List>
              <ListItem 
                button 
                component={RouterLink} 
                to="/admin/login"
                selected={location.pathname === '/admin/login'}
                sx={getMenuItemStyle(location.pathname === '/admin/login')}
              >
                <ListItemIcon><AdminPanelSettingsIcon /></ListItemIcon>
                <ListItemText primary="로그인" primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }} />
              </ListItem>
            </List>
          )}
        </Box>

        {/* 내 정보 및 로그아웃 푸터 */}
        {isAdminLoggedIn && (
          <Box sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <ListItem 
              button 
              onClick={() => setProfileOpen(true)}
              sx={{ 
                borderRadius: 2, 
                mb: 1,
                color: 'rgba(255, 255, 255, 0.85)',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)', color: '#ffffff' }
              }}
            >
              <ListItemIcon sx={{ color: 'rgba(255, 255, 255, 0.6)', minWidth: 32 }}><AccountCircleIcon /></ListItemIcon>
              <ListItemText 
                primary={userName} 
                secondary="내 정보" 
                primaryTypographyProps={{ fontWeight: 600, fontSize: '0.85rem' }} 
                secondaryTypographyProps={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}
              />
            </ListItem>
            <Box sx={{ display: 'flex', gap: 1, px: 1 }}>
              <Button
                variant="text"
                size="small"
                startIcon={<HelpOutlineIcon sx={{ fontSize: 14 }} />}
                onClick={() => setHelpOpen(true)}
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.6)', 
                  fontSize: '0.75rem',
                  py: 0.5,
                  px: 1,
                  minWidth: 0,
                  flexGrow: 1,
                  '&:hover': { color: '#ffffff', bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                도움말
              </Button>
              <Button
                variant="text"
                size="small"
                startIcon={<LogoutIcon sx={{ fontSize: 14 }} />}
                onClick={handleLogout}
                sx={{ 
                  color: 'rgba(244, 63, 94, 0.8)', 
                  fontSize: '0.75rem',
                  py: 0.5,
                  px: 1,
                  minWidth: 0,
                  flexGrow: 1,
                  '&:hover': { color: '#fda4af', bgcolor: 'rgba(244,63,94,0.05)' }
                }}
              >
                로그아웃
              </Button>
            </Box>
          </Box>
        )}
      </Box>

      {profileOpen && <AdminProfilePage isDialog onClose={() => setProfileOpen(false)} />}
      {helpOpen && <AdminHelpPage isDialog onClose={() => setHelpOpen(false)} />}
    </>
  );
};

export default NavBar;
