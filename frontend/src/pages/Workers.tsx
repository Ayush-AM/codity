import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Chip,
} from '@mui/material';
import { Refresh as RefreshIcon, DeleteOutline as DeleteOutlineIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workersApi } from '../api/workers';
import { WorkerCard } from '../components/WorkerCard';

export const Workers: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'dead'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: allWorkers, isLoading, refetch } = useQuery({
    queryKey: ['workers-all'],
    queryFn: () => workersApi.getWorkers(),
    refetchInterval: 3000,
  });

  const pruneMutation = useMutation({
    mutationFn: () => workersApi.pruneDeadWorkers(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers-all'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workersApi.deleteWorker(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers-all'] });
    },
  });

  const totalCount = allWorkers?.length ?? 0;
  const activeCount = allWorkers?.filter((w) => w.status === 'active').length ?? 0;
  const deadCount = allWorkers?.filter((w) => w.status === 'dead').length ?? 0;

  const displayedWorkers = React.useMemo(() => {
    if (!allWorkers) return [];
    if (statusFilter === 'active') return allWorkers.filter((w) => w.status === 'active');
    if (statusFilter === 'dead') return allWorkers.filter((w) => w.status === 'dead');
    return allWorkers;
  }, [allWorkers, statusFilter]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Worker Nodes & Heartbeats
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Live consumer processes pulling tasks via atomic <code>FOR UPDATE SKIP LOCKED</code>
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Chip label={`${activeCount} Active`} color="success" sx={{ fontWeight: 700, borderRadius: '4px' }} />
          <Chip label={`${deadCount} Dead`} color={deadCount > 0 ? 'error' : 'default'} sx={{ fontWeight: 700, borderRadius: '4px' }} />
          
          {deadCount > 0 && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={() => pruneMutation.mutate()}
              disabled={pruneMutation.isPending}
              size="small"
              sx={{ borderRadius: '6px', textTransform: 'none', boxShadow: 'none' }}
            >
              {pruneMutation.isPending ? 'Pruning...' : 'Prune Dead'}
            </Button>
          )}

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
            sx={{ borderRadius: '6px', textTransform: 'none', boxShadow: 'none' }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Filter */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: '4px',
          bgcolor: '#1B1E24',
          border: '1px solid #37393e',
          boxShadow: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <TextField
          select
          size="small"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          sx={{
            minWidth: 220,
            '& .MuiOutlinedInput-root': {
              borderRadius: '4px',
              bgcolor: '#181A20',
              color: '#ffffff',
              fontSize: '0.88rem',
              fontWeight: 600,
              '& fieldset': {
                borderColor: '#37393e',
              },
              '&:hover fieldset': {
                borderColor: '#00ffc2',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#00ffc2',
              },
            },
          }}
        >
          <MenuItem value="all">All Workers ({totalCount})</MenuItem>
          <MenuItem value="active">Active ({activeCount})</MenuItem>
          <MenuItem value="dead">Dead / Timed Out ({deadCount})</MenuItem>
        </TextField>
      </Paper>

      {/* Workers Grid */}
      {isLoading ? (
        <Box display="flex" justifyContent="center" p={6}><CircularProgress /></Box>
      ) : displayedWorkers.length > 0 ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: '1fr 1fr 1fr' },
            gap: 2.5,
          }}
        >
          {displayedWorkers.map((w) => (
            <WorkerCard key={w.id} worker={w} onDelete={(id) => deleteMutation.mutate(id)} />
          ))}
        </Box>
      ) : (
        <Typography color="text.secondary" textAlign="center" py={6}>
          No worker processes currently detected. Run <code>python -m app.workers.main_worker --queue-id &lt;UUID&gt;</code> to start a worker.
        </Typography>
      )}
    </Box>
  );
};
