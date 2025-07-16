import React, { useState, useEffect } from 'react'; // Corrected: useEffect imported from 'react'
import { supabase } from '../lib/supabaseClient'; 

// Import MUI components and hooks
import {
  Button,
  TextField,
  Typography,
  Paper,
  Box,
  Link,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Container,
  IconButton, // For the password visibility toggle
  InputAdornment, // For placing the icon inside the TextField
} from '@mui/material';
import { styled } from '@mui/material/styles';
// Import Material Icons for password visibility
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';


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
  const [confirmPassword, setConfirmPassword] = useState(''); // New state for password confirmation
  const [isLogin, setIsLogin] = useState(true); // Toggles between login and signup forms
  const [isForgotPassword, setIsForgotPassword] = useState(false); // Toggles to forgot password form
  const [isUpdatePassword, setIsUpdatePassword] = useState(false); // New state for password update form
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false); // Loading state for auth actions
  const [showPassword, setShowPassword] = useState(false); // State for password visibility
  const [resetEmailSent, setResetEmailSent] = useState(false); // State to confirm reset email sent

  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('md')); // Check if screen is medium size or larger

  // Effect to check URL for password reset token on component mount
  useEffect(() => {
    const { hash } = window.location;
    const params = new URLSearchParams(hash.substring(1)); // Remove '#' and parse
    const accessToken = params.get('access_token');
    const type = params.get('type');

    if (accessToken && type === 'recovery') {
      // If a recovery token is present, set the state to show the update password form
      setIsUpdatePassword(true);
      setIsLogin(false); // Ensure login/signup form is hidden
      setIsForgotPassword(false); // Ensure forgot password form is hidden
      setMessage('Please set your new password.');
    }
  }, []);

  // Function to toggle password visibility
  const handleClickShowPassword = () => setShowPassword((show) => !show);

  // Function to handle mouse down on password visibility button (prevents blur)
  const handleMouseDownPassword = (event) => {
    event.preventDefault();
  };

  // Create or check member after successful login
  async function handlePostLogin(user) {
    try {
      // Check if the user already exists in the 'members' table
      const { data: existingMember, error: fetchError } = await supabase
        .from('members')
        .select('user_id')
        .eq('user_id', user.id)
        .single();

      // If there's an error other than 'PGRST116' (no rows found), log and set message
      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking member:', fetchError);
        setMessage('Error verifying user profile. Please try again later.');
        return;
      }

      // If no existing member, insert a new record
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
          role: 'user', // Default role for new users
        });

        if (insertError) {
          console.error('Error inserting member:', insertError);
          setMessage('Failed to create user profile.');
          return;
        }
      }

      // Fetch the user's role after ensuring their member profile exists
      const { data: memberData, error: roleError } = await supabase
        .from('members')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (roleError) {
        console.error('Error fetching role:', roleError);
        setMessage('Failed to retrieve user role.');
        return;
      }

      // Get the role, defaulting to 'user' if not found
      const role = memberData?.role || 'user';
      // Call the onLogin callback with user data and their role
      onLogin({ ...user, role });
    } catch (err) {
      console.error('Unexpected error in post-login:', err);
      setMessage('Unexpected error occurred. Please try again.');
    }
  }

  // Handles login and signup submissions
  async function handleSubmit(e) {
    e.preventDefault(); // Prevent default form submission
    setMessage(''); // Clear previous messages
    setLoading(true); // Start loading indicator

    try {
      if (isLogin) {
        // Handle user login
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          setMessage(error.message); // Display error message from Supabase
          return;
        }

        const user = data.user || data.session?.user; // Get user from data or session
        if (!user) {
          setMessage('Login failed. No user returned.'); // Fallback message if no user
          return;
        }

        await handlePostLogin(user); // Proceed with post-login actions
      } else {
        // Handle user registration
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`, // Redirect after email confirmation
          },
        });

        if (error) {
          setMessage(error.message); // Display error message from Supabase
          return;
        }

        // Display success message for registration
        setMessage(
          'Registration successful. Please check your email to confirm your address before logging in.'
        );
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setMessage('An unexpected error occurred.'); // Catch any other unexpected errors
    } finally {
      setLoading(false); // Stop loading indicator
    }
  }

  // Handles forgot password submission
  async function handleForgotPasswordSubmit(e) {
    e.preventDefault();
    setMessage('');
    setLoading(true);
    setResetEmailSent(false); // Reset this state

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`, // Redirect user to a page to update password
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage('Password reset email sent. Please check your inbox.');
        setResetEmailSent(true);
      }
    } catch (err) {
      console.error('Unexpected error during password reset:', err);
      setMessage('An unexpected error occurred during password reset.');
    } finally {
      setLoading(false);
    }
  }

  // Handles password update submission
  async function handleUpdatePasswordSubmit(e) {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.updateUser({ password: password });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage('Password updated successfully! You can now sign in with your new password.');
        // Optionally, redirect to login or automatically log in the user
        setIsUpdatePassword(false);
        setIsLogin(true);
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      console.error('Unexpected error during password update:', err);
      setMessage('An unexpected error occurred during password update.');
    } finally {
      setLoading(false);
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
          src="img/logo.webp" 
          alt="TUM.ai Logo"
          style={{
            width: isLargeScreen ? '180px' : '120px', // Larger logo on large screens
            marginBottom: theme.spacing(isLargeScreen ? 0 : 4),
          }}
          onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/180x120/E0E0E0/333333?text=Logo+Not+Found"; }} // Fallback for image
        />
        {/* Optional: Add a tagline or description for the logo section on larger screens */}
        {isLargeScreen && (
            <Typography variant="h5" color="text.secondary" sx={{ mt: 2 }}>
                Welcome to TUM.ai Portal
            </Typography>
        )}
      </Box>

      {/* Auth Form Card */}
      <AuthCard>
        <Typography variant="h5" component="h2" align="center" gutterBottom>
          {isUpdatePassword ? 'Set New Password' : (isForgotPassword ? 'Reset Password' : (isLogin ? 'Sign In' : 'Register'))}
        </Typography>

        {/* Conditional rendering for Password Update form */}
        {isUpdatePassword ? (
          <form onSubmit={handleUpdatePasswordSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: theme.spacing(2) }}>
              <TextField
                label="New Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleClickShowPassword}
                        onMouseDown={handleMouseDownPassword}
                        edge="end"
                        sx={{ color: theme.palette.secondary.main }} // Changed to secondary.main for higher contrast
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Confirm New Password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                fullWidth
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleClickShowPassword}
                        onMouseDown={handleMouseDownPassword}
                        edge="end"
                        sx={{ color: theme.palette.secondary.main }} // Changed to secondary.main for higher contrast
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={loading}
                sx={{ mt: 2, height: 48 }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Update Password'}
              </Button>
            </Box>
          </form>
        ) : isForgotPassword ? (
          /* Forgot Password form */
          <form onSubmit={handleForgotPasswordSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: theme.spacing(2) }}>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
                helperText="Enter your email to receive a password reset link."
              />
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={loading}
                sx={{ mt: 2, height: 48 }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Send Reset Link'}
              </Button>
            </Box>
          </form>
        ) : (
          /* Login/Register Form */
          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: theme.spacing(2) }}>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Password"
                type={showPassword ? 'text' : 'password'} // Toggle type based on showPassword state
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                InputProps={{ // Add InputAdornment for the visibility toggle
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleClickShowPassword}
                        onMouseDown={handleMouseDownPassword}
                        edge="end"
                        // Set the color directly using the sx prop for more control
                        sx={{ color: theme.palette.secondary.main }} // Changed to secondary.main for higher contrast
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />} {/* Material Icons for visibility toggle */}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={loading}
                sx={{ mt: 2, height: 48 }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : (isLogin ? 'Login' : 'Register')}
              </Button>
            </Box>
          </form>
        )}

        {message && (
          <Typography color={resetEmailSent ? 'success.main' : 'error'} align="center" sx={{ mt: 2 }}>
            {message}
          </Typography>
        )}

        <Box sx={{ textAlign: 'center', mt: 2 }}>
          {/* Toggle between Login/Register or back to Login from Forgot Password */}
          {!isForgotPassword && !isUpdatePassword ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column', // Always stack links vertically
                alignItems: 'center',
                gap: theme.spacing(1), // Add gap between links
              }}
            >
              <Link
                component="button"
                variant="body2" // Consistent variant for both links
                onClick={() => setIsLogin(!isLogin)}
                sx={{
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' },
                    color: theme.palette.primary.main, // Consistent color
                    fontWeight: 'normal', // Consistent font weight
                }}
              >
                {isLogin ? 'Sign Up' : 'Sign In'}
              </Link>
              {isLogin && ( // Only show "Forgot Password?" when on the login form
                <Link
                  component="button"
                  variant="body2" // Consistent variant for both links
                  onClick={() => {
                    setIsForgotPassword(true);
                    setMessage(''); // Clear any existing messages
                    setEmail(''); // Clear email field
                    setPassword(''); // Clear password field
                  }}
                  sx={{
                      textDecoration: 'none',
                      '&:hover': { textDecoration: 'underline' },
                      color: theme.palette.primary.main, // Consistent color
                      fontWeight: 'normal', // Consistent font weight
                  }}
                >
                  Forgot Password?
                </Link>
              )}
            </Box>
          ) : (
            <Link
              component="button"
              variant="body2"
              onClick={() => {
                setIsForgotPassword(false);
                setIsUpdatePassword(false); // Ensure update password form is hidden
                setIsLogin(true); // Return to login form
                setMessage('');
                setEmail('');
                setPassword('');
                setConfirmPassword('');
                setResetEmailSent(false);
              }}
              sx={{
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                  color: theme.palette.primary.main,
              }}
            >
              Back to Sign In
            </Link>
          )}
        </Box>
      </AuthCard>
    </Container>
  );
}
