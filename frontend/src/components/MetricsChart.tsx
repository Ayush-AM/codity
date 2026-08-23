import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Paper, Typography, Box, Chip } from '@mui/material';
import { ShowChart as ChartIcon } from '@mui/icons-material';

interface DataPoint {
  time: string;
  completed: number;
  failed: number;
}

interface MetricsChartProps {
  data: DataPoint[];
  title?: string;
}

export const MetricsChart: React.FC<MetricsChartProps> = ({
  data,
  title = 'Job Throughput & Execution Trends',
}) => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: '4px',
        bgcolor: '#1B1E24',
        border: '1px solid #37393e',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, position: 'relative' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <ChartIcon sx={{ color: '#00ffc2', fontSize: '1.15rem' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: '#ffffff' }}>
              {title}
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: '#94A3B8' }}>
            Last 24 hours · Updated every 5 seconds
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Chip
            size="small"
            label="Completed"
            sx={{
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 24,
              borderRadius: '4px',
              bgcolor: 'rgba(0, 255, 194, 0.1)',
              color: '#00ffc2',
              fontFamily: 'var(--font-mono)',
              '&::before': {
                content: '""',
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: '#00ffc2',
                mr: 0.5,
              },
            }}
          />
          <Chip
            size="small"
            label="Failed"
            sx={{
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 24,
              borderRadius: '4px',
              bgcolor: 'rgba(255, 77, 77, 0.1)',
              color: '#ff4d4d',
              fontFamily: 'var(--font-mono)',
              '&::before': {
                content: '""',
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: '#ff4d4d',
                mr: 0.5,
              },
            }}
          />
        </Box>
      </Box>

      <Box sx={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00ffc2" stopOpacity={0.3} />
                <stop offset="50%" stopColor="#00ffc2" stopOpacity={0.08} />
                <stop offset="95%" stopColor="#00ffc2" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="failedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff4d4d" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#ff4d4d" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#37393e" />
            <XAxis
              dataKey="time"
              stroke="#94A3B8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              fontWeight={500}
            />
            <YAxis
              stroke="#94A3B8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              fontWeight={500}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#181A20',
                borderRadius: '4px',
                border: '1px solid #37393e',
                color: '#ffffff',
                fontSize: '0.8rem',
                boxShadow: 'none',
                padding: '10px 14px',
              }}
              cursor={{ stroke: 'rgba(0, 255, 194, 0.2)', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Area
              type="monotone"
              dataKey="completed"
              stroke="#00ffc2"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#completedGrad)"
              dot={false}
              activeDot={{
                r: 5,
                fill: '#00ffc2',
                stroke: '#111317',
                strokeWidth: 2,
              }}
            />
            <Area
              type="monotone"
              dataKey="failed"
              stroke="#ff4d4d"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#failedGrad)"
              dot={false}
              activeDot={{
                r: 4,
                fill: '#ff4d4d',
                stroke: '#111317',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};
