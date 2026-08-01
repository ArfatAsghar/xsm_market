import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/AuthProvider';
import { NotificationProvider } from '@/context/NotificationContext';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { GoogleOAuthProvider } from '@react-oauth/google';
import { useTokenManager } from '@/hooks/useTokenManager';
import { useAuth } from '@/context/useAuth';
import ErrorBoundary from './components/ErrorBoundary';
import BannedScreen from './components/BannedScreen';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import SellChannel from './pages/SellChannel';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import PublicProfile from './pages/PublicProfile';
import ProfileRedirect from './components/ProfileRedirect';
import UsernameRedirect from './components/UsernameRedirect';
import NotFound from './pages/NotFound';
import About from './pages/About';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Verify from './pages/Verify';
import EmailVerify from './pages/EmailVerify';
import ForgotPassword from './pages/ForgotPassword';
import AdminDashboard from './pages/AdminDashboard';
import Contact from './pages/Contact';
import SellerDeals from './components/SellerDeals';
import BuyerDeals from './components/BuyerDeals';
import AdDetails from './pages/AdDetails';
import { getBanData, handleBanResponse, BanData, clearBanData, API_URL } from '@/services/auth';

// Inner component that has access to AuthContext
const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, user, setIsLoggedIn, setUser } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread messages count periodically when logged in
  useEffect(() => {
    if (!isLoggedIn) {
      setUnreadCount(0);
      return;
    }
    const fetchUnread = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch(`${API_URL}/chat/unread-count`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (typeof data.unreadCount === 'number') {
            setUnreadCount(data.unreadCount);
          }
        }
      } catch (e) {
        // silent catch
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  // ── Ban management ──────────────────────────────────────────────────────────
  const [banData, setBanDataState] = useState<BanData | null>(() => getBanData());

  useEffect(() => {
    // Listen for ban events fired from handleBanResponse / setBanData
    const onBanned = (e: Event) => {
      const detail = (e as CustomEvent<BanData>).detail;
      setBanDataState(detail);
      setIsLoggedIn(false);
      setUser(null);
    };
    window.addEventListener('xsm:banned', onBanned);

    // Patch window.fetch globally so EVERY API call gets checked for a ban response
    const origFetch = window.fetch.bind(window);
    (window as any)._origFetch = origFetch;
    window.fetch = async (...args) => {
      const response = await origFetch(...args);
      // Only check our own API calls (avoid false positives on CDN/3rd-party)
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
      if (url.includes('/api/')) {
        await handleBanResponse(response);
      }
      return response;
    };

    return () => {
      window.removeEventListener('xsm:banned', onBanned);
      // Restore original fetch
      if ((window as any)._origFetch) {
        window.fetch = (window as any)._origFetch;
      }
    };
  }, [setIsLoggedIn, setUser]);
  // ────────────────────────────────────────────────────────────────────────────
  
  // Type assertion for user to include isAdmin property
  type AdminUser = typeof user & { isAdmin?: boolean };
  const adminUser = user as AdminUser;
  
  // Initialize token manager for session handling
  useTokenManager();

  // Helper function to navigate and scroll to top
  const navigateToPage = (page: string) => {
    navigate(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Show banned screen if user is banned (overrides everything)
  if (banData?.banned) {
    return (
      <BannedScreen
        banData={banData}
        onDismiss={() => {
          clearBanData();
          setBanDataState(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-xsm-black">
      <ErrorBoundary>
        <Toaster />
        <Sonner />
        <Navbar />
        <main className="animate-fade-in">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/sell" element={<SellChannel />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/ad/:adId" element={<AdDetails />} />
            {/* Profile redirect - redirects /profile to /@username */}
            <Route path="/profile" element={<ProfileRedirect />} />
            {/* Public profile route - shows public view or edit view if own profile */}
            <Route path="/u/:username" element={<PublicProfile />} />
            {/* Profile editing with username in URL */}
            <Route path="/u/:username/edit" element={<Profile />} />
            <Route path="/my-deals" element={<BuyerDeals />} />
            <Route path="/seller-deals" element={<SellerDeals />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/email-verify" element={<EmailVerify />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route 
              path="/admin-dashboard" 
              element={
                isLoggedIn && (
                  (adminUser as any)?.role === 'admin' ||
                  (adminUser as any)?.role === 'manager' ||
                  (adminUser as any)?.role === 'viewer' ||
                  adminUser?.isAdmin === true
                ) ? (
                  <AdminDashboard />
                ) : (
                  <Login />
                )
              } 
            />
            {/* 404 page */}
            <Route path="/404" element={<NotFound />} />
            {/* Catch-all route for potential usernames - this must be last before the final 404 */}
            <Route path="/:possibleUsername" element={<UsernameRedirect />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

      </ErrorBoundary>

      {/* Footer - Aligned layout per Revision 32 */}
      <footer className="bg-xsm-black border-t border-xsm-medium-gray/30 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo and Begin Selling Button (left aligned, indented from left) */}
            <div className="flex items-center gap-5 pl-2 sm:pl-4">
              <img 
                src="/images/logo.png" 
                alt="XSM Market Logo" 
                className="h-10 md:h-11 object-contain drop-shadow-[0_0_4px_rgba(255,208,0,0.5)]"
              />
              <button
                onClick={() => {navigate('/sell'); window.scrollTo({ top: 0, behavior: 'smooth' });}}
                className="bg-xsm-yellow text-black px-4 py-2 text-sm font-semibold rounded hover:bg-yellow-500 transition-colors shadow-sm"
              >
                Begin Selling
              </button>
            </div>
            
            {/* Navigation Links (vertically aligned with logo row) */}
            <div className="flex flex-wrap justify-center items-center gap-6 text-sm font-medium text-xsm-light-gray">
              <button onClick={() => {navigate('/about'); window.scrollTo({ top: 0, behavior: 'smooth' });}} className="hover:text-xsm-yellow transition-colors">About Us</button>
              <button onClick={() => {navigate('/contact'); window.scrollTo({ top: 0, behavior: 'smooth' });}} className="hover:text-xsm-yellow transition-colors">Contact</button>
              <button onClick={() => {navigate('/terms'); window.scrollTo({ top: 0, behavior: 'smooth' });}} className="hover:text-xsm-yellow transition-colors">Terms of Service</button>
              <button onClick={() => {navigate('/privacy'); window.scrollTo({ top: 0, behavior: 'smooth' });}} className="hover:text-xsm-yellow transition-colors">Privacy Policy</button>
            </div>
          </div>
          
          {/* Copyright */}
          <p className="mt-4 pt-4 border-t border-xsm-medium-gray/20 text-center text-xs text-xsm-medium-gray">
            © 2025 XSM Market. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

// Main App component
const App: React.FC = () => {
  // Debug: Log the Google Client ID to console
  console.log('Google Client ID:', import.meta.env.VITE_GOOGLE_CLIENT_ID);
  
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <NotificationProvider>
          <TooltipProvider>
            <Router>
              <AppContent />
            </Router>
          </TooltipProvider>
        </NotificationProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
};

export default App;
