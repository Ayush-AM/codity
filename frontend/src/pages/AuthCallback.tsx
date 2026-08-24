import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { authApi } from '../api/auth';

export const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const processedRef = React.useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const handleOAuthCallback = async () => {
      const code = searchParams.get('code');
      const provider = searchParams.get('provider') || searchParams.get('state') || 'google';
      const email = searchParams.get('email') || undefined;
      const name = searchParams.get('name') || undefined;

      if (!code && !email) {
        setError('No authorization code or OAuth parameters found in URL callback.');
        return;
      }

      try {
        const res = await authApi.oauthLogin({
          provider,
          code: code || undefined,
          email: email || undefined,
          full_name: name || undefined,
        });

        localStorage.setItem('token', res.access_token);
        localStorage.setItem('user', JSON.stringify(res.user));
        navigate('/dashboard', { replace: true });
      } catch (err: any) {
        const msg =
          err.response?.data?.detail ||
          (typeof err.response?.data === 'string'
            ? err.response?.data
            : 'OAuth authentication failed. Please try again.');
        setError(msg);
      }
    };

    handleOAuthCallback();
  }, [searchParams, navigate]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: '#111317',
        p: 3,
      }}
    >
      <Box
        sx={{
          bgcolor: '#181A20',
          border: '1px solid #37393e',
          borderRadius: '4px',
          p: 5,
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
        }}
      >
        {error ? (
          <>
            <Alert severity="error" sx={{ mb: 3, borderRadius: '4px' }}>
              {error}
            </Alert>
            <Typography
              variant="body2"
              sx={{ color: '#00ffc2', cursor: 'pointer', fontWeight: 700 }}
              onClick={() => navigate('/login')}
            >
              Return to Login
            </Typography>
          </>
        ) : (
          <>
            <CircularProgress size={44} sx={{ color: '#00ffc2', mb: 3 }} />
            <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 1, fontFamily: 'var(--font-mono)' }}>
              Completing OAuth Sign In...
            </Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
              Authenticating credentials and preparing tenant environment.
            </Typography>
          </>
        )}
      </Box>
    </Box>
  );
};

export default AuthCallback;
