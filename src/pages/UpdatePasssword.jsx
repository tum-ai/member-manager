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
  const [isReady, setIsReady] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    // This effect will run when the component mounts and handle the recovery event.
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const errorCode = params.get('error_code');
    const errorDescription = params.get('error_description');

    if (errorCode) {
      // If there's an error in the URL, display it and stop.
      setError(errorDescription?.replace(/\+/g, ' ') || 'An unknown error occurred.');
      return; // Don't proceed to set up the listener.
    }


    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // The PASSWORD_RECOVERY event provides a session object.
      // This confirms the user is authenticated for this specific action.
      // React StrictMode (idk, can we fix this?) causes a race condition, so there's a possibility we get INITIAL_SESSION 
      // instead of PASSWORD_RECOVERY. But we can handle that by checking if session exists.
      // React.StrictMode loads the component twice but we only want to handle the first load.
      // The session state change is implicitly handled by the supabase client.
      console.log('Auth state change:', event, session);
      if (event === 'PASSWORD_RECOVERY' || (event === 'INITIAL_SESSION' && session)) {
        setIsReady(true);
      }
    });

    return () => {
      // Clean up the subscription when the component unmounts.
      subscription.unsubscribe();
    };
  }, []); // The empty dependency array ensures this runs only once on mount.

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
    } else {
      setMessage('Your password has been updated successfully. You will be redirected to the login page.');
      // Sign out to clear the temporary recovery session
      await supabase.auth.signOut();
      setTimeout(() => navigate('/auth'), 3000);
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
              disabled={!isReady || loading}/>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={!isReady || loading}
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
        {!isReady && !error && (
          <Typography color="text.secondary" align="center" sx={{ mt: 2 }}>
            Verifying...
          </Typography>
        )}
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