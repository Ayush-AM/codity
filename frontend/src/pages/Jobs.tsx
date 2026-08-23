import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TablePagination,
  TextField,
  Chip,
  Button,
  IconButton,
  Tooltip,
  MenuItem,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  PlayArrow as ImmediateIcon,
  Repeat as CronIcon,
  Layers as QueueIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi, Job, JobStatus, CreateJobPayload } from '../api/jobs';
import { queuesApi } from '../api/queues';
import { projectsApi } from '../api/projects';
import { JobDetailModal } from '../components/JobDetailModal';

export function formatCronDescription(cronStr?: string | null): string {
  if (!cronStr) return '';
  const str = cronStr.trim();
  if (str === '* * * * *') return 'Every 1 min';
  if (str.startsWith('*/') && str.endsWith(' * * * *')) {
    const mins = str.split(' ')[0].replace('*/', '');
    return `Every ${mins} mins`;
  }
  if (str.startsWith('0 */') && str.endsWith(' * * *')) {
    const hrs = str.split(' ')[1].replace('*/', '');
    return `Every ${hrs} hrs`;
  }
  if (str === '0 * * * *') return 'Every 1 hr';
  if (str === '0 0 * * *') return 'Every 24 hrs (Daily)';
  if (str.startsWith('0 0 */') && str.endsWith(' * *')) {
    const days = str.split(' ')[2].replace('*/', '');
    return `Every ${days} days`;
  }
  if (str === '0 0 * * 1') return 'Weekly (Mon)';
  return cronStr;
}

const ALL_STATUSES: JobStatus[] = ['queued', 'scheduled', 'claimed', 'running', 'completed', 'failed', 'dead'];

