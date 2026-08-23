import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Tabs,
  Tab,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  Divider,
  Paper,
  IconButton,
} from '@mui/material';
import { Close as CloseIcon, Replay as ReplayIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Job, jobsApi } from '../api/jobs';
import { dlqApi } from '../api/dlq';
import { queuesApi } from '../api/queues';
import { projectsApi } from '../api/projects';

interface JobDetailModalProps {
  job: Job | null;
  open: boolean;
  onClose: () => void;
}

const statusColors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  queued: 'info',
  scheduled: 'secondary',
  claimed: 'warning',
  running: 'primary',
  completed: 'success',
  failed: 'error',
  dead: 'error',
};

export const JobDetailModal: React.FC<JobDetailModalProps> = ({ job, open, onClose }) => {
  const [tabIndex, setTabIndex] = useState(0);
  const queryClient = useQueryClient();

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getProjects(),
  });

  const { data: queues } = useQuery({
    queryKey: ['queues', projects?.[0]?.id],
    queryFn: () => (projects?.[0]?.id ? queuesApi.getQueuesByProject(projects[0].id) : []),
    enabled: !!projects && projects.length > 0 && open,
  });

  const queueName = queues?.find((q) => q.id === job?.queue_id)?.name;

  const { data: executions, isLoading: loadingExecutions } = useQuery({
    queryKey: ['job-executions', job?.id],
    queryFn: () => jobsApi.getExecutions(job!.id),
    enabled: !!job && open,
  });

  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ['job-logs', job?.id],
    queryFn: () => jobsApi.getLogs(job!.id),
    enabled: !!job && open,
  });

  const retryMutation = useMutation({
    mutationFn: () => dlqApi.retryDeadJob(job!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dlq'] });
      onClose();
    },
  });

  if (!job) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '4px',
          bgcolor: '#1B1E24',
          border: '1px solid #37393e',
          boxShadow: 'none',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, color: '#ffffff' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h6" fontWeight={700}>
            Job Details
          </Typography>
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
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: '#94A3B8' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: '#37393e', px: 3 }}>
        <Tabs
          value={tabIndex}
          onChange={(_, val) => setTabIndex(val)}
          sx={{
            '& .MuiTab-root': { color: '#94A3B8', fontWeight: 600, textTransform: 'none' },
            '& .Mui-selected': { color: '#00ffc2' },
            '& .MuiTabs-indicator': { backgroundColor: '#00ffc2' },
          }}
        >
          <Tab label="Overview & Payload" />
          <Tab label={`Executions (${executions?.total ?? 0})`} />
          <Tab label={`Audit Logs (${logs?.total ?? 0})`} />
        </Tabs>
      </Box>

      <DialogContent sx={{ minHeight: 380, p: 3 }}>
        {/* Tab 0: Overview & Metadata */}
        {tabIndex === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: '4px', bgcolor: '#181A20', border: '1px solid #37393e' }}>
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>Job ID</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#ffffff' }}>{job.id}</Typography>
              </Paper>
              <Paper elevation={0} sx={{ p: 2, borderRadius: '4px', bgcolor: '#181A20', border: '1px solid #37393e' }}>
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>Queue</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                  {queueName ? `${queueName}` : job.queue_id.slice(0, 8) + '...'}
                </Typography>
              </Paper>
              <Paper elevation={0} sx={{ p: 2, borderRadius: '4px', bgcolor: '#181A20', border: '1px solid #37393e' }}>
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>Priority / Retries</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                  Priority: {job.priority} | Attempt: {job.retry_count} / {job.max_retries}
                </Typography>
              </Paper>
              <Paper elevation={0} sx={{ p: 2, borderRadius: '4px', bgcolor: '#181A20', border: '1px solid #37393e' }}>
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>Created / Updated</Typography>
                <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                  {new Date(job.created_at).toLocaleString()}
                </Typography>
              </Paper>
            </Box>

            {job.last_error && (
              <Paper elevation={0} sx={{ p: 2, borderColor: 'rgba(255, 77, 77, 0.3)', bgcolor: 'rgba(255, 77, 77, 0.1)', color: '#ff4d4d', borderRadius: '4px', border: '1px solid' }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#ff4d4d' }}>Last Error Message</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'var(--font-mono)', color: '#ff4d4d', mt: 0.5 }}>
                  {job.last_error}
                </Typography>
              </Paper>
            )}

            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#ffffff' }}>
                Payload JSON
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: '#181A20',
                  color: '#00ffc2',
                  borderRadius: '4px',
                  border: '1px solid #37393e',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                  overflowX: 'auto',
                  maxHeight: 200,
                }}
              >
                <pre style={{ margin: 0 }}>{JSON.stringify(job.payload, null, 2)}</pre>
              </Paper>
            </Box>
          </Box>
        )}

        {/* Tab 1: Execution Attempts */}
        {tabIndex === 1 && (
          <Box>
            {loadingExecutions ? (
              <Box display="flex" justifyContent="center" p={4}><CircularProgress sx={{ color: '#00ffc2' }} /></Box>
            ) : executions?.items && executions.items.length > 0 ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: '#94A3B8', fontWeight: 700, fontSize: '0.72rem', borderBottom: '1px solid #37393e' }}>Execution ID</TableCell>
                    <TableCell sx={{ color: '#94A3B8', fontWeight: 700, fontSize: '0.72rem', borderBottom: '1px solid #37393e' }}>Status</TableCell>
                    <TableCell sx={{ color: '#94A3B8', fontWeight: 700, fontSize: '0.72rem', borderBottom: '1px solid #37393e' }}>Started</TableCell>
                    <TableCell sx={{ color: '#94A3B8', fontWeight: 700, fontSize: '0.72rem', borderBottom: '1px solid #37393e' }}>Finished</TableCell>
                    <TableCell sx={{ color: '#94A3B8', fontWeight: 700, fontSize: '0.72rem', borderBottom: '1px solid #37393e' }}>Error</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {executions.items.map((exec) => (
                    <TableRow key={exec.id} sx={{ '& td': { borderBottom: '1px solid #37393e' } }}>
                      <TableCell sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#ffffff' }}>{exec.id.slice(0, 8)}...</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={exec.status.toUpperCase()}
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.62rem',
                            height: 18,
                            borderRadius: '4px',
                            bgcolor: exec.status === 'completed' ? 'rgba(0, 255, 194, 0.1)' : 'rgba(255, 77, 77, 0.1)',
                            color: exec.status === 'completed' ? '#00ffc2' : '#ff4d4d',
                            fontFamily: 'var(--font-mono)',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>{new Date(exec.started_at).toLocaleTimeString()}</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>{exec.finished_at ? new Date(exec.finished_at).toLocaleTimeString() : 'In flight'}</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: '#ff4d4d', fontFamily: 'var(--font-mono)' }}>{exec.error_message || 'None'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Typography sx={{ color: '#94A3B8' }} textAlign="center" py={4}>No execution history recorded yet.</Typography>
            )}
          </Box>
        )}

        {/* Tab 2: Audit Logs */}
        {tabIndex === 2 && (
          <Box>
            {loadingLogs ? (
              <Box display="flex" justifyContent="center" p={4}><CircularProgress sx={{ color: '#00ffc2' }} /></Box>
            ) : logs?.items && logs.items.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {logs.items.map((log) => (
                  <Paper key={log.id} elevation={0} sx={{ p: 1.5, borderRadius: '4px', bgcolor: '#181A20', border: '1px solid #37393e' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Chip
                        size="small"
                        label={log.level.toUpperCase()}
                        sx={{
                          fontSize: '0.65rem',
                          height: 18,
                          fontWeight: 700,
                          borderRadius: '4px',
                          bgcolor: log.level === 'error' ? 'rgba(255, 77, 77, 0.15)' : 'rgba(255, 184, 0, 0.15)',
                          color: log.level === 'error' ? '#ff4d4d' : '#ffb800',
                          fontFamily: 'var(--font-mono)',
                        }}
                      />
                      <Typography variant="caption" sx={{ color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={500} sx={{ color: '#ffffff' }}>{log.message}</Typography>
                    {log.metadata && (
                      <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>
                        Metadata: {JSON.stringify(log.metadata)}
                      </Typography>
                    )}
                  </Paper>
                ))}
              </Box>
            ) : (
              <Typography sx={{ color: '#94A3B8' }} textAlign="center" py={4}>No log entries available.</Typography>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #37393e' }}>
        {job.status === 'dead' && (
          <Button
            variant="contained"
            startIcon={<ReplayIcon />}
            onClick={() => retryMutation.mutate()}
            disabled={retryMutation.isPending}
            sx={{
              bgcolor: '#ffb800',
              color: '#111317',
              fontWeight: 800,
              borderRadius: '4px',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#ffc533', boxShadow: 'none' },
            }}
          >
            {retryMutation.isPending ? 'Replaying...' : 'Replay Job'}
          </Button>
        )}
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{
            borderColor: '#37393e',
            color: '#ffffff',
            borderRadius: '4px',
            '&:hover': { borderColor: '#00ffc2', color: '#00ffc2' },
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
