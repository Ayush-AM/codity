import React, { useState, useEffect, useRef } from 'react';
import {
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
  Popper,
  Paper,
  ClickAwayListener,
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

export const GlobalSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: jobsResponse, isLoading: isLoadingJobs } = useQuery({
    queryKey: ['search-jobs', debouncedQuery],
    queryFn: () => jobsApi.getJobs({ search: debouncedQuery.trim() || undefined, limit: 5 }),
    enabled: debouncedQuery.length > 0 && open,
  });

  const { data: projects } = useQuery({
    queryKey: ['search-projects'],
    queryFn: () => projectsApi.getProjects(),
    enabled: open,
  });
  const projectId = projects?.[0]?.id;

  const { data: queues, isLoading: isLoadingQueues } = useQuery({
    queryKey: ['search-queues', projectId],
    queryFn: () => queuesApi.getQueuesByProject(projectId!),
    enabled: !!projectId && open,
  });

  const { data: workers } = useQuery({
    queryKey: ['search-workers'],
    queryFn: () => workersApi.getWorkers(),
    enabled: open,
  });

  const filteredQueues = (queues || []).filter((q) => q.name.toLowerCase().includes(debouncedQuery.toLowerCase()));
  const filteredWorkers = (workers || []).filter(
    (w) => w.hostname.toLowerCase().includes(debouncedQuery.toLowerCase()) || w.id.includes(debouncedQuery)
  );

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
    setQuery('');
  };

  const showResults = open && debouncedQuery.length > 0;

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ width: '100%', maxWidth: 600, position: 'relative' }} ref={anchorRef}>
        <TextField
          fullWidth
          placeholder="Search jobs, queues, workers... (Ctrl+K)"
          variant="outlined"
          size="small"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            if (query.length > 0) setOpen(true);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#736F87', fontSize: '1.2rem' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '4px',
              bgcolor: '#181A20',
              border: '1px solid #37393e',
              color: '#ffffff',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: '#00ffc2',
              },
              '&.Mui-focused': {
                bgcolor: '#181A20',
                borderColor: '#00ffc2',
                boxShadow: 'none',
              },
            },
            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
          }}
        />

        <Popper
          open={showResults}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          style={{ width: anchorRef.current?.clientWidth, zIndex: 1300, paddingTop: '8px' }}
        >
          <Paper
            elevation={0}
            sx={{
              maxHeight: '60vh',
              overflow: 'auto',
              borderRadius: '4px',
              bgcolor: '#1B1E24',
              border: '1px solid #37393e',
              boxShadow: 'none',
            }}
          >
            {isLoadingJobs || isLoadingQueues ? (
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
                  <Box sx={{ p: 3, textAlign: 'center', color: '#94A3B8' }}>
                    <Typography variant="body2">No matching results found for "{debouncedQuery}"</Typography>
                  </Box>
                )}
              </List>
            )}
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};
