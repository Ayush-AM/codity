import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Layers as LayersIcon,
  Group as GroupIcon,
  Cached as RetryIcon,
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Queue, queuesApi, UpdateQueuePayload } from '../api/queues';
import { useAuth } from '../hooks/useAuth';

interface QueueCardProps {
  queue: Queue;
}

export const QueueCard: React.FC<QueueCardProps> = ({ queue }) => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [formData, setFormData] = useState<UpdateQueuePayload>({
    name: queue.name,
    description: queue.description || '',
    priority: queue.priority,
    concurrency_limit: queue.concurrency_limit,
    retry_policy: queue.retry_policy,
  });

  useEffect(() => {
    if (editOpen) {
      setFormData({
        name: queue.name,
        description: queue.description || '',
        priority: queue.priority,
        concurrency_limit: queue.concurrency_limit,
        retry_policy: queue.retry_policy,
      });
    }
  }, [editOpen, queue]);

  const pauseMutation = useMutation({
    mutationFn: () => (queue.is_paused ? queuesApi.resumeQueue(queue.id) : queuesApi.pauseQueue(queue.id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queues'] }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateQueuePayload) => queuesApi.updateQueue(queue.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queues'] });
      setEditOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (force?: boolean) => queuesApi.deleteQueue(queue.id, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queues'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['system-metrics'] });
      setDeleteOpen(false);
      setDeleteError(null);
    },
    onError: (err: any) => {
      setDeleteError(err.response?.data?.detail || err.message || 'Failed to delete queue');
    },
  });

  return (
    <>
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
          minHeight: '260px',
          transition: 'all 0.15s ease',
          '&:hover': {
            borderColor: queue.is_paused ? '#ffb800' : '#00ffc2',
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
              bgcolor: queue.is_paused ? 'rgba(255, 184, 0, 0.1)' : 'rgba(0, 255, 194, 0.1)',
              border: `1px solid ${queue.is_paused ? 'rgba(255, 184, 0, 0.3)' : 'rgba(0, 255, 194, 0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: queue.is_paused ? '#ffb800' : '#00ffc2',
              boxShadow: 'none',
            }}
          >
            <LayersIcon sx={{ fontSize: '1.3rem' }} />
          </Box>

          <Chip
            size="small"
            label={queue.is_paused ? 'PAUSED' : 'ACTIVE'}
            sx={{
              fontWeight: 700,
              fontSize: '0.68rem',
              height: 22,
              borderRadius: '4px',
              bgcolor: queue.is_paused ? 'rgba(255, 184, 0, 0.1)' : 'rgba(0, 255, 194, 0.1)',
              color: queue.is_paused ? '#ffb800' : '#00ffc2',
              border: `1px solid ${queue.is_paused ? 'rgba(255, 184, 0, 0.3)' : 'rgba(0, 255, 194, 0.3)'}`,
              fontFamily: 'var(--font-mono)',
            }}
          />
        </Box>

        {/* Title & Description */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#ffffff', fontSize: '1.05rem', mb: 0.5, fontFamily: 'var(--font-mono)' }}>
            {queue.name}
          </Typography>
          <Typography variant="body2" sx={{ color: '#94A3B8', fontSize: '0.82rem', minHeight: '36px' }}>
            {queue.description || 'General workload distribution channel'}
          </Typography>
        </Box>

        {/* Metrics Grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 1.5,
            p: 1.5,
            bgcolor: '#181A20',
            borderRadius: '4px',
            border: '1px solid #37393e',
            mb: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GroupIcon sx={{ fontSize: '1rem', color: '#94A3B8' }} />
            <Box>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.68rem', display: 'block' }}>
                Max Concurrency
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#ffffff', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
                {queue.concurrency_limit} max jobs
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RetryIcon sx={{ fontSize: '1rem', color: '#94A3B8' }} />
            <Box>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.68rem', display: 'block' }}>
                Retry Policy
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#ffffff', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
                {queue.retry_policy?.strategy?.toUpperCase()} ({queue.retry_policy?.max_retries}x)
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Actions */}
        {isAdmin && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={queue.is_paused ? <PlayIcon /> : <PauseIcon />}
              onClick={() => pauseMutation.mutate()}
              disabled={pauseMutation.isPending}
              sx={{
                borderRadius: '4px',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.78rem',
                borderColor: queue.is_paused ? '#00ffc2' : '#ffb800',
                color: queue.is_paused ? '#00ffc2' : '#ffb800',
                boxShadow: 'none',
                '&:hover': {
                  bgcolor: queue.is_paused ? 'rgba(0, 255, 194, 0.1)' : 'rgba(255, 184, 0, 0.1)',
                  boxShadow: 'none',
                },
              }}
            >
              {queue.is_paused ? 'Resume' : 'Pause'}
            </Button>

            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Edit Configuration">
                <IconButton
                  size="small"
                  onClick={() => setEditOpen(true)}
                  sx={{ color: '#94A3B8', '&:hover': { color: '#ffffff', bgcolor: 'rgba(255,255,255,0.06)' } }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete Queue">
                <IconButton
                  size="small"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteOpen(true);
                  }}
                  sx={{ color: '#94A3B8', '&:hover': { color: '#ff4d4d', bgcolor: 'rgba(255,77,77,0.1)' } }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Edit Queue Dialog */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
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
        <DialogTitle sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.2rem', pb: 1, fontFamily: 'var(--font-mono)' }}>
          Edit Queue: {queue.name}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '28px !important' }}>
          <TextField
            label="Queue Name"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={{
              '& .MuiInputLabel-root': { color: '#94A3B8' },
              '& .MuiOutlinedInput-root': {
                borderRadius: '4px',
                bgcolor: '#181A20',
                '& fieldset': { borderColor: '#37393e' },
                '&:hover fieldset': { borderColor: '#00ffc2' },
                '&.Mui-focused fieldset': { borderColor: '#00ffc2' },
              },
              '& .MuiInputBase-input': { color: '#ffffff', fontFamily: 'var(--font-mono)' },
            }}
          />
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={2}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            sx={{
              '& .MuiInputLabel-root': { color: '#94A3B8' },
              '& .MuiOutlinedInput-root': {
                borderRadius: '4px',
                bgcolor: '#181A20',
                '& fieldset': { borderColor: '#37393e' },
                '&:hover fieldset': { borderColor: '#00ffc2' },
                '&.Mui-focused fieldset': { borderColor: '#00ffc2' },
              },
              '& .MuiInputBase-input': { color: '#ffffff', fontFamily: 'var(--font-mono)' },
            }}
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField
              label="Priority (0-100)"
              type="number"
              value={formData.priority === undefined ? '' : formData.priority}
              onChange={(e) => {
                const val = e.target.value;
                setFormData({ ...formData, priority: val === '' ? ('' as any) : parseInt(val) });
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
                '& .MuiInputBase-input': { color: '#ffffff', fontFamily: 'var(--font-mono)' },
                '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': { display: 'none' },
                '& input[type=number]': { MozAppearance: 'textfield' },
              }}
            />
            <TextField
              label="Concurrency Limit"
              type="number"
              value={formData.concurrency_limit === undefined ? '' : formData.concurrency_limit}
              onChange={(e) => {
                const val = e.target.value;
                setFormData({ ...formData, concurrency_limit: val === '' ? ('' as any) : parseInt(val) });
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
                '& .MuiInputBase-input': { color: '#ffffff', fontFamily: 'var(--font-mono)' },
                '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': { display: 'none' },
                '& input[type=number]': { MozAppearance: 'textfield' },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #37393e' }}>
          <Button onClick={() => setEditOpen(false)} sx={{ color: '#94A3B8', textTransform: 'none', fontWeight: 600, '&:hover': { color: '#ffffff' } }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => updateMutation.mutate({
              ...formData,
              priority: formData.priority !== undefined && formData.priority !== ('' as any) ? formData.priority : 0,
              concurrency_limit: formData.concurrency_limit !== undefined && formData.concurrency_limit !== ('' as any) ? formData.concurrency_limit : 1
            })}
            disabled={updateMutation.isPending}
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
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '4px',
            bgcolor: '#1B1E24',
            border: '1px solid #37393e',
            p: 1,
          },
        }}
      >
        <DialogTitle sx={{ color: '#ffffff', fontWeight: 700 }}>Delete Queue: {queue.name}?</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          {deleteError && (
            <Alert severity="error" sx={{ borderRadius: '4px', bgcolor: 'rgba(255, 77, 77, 0.1)', color: '#ff4d4d', border: '1px solid rgba(255, 77, 77, 0.3)' }}>
              {deleteError}
            </Alert>
          )}
          <Typography variant="body2" sx={{ color: '#94A3B8' }}>
            Are you sure you want to delete this queue? Note that queues with active jobs require Force Delete to purge remaining workloads.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #37393e', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={() => setDeleteOpen(false)} sx={{ color: '#94A3B8', '&:hover': { color: '#ffffff' } }}>
            Cancel
          </Button>
          <Button
            variant="outlined"
            onClick={() => deleteMutation.mutate(false)}
            disabled={deleteMutation.isPending}
            sx={{ borderRadius: '4px', borderColor: '#ff4d4d', color: '#ff4d4d', '&:hover': { borderColor: '#ff4d4d', bgcolor: 'rgba(255, 77, 77, 0.1)' } }}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete Queue'}
          </Button>
          <Button
            variant="contained"
            onClick={() => deleteMutation.mutate(true)}
            disabled={deleteMutation.isPending}
            sx={{ borderRadius: '4px', bgcolor: '#ff4d4d', color: '#ffffff', fontWeight: 700, boxShadow: 'none', '&:hover': { bgcolor: '#e63939', boxShadow: 'none' } }}
          >
            {deleteMutation.isPending ? 'Purging...' : 'Force Delete (Purge)'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
