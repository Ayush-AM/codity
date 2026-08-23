import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Box, CircularProgress } from '@mui/material';
import { AuthProvider } from './context/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';
import { Layout } from './components/Layout';

const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const Jobs = lazy(() => import('./pages/Jobs').then((module) => ({ default: module.Jobs })));
const Queues = lazy(() => import('./pages/Queues').then((module) => ({ default: module.Queues })));
const Workers = lazy(() => import('./pages/Workers').then((module) => ({ default: module.Workers })));
const DLQ = lazy(() => import('./pages/DLQ').then((module) => ({ default: module.DLQ })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00ffc2',
      light: '#33ffce',
      dark: '#00cc9b',
      contrastText: '#111317',
    },
    secondary: {
      main: '#ffb800',
      light: '#ffc633',
      dark: '#cc9300',
    },
    background: {
      default: '#111317',
      paper: '#1B1E24',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#94A3B8',
    },
    success: {
      main: '#00ffc2',
    },
    error: {
      main: '#ff4d4d',
    },
    warning: {
      main: '#ffb800',
    },
    info: {
      main: '#00ffc2',
    },
    divider: '#37393e',
  },
  typography: {
    fontFamily: '"JetBrains Mono", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 4,
          boxShadow: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1B1E24',
          border: '1px solid #37393e',
          borderRadius: 4,
          boxShadow: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #37393e',
        },
        head: {
          fontWeight: 700,
          color: '#94A3B8',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#181A20',
          borderRadius: 4,
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
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1B1E24',
          border: '1px solid #37393e',
          backgroundImage: 'none',
          borderRadius: 4,
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1B1E24',
          border: '1px solid #37393e',
          backgroundImage: 'none',
          borderRadius: 4,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#181A20',
          border: '1px solid #37393e',
          backgroundImage: 'none',
          borderRadius: 4,
        },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: {
          color: '#94A3B8',
          '&.Mui-checked': {
            color: '#00ffc2',
          },
        },
      },
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <AuthProvider>
          <BrowserRouter>
            <Suspense
              fallback={
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
                  <CircularProgress />
                </Box>
              }
            >
              <Routes>
                {/* Public route */}
                <Route path="/login" element={<Login />} />

                {/* Protected dashboard routes */}
                <Route element={<PrivateRoute />}>
                  <Route element={<Layout />}>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/jobs" element={<Jobs />} />
                    <Route path="/queues" element={<Queues />} />
                    <Route path="/workers" element={<Workers />} />
                    <Route path="/dlq" element={<DLQ />} />
                  </Route>
                </Route>

                {/* Catch-all fallback */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};
