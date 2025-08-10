import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline'; // Optional: for consistent baseline styles
import getAppTheme from './theme'; // Import the theme function


const darkTheme = getAppTheme('dark'); // Directly create the dark theme once


ReactDOM.createRoot(document.getElementById('root')).render(
    <ThemeProvider theme={darkTheme}>
      <CssBaseline /> {/* Optional: Resets CSS for consistent base styles */}
      <App />
    </ThemeProvider>
)
