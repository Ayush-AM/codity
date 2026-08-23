import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Replay as ReplayIcon,
  Refresh as RefreshIcon,
  Dangerous as DlqIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dlqApi, DeadLetterEntry } from '../api/dlq';

export const DLQ: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedEntry, setSelectedEntry] = useState<DeadLetterEntry | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: entries, isLoading, refetch } = useQuery({
    queryKey: ['dlq'],
    queryFn: () => dlqApi.getDlqEntries(),
    refetchInterval: 5000,
  });

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => dlqApi.retryDeadJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dlq'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setSelectedEntry(null);
    },
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#ffffff' }}>
            <DlqIcon sx={{ color: '#ff4d4d' }} /> Dead Letter Queue (DLQ)
          </Typography>
          <Typography variant="body2" sx={{ color: '#94A3B8' }}>
            Inspect jobs that have exceeded maximum retry attempts or suffered permanent failure
          </Typography>
        </Box>

        <Button
          variant="outlined"
          startIcon={
            <RefreshIcon
              sx={{
                animation: isRefreshing ? 'spin 0.5s linear infinite' : 'none',
                '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } }
              }}
            />
          }
          onClick={async () => {
            setIsRefreshing(true);
            await refetch();
            setTimeout(() => setIsRefreshing(false), 500);
          }}
          size="small"
          sx={{
            borderRadius: '4px',
            textTransform: 'none',
            borderColor: '#37393e',
            color: '#94A3B8',
            boxShadow: 'none',
            '&:hover': { borderColor: '#00ffc2', color: '#00ffc2', bgcolor: 'transparent' },
          }}
        >
          Refresh
        </Button>
      </Box>

      {/* DLQ Table */}
      <Paper elevation={0} sx={{ borderRadius: '4px', overflowX: 'auto', boxShadow: 'none', bgcolor: '#1B1E24', border: '1px solid #37393e' }}>
        {isLoading ? (
          <Box display="flex" justifyContent="center" p={6}><CircularProgress sx={{ color: '#00ffc2' }} /></Box>
        ) : entries && entries.length > 0 ? (
          <Table>
            <TableHead sx={{ bgcolor: '#181A20' }}>
              <TableRow>
                <TableCell sx={{ color: '#94A3B8', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: '1px solid #37393e' }}>Job ID</TableCell>
                <TableCell sx={{ color: '#94A3B8', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: '1px solid #37393e' }}>Failure Reason</TableCell>
                <TableCell sx={{ color: '#94A3B8', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: '1px solid #37393e' }}>Final Payload</TableCell>
                <TableCell sx={{ color: '#94A3B8', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: '1px solid #37393e' }}>Failed Timestamp</TableCell>
                <TableCell align="right" sx={{ color: '#94A3B8', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: '1px solid #37393e' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id} hover sx={{ '&:hover': { bgcolor: 'rgba(0, 255, 194, 0.03)' } }}>
                  <TableCell sx={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.82rem', color: '#ffffff' }}>
                    {entry.job_id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: '#ff4d4d', fontWeight: 600, maxWidth: 300, fontFamily: 'var(--font-mono)' }} noWrap>
                      {entry.reason}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 220, fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: '#94A3B8' }}>
                      {JSON.stringify(entry.final_payload)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8rem', color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>
                    {new Date(entry.failed_at).toLocaleString()}
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <Tooltip title="View Payload Snapshot">
                        <IconButton size="small" onClick={() => setSelectedEntry(entry)} sx={{ color: '#94A3B8' }}>
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<ReplayIcon />}
                        onClick={() => retryMutation.mutate(entry.job_id)}
                        disabled={retryMutation.isPending}
                        sx={{
                          textTransform: 'none',
                          borderRadius: '4px',
                          boxShadow: 'none',
                          bgcolor: '#ffb800',
                          color: '#111317',
                          fontWeight: 800,
                          '&:hover': { bgcolor: '#ffc533', boxShadow: 'none' },
                        }}
                      >
                        Replay
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" fontWeight={700} sx={{ color: '#00ffc2' }}>
              DLQ is Clean & Empty
            </Typography>
            <Typography variant="body2" sx={{ color: '#94A3B8', mt: 0.5 }}>
              No permanent failures have been recorded.
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Snapshot Dialog */}
      <Dialog
        open={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
        maxWidth="sm"
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
        <DialogTitle sx={{ color: '#ffffff', fontWeight: 700 }}>Dead Letter Entry Details</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Box>
            <Typography variant="caption" sx={{ color: '#94A3B8' }}>Permanent Failure Reason</Typography>
            <Typography variant="body2" sx={{ color: '#ff4d4d', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{selectedEntry?.reason}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: '#94A3B8' }}>Final Payload Snapshot</Typography>
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
                mt: 0.5,
              }}
            >
              <pre style={{ margin: 0 }}>
                {JSON.stringify(selectedEntry?.final_payload, null, 2)}
              </pre>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSelectedEntry(null)}>Close</Button>
          {selectedEntry && (
            <Button
              variant="contained"
              color="warning"
              startIcon={<ReplayIcon />}
              onClick={() => retryMutation.mutate(selectedEntry.job_id)}
              disabled={retryMutation.isPending}
            >
              Replay Job
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};
