import React from 'react';
import { Paper, Typography, Box, Chip, LinearProgress, IconButton, Tooltip } from '@mui/material';
import { Memory as MemoryIcon, AccessTime as TimeIcon, Dns as ServerIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';
import { Worker } from '../api/workers';

interface WorkerCardProps {
  worker: Worker;
  onDelete?: (id: string) => void;
}

export const WorkerCard: React.FC<WorkerCardProps> = ({ worker, onDelete }) => {
  const isActive = worker.status === 'active';
  const lastHeartbeat = new Date(worker.last_heartbeat_at);
  const now = new Date();
  const secondsAgo = Math.round((now.getTime() - lastHeartbeat.getTime()) / 1000);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: '4px',
        bgcolor: '#1B1E24',
        border: '1px solid #37393e',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '240px',
        transition: 'all 0.15s ease',
        '&:hover': {
          borderColor: isActive ? '#00ffc2' : '#ff4d4d',
        },
      }}
    >
      {/* Top Square Icon & Status */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '4px',
            bgcolor: isActive ? 'rgba(0, 255, 194, 0.1)' : 'rgba(255, 77, 77, 0.1)',
            border: `1px solid ${isActive ? 'rgba(0, 255, 194, 0.3)' : 'rgba(255, 77, 77, 0.3)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isActive ? '#00ffc2' : '#ff4d4d',
            boxShadow: 'none',
          }}
        >
          <MemoryIcon sx={{ fontSize: '1.3rem' }} />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            size="small"
            label={worker.status.toUpperCase()}
            sx={{
              fontWeight: 700,
              fontSize: '0.68rem',
              height: 22,
              borderRadius: '4px',
              bgcolor: isActive ? 'rgba(0, 255, 194, 0.1)' : 'rgba(255, 77, 77, 0.1)',
              color: isActive ? '#00ffc2' : '#ff4d4d',
              border: `1px solid ${isActive ? 'rgba(0, 255, 194, 0.3)' : 'rgba(255, 77, 77, 0.3)'}`,
            }}
          />
          {onDelete && (
            <Tooltip title="Deregister / Delete worker record">
              <IconButton
                size="small"
                onClick={() => onDelete(worker.id)}
                sx={{ color: '#94A3B8', '&:hover': { color: '#ff4d4d', bgcolor: 'rgba(255, 77, 77, 0.1)' } }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Hostname & PID */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <ServerIcon sx={{ fontSize: '1rem', color: '#94A3B8' }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#ffffff', fontSize: '1.05rem', fontFamily: 'var(--font-mono)' }}>
            {worker.hostname}
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>
          PID: {worker.pid}
        </Typography>
      </Box>

      {/* Workload Indicator */}
      <Box
        sx={{
          p: 1.5,
          bgcolor: '#181A20',
          borderRadius: '4px',
          border: '1px solid #37393e',
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
          <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600 }}>
            In-Flight Tasks
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
            {worker.concurrent_tasks} tasks
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={Math.min(worker.concurrent_tasks * 20, 100)}
          sx={{
            height: 4,
            borderRadius: 0,
            bgcolor: 'rgba(255, 255, 255, 0.06)',
            '& .MuiLinearProgress-bar': { bgcolor: '#00ffc2', borderRadius: 0 },
          }}
        />
      </Box>

      {/* Heartbeat Footer */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, color: '#94A3B8' }}>
          <TimeIcon sx={{ fontSize: '0.9rem' }} />
          <Typography variant="caption">Last Heartbeat</Typography>
        </Box>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: secondsAgo > 15 ? '#ff4d4d' : '#00ffc2',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {secondsAgo < 0 ? '0s ago' : `${secondsAgo}s ago`}
        </Typography>
      </Box>
    </Paper>
  );
};
