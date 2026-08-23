import React from 'react';
import {
  Popover,
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
  Chip,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Dangerous as ErrorIcon,
  NotificationsOff as EmptyIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dlqApi } from '../api/dlq';
import { metricsApi } from '../api/metrics';
import { workersApi } from '../api/workers';

interface NotificationsPopoverProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  setNotificationCount: (count: number) => void;
}

export const NotificationsPopover: React.FC<NotificationsPopoverProps> = ({ anchorEl, onClose, setNotificationCount }) => {
  const navigate = useNavigate();
  const open = Boolean(anchorEl);

  const { data: dlqEntries } = useQuery({
    queryKey: ['notif-dlq'],
    queryFn: () => dlqApi.getDlqEntries(),
    refetchInterval: 10000,
  });

  const { data: metrics } = useQuery({
    queryKey: ['notif-metrics'],
    queryFn: () => metricsApi.getSystemMetrics(),
    refetchInterval: 10000,
  });

  const { data: workers } = useQuery({
    queryKey: ['notif-workers'],
    queryFn: () => workersApi.getWorkers(),
    refetchInterval: 10000,
  });

  const notifications = [];

  if (dlqEntries && dlqEntries.length > 0) {
    notifications.push({
      id: 'dlq',
      type: 'error',
      title: 'Dead Letter Queue',
      message: `${dlqEntries.length} jobs have failed permanently.`,
      onClick: () => { navigate('/dlq'); onClose(); },
      icon: <ErrorIcon sx={{ color: '#f43f5e' }} />,
    });
  }

  if (metrics && metrics.overall_failure_rate_24h > 10) {
    notifications.push({
      id: 'failure-rate',
      type: 'warning',
      title: 'High Failure Rate',
      message: `24h failure rate is currently at ${metrics.overall_failure_rate_24h.toFixed(1)}%.`,
      onClick: () => { navigate('/dashboard'); onClose(); },
      icon: <WarningIcon sx={{ color: '#f59e0b' }} />,
    });
  }

  const deadWorkers = workers?.filter((w) => w.status === 'dead') || [];
  if (deadWorkers.length > 0) {
    notifications.push({
      id: 'dead-workers',
      type: 'error',
      title: 'Worker Nodes Offline',
      message: `${deadWorkers.length} worker(s) stopped sending heartbeats.`,
      onClick: () => { navigate('/workers'); onClose(); },
      icon: <ErrorIcon sx={{ color: '#f43f5e' }} />,
    });
  }

  React.useEffect(() => {
    setNotificationCount(notifications.length);
  }, [notifications.length, setNotificationCount]);

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      PaperProps={{
        sx: {
          mt: 1.5,
          width: 360,
          borderRadius: '4px',
          boxShadow: 'none',
          border: '1px solid #37393e',
          bgcolor: '#1B1E24',
          overflow: 'hidden',
        },
      }}
    >
      <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #37393e' }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#ffffff' }}>
          System Notifications
        </Typography>
        {notifications.length > 0 && (
          <Chip
            size="small"
            label={`${notifications.length} New`}
            sx={{
              height: 22,
              fontSize: '0.7rem',
              fontWeight: 700,
              borderRadius: '4px',
              bgcolor: 'rgba(0, 255, 194, 0.1)',
              color: '#00ffc2',
              border: '1px solid rgba(0, 255, 194, 0.3)',
              fontFamily: 'var(--font-mono)',
            }}
          />
        )}
      </Box>

      {notifications.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center', color: '#94A3B8' }}>
          <EmptyIcon sx={{ fontSize: 40, color: '#37393e', mb: 1 }} />
          <Typography variant="body2" fontWeight={600} sx={{ color: '#ffffff' }}>
            All systems operational
          </Typography>
          <Typography variant="caption" sx={{ color: '#94A3B8' }}>
            No warning alerts or dead letters.
          </Typography>
        </Box>
      ) : (
        <List sx={{ p: 0 }}>
          {notifications.map((notif, index) => (
            <React.Fragment key={notif.id}>
              {index > 0 && <Divider sx={{ borderColor: '#37393e' }} />}
              <ListItem disablePadding>
                <ListItemButton onClick={notif.onClick} sx={{ p: 2, alignItems: 'flex-start', '&:hover': { bgcolor: 'rgba(0, 255, 194, 0.04)' } }}>
                  <ListItemIcon sx={{ minWidth: 38, mt: 0.5 }}>{notif.icon}</ListItemIcon>
                  <ListItemText
                    primary={notif.title}
                    secondary={notif.message}
                    primaryTypographyProps={{ variant: 'subtitle2', fontWeight: 600, color: '#ffffff' }}
                    secondaryTypographyProps={{ variant: 'caption', color: '#94A3B8', display: 'block', mt: 0.5 }}
                  />
                </ListItemButton>
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      )}

      {notifications.length > 0 && (
        <Box sx={{ p: 1.5, borderTop: '1px solid #37393e' }}>
          <Button
            fullWidth
            size="small"
            sx={{ textTransform: 'none', fontWeight: 600, color: '#94A3B8', '&:hover': { color: '#00ffc2' } }}
            onClick={onClose}
          >
            Dismiss All
          </Button>
        </Box>
      )}
    </Popover>
  );
};
