import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

// Import MUI components and hooks
import {
  Button,
  TextField,
  Typography,
  Paper,
  Box,
  Link, // For the toggle text
  CircularProgress,
  useTheme, // To access the current theme
  useMediaQuery, // To check screen size for responsiveness
  Container, // For overall page container
} from '@mui/material';
import { styled } from '@mui/material/styles';

// Styled component for the main form card
const AuthCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  borderRadius: theme.shape.borderRadius * 2, // More rounded for M3
  boxShadow: theme.shadows[3],
  width: '100%',
  maxWidth: 400,
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(3), // Slightly less padding on small screens
  },
}));

export default function Auth({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [isPasswordReset, setIsPasswordReset] = useState(false); // State for reset view
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false); // New loading state for auth actions

  const navigate = useNavigate();
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('md')); // Check if screen is medium size or larger

  // Create or check member after login
  async function handlePostLogin(user) {
    try {
      const { data: existingMember, error: fetchError } = await supabase
        .from('members')
        .select('user_id')
        .eq('user_id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking member:', fetchError);
        setMessage('Error verifying user profile. Please try again later.');
        return;
      }

      if (!existingMember) {
        const { error: insertError } = await supabase.from('members').insert({
          user_id: user.id,
          email: user.email,
          given_name: '',
          surname: '',
          date_of_birth: '1900-01-01',
          street: '',
          number: '',
          postal_code: '',
          city: '',
          country: '',
          active: true,
          salutation: '',
          role: 'user',
        });

        if (insertError) {
          console.error('Error inserting member:', insertError);
          setMessage('Failed to create user profile.');
          return;
        }
      }

      const { data: memberData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (roleError) {
        console.error('Error fetching role:', roleError);
        setMessage('Failed to retrieve user role.');
        return;
      }

      const role = memberData?.role || 'user';
      onLogin({ ...user, role });
      navigate('/'); 
    } catch (err) {
      console.error('Unexpected error in post-login:', err);
      setMessage('Unexpected error occurred. Please try again.');
    }
  }

  async function handlePasswordReset(e) {
    e.preventDefault();
    setMessage('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${import.meta.env.VITE_SITE_URL}/update-password`,
      });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage(`Password reset link has been sent to ${email}, expect a redirect to ${import.meta.env.VITE_SITE_URL}.`);
        setIsPasswordReset(false); // Go back to login view
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setMessage('Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  }


  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    setLoading(true); // Start loading

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          setMessage(error.message);
          return;
        }

        const user = data.user || data.session?.user;
        if (!user) {
          setMessage('Login failed. No user returned.');
          return;
        }

        await handlePostLogin(user);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        setMessage(
          'Registration successful. Please check your email to confirm your address before logging in.'
        );
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setMessage('An unexpected error occurred.');
    } finally {
      setLoading(false); // Stop loading regardless of outcome
    }
  }

  return (
    <Container
      maxWidth={false} // Allow container to take full width
      sx={{
        display: 'flex',
        flexDirection: isLargeScreen ? 'row' : 'column', // Row for large, column for small
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh', // Take full viewport height
        padding: theme.spacing(3), // Use theme spacing
        backgroundColor: theme.palette.background.default, // Use theme background color
        gap: theme.spacing(isLargeScreen ? 8 : 4), // More gap on large screens
      }}
    >
      {/* Logo Section */}
      <Box
        sx={{
          textAlign: isLargeScreen ? 'left' : 'center',
          flexShrink: 0, // Prevent shrinking
        }}
      >
        <img
          src="/img/logo.webp" // Ensure this path is correct relative to /public
          alt="TUM.ai Logo"
          style={{
            width: isLargeScreen ? '180px' : '120px', // Larger logo on large screens
            marginBottom: theme.spacing(isLargeScreen ? 0 : 4),
          }}
        />
        {/* Optional: Add a tagline or description for the logo section on larger screens */}
        {isLargeScreen && (
          <Typography variant="h5" color="text.secondary" sx={{ mt: 2 }}>
            Welcome to TUM.ai Portal
          </Typography>
        )}
      </Box>

      {/* Auth Form Card */}
      <AuthCard> {/* Use the styled Paper component */}
        <Typography variant="h5" component="h2" align="center" gutterBottom>
          {isPasswordReset ? 'Reset Password' : isLogin ? 'Sign In' : 'Register'}
        </Typography>

        <form onSubmit={isPasswordReset ? handlePasswordReset : handleSubmit}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: theme.spacing(2) }}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
            />
            {!isPasswordReset && (
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
              />
            )}
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={loading} // Disable button when loading
              sx={{ mt: 2, height: 48 }} // Ensure consistent button height
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : isPasswordReset ? (
                'Send Reset Link'
              ) : isLogin ? (
                'Login'
              ) : (
                'Register'
              )}
            </Button>
          </Box>
        </form>

        {message && (
          <Typography
            color={message.includes('sent') ? 'primary' : 'error'}
            align="center"
            sx={{ mt: 2 }}
          >
            {message}
          </Typography>
        )}

<Box sx={{ textAlign: 'center', mt: 2 }}>
          {isLogin && !isPasswordReset && (
            <Link
              component="button"
              variant="body2"
              onClick={() => {
                setIsPasswordReset(true);
                setMessage('');
              }}
              sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              Forgot your password?
            </Link>
          )}
          <Link
            component="button"
            variant="body2"
            onClick={() => {
              setIsLogin(!isLogin);
              setIsPasswordReset(false);
              setMessage('');
            }}
            sx={{
                display: 'block', // Ensure it takes its own line
                mt: isLogin && !isPasswordReset ? 1 : 0,
                textDecoration: 'none', // Remove underline initially
                '&:hover': {
                    textDecoration: 'underline', // Add underline on hover
                },
                color: theme.palette.primary.main, // Use primary color for the link
            }}
          >
            {isLogin && !isPasswordReset
              ? "Don't have an account? Sign Up"
              : 'Back to Sign In'}
          </Link>
        </Box>
      </AuthCard>
    </Container>
  );
}