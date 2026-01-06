// API Configuration
// In production, use the Render backend URL
// In development, use localhost
const getApiUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:3001';
  }
  
  // If we're on render's frontend domain, use render's backend
  if (window.location.hostname === 'sweetteams.onrender.com') {
    return 'https://sweetteams-server.onrender.com';
  }
  
  // Use env variable if set, otherwise localhost
  return import.meta.env.VITE_API_URL || 'http://localhost:3001';
};

const API_URL = getApiUrl();

export const config = {
  apiUrl: API_URL,
  wsUrl: API_URL, // Socket.io använder samma URL som API:et
};
