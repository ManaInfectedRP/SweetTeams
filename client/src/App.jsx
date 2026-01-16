import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import Login from './pages/Login';
import VerifyMagicLink from './pages/VerifyMagicLink';
import Dashboard from './pages/Dashboard';
import Room from './pages/Room';
import Admin from './pages/Admin';
import GuestJoin from './pages/GuestJoin';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <div className="animate-pulse" style={{ fontSize: '2rem', marginBottom: '1rem' }}>
            🎥
          </div>
          <p className="text-secondary">Loading SweetTeams...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;
  
  // If user is a guest, redirect to their authorized room
  if (user.isGuest && user.linkCode) {
    // Allow access to the room page
    if (window.location.pathname.includes(`/room/${user.linkCode}`)) {
      return children;
    }
    // Redirect guests away from dashboard/admin to their room
    return <Navigate to={`/room/${user.linkCode}`} replace />;
  }
  
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <div className="animate-pulse" style={{ fontSize: '2rem', marginBottom: '1rem' }}>
            🎥
          </div>
          <p className="text-secondary">Loading SweetTeams...</p>
        </div>
      </div>
    );
  }

  if (!user) return children;
  
  // Redirect guests to their room, regular users to dashboard
  if (user.isGuest && user.linkCode) {
    return <Navigate to={`/room/${user.linkCode}`} replace />;
  }
  
  return <Navigate to="/dashboard" />;
}

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } />
            <Route path="/auth/verify" element={
              <VerifyMagicLink />
            } />
            <Route path="/guest/:linkCode" element={
              <GuestJoin />
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/room/:linkCode" element={
              <ProtectedRoute>
                <Room />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            } />
            <Route path="/" element={
              <ProtectedRoute>
                <Navigate to="/dashboard" />
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