export const Jobs: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Filters & Pagination State
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Submit Job Dialog State
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedQueueId, setSelectedQueueId] = useState('');
  const [jobPayloadText, setJobPayloadText] = useState('{\n  "task": "send_welcome_email",\n  "user_id": "usr_99812",\n  "email": "ayush@example.com"\n}');
  const [priority, setPriority] = useState<number | string>(0);
  const [maxRetries, setMaxRetries] = useState<number | string>(3);
  
  // Timing Mode: 'immediate' | 'future' | 'cron'
  const [timingMode, setTimingMode] = useState<'immediate' | 'future' | 'cron'>('immediate');
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [cronValue, setCronValue] = useState<number | string>(5);
  const [cronUnit, setCronUnit] = useState<'minutes' | 'hours' | 'days'>('minutes');
  const [cronExpression, setCronExpression] = useState<string>('*/5 * * * *');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch projects and queues
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getProjects(),
  });

  const { data: queues } = useQuery({
    queryKey: ['queues', projects?.[0]?.id],
    queryFn: () => (projects?.[0]?.id ? queuesApi.getQueuesByProject(projects[0].id) : []),
    enabled: !!projects && projects.length > 0,
  });

  // Auto-select first queue
  React.useEffect(() => {
    if (queues && queues.length > 0 && !selectedQueueId) {
      setSelectedQueueId(queues[0].id);
    }
  }, [queues, selectedQueueId]);

  // Query jobs with polling
  const { data: jobsResponse, isLoading, refetch } = useQuery({
    queryKey: ['jobs', page, rowsPerPage, selectedStatus, search],
    queryFn: () =>
      jobsApi.getJobs({
        skip: page * rowsPerPage,
        limit: rowsPerPage,
        status: selectedStatus !== 'all' ? [selectedStatus as JobStatus] : undefined,
        search: search.trim() || undefined,
        sort_by: 'created_at',
        sort_order: 'desc',
      }),
    refetchInterval: 3000,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const createJobMutation = useMutation({
    mutationFn: async () => {
      let parsedPayload: Record<string, any>;
      try {
        parsedPayload = JSON.parse(jobPayloadText);
      } catch {
        throw new Error('Invalid JSON format in payload.');
      }

      if (!selectedQueueId) {
        throw new Error('Please select a target queue.');
      }

      const payloadData: CreateJobPayload = {
        payload: parsedPayload,
        priority: priority === '' ? 0 : Number(priority),
        max_retries: maxRetries === '' ? 3 : Number(maxRetries),
      };

      if (timingMode === 'future') {
        if (!scheduledAt) {
          throw new Error('Please pick a scheduled future date & time.');
        }
        const parsedDate = new Date(scheduledAt);
        if (parsedDate.getTime() <= Date.now()) {
          throw new Error('Scheduled date & time must be in the future.');
        }
        payloadData.scheduled_at = parsedDate.toISOString();
      } else if (timingMode === 'cron') {
        if (!cronExpression.trim()) {
          throw new Error('Please specify a valid cron expression.');
        }
        payloadData.cron_expression = cronExpression.trim();
      }

      return jobsApi.submitJob(selectedQueueId, payloadData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['system-metrics'] });
      setCreateOpen(false);
      setSubmitError(null);
    },
    onError: (err: any) => {
      setSubmitError(err.response?.data?.detail || err.message || 'Failed to submit job');
    },
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ── Page Header ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Jobs Explorer
          </Typography>
          <Typography variant="body2" sx={{ color: '#908AAB', fontSize: '0.85rem' }}>
            Submit, schedule, monitor, and inspect background jobs across distributed queues
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: { xs: '100%', sm: 'auto' }, justifyContent: { xs: 'space-between', sm: 'flex-end' } }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={
              <RefreshIcon
                sx={{
                  animation: isRefreshing ? 'spin 0.5s linear infinite' : 'none',
                  '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } }
                }}
              />
            }
            onClick={handleRefresh}
            sx={{
              borderRadius: '4px',
              textTransform: 'none',
              fontWeight: 600,
              flex: { xs: 1, sm: 'none' },
              borderColor: '#37393e',
              color: '#94A3B8',
              boxShadow: 'none',
              '&:hover': { borderColor: '#00ffc2', color: '#00ffc2', bgcolor: 'transparent', boxShadow: 'none' },
            }}
          >
            Refresh
          </Button>

          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => {
              setSubmitError(null);
              setCreateOpen(true);
            }}
            sx={{
              borderRadius: '4px',
              textTransform: 'none',
              fontWeight: 800,
              px: 2.5,
              flex: { xs: 1, sm: 'none' },
              bgcolor: '#00ffc2',
              color: '#111317',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#33ffce', boxShadow: 'none' },
            }}
          >
            Schedule Job
          </Button>
        </Box>
      </Box>

      {/* ── Filter Bar ── */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: '4px',
          bgcolor: '#1B1E24',
          border: '1px solid #37393e',
          boxShadow: 'none',
          display: 'flex',
          gap: 2,
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
        }}
      >
        <TextField
          size="small"
          placeholder="Search by Job ID or payload keyword..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#736F87', fontSize: '1.2rem' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            flex: 1,
            width: '100%',
            '& .MuiOutlinedInput-root': {
              borderRadius: '4px',
              bgcolor: 'rgba(255,255,255,0.03)',
            },
          }}
        />

        <TextField
          select
          size="small"
          label="Filter Status"
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setPage(0);
          }}
          sx={{
            minWidth: { xs: '100%', sm: 180 },
            width: { xs: '100%', sm: 'auto' },
            '& .MuiInputLabel-root': { color: '#908AAB' },
            '& .MuiOutlinedInput-root': {
              borderRadius: '4px',
              bgcolor: 'rgba(255,255,255,0.03)',
            },
          }}
        >
          <MenuItem value="all">All Statuses</MenuItem>
          {ALL_STATUSES.map((st) => (
            <MenuItem key={st} value={st}>
              {st.toUpperCase()}
            </MenuItem>
          ))}
        </TextField>
      </Paper>

      {/* ── Jobs Table ── */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '4px',
          bgcolor: '#1B1E24',
          border: '1px solid #37393e',
          boxShadow: 'none',
          overflow: 'hidden',
          width: '100%',
        }}
      >
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
            <CircularProgress sx={{ color: '#7356F1' }} />
          </Box>
        ) : jobsResponse?.items && jobsResponse.items.length > 0 ? (
          <>
            {isMobile ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
                {jobsResponse.items.map((job) => {
                  const isCron = Boolean(job.cron_expression);
                  const isDelayed = Boolean(job.scheduled_at);
                  const payloadStr = typeof job.payload === 'object' ? JSON.stringify(job.payload) : String(job.payload);

                  return (
                    <Paper
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      sx={{
                        p: 2.5,
                        borderRadius: '4px',
                        bgcolor: '#1B1E24',
                        border: '1px solid #37393e',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1.5,
                        cursor: 'pointer',
                        '&:hover': { borderColor: '#00ffc2' },
                      }}
                    >
                      {/* Header Row: ID, Priority, Status, Action */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#ffffff' }}>
                            #{job.id.slice(0, 8)}
                          </Typography>
                          <Chip label={`P${job.priority}`} size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, bgcolor: 'rgba(255,255,255,0.06)', color: '#94A3B8', fontFamily: 'var(--font-mono)' }} />
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            size="small"
                            label={job.status.toUpperCase()}
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.62rem',
                              height: 20,
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
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setSelectedJob(job); }} sx={{ color: '#94A3B8' }}>
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>

                      {/* Payload Preview */}
                      <Box sx={{ bgcolor: '#181A20', p: 1.2, borderRadius: '4px', border: '1px solid #37393e' }}>
                        <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', fontSize: '0.68rem', mb: 0.2 }}>
                          PAYLOAD PREVIEW
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#ffffff', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', wordBreak: 'break-all' }}>
                          {payloadStr}
                        </Typography>
                      </Box>

                      {/* Timing & Mode Metadata */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {isCron ? (
                            <Chip icon={<ScheduleIcon sx={{ fontSize: '0.75rem !important' }} />} label="RECURRING CRON" size="small" sx={{ height: 20, fontSize: '0.62rem', fontWeight: 700, borderRadius: '4px', bgcolor: 'rgba(0, 255, 194, 0.1)', color: '#00ffc2', border: '1px solid rgba(0, 255, 194, 0.3)', '& .MuiChip-icon': { color: '#00ffc2' } }} />
                          ) : isDelayed ? (
                            <Chip icon={<ScheduleIcon sx={{ fontSize: '0.75rem !important' }} />} label="DELAYED" size="small" sx={{ height: 20, fontSize: '0.62rem', fontWeight: 700, borderRadius: '4px', bgcolor: 'rgba(255, 184, 0, 0.1)', color: '#ffb800', border: '1px solid rgba(255, 184, 0, 0.3)', '& .MuiChip-icon': { color: '#ffb800' } }} />
                          ) : (
                            <Chip label="IMMEDIATE" size="small" sx={{ height: 20, fontSize: '0.62rem', fontWeight: 700, borderRadius: '4px', bgcolor: 'rgba(255, 255, 255, 0.05)', color: '#94A3B8' }} />
                          )}
                        </Box>
                        <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                          {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </Box>
                    </Paper>
                  );
                })}
              </Box>
            ) : (
              <Box sx={{ overflowX: 'auto', width: '100%' }}>
                <Table sx={{ minWidth: 680 }}>
                  <TableHead>
                    <TableRow>
                      {['Job ID', 'Status', 'Payload Preview', 'Priority', 'Schedule Mode', 'Timing', 'Submitted', ''].map((h) => (
                        <TableCell
                          key={h}
                          align={h === '' ? 'right' : 'left'}
                          sx={{
                            color: '#94A3B8',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            borderBottom: '1px solid #37393e',
                            py: 2,
                          }}
                        >
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                <TableBody>
                  {jobsResponse.items.map((job) => {
                    const isCron = Boolean(job.cron_expression);
                    const isDelayed = Boolean(job.scheduled_at);

                    return (
                      <TableRow key={job.id} hover sx={{ '&:hover': { bgcolor: 'rgba(0, 255, 194, 0.03)' } }}>
                        <TableCell sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: '#ffffff', fontWeight: 600 }}>
                          {job.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={job.status.toUpperCase()}
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.65rem',
                              height: 20,
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
                        <TableCell sx={{ color: '#908AAB', fontSize: '0.82rem', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {typeof job.payload === 'object' ? JSON.stringify(job.payload) : String(job.payload)}
                        </TableCell>
                        <TableCell sx={{ color: '#ffffff', fontSize: '0.82rem', fontWeight: 600 }}>
                          P{job.priority}
                        </TableCell>
                        <TableCell>
                          {isCron ? (
                            <Chip
                              icon={<ScheduleIcon sx={{ fontSize: '0.75rem !important' }} />}
                              label="RECURRING CRON"
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                borderRadius: '4px',
                                bgcolor: 'rgba(115, 86, 241, 0.15)',
                                color: '#BCA8FF',
                                border: '1px solid rgba(115, 86, 241, 0.3)',
                                '& .MuiChip-icon': { color: '#BCA8FF' },
                              }}
                            />
                          ) : isDelayed ? (
                            <Chip
                              icon={<ScheduleIcon sx={{ fontSize: '0.75rem !important' }} />}
                              label="DELAYED"
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                borderRadius: '4px',
                                bgcolor: 'rgba(56, 189, 248, 0.15)',
                                color: '#38bdf8',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                '& .MuiChip-icon': { color: '#38bdf8' },
                              }}
                            />
                          ) : (
                            <Chip
                              label="IMMEDIATE"
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                borderRadius: '4px',
                                bgcolor: 'rgba(255, 255, 255, 0.05)',
                                color: '#908AAB',
                                '& .MuiChip-icon': { color: '#908AAB' },
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.82rem', color: '#908AAB', fontFamily: 'var(--font-mono)' }}>
                          {isCron
                            ? formatCronDescription(job.cron_expression)
                            : isDelayed
                            ? new Date(job.scheduled_at!).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                            : 'Immediate'}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.82rem', color: '#736F87', fontFamily: 'var(--font-mono)' }}>
                          {new Date(job.created_at).toLocaleTimeString()}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="View Job Details">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedJob(job);
                              }}
                              sx={{ color: '#736F87', '&:hover': { color: '#ffffff', bgcolor: 'rgba(255,255,255,0.06)' } }}
                            >
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
            )}

            <TablePagination
              component="div"
              count={jobsResponse.total}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 20, 50]}
              sx={{ color: '#908AAB', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}
            />
          </>
        ) : (
          <Box sx={{ p: 8, textAlign: 'center', color: '#908AAB' }}>
            <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 600, mb: 0.5 }}>
              No jobs matching your filters
            </Typography>
            <Typography variant="body2">Try adjusting search or status query</Typography>
          </Box>
        )}
      </Paper>

      {/* ── Submit / Schedule Job Modal ── */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '4px',
            bgcolor: '#1B1E24',
            border: '1px solid #37393e',
            boxShadow: 'none',
            p: 1,
          },
        }}
      >
        <DialogTitle sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.2rem', pb: 1 }}>
          Create & Schedule Workload
        </DialogTitle>

        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '28px !important' }}>
          {submitError && (
            <Alert severity="error" sx={{ borderRadius: '4px', bgcolor: 'rgba(255, 77, 77, 0.1)', color: '#ff4d4d', border: '1px solid rgba(255, 77, 77, 0.3)' }}>
              {submitError}
            </Alert>
          )}

          {/* Target Queue */}
          <TextField
            select
            label="Target Queue"
            fullWidth
            value={selectedQueueId}
            onChange={(e) => setSelectedQueueId(e.target.value)}
            sx={{
              '& .MuiInputLabel-root': { color: '#94A3B8' },
              '& .MuiOutlinedInput-root': {
                borderRadius: '4px',
                bgcolor: '#181A20',
                '& fieldset': { borderColor: '#37393e' },
                '&:hover fieldset': { borderColor: '#00ffc2' },
                '&.Mui-focused fieldset': { borderColor: '#00ffc2' },
              },
            }}
          >
            {queues?.map((q) => (
              <MenuItem key={q.id} value={q.id} sx={{ fontFamily: 'var(--font-mono)' }}>
                {q.name} (Priority: {q.priority})
              </MenuItem>
            ))}
          </TextField>

          {/* JSON Payload */}
          <TextField
            label="Payload (JSON)"
            multiline
            rows={4}
            fullWidth
            value={jobPayloadText}
            onChange={(e) => setJobPayloadText(e.target.value)}
            sx={{
              '& .MuiInputLabel-root': { color: '#94A3B8' },
              '& .MuiOutlinedInput-root': {
                borderRadius: '4px',
                bgcolor: '#181A20',
                '& fieldset': { borderColor: '#37393e' },
                '&:hover fieldset': { borderColor: '#00ffc2' },
                '&.Mui-focused fieldset': { borderColor: '#00ffc2' },
              },
              '& .MuiInputBase-input': { fontFamily: 'var(--font-mono)', fontSize: '0.88rem', color: '#00ffc2' },
            }}
          />

          {/* Priority & Max Retries */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              label="Priority (0 = Highest)"
              type="number"
              value={priority}
              onChange={(e) => {
                const val = e.target.value;
                setPriority(val === '' ? '' : parseInt(val));
              }}
              sx={{
                '& .MuiInputLabel-root': { color: '#94A3B8' },
                '& .MuiOutlinedInput-root': {
                  borderRadius: '4px',
                  bgcolor: '#181A20',
                  '& fieldset': { borderColor: '#37393e' },
                  '&:hover fieldset': { borderColor: '#00ffc2' },
                  '&.Mui-focused fieldset': { borderColor: '#00ffc2' },
                },
                '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': { display: 'none' },
                '& input[type=number]': { MozAppearance: 'textfield', fontFamily: 'var(--font-mono)' },
              }}
            />
            <TextField
              label="Max Retries"
              type="number"
              value={maxRetries}
              onChange={(e) => {
                const val = e.target.value;
                setMaxRetries(val === '' ? '' : parseInt(val));
              }}
              sx={{
                '& .MuiInputLabel-root': { color: '#94A3B8' },
                '& .MuiOutlinedInput-root': {
                  borderRadius: '4px',
                  bgcolor: '#181A20',
                  '& fieldset': { borderColor: '#37393e' },
                  '&:hover fieldset': { borderColor: '#00ffc2' },
                  '&.Mui-focused fieldset': { borderColor: '#00ffc2' },
                },
                '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': { display: 'none' },
                '& input[type=number]': { MozAppearance: 'textfield', fontFamily: 'var(--font-mono)' },
              }}
            />
          </Box>

          {/* Timing Mode Radio Options */}
          <Box sx={{ p: 2, bgcolor: '#181A20', borderRadius: '4px', border: '1px solid #37393e' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#ffffff', mb: 1 }}>
              Execution Timing
            </Typography>

            <RadioGroup
              row
              value={timingMode}
              onChange={(e) => setTimingMode(e.target.value as any)}
              sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 0.5, sm: 0 }, mb: 2 }}
            >
              <FormControlLabel
                value="immediate"
                control={<Radio sx={{ color: '#94A3B8', '&.Mui-checked': { color: '#00ffc2' } }} />}
                label={<Typography sx={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: 600 }}>Run Immediately</Typography>}
              />
              <FormControlLabel
                value="future"
                control={<Radio sx={{ color: '#94A3B8', '&.Mui-checked': { color: '#00ffc2' } }} />}
                label={<Typography sx={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: 600 }}>Future Date/Time</Typography>}
              />
              <FormControlLabel
                value="cron"
                control={<Radio sx={{ color: '#94A3B8', '&.Mui-checked': { color: '#00ffc2' } }} />}
                label={<Typography sx={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: 600 }}>Recurring Cron</Typography>}
              />
            </RadioGroup>

            {/* Future Date Time Picker */}
            {timingMode === 'future' && (
              <Box sx={{ mt: 1 }}>
                <TextField
                  fullWidth
                  type="datetime-local"
                  label="Scheduled At (Local Time)"
                  InputLabelProps={{ shrink: true }}
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  helperText="The job will wait until this exact timestamp before becoming eligible for worker execution."
                  sx={{
                    '& .MuiInputLabel-root': { color: '#94A3B8', fontFamily: 'var(--font-mono)' },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '4px',
                      bgcolor: '#181A20',
                      colorScheme: 'dark',
                      '& fieldset': { borderColor: '#37393e' },
                      '&:hover fieldset': { borderColor: '#00ffc2' },
                      '&.Mui-focused fieldset': { borderColor: '#00ffc2' },
                    },
                    '& .MuiInputBase-input': {
                      color: '#ffffff',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.95rem',
                      letterSpacing: '0.05em',
                    },
                    '& input::-webkit-calendar-picker-indicator': {
                      filter: 'invert(0.8) sepia(1) saturate(5) hue-rotate(120deg)',
                      cursor: 'pointer',
                      opacity: 0.9,
                      '&:hover': { opacity: 1 },
                    },
                    '& .MuiFormHelperText-root': {
                      color: '#94A3B8',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      mt: 1,
                    },
                  }}
                />
              </Box>
            )}

            {/* Recurring Cron Input + Presets */}
            {timingMode === 'cron' && (
              <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  <TextField
                    label="Repeat Every"
                    type="number"
                    value={cronValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      const numVal = val === '' ? '' : parseInt(val);
                      setCronValue(numVal);
                      
                      const num = numVal === '' ? 1 : Number(numVal);
                      if (cronUnit === 'minutes') {
                        setCronExpression(num <= 1 ? '* * * * *' : `*/${num} * * * *`);
                      } else if (cronUnit === 'hours') {
                        setCronExpression(num <= 1 ? '0 * * * *' : `0 */${num} * * *`);
                      } else if (cronUnit === 'days') {
                        setCronExpression(num <= 1 ? '0 0 * * *' : `0 0 */${num} * *`);
                      }
                    }}
                    sx={{
                      '& .MuiInputLabel-root': { color: '#94A3B8' },
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '4px',
                        bgcolor: '#111317',
                        '& fieldset': { borderColor: '#37393e' },
                        '&:hover fieldset': { borderColor: '#00ffc2' },
                        '&.Mui-focused fieldset': { borderColor: '#00ffc2' },
                      },
                      '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': { display: 'none' },
                      '& input[type=number]': { MozAppearance: 'textfield', fontFamily: 'var(--font-mono)' },
                    }}
                  />

                  <TextField
                    select
                    label="Unit"
                    value={cronUnit}
                    onChange={(e) => {
                      const unit = e.target.value as 'minutes' | 'hours' | 'days';
                      setCronUnit(unit);
                      const num = cronValue === '' ? 1 : Number(cronValue);
                      if (unit === 'minutes') {
                        setCronExpression(num <= 1 ? '* * * * *' : `*/${num} * * * *`);
                      } else if (unit === 'hours') {
                        setCronExpression(num <= 1 ? '0 * * * *' : `0 */${num} * * *`);
                      } else if (unit === 'days') {
                        setCronExpression(num <= 1 ? '0 0 * * *' : `0 0 */${num} * *`);
                      }
                    }}
                    sx={{
                      '& .MuiInputLabel-root': { color: '#94A3B8' },
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '4px',
                        bgcolor: '#111317',
                        '& fieldset': { borderColor: '#37393e' },
                        '&:hover fieldset': { borderColor: '#00ffc2' },
                        '&.Mui-focused fieldset': { borderColor: '#00ffc2' },
                      },
                    }}
                  >
                    <MenuItem value="minutes">Minutes</MenuItem>
                    <MenuItem value="hours">Hours</MenuItem>
                    <MenuItem value="days">Days</MenuItem>
                  </TextField>
                </Box>

                {/* Quick Presets */}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#94A3B8', mr: 1, fontWeight: 600 }}>
                    Quick Presets:
                  </Typography>
                  {[
                    { label: '5 Mins', val: 5, unit: 'minutes', expr: '*/5 * * * *' },
                    { label: '15 Mins', val: 15, unit: 'minutes', expr: '*/15 * * * *' },
                    { label: '1 Hour', val: 1, unit: 'hours', expr: '0 * * * *' },
                    { label: '12 Hours', val: 12, unit: 'hours', expr: '0 */12 * * *' },
                    { label: '24 Hours', val: 24, unit: 'hours', expr: '0 0 * * *' },
                  ].map((preset) => (
                    <Chip
                      key={preset.label}
                      label={preset.label}
                      size="small"
                      onClick={() => {
                        setCronValue(preset.val);
                        setCronUnit(preset.unit as any);
                        setCronExpression(preset.expr);
                      }}
                      sx={{
                        borderRadius: '4px',
                        cursor: 'pointer',
                        bgcolor: cronExpression === preset.expr ? 'rgba(0, 255, 194, 0.15)' : '#111317',
                        color: cronExpression === preset.expr ? '#00ffc2' : '#94A3B8',
                        border: '1px solid',
                        borderColor: cronExpression === preset.expr ? '#00ffc2' : '#37393e',
                        fontFamily: 'var(--font-mono)',
                      }}
                    />
                  ))}
                </Box>

                <Box sx={{ p: 1.5, bgcolor: 'rgba(0, 255, 194, 0.08)', borderRadius: '4px', border: '1px solid rgba(0, 255, 194, 0.3)' }}>
                  <Typography variant="caption" sx={{ color: '#00ffc2', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    Schedule Summary: {formatCronDescription(cronExpression)}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #37393e' }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ color: '#94A3B8', textTransform: 'none', fontWeight: 600, '&:hover': { color: '#ffffff' } }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => createJobMutation.mutate()}
            disabled={createJobMutation.isPending || !selectedQueueId}
            sx={{
              bgcolor: '#00ffc2',
              color: '#111317',
              borderRadius: '4px',
              px: 3,
              py: 1,
              fontWeight: 800,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#33ffce', boxShadow: 'none' },
              '&.Mui-disabled': { bgcolor: '#37393e', color: '#94A3B8' },
            }}
          >
            {createJobMutation.isPending ? 'Scheduling...' : timingMode === 'immediate' ? 'Run Now' : 'Schedule Workload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Job Detail Modal ── */}
      <JobDetailModal
        job={selectedJob}
        open={Boolean(selectedJob)}
        onClose={() => setSelectedJob(null)}
      />
    </Box>
  );
};
