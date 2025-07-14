import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link as RouterLink } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';

// Import MUI Components
import {
  AppBar,
  Toolbar,
  Button,
  Typography,
  Box,
  IconButton,
  CircularProgress,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useMediaQuery,
  useTheme,
  Slide,
  Paper,
  Tooltip,
} from '@mui/material';

// Import MUI Icons
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle'; // For Member Form
import DescriptionIcon from '@mui/icons-material/Description'; // For SEPA
import PolicyIcon from '@mui/icons-material/Policy'; // For Privacy Policy
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'; // For Certificate
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'; // For Admin View
import PaidIcon from '@mui/icons-material/Paid'; // For Legal & Financial Admin View
import Auth from './pages/Auth'
import MemberForm from './pages/MemberForm'
import Certificate from './pages/Certificate'
import AdminDatabaseView from './pages/AdminDatabaseView'

import SepaMandate from './pages/SepaMandate'
import PrivacyPolicy from './pages/PrivacyPolicy'

// Transition for Dialog (like a bottom-up slide)
const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const dummyUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'debug@example.com',
  role: 'user',
};

export default function App() {
  const isDev = import.meta.env.MODE === 'development' && false;
  const [user, setUser] = useState(isDev ? dummyUser : null);
  const [loading, setLoading] = useState(!isDev);
  const [userRole, setUserRole] = useState(null);

  const [showSepa, setShowSepa] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const [sepaChecked, setSepaChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);

  // Get current agreement states from user's data
  const [currentSepaAgreed, setCurrentSepaAgreed] = useState(false);
  const [currentPrivacyAgreed, setCurrentPrivacyAgreed] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const handleOpenSepa = () => setShowSepa(true);
    const handleOpenPrivacy = () => setShowPrivacy(true);

    window.addEventListener('open-sepa', handleOpenSepa);
    window.addEventListener('open-privacy', handleOpenPrivacy);

    return () => {
      window.removeEventListener('open-sepa', handleOpenSepa);
      window.removeEventListener('open-privacy', handleOpenPrivacy);
    };
  }, []);

  useEffect(() => {
    const handleSepaUpdate = (event) => {
      if (event.detail && typeof event.detail.mandate_agreed === 'boolean') {
        setSepaChecked(event.detail.mandate_agreed);
        setCurrentSepaAgreed(event.detail.mandate_agreed);
      }
    };

    const handlePrivacyUpdate = (event) => {
      if (event.detail && typeof event.detail.privacy_agreed === 'boolean') {
        setPrivacyChecked(event.detail.privacy_agreed);
        setCurrentPrivacyAgreed(event.detail.privacy_agreed);
      }
    };

    window.addEventListener('sepa-updated', handleSepaUpdate);
    window.addEventListener('privacy-updated', handlePrivacyUpdate);

    return () => {
      window.removeEventListener('sepa-updated', handleSepaUpdate);
      window.removeEventListener('privacy-updated', handlePrivacyUpdate);
    };
  }, []);

  useEffect(() => {
    if (!isDev) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setLoading(false);
      });

      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });

      return () => {
        listener.subscription.unsubscribe();
      };
    }
  }, []);

  useEffect(() => {
    if (user) {
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()
        .then(({ data, error }) => {
          if (data) setUserRole(data.role);
          else setUserRole(null);
        });
    } else {
      setUserRole(null);
    }
  }, [user]);

  useEffect(() => {
    if (user && !isDev) {
      supabase
        .from('sepa')
        .select('mandate_agreed, privacy_agreed')
        .eq('user_id', user.id)
        .single()
        .then(({ data, error }) => {
          if (data) {
            setCurrentSepaAgreed(data.mandate_agreed || false);
            setCurrentPrivacyAgreed(data.privacy_agreed || false);
            setSepaChecked(data.mandate_agreed || false);
            setPrivacyChecked(data.privacy_agreed || false);
          }
        });
    }
  }, [user, isDev]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  const handleSepaModalClose = () => {
    setShowSepa(false);
    setCurrentSepaAgreed(sepaChecked);
    window.dispatchEvent(new CustomEvent('sepa-updated', {
      detail: { mandate_agreed: sepaChecked }
    }));
  };

  const handlePrivacyModalClose = () => {
    setShowPrivacy(false);
    setCurrentPrivacyAgreed(privacyChecked);
    window.dispatchEvent(new CustomEvent('privacy-updated', {
      detail: { privacy_agreed: privacyChecked }
    }));
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: theme.palette.background.default,
        }}
      >
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2, color: theme.palette.text.primary }}>
          Loading...
        </Typography>
      </Box>
    );
  }

  if (!user) return <Auth onLogin={setUser} />;

  return (
    <Router>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          {isMobile && ( // Show menu icon only on mobile
            <IconButton
              edge="start"
              sx={{ mr: 2, color: theme.palette.primary.main  }}
              aria-label="menu"
              onClick={() => setDrawerOpen(true)}
            >
              <MenuIcon />
            </IconButton>
          )}

          {/* TUM.ai Logo on the left */}
          <Box sx={{ display: 'flex', alignItems: 'center', mr: isMobile ? 0 : 4 }}>
            <img
              src="/img/logo.webp"
              alt="TUM.ai Logo"
              // FIX 2: Adjust logo height for better visual balance
              style={{ height: '24px' }} // Adjusted from 36px to 32px
            />
          </Box>
          {!isMobile && ( // Desktop navigation links
            <Box sx={{ display: 'flex', gap: 2, flexGrow: 1 }}>
              <Button color="inherit" component={RouterLink} to="/">
                <AccountCircleIcon sx={{ mr: 0.5 }} /> Member Form
              </Button>
              <Button color="inherit" component="a" onClick={() => setShowSepa(true)}>
                <DescriptionIcon sx={{ mr: 0.5 }} /> SEPA
              </Button>
              <Button color="inherit" component="a" onClick={() => setShowPrivacy(true)}>
                <PolicyIcon sx={{ mr: 0.5 }} /> Privacy Policy
              </Button>
              <Button color="inherit" component={RouterLink} to="/certificate">
                <EmojiEventsIcon sx={{ mr: 0.5 }} /> Certificate
              </Button>
              {userRole === 'admin' && (
                <Button color="inherit" component={RouterLink} to="/admin">
                  <AdminPanelSettingsIcon sx={{ mr: 0.5 }} /> Admin
                </Button>
              )}
            </Box>
          )}

          {/* User Email and Logout Button on the right */}
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
            {!isMobile && user?.email && (
              <Typography variant="body2" color="inherit">
                {user.email}
              </Typography>
            )}
            <Tooltip title="Logout">
              <IconButton
                sx={{ color: theme.palette.primary.main }}
                onClick={handleLogout}
              >
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Navigation Drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
            sx: {
                backgroundColor: theme.palette.background.paper,
                color: theme.palette.text.primary,
            }
        }}
      >
        <Box
          sx={{
            width: 250,
            pt: 2,
            pb: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
          role="presentation"
          onClick={() => setDrawerOpen(false)}
          onKeyDown={() => setDrawerOpen(false)}
        >
          <img src="/img/logo.webp" alt="TUM.ai Logo" style={{ height: '24px', mb: 4, pb: 4 }} />
          <List sx={{ width: '100%' }}>
            {userRole === 'user' && (
            <ListItem disablePadding>
              <ListItemButton component={RouterLink} to="/">
                <ListItemIcon><AccountCircleIcon sx={{ color: theme.palette.text.secondary }} /></ListItemIcon>
                <ListItemText primary="Member Form" />
              </ListItemButton>
            </ListItem>
            )}
            {userRole === 'user' && (
            <ListItem disablePadding>
              <ListItemButton component="a" onClick={() => setShowSepa(true)}>
                <ListItemIcon><DescriptionIcon sx={{ color: theme.palette.text.secondary }} /></ListItemIcon>
                <ListItemText primary="SEPA" />
              </ListItemButton>
            </ListItem>
            )}
            {userRole === 'user' && (
            <ListItem disablePadding>
              <ListItemButton component="a" onClick={() => setShowPrivacy(true)}>
                <ListItemIcon><PolicyIcon sx={{ color: theme.palette.text.secondary }} /></ListItemIcon>
                <ListItemText primary="Privacy Policy" />
              </ListItemButton>
            </ListItem>
            )}
            {userRole === 'user' && (
            <ListItem disablePadding>
              <ListItemButton component={RouterLink} to="/certificate">
                <ListItemIcon><EmojiEventsIcon sx={{ color: theme.palette.text.secondary }} /></ListItemIcon>
                <ListItemText primary="Certificate" />
              </ListItemButton>
            </ListItem>
            )}
            {userRole === 'admin' && (
              <ListItem disablePadding>
                <ListItemButton component={RouterLink} to="/admin">
                  <ListItemIcon><AdminPanelSettingsIcon sx={{ color: theme.palette.text.secondary }} /></ListItemIcon>
                  <ListItemText primary="Admin" />
                </ListItemButton>
              </ListItem>
            )}
            <ListItem disablePadding sx={{ mt: 2 }}>
              <ListItemButton onClick={handleLogout}>
                <ListItemIcon><LogoutIcon sx={{ color: theme.palette.primary.surface }} /></ListItemIcon>
                <ListItemText primary="Logout" sx={{ color: theme.palette.primary.surface }} />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          backgroundColor: theme.palette.background.default,
          color: theme.palette.text.primary,
          minHeight: 'calc(100vh - 64px)',
          paddingX: { xs: theme.spacing(2), md: theme.spacing(4) }, // Responsive horizontal padding
          paddingY: theme.spacing(3), // Vertical padding
          overflow: 'auto',
        }}
      >
        <Routes>
              <Route path="/" element={<MemberForm user={user} />} />
              <Route path="/sepa" element={<SepaMandate user={user} />} />
              <Route path="/privacy" element={<PrivacyPolicy user={user} />} />
              <Route path="/certificate" element={<Certificate user={user} />} />
             <Route path="/admin" element={<AdminDatabaseView />} />
        </Routes>
      </Box>

      {/* SEPA Dialog */}
      <Dialog
        open={showSepa}
        onClose={handleSepaModalClose}
        TransitionComponent={Transition}
        fullWidth
        maxWidth="md"
        PaperProps={{
            sx: {
                borderRadius: theme.shape.borderRadius * 2,
                backgroundColor: theme.palette.background.paper,
                color: theme.palette.text.primary,
                p: theme.spacing(2),
            }
        }}
      >
        <DialogTitle variant="h5" sx={{ textAlign: 'center', pb: 2 }}>
            SEPA Mandate
            <IconButton
                aria-label="close"
                onClick={handleSepaModalClose}
                sx={{
                    position: 'absolute',
                    right: 8,
                    top: 8,
                    color: (theme) => theme.palette.grey[500],
                }}
            >
                ×
            </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <SepaMandate
            onCheckChange={setSepaChecked}
            sepaAgreed={currentSepaAgreed}
          />
        </DialogContent>
        <DialogActions sx={{ pt: 2, pb: 1, pr: 2 }}>
          <Button onClick={handleSepaModalClose} color="primary" variant="contained">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Privacy Dialog */}
      <Dialog
        open={showPrivacy}
        onClose={handlePrivacyModalClose}
        TransitionComponent={Transition}
        fullWidth
        maxWidth="md"
        PaperProps={{
            sx: {
                borderRadius: theme.shape.borderRadius * 2,
                backgroundColor: theme.palette.background.paper,
                color: theme.palette.text.primary,
                p: theme.spacing(2),
            }
        }}
      >
        <DialogTitle variant="h5" sx={{ textAlign: 'center', pb: 2 }}>
            Privacy Policy
            <IconButton
                aria-label="close"
                onClick={handlePrivacyModalClose}
                sx={{
                    position: 'absolute',
                    right: 8,
                    top: 8,
                    color: (theme) => theme.palette.grey[500],
                }}
            >
                ×
            </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <PrivacyPolicy
            onCheckChange={setPrivacyChecked}
            privacyAgreed={currentPrivacyAgreed}
          />
        </DialogContent>
        <DialogActions sx={{ pt: 2, pb: 1, pr: 2 }}>
          <Button
            onClick={handlePrivacyModalClose}
            disabled={!privacyChecked}
            color="primary"
            variant="contained"
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Router>
  );
}