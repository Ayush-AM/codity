import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Assignment as JobIcon,
  Layers as QueueIcon,
  Memory as WorkerIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { jobsApi } from '../api/jobs';
import { queuesApi } from '../api/queues';
import { projectsApi } from '../api/projects';
import { workersApi } from '../api/workers';

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

export const SearchDialog: React.FC<SearchDialogProps> = ({ open, onClose }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setDebouncedQuery('');
    }
  }, [open]);

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getProjects(),
    enabled: open,
  });

  const projectId = projects?.[0]?.id;

  const { data: jobsResponse, isLoading: isLoadingJobs } = useQuery({
    queryKey: ['search-jobs', debouncedQuery],
    queryFn: () => jobsApi.getJobs({ search: debouncedQuery.trim() || undefined, limit: 5 }),
    enabled: open && debouncedQuery.length > 0,
  });

  const { data: queues, isLoading: isLoadingQueues } = useQuery({
    queryKey: ['search-queues', projectId],
    queryFn: () => (projectId ? queuesApi.getQueuesByProject(projectId) : []),
    enabled: open && !!projectId,
  });

  const { data: workers } = useQuery({
    queryKey: ['search-workers'],
    queryFn: () => workersApi.getWorkers(),
    enabled: open,
  });

  const filteredQueues = debouncedQuery
    ? queues?.filter((q) => q.name.toLowerCase().includes(debouncedQuery.toLowerCase())) || []
    : [];

  const filteredWorkers = debouncedQuery
    ? workers?.filter((w) => w.hostname.toLowerCase().includes(debouncedQuery.toLowerCase())) || []
    : [];

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '4px',
          boxShadow: 'none',
          bgcolor: '#1B1E24',
          border: '1px solid #37393e',
          overflow: 'hidden',
          position: 'absolute',
          top: '10vh',
          m: 0,
        },
      }}
    >
      <Box sx={{ p: 2.5, borderBottom: '1px solid #37393e', bgcolor: '#181A20' }}>
        <TextField
          fullWidth
          placeholder="Search jobs, queues, workers... (Ctrl+K)"
          variant="standard"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          InputProps={{
            disableUnderline: true,
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#00ffc2', mr: 1.5, fontSize: '1.4rem' }} />
              </InputAdornment>
            ),
            sx: { fontSize: '1.05rem', color: '#ffffff' },
          }}
        />
      </Box>

      <DialogContent sx={{ p: 0, maxHeight: '60vh' }}>
        {debouncedQuery.length === 0 ? (
          <Box sx={{ p: 5, textAlign: 'center', color: '#94A3B8' }}>
            <SearchIcon sx={{ fontSize: 40, color: '#37393e', mb: 1 }} />
            <Typography variant="body2">Type any keyword to search across jobs, queues, or worker nodes...</Typography>
          </Box>
        ) : isLoadingJobs || isLoadingQueues ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress size={26} sx={{ color: '#00ffc2' }} />
          </Box>
        ) : (
          <List sx={{ pt: 0, pb: 1 }}>
            {filteredQueues.length > 0 && (
              <>
                <Box sx={{ px: 2.5, py: 1, bgcolor: '#181A20', borderBottom: '1px solid #37393e' }}>
                  <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Queues
                  </Typography>
                </Box>
                {filteredQueues.slice(0, 4).map((queue) => (
                  <ListItem disablePadding key={queue.id}>
                    <ListItemButton onClick={() => handleNavigate('/queues')} sx={{ px: 2.5, py: 1.2, '&:hover': { bgcolor: 'rgba(0, 255, 194, 0.04)' } }}>
                      <ListItemIcon sx={{ minWidth: 38 }}>
                        <QueueIcon fontSize="small" sx={{ color: '#00ffc2' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={queue.name}
                        secondary={queue.description || `${queue.concurrency_limit} concurrency limit`}
                        primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem', color: '#ffffff', fontFamily: 'var(--font-mono)' }}
                        secondaryTypographyProps={{ noWrap: true, color: '#94A3B8', fontSize: '0.78rem' }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </>
            )}

            {filteredWorkers.length > 0 && (
              <>
                <Box sx={{ px: 2.5, py: 1, bgcolor: '#181A20', borderBottom: '1px solid #37393e' }}>
                  <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Workers
                  </Typography>
                </Box>
                {filteredWorkers.slice(0, 4).map((worker) => (
                  <ListItem disablePadding key={worker.id}>
                    <ListItemButton onClick={() => handleNavigate('/workers')} sx={{ px: 2.5, py: 1.2, '&:hover': { bgcolor: 'rgba(0, 255, 194, 0.04)' } }}>
                      <ListItemIcon sx={{ minWidth: 38 }}>
                        <WorkerIcon fontSize="small" sx={{ color: '#00ffc2' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={worker.hostname}
                        secondary={`PID: ${worker.pid} · Status: ${worker.status}`}
                        primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem', color: '#ffffff', fontFamily: 'var(--font-mono)' }}
                        secondaryTypographyProps={{ noWrap: true, color: '#94A3B8', fontSize: '0.78rem' }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </>
            )}

            {jobsResponse?.items && jobsResponse.items.length > 0 && (
              <>
                <Box sx={{ px: 2.5, py: 1, bgcolor: '#181A20', borderBottom: '1px solid #37393e' }}>
                  <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Jobs
                  </Typography>
                </Box>
                {jobsResponse.items.map((job) => (
                  <ListItem disablePadding key={job.id}>
                    <ListItemButton onClick={() => handleNavigate('/jobs')} sx={{ px: 2.5, py: 1.2, '&:hover': { bgcolor: 'rgba(0, 255, 194, 0.04)' } }}>
                      <ListItemIcon sx={{ minWidth: 38 }}>
                        <JobIcon fontSize="small" sx={{ color: '#00ffc2' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Job ${job.id.slice(0, 8)}…`}
                        secondary={job.payload?.task || JSON.stringify(job.payload)}
                        primaryTypographyProps={{ fontWeight: 600, fontSize: '0.88rem', color: '#ffffff', fontFamily: 'var(--font-mono)' }}
                        secondaryTypographyProps={{ noWrap: true, color: '#94A3B8', fontSize: '0.8rem' }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </>
            )}

            {filteredQueues.length === 0 && filteredWorkers.length === 0 && (!jobsResponse?.items || jobsResponse.items.length === 0) && (
              <Box sx={{ p: 5, textAlign: 'center', color: '#94A3B8' }}>
                <Typography variant="body2">No matching results found for "{debouncedQuery}"</Typography>
              </Box>
            )}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
};
