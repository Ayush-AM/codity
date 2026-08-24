// Updated with OAuth Buttons
import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  IconButton,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  AutoAwesome,
  FlashOn,
  GitHub,
  Google,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../api/auth';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.getOAuthUrl(provider);
      window.location.href = res.authorize_url;
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to initialize OAuth authorization.';
      setError(msg);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister && !termsAccepted) {
      setError('You must agree to the terms and conditions.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (!isRegister) {
        await login({ email, password });
        navigate('/dashboard');
      } else {
        const res = await authApi.register({
          email,
          password,
          full_name: `${firstName} ${lastName}`.trim(),
          organization_name: 'Default Org',
        });
        localStorage.setItem('token', res.access_token);
        localStorage.setItem('user', JSON.stringify(res.user));
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        (typeof err.response?.data === 'string' ? err.response?.data : 'Authentication failed. Please check your credentials.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fillAdminCredentials = () => {
    setEmail('admin@example.com');
    setPassword('StrongP@ss123');
    setIsRegister(false);
  };

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '4px',
      backgroundColor: '#181A20',
      color: '#ffffff',
      fontFamily: 'var(--font-mono)',
      '& fieldset': { border: '1px solid #37393e' },
      '&:hover fieldset': { border: '1px solid #00ffc2' },
      '&.Mui-focused fieldset': {
        border: '1px solid #00ffc2',
      },
    },
    '& .MuiInputBase-input': {
      padding: '14px 16px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.9rem',
      '&::placeholder': { color: '#94a3b8', opacity: 1 },
    },
  };

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: '#111317',
        backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Left Panel - Branding */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          width: { md: '45%', lg: '50%' },
          position: 'relative',
          bgcolor: '#181A20',
          borderRight: '1px solid #37393e',
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 6,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h5" sx={{ color: '#ffffff', fontWeight: 800, letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
            Codity
          </Typography>
        </Box>

        <Box sx={{ mb: 6 }}>
          <Typography variant="h3" sx={{ color: '#ffffff', fontWeight: 800, mb: 2, letterSpacing: '-0.02em', lineHeight: 1.2, fontFamily: 'var(--font-mono)' }}>
            Distributed Job Scheduling Engine
          </Typography>
          <Typography variant="body1" sx={{ color: '#94a3b8', fontSize: '1.05rem', maxWidth: 480, fontFamily: 'var(--font-mono)', lineHeight: 1.7 }}>
            Ultra-reliable background task processing, cron automation, atomic queue claims, and fault-tolerant dead letter recovery.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#00ffc2', boxShadow: '0 0 8px #00ffc2' }} />
          <Typography variant="caption" sx={{ color: '#94a3b8', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
            Codity Engine v1.0.0 &bull; Enterprise Reliability Framework
          </Typography>
        </Box>
      </Box>

      {/* Right Panel - Form */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          p: { xs: 3, md: 8 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 420 }}>
          <Typography variant="h4" sx={{ color: '#ffffff', fontWeight: 800, mb: 1, letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
            {isRegister ? 'Create an account' : 'Sign in to Codity'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8', mb: 4, fontFamily: 'var(--font-mono)' }}>
            {isRegister ? 'Already registered? ' : 'Don\'t have an account? '}
            <Box
              component="span"
              sx={{ color: '#00ffc2', cursor: 'pointer', fontWeight: 700, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              onClick={() => { setIsRegister(!isRegister); setError(null); }}
            >
              {isRegister ? 'Sign in' : 'Create an account'}
            </Box>
          </Typography>

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                borderRadius: '4px',
                bgcolor: 'rgba(255, 77, 77, 0.1)',
                border: '1px solid rgba(255, 77, 77, 0.3)',
                color: '#ff4d4d',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
              }}
            >
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {isRegister && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  placeholder="First name"
                  required
                  fullWidth
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  sx={inputSx}
                />
                <TextField
                  placeholder="Last name"
                  required
                  fullWidth
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  sx={inputSx}
                />
              </Box>
            )}

            <TextField
              placeholder="Email address"
              type="email"
              required
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={inputSx}
            />

            <TextField
              placeholder="Enter your password"
              type={showPassword ? 'text' : 'password'}
              required
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={inputSx}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      sx={{ color: '#94a3b8', '&:hover': { color: '#00ffc2' } }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {isRegister && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    sx={{
                      color: '#94a3b8',
                      '&.Mui-checked': { color: '#00ffc2' },
                    }}
                  />
                }
                label={
                  <Typography sx={{ color: '#94a3b8', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
                    I accept the terms of service and multi-tenant security policies.
                  </Typography>
                }
              />
            )}

            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{
                bgcolor: '#00ffc2',
                color: '#111317',
                py: 1.5,
                borderRadius: '4px',
                textTransform: 'none',
                fontWeight: 800,
                fontSize: '0.95rem',
                fontFamily: 'var(--font-mono)',
                mt: 1,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#33ffce', boxShadow: 'none' },
                '&:disabled': { bgcolor: '#37393e', color: '#94a3b8' }
              }}
            >
              {loading ? <CircularProgress size={22} sx={{ color: '#111317' }} /> : (isRegister ? 'Register Organization & Account' : 'Sign In')}
            </Button>

            <Divider
              sx={{
                my: 1.5,
                borderColor: '#37393e',
                color: '#94a3b8',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.05em',
              }}
            >
              OR CONTINUE WITH OAUTH
            </Divider>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                fullWidth
                disabled={loading}
                onClick={() => handleOAuthLogin('google')}
                startIcon={<Google sx={{ color: '#ea4335' }} />}
                sx={{
                  color: '#ffffff',
                  borderColor: '#37393e',
                  borderRadius: '4px',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  py: 1.2,
                  bgcolor: '#181A20',
                  '&:hover': { borderColor: '#ea4335', bgcolor: 'rgba(234, 67, 53, 0.08)' }
                }}
              >
                Google
              </Button>

              <Button
                variant="outlined"
                fullWidth
                disabled={loading}
                onClick={() => handleOAuthLogin('github')}
                startIcon={<GitHub sx={{ color: '#ffffff' }} />}
                sx={{
                  color: '#ffffff',
                  borderColor: '#37393e',
                  borderRadius: '4px',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  py: 1.2,
                  bgcolor: '#181A20',
                  '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255, 255, 255, 0.08)' }
                }}
              >
                GitHub
              </Button>
            </Box>

            <Button
              variant="outlined"
              onClick={fillAdminCredentials}
              startIcon={<AutoAwesome sx={{ color: '#00ffc2' }} />}
              sx={{
                color: '#ffffff',
                borderColor: '#37393e',
                borderRadius: '4px',
                textTransform: 'none',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                py: 1.2,
                mt: 1,
                boxShadow: 'none',
                bgcolor: '#181A20',
                '&:hover': { borderColor: '#00ffc2', color: '#00ffc2', bgcolor: '#181A20', boxShadow: 'none' }
              }}
            >
              Autofill Demo Admin Credentials
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;
