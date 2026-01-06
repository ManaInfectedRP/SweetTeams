// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const config = {
  apiUrl: API_URL,
  wsUrl: API_URL, // Socket.io använder samma URL som API:et
};
