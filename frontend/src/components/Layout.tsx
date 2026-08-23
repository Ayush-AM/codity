import React, { useState } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Chip,
  Avatar,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  ListAlt as JobsIcon,
  Layers as QueuesIcon,
  Memory as WorkersIcon,
  Dangerous as DlqIcon,
  Logout as LogoutIcon,
  Search as SearchIcon,
  Notifications as NotificationIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { NotificationsPopover } from './NotificationsPopover';
import { GlobalSearch } from './GlobalSearch';

const DRAWER_WIDTH = 272;

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon />, badge: null },
  { label: 'Jobs Explorer', path: '/jobs', icon: <JobsIcon />, badge: null },
  { label: 'Queues', path: '/queues', icon: <QueuesIcon />, badge: null },
  { label: 'Workers', path: '/workers', icon: <WorkersIcon />, badge: null },
  { label: 'Dead Letter Queue', path: '/dlq', icon: <DlqIcon />, badge: 'DLQ' },
];

export const Layout: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);
  const [notificationCount, setNotificationCount] = useState(0);

  // Removed search shortcut since GlobalSearch has it built-in or handles its own focus

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
  const handleLogout = () => { handleMenuClose(); logout(); };

  const drawerContent = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#181A20',
        p: 2.5,
        color: 'text.primary',
        borderRight: '1px solid #37393e',
      }}
    >
      {/* ── Brand Header ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          mb: 4,
          px: 1,
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: 800,
            fontSize: '1.2rem',
            letterSpacing: '-0.02em',
            color: '#ffffff',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Codity
        </Typography>
      </Box>

      {/* ── Navigation Links ── */}
      <List sx={{ px: 0, py: 0, flexGrow: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <ListItem
              key={item.path}
              disablePadding
              sx={{
                mb: 0.8,
              }}
            >
              <ListItemButton
                onClick={() => { navigate(item.path); if (isMobile) setMobileOpen(false); }}
                sx={{
                  borderRadius: '4px',
                  py: 1.2,
                  px: 2,
                  bgcolor: isActive ? 'rgba(0, 255, 194, 0.08)' : 'transparent',
                  color: isActive ? '#00ffc2' : '#94A3B8',
                  borderLeft: isActive ? '3px solid #00ffc2' : '3px solid transparent',
                  boxShadow: 'none',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    bgcolor: isActive ? 'rgba(0, 255, 194, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                    color: isActive ? '#00ffc2' : '#ffffff',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 34,
                    color: isActive ? '#00ffc2' : '#94A3B8',
                    transition: 'color 0.15s ease',
                    '& .MuiSvgIcon-root': { fontSize: '1.2rem' },
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '0.85rem',
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                />
                {item.badge && (
                  <Chip
                    size="small"
                    label={item.badge}
                    sx={{
                      height: 18,
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      borderRadius: '4px',
                      bgcolor: 'rgba(255, 77, 77, 0.15)',
                      color: '#ff4d4d',
                      border: '1px solid rgba(255, 77, 77, 0.3)',
                      ml: 1,
                      flexShrink: 0,
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* ── Minimal Bottom User Profile & Logout ── */}
      <Box sx={{ mt: 'auto', pt: 2, borderTop: '1px solid #37393e' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 1.2,
            borderRadius: '4px',
            bgcolor: '#181A20',
            border: '1px solid #37393e',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            <Avatar
              sx={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                bgcolor: '#22262F',
                border: '1px solid #37393e',
                color: '#94A3B8',
              }}
            >
              <PersonIcon sx={{ fontSize: '1.2rem' }} />
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 700, fontSize: '0.82rem', color: '#ffffff' }}>
                {user?.full_name || 'Ayush Mahajan'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.68rem', display: 'block' }}>
                {user?.role?.toUpperCase() || 'ADMIN'}
              </Typography>
            </Box>
          </Box>

          <Tooltip title="Logout">
            <IconButton
              size="small"
              onClick={handleLogout}
              sx={{
                color: '#94A3B8',
                borderRadius: '4px',
                '&:hover': { color: '#ff4d4d', bgcolor: 'rgba(255, 77, 77, 0.1)' },
              }}
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#111317' }}>
      <CssBaseline />

      {/* ── Top AppBar ── */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          bgcolor: 'rgba(17, 19, 23, 0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid #37393e',
          color: 'text.primary',
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', minHeight: '64px !important', px: { xs: 2, md: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 1, display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>

            <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
              <GlobalSearch />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Tooltip title="Notifications">
              <IconButton
                onClick={(e) => setNotifAnchorEl(e.currentTarget)}
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: '4px',
                  bgcolor: '#181A20',
                  border: '1px solid #37393e',
                  color: '#94A3B8',
                  '&:hover': { borderColor: '#00ffc2', color: '#00ffc2' },
                }}
              >
                <Badge
                  badgeContent={notificationCount > 0 ? notificationCount : undefined}
                  color="error"
                  variant={notificationCount > 0 ? 'standard' : 'dot'}
                  invisible={notificationCount === 0}
                  sx={{
                    '& .MuiBadge-badge': {
                      bgcolor: '#ff4d4d',
                      color: '#fff',
                      fontSize: '0.65rem',
                      height: 16,
                      minWidth: 16,
                    },
                  }}
                >
                  <NotificationIcon fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* ── Sidebar Drawer ── */}
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH, border: 'none', bgcolor: '#181A20' },
          }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              border: 'none',
              bgcolor: '#181A20',
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* ── Main Content ── */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3, md: 4 },
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: '64px',
          animation: 'fade-in 0.5s ease both',
        }}
      >
        <Outlet />
      </Box>

      <NotificationsPopover 
        anchorEl={notifAnchorEl} 
        onClose={() => setNotifAnchorEl(null)} 
        setNotificationCount={setNotificationCount} 
      />
    </Box>
  );
};
