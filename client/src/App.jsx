import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import VerifyMagicLink from './pages/VerifyMagicLink';
import Dashboard from './pages/Dashboard';
import Room from './pages/Room';
import Admin from './pages/Admin';

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

  return user ? children : <Navigate to="/login" />;
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

  return user ? <Navigate to="/dashboard" /> : children;
}

function App() {
  return (
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
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
