import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  Paper,
} from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon, Layers as QueueIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queuesApi, CreateQueuePayload } from '../api/queues';
import { projectsApi } from '../api/projects';
import { QueueCard } from '../components/QueueCard';
import { useAuth } from '../hooks/useAuth';

export const Queues: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [formData, setFormData] = useState<CreateQueuePayload>({
    name: '',
    description: '',
    priority: 0,
    concurrency_limit: 5,
    retry_policy: {
      strategy: 'exponential',
      base_delay: 10,
      max_retries: 3,
    },
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getProjects(),
  });

  const projectId = projects?.[0]?.id;

  const { data: queues, isLoading, refetch } = useQuery({
    queryKey: ['queues', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      return queuesApi.getQueuesByProject(projectId);
    },
    enabled: !!projectId,
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateQueuePayload) => {
      let activeProjId = projectId;
      if (!activeProjId) {
        const newProj = await projectsApi.createProject('Main Project', 'Primary workload channels');
        activeProjId = newProj.id;
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      }
      return queuesApi.createQueue(activeProjId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queues'] });
      setCreateOpen(false);
      setError(null);
      setFormData({
        name: '',
        description: '',
        priority: 0,
        concurrency_limit: 5,
        retry_policy: { strategy: 'exponential', base_delay: 10, max_retries: 3 },
      });
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || err.message || 'Failed to create queue');
    },
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Queue Partitions & Channels
          </Typography>
          <Typography variant="body2" sx={{ color: '#908AAB', fontSize: '0.85rem' }}>
            Configure priority, concurrency limits, and retry policies for distributed workers
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
            onClick={async () => {
              setIsRefreshing(true);
              await refetch();
              setTimeout(() => setIsRefreshing(false), 500);
            }}
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

          {isAdmin && (
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => {
                setError(null);
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
              New Queue
            </Button>
          )}
        </Box>
      </Box>

      {/* Content */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress sx={{ color: '#7356F1' }} />
        </Box>
      ) : queues && queues.length > 0 ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: '1fr 1fr 1fr' },
            gap: 3,
          }}
        >
          {queues.map((queue) => (
            <QueueCard key={queue.id} queue={queue} />
          ))}
        </Box>
      ) : (
        <Paper
          elevation={0}
          sx={{
            p: 8,
            borderRadius: '4px',
            bgcolor: '#1B1E24',
            border: '1px solid #37393e',
            textAlign: 'center',
            color: '#94A3B8',
          }}
        >
          <QueueIcon sx={{ fontSize: 56, color: 'rgba(255,255,255,0.1)', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#ffffff', mb: 1 }}>
            No Queues Configured
          </Typography>
          <Typography variant="body2" sx={{ maxWidth: 450, mx: 'auto', mb: 3 }}>
            Create your first queue channel to start routing, prioritizing, and scheduling background jobs.
          </Typography>
          {isAdmin && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateOpen(true)}
              sx={{
                bgcolor: '#7356F1',
                borderRadius: '14px',
                fontWeight: 700,
                textTransform: 'none',
                px: 3,
                py: 1,
                boxShadow: '0 8px 24px rgba(115, 86, 241, 0.35)',
                '&:hover': { bgcolor: '#6347D4' },
              }}
            >
              Create Default Queue
            </Button>
          )}
        </Paper>
      )}

      {/* Create Queue Dialog */}
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
          Create New Queue Partition
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '28px !important' }}>
          {error && (
            <Alert severity="error" sx={{ borderRadius: '4px', bgcolor: 'rgba(255, 77, 77, 0.1)', color: '#ff4d4d', border: '1px solid rgba(255, 77, 77, 0.3)' }}>
              {error}
            </Alert>
          )}

          <TextField
            label="Queue Identifier"
            placeholder="e.g. email-queue, media-transcode"
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
            }}
          />

          <TextField
            label="Description (Optional)"
            placeholder="Describe the workload type"
            fullWidth
            multiline
            rows={2}
            value={formData.description || ''}
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
            }}
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              label="Priority (0 = Highest)"
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
                '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': { display: 'none' },
                '& input[type=number]': { MozAppearance: 'textfield', fontFamily: 'var(--font-mono)' },
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
                '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': { display: 'none' },
                '& input[type=number]': { MozAppearance: 'textfield', fontFamily: 'var(--font-mono)' },
              }}
            />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
            <TextField
              select
              label="Retry Strategy"
              value={formData.retry_policy?.strategy || 'exponential'}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  retry_policy: {
                    ...formData.retry_policy!,
                    strategy: e.target.value as 'fixed' | 'linear' | 'exponential',
                  },
                })
              }
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
              <MenuItem value="fixed">Fixed Delay</MenuItem>
              <MenuItem value="linear">Linear Backoff</MenuItem>
              <MenuItem value="exponential">Exponential Backoff</MenuItem>
            </TextField>

            <TextField
              label="Base Delay (s)"
              type="number"
              value={formData.retry_policy?.base_delay === undefined ? '' : formData.retry_policy?.base_delay}
              onChange={(e) => {
                const val = e.target.value;
                setFormData({
                  ...formData,
                  retry_policy: {
                    strategy: formData.retry_policy?.strategy || 'exponential',
                    max_retries: formData.retry_policy?.max_retries || 3,
                    base_delay: val === '' ? ('' as any) : parseInt(val),
                  },
                });
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
              value={formData.retry_policy?.max_retries === undefined ? '' : formData.retry_policy?.max_retries}
              onChange={(e) => {
                const val = e.target.value;
                setFormData({
                  ...formData,
                  retry_policy: {
                    strategy: formData.retry_policy?.strategy || 'exponential',
                    base_delay: formData.retry_policy?.base_delay || 10,
                    max_retries: val === '' ? ('' as any) : parseInt(val),
                  },
                });
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
        </DialogContent>

        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #37393e' }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ color: '#94A3B8', textTransform: 'none', fontWeight: 600, '&:hover': { color: '#ffffff' } }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() =>
              createMutation.mutate({
                ...formData,
                priority: formData.priority !== undefined && formData.priority !== ('' as any) ? formData.priority : 0,
                concurrency_limit:
                  formData.concurrency_limit !== undefined && formData.concurrency_limit !== ('' as any)
                    ? formData.concurrency_limit
                    : 1,
                retry_policy: formData.retry_policy
                  ? {
                      ...formData.retry_policy,
                      base_delay:
                        formData.retry_policy.base_delay !== undefined && formData.retry_policy.base_delay !== ('' as any)
                          ? formData.retry_policy.base_delay
                          : 10,
                      max_retries:
                        formData.retry_policy.max_retries !== undefined && formData.retry_policy.max_retries !== ('' as any)
                          ? formData.retry_policy.max_retries
                          : 3,
                    }
                  : undefined,
              })
            }
            disabled={createMutation.isPending || !formData.name.trim()}
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
            {createMutation.isPending ? 'Creating...' : 'Create Queue'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
