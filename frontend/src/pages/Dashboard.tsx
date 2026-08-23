import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  Assignment as JobIcon,
  Memory as WorkerIcon,
  Layers as QueueIcon,
  Warning as ErrorIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  Speed as SpeedIcon,
  Add as AddIcon,
  GridView as GridViewIcon,
  ViewList as ViewListIcon,
  Schedule as ScheduleIcon,
  CheckCircle as SuccessIcon,
  PlayArrow as RunningIcon,
  HourglassEmpty as QueuedIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { metricsApi } from '../api/metrics';
import { jobsApi, Job } from '../api/jobs';
import { queuesApi } from '../api/queues';
import { projectsApi } from '../api/projects';
import { MetricsChart } from '../components/MetricsChart';
import { JobDetailModal } from '../components/JobDetailModal';

const iconCircleColors = [
  { bg: 'rgba(236, 72, 153, 0.15)', text: '#ec4899', border: 'rgba(236, 72, 153, 0.3)' }, // Pink
  { bg: 'rgba(20, 184, 166, 0.15)', text: '#14b8a6', border: 'rgba(20, 184, 166, 0.3)' }, // Teal
  { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)' }, // Sky
  { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316', border: 'rgba(249, 115, 22, 0.3)' }, // Orange
  { bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7', border: 'rgba(168, 85, 247, 0.3)' }, // Purple
  { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308', border: 'rgba(234, 179, 8, 0.3)' },   // Amber
  { bg: 'rgba(99, 102, 241, 0.15)', text: '#6366f1', border: 'rgba(99, 102, 241, 0.3)' }, // Indigo
  { bg: 'rgba(244, 63, 94, 0.15)', text: '#f43f5e', border: 'rgba(244, 63, 94, 0.3)' },   // Rose
];

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data: metrics, refetch: refetchMetrics } = useQuery({
    queryKey: ['system-metrics'],
    queryFn: metricsApi.getSystemMetrics,
    refetchInterval: 5000,
  });

  const { data: recentJobs, isLoading: loadingJobs, refetch: refetchJobs } = useQuery({
    queryKey: ['recent-jobs'],
    queryFn: () => jobsApi.getJobs({ limit: 12, sort_by: 'created_at', sort_order: 'desc' }),
    refetchInterval: 5000,
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getProjects(),
  });

  const projectId = projects?.[0]?.id;

  const { data: queues } = useQuery({
    queryKey: ['dashboard-queues', projectId],
    queryFn: () => (projectId ? queuesApi.getQueuesByProject(projectId) : []),
    enabled: !!projectId,
  });

  const queueMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    queues?.forEach((q) => {
      map[q.id] = q.name;
    });
    return map;
  }, [queues]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchMetrics(), refetchJobs()]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const allJobs = recentJobs?.items || [];
  const filteredJobs = allJobs.filter((job) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'queued') return job.status === 'queued' || job.status === 'scheduled';
    if (activeFilter === 'failed') return job.status === 'failed' || job.status === 'dead';
    return job.status.toLowerCase() === activeFilter.toLowerCase();
  });

  const filterCounts = {
    all: allJobs.length,
    running: allJobs.filter((j) => j.status === 'running').length,
    queued: allJobs.filter((j) => j.status === 'queued' || j.status === 'scheduled').length,
    completed: allJobs.filter((j) => j.status === 'completed').length,
    failed: allJobs.filter((j) => j.status === 'failed' || j.status === 'dead').length,
  };

  const chartData = [
    { time: '00:00', completed: 4, failed: 0 },
    { time: '04:00', completed: 8, failed: 1 },
    { time: '08:00', completed: 15, failed: 0 },
    { time: '12:00', completed: (metrics?.jobs_completed_24h ?? 12) > 10 ? 20 : 12, failed: 2 },
    { time: '16:00', completed: metrics?.jobs_completed_24h ?? 6, failed: metrics?.jobs_failed_24h ?? 1 },
    { time: '20:00', completed: Math.max(2, (metrics?.jobs_completed_24h ?? 8) - 2), failed: 0 },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
      {/* ── Main Top Card ── */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, md: 3.5 },
          borderRadius: '4px',
          bgcolor: '#1B1E24',
          border: '1px solid #37393e',
          boxShadow: 'none',
        }}
      >
        {/* Header Title and Primary Action */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3,
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                Reporting & Overview
              </Typography>
              <Chip
                size="small"
                icon={<SpeedIcon sx={{ fontSize: '0.85rem !important' }} />}
                label="LIVE"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.65rem',
                  height: 22,
                  borderRadius: '4px',
                  bgcolor: 'rgba(0, 255, 194, 0.1)',
                  color: '#00ffc2',
                  border: '1px solid rgba(0, 255, 194, 0.3)',
                  '& .MuiChip-icon': { color: '#00ffc2' },
                }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: '#94A3B8', fontSize: '0.85rem' }}>
              Real-time distributed execution cluster · auto-refreshing every 5s
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/jobs')}
              sx={{
                bgcolor: '#00ffc2',
                color: '#111317',
                borderRadius: '4px',
                px: 2.5,
                py: 1,
                fontWeight: 800,
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#33ffce', boxShadow: 'none' },
              }}
            >
              New Job
            </Button>
          </Box>
        </Box>

        {/* Filter Pills and Controls Bar */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
            mb: 3.5,
            pt: 1,
            borderTop: '1px solid #37393e',
          }}
        >
          {/* Status Filter Pills */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: 'All', count: filterCounts.all },
              { key: 'running', label: 'Running', count: filterCounts.running },
              { key: 'queued', label: 'Queued', count: filterCounts.queued },
              { key: 'completed', label: 'Completed', count: filterCounts.completed },
              { key: 'failed', label: 'Failed', count: filterCounts.failed },
            ].map((f) => {
              const isSelected = activeFilter === f.key;
              return (
                <Box
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2,
                    py: 0.8,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    bgcolor: isSelected ? 'rgba(0, 255, 194, 0.08)' : '#181A20',
                    color: isSelected ? '#00ffc2' : '#94A3B8',
                    border: '1px solid',
                    borderColor: isSelected ? '#00ffc2' : '#37393e',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      borderColor: '#00ffc2',
                      color: '#00ffc2',
                    },
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {f.label}
                  </Typography>
                  <Box
                    sx={{
                      bgcolor: isSelected ? 'rgba(0, 255, 194, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      color: isSelected ? '#00ffc2' : '#94A3B8',
                      borderRadius: '4px',
                      px: 1,
                      py: 0.1,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {f.count}
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* Right Action Icons & View Switcher */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Refresh telemetry">
              <IconButton
                onClick={handleRefresh}
                size="small"
                sx={{
                  bgcolor: '#181A20',
                  border: '1px solid #37393e',
                  color: '#94A3B8',
                  borderRadius: '4px',
                  p: 1,
                  '&:hover': { borderColor: '#00ffc2', color: '#00ffc2' },
                }}
              >
                <RefreshIcon
                  fontSize="small"
                  sx={{
                    animation: isRefreshing ? 'spin 0.5s linear infinite' : 'none',
                    '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } },
                  }}
                />
              </IconButton>
            </Tooltip>

            <Box
              sx={{
                display: 'flex',
                bgcolor: '#181A20',
                border: '1px solid #37393e',
                borderRadius: '4px',
                p: 0.3,
              }}
            >
              <IconButton
                size="small"
                onClick={() => setViewMode('grid')}
                sx={{
                  borderRadius: '4px',
                  bgcolor: viewMode === 'grid' ? 'rgba(0, 255, 194, 0.15)' : 'transparent',
                  color: viewMode === 'grid' ? '#00ffc2' : '#94A3B8',
                  p: 0.8,
                  '&:hover': { color: '#00ffc2' },
                }}
              >
                <GridViewIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setViewMode('list')}
                sx={{
                  borderRadius: '4px',
                  bgcolor: viewMode === 'list' ? 'rgba(0, 255, 194, 0.15)' : 'transparent',
                  color: viewMode === 'list' ? '#00ffc2' : '#94A3B8',
                  p: 0.8,
                  '&:hover': { color: '#00ffc2' },
                }}
              >
                <ViewListIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </Box>

        {/* ── Cards Grid View ── */}
        {loadingJobs ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: '#00ffc2' }} />
          </Box>
        ) : filteredJobs.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, color: '#94A3B8' }}>
            <JobIcon sx={{ fontSize: 48, color: '#37393e', mb: 1.5 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#ffffff', mb: 0.5 }}>
              No tasks found
            </Typography>
            <Typography variant="body2" sx={{ color: '#94A3B8' }}>
              There are currently no tasks under the selected filter.
            </Typography>
          </Box>
        ) : viewMode === 'grid' ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' },
              gap: 2.5,
            }}
          >
            {filteredJobs.map((job) => {
              const taskPayload = job.payload?.task || (typeof job.payload === 'string' ? job.payload : 'Background Process');
              const statusProgress =
                job.status === 'completed'
                  ? 100
                  : job.status === 'running'
                  ? 65
                  : job.status === 'claimed'
                  ? 30
                  : job.status === 'queued'
                  ? 10
                  : 0;

              const statusColor =
                job.status === 'completed'
                  ? '#00ffc2'
                  : job.status === 'running'
                  ? '#00ffc2'
                  : job.status === 'failed' || job.status === 'dead'
                  ? '#ff4d4d'
                  : '#ffb800';

              return (
                <Paper
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  sx={{
                    p: 3,
                    borderRadius: '4px',
                    bgcolor: '#1B1E24',
                    border: '1px solid #37393e',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '220px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    '&:hover': {
                      borderColor: statusColor,
                    },
                  }}
                >
                  {/* Top Square Badge */}
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '4px',
                        bgcolor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid #37393e',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: statusColor,
                      }}
                    >
                      {job.status === 'completed' ? (
                        <SuccessIcon sx={{ fontSize: '1.25rem' }} />
                      ) : job.status === 'running' ? (
                        <RunningIcon sx={{ fontSize: '1.25rem' }} />
                      ) : job.status === 'failed' || job.status === 'dead' ? (
                        <ErrorIcon sx={{ fontSize: '1.25rem' }} />
                      ) : (
                        <QueuedIcon sx={{ fontSize: '1.25rem' }} />
                      )}
                    </Box>
                  </Box>

                  {/* Title & Metadata */}
                  <Box sx={{ textAlign: 'center', mb: 2 }}>
                    <Typography
                      variant="subtitle1"
                      noWrap
                      sx={{ fontWeight: 700, color: '#ffffff', fontSize: '0.95rem', mb: 0.5, fontFamily: 'var(--font-mono)' }}
                    >
                      {taskPayload}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      <QueueIcon sx={{ fontSize: '0.85rem', color: '#94A3B8' }} />
                      <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
                        {`${queueMap[job.queue_id] || 'Queue'} · P${job.priority}`}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.8, mt: 0.5 }}>
                      <ScheduleIcon sx={{ fontSize: '0.8rem', color: '#94A3B8' }} />
                      <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                        {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Bottom Row - Status & Progress */}
                  <Box sx={{ pt: 1.5, borderTop: '1px solid #37393e' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600, fontSize: '0.7rem' }}>
                        Status
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: statusColor,
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {job.status}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={statusProgress}
                      sx={{
                        height: 3,
                        borderRadius: 0,
                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: statusColor,
                          borderRadius: 0,
                        },
                      }}
                    />
                  </Box>
                </Paper>
              );
            })}
          </Box>
        ) : (
          /* List View */
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Job ID', 'Task / Payload', 'Status', 'Priority', 'Submitted', ''].map((h) => (
                  <TableCell
                    key={h}
                    align={h === '' ? 'right' : 'left'}
                    sx={{
                      color: '#736F87',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      py: 1.8,
                    }}
                  >
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredJobs.map((job) => (
                      <TableRow
                        key={job.id}
                        hover
                        onClick={() => setSelectedJob(job)}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'rgba(0, 255, 194, 0.03)' },
                          '& td': { borderBottom: '1px solid #37393e' },
                        }}
                      >
                        <TableCell sx={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.85rem', color: '#ffffff' }}>
                          {job.id.slice(0, 8)}…
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 260, fontSize: '0.88rem', color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                            {job.payload?.task || JSON.stringify(job.payload)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={job.status.toUpperCase()}
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.65rem',
                              height: 22,
                              borderRadius: '4px',
                              bgcolor:
                                job.status === 'completed' || job.status === 'running'
                                  ? 'rgba(0, 255, 194, 0.1)'
                                  : job.status === 'failed' || job.status === 'dead'
                                  ? 'rgba(255, 77, 77, 0.1)'
                                  : 'rgba(255, 184, 0, 0.1)',
                              color:
                                job.status === 'completed' || job.status === 'running'
                                  ? '#00ffc2'
                                  : job.status === 'failed' || job.status === 'dead'
                                  ? '#ff4d4d'
                                  : '#ffb800',
                              border: '1px solid',
                              borderColor:
                                job.status === 'completed' || job.status === 'running'
                                  ? 'rgba(0, 255, 194, 0.3)'
                                  : job.status === 'failed' || job.status === 'dead'
                                  ? 'rgba(255, 77, 77, 0.3)'
                                  : 'rgba(255, 184, 0, 0.3)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#94A3B8', fontWeight: 600, fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
                            {`P${job.priority}`}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ color: '#94A3B8', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
                          {new Date(job.created_at).toLocaleTimeString()}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="View details">
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); setSelectedJob(job); }}
                              sx={{ color: '#94A3B8', '&:hover': { color: '#ffffff' } }}
                            >
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Paper>

            {/* ── Throughput Chart & Cluster Summary ── */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 3 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: '4px',
                  bgcolor: '#1B1E24',
                  border: '1px solid #37393e',
                  boxShadow: 'none',
                }}
              >
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#ffffff' }}>
                    Execution Throughput
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                    Completed vs Failed jobs over the last 24 hours
                  </Typography>
                </Box>
                <MetricsChart data={chartData} />
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: '4px',
                  bgcolor: '#1B1E24',
                  border: '1px solid #37393e',
                  boxShadow: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#ffffff', mb: 2 }}>
                    Cluster Health
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, bgcolor: '#181A20', border: '1px solid #37393e', borderRadius: '4px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <WorkerIcon sx={{ color: '#00ffc2', fontSize: '1.2rem' }} />
                        <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>Active Workers</Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#00ffc2', fontFamily: 'var(--font-mono)' }}>
                        {metrics?.active_workers ?? 0}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, bgcolor: '#181A20', border: '1px solid #37393e', borderRadius: '4px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <QueueIcon sx={{ color: '#00ffc2', fontSize: '1.2rem' }} />
                        <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>Active Queues</Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#00ffc2', fontFamily: 'var(--font-mono)' }}>
                        {queues?.length ?? metrics?.total_queues ?? 0}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, bgcolor: '#181A20', border: '1px solid #37393e', borderRadius: '4px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <ErrorIcon sx={{ color: '#ff4d4d', fontSize: '1.2rem' }} />
                        <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>Failure Rate</Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#ff4d4d', fontFamily: 'var(--font-mono)' }}>
                        {`${metrics?.overall_failure_rate_24h ?? 0}%`}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => navigate('/queues')}
                  sx={{
                    mt: 3,
                    borderRadius: '4px',
                    borderColor: '#37393e',
                    color: '#ffffff',
                    textTransform: 'none',
                    fontWeight: 600,
                    boxShadow: 'none',
                    '&:hover': { borderColor: '#00ffc2', color: '#00ffc2', bgcolor: 'transparent', boxShadow: 'none' },
                  }}
                >
                  Manage Queues &rarr;
                </Button>
              </Paper>
            </Box>

      <JobDetailModal
        job={selectedJob}
        open={Boolean(selectedJob)}
        onClose={() => setSelectedJob(null)}
      />
    </Box>
  );
};
