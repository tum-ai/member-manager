import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  TextField,
  Typography,
  Paper,
  Box,
  Container,
  CircularProgress,
} from '@mui/material';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // This effect will run when the component mounts to check for errors in the URL.
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const errorCode = params.get('error_code');
    const errorDescription = params.get('error_description');

    if (errorCode) {
      // If there's an error in the URL, display it and stop.
      console.error('Error during password recovery:', errorCode, errorDescription);
      setError(errorDescription?.replace(/\+/g, ' ') || 'An unknown error occurred.');
    }
  }, []);

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    // The session is now implicitly handled by the supabase client
    // because the PASSWORD_RECOVERY event has been processed.
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      console.error('Error updating password:', updateError);
    } else {
      setMessage('Your password has been updated successfully. You will be redirected to the login page.');
      // Sign out to clear the temporary recovery session
      console.log('Password updated successfully, signing out...');
      await supabase.auth.signOut();
      setTimeout(() => navigate('/auth', { replace: true }), 3000);
    }
    setLoading(false);
  };

  return (
    <Container
      maxWidth="xs"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          padding: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          width: '100%',
        }}
      >
        <Typography variant="h5" component="h1" align="center">
          Update Your Password
        </Typography>
        <form onSubmit={handlePasswordUpdate}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="New Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              disabled={loading || !!error} // Disable if loading or if there was an initial error
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={loading || !!error}
              sx={{ mt: 2, height: 48 }}>
              {loading ? <CircularProgress size={24} /> : 'Update Password'}
            </Button>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => navigate('/auth')}
              sx={{ mt: 2, height: 48 }}>
              Back to Login
            </Button>
          </Box>
        </form>
        {message && (
          <Typography color="primary.main" align="center" sx={{ mt: 2 }}>
            {message}
          </Typography>
        )}
        {error && (
          <Typography color="error" align="center" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
      </Paper>
    </Container>
  );
}