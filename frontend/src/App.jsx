import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { warmupServer } from './utils/api';
import { SocketProvider } from './context/SocketContext';
import { LiveStreamProvider } from './context/LiveStreamContext';
import PWAProvider from './components/PWAInstallBanner';
import MiniStreamPlayer from './components/MiniStreamPlayer';
import HostStreamBroadcaster from './components/HostStreamBroadcaster';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import DiscoverPage from './pages/DiscoverPage';
import LivePage from './pages/LivePage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import GoLivePage from './pages/GoLivePage';
import CoinsPage from './pages/CoinsPage';
import PaymentVerifyPage from './pages/PaymentVerifyPage';
import LeaderboardPage from './pages/LeaderboardPage';
import SettingsPage from './pages/SettingsPage';
import HostDashboardPage from './pages/HostDashboardPage';
import WithdrawPage from './pages/WithdrawPage';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Layout />}>
      <Route index element={<HomePage />} />
      <Route path="discover" element={<DiscoverPage />} />
      <Route path="leaderboard" element={<LeaderboardPage />} />
      <Route path="live/:streamId" element={<LivePage />} />
      <Route path="profile/:username" element={<ProfilePage />} />
      <Route path="go-live" element={<PrivateRoute><GoLivePage /></PrivateRoute>} />
      <Route path="coins" element={<PrivateRoute><CoinsPage /></PrivateRoute>} />
      <Route path="payment/verify" element={<PrivateRoute><PaymentVerifyPage /></PrivateRoute>} />
      <Route path="settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
      <Route path="host-dashboard" element={<PrivateRoute><HostDashboardPage /></PrivateRoute>} />
      <Route path="withdraw" element={<PrivateRoute><WithdrawPage /></PrivateRoute>} />
    </Route>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default function App() {
  // Wake the backend up the moment the app loads. On Render's free tier the
  // server sleeps after ~15 min idle; the first cold request takes 30–60 s.
  // Pinging /health on boot means subsequent user actions (login, go-live,
  // join stream) hit a warm server and don't time out.
  useEffect(() => { warmupServer(); }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <LiveStreamProvider>
            <PWAProvider>
              <AppRoutes />
              {/* Global host broadcaster — keeps WebRTC peer connections to
                  viewers alive for the whole live session, regardless of
                  which page the host is currently on. */}
              <HostStreamBroadcaster />
              {/* Global mini player — renders on top of all routes */}
              <MiniStreamPlayer />
              <Toaster
                position="top-center"
                toastOptions={{
                  style: { background: '#1a1a26', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
                  success: { iconTheme: { primary: '#d946ef', secondary: '#fff' } },
                }}
              />
            </PWAProvider>
          </LiveStreamProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
