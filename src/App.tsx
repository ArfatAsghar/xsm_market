import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/AuthProvider';
import { NotificationProvider } from '@/context/NotificationContext';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MessageCircle } from 'lucide-react';
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
import { getBanData, handleBanResponse, BanData, clearBanData } from '@/services/auth';

// Inner component that has access to AuthContext
const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, user, setIsLoggedIn, setUser } = useAuth();

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
          
        {/* Floating Chat Button */}
        <button
          onClick={() => navigate('/chat')}
          className="fixed bg-xsm-yellow hover:bg-yellow-500 text-black p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110 z-[9999] flex items-center justify-center relative"
          style={{ 
            bottom: '24px', 
            right: '24px',
            position: 'fixed'
          }}
          aria-label="Open Chat"
        >
          <MessageCircle className="w-6 h-6" />
          {/* Unread notification indicator */}
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          </div>
        </button>
      </ErrorBoundary>

      {/* Footer - Simplified design */}
      <footer className="bg-xsm-black border-t border-xsm-medium-gray/30 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Logo and Button Row */}
          <div className="flex justify-between items-center mb-3">
            {/* Logo with glow effect (left) */}
            <div className="group relative">
              {/* Logo highlight background with yellow fade in middle */}
              <div className="absolute -inset-4 bg-gradient-radial from-xsm-yellow/30 via-xsm-medium-gray/30 to-transparent rounded-full blur-lg opacity-80 group-hover:opacity-100 transition-all duration-300 group-hover:from-xsm-yellow/50"></div>
              {/* Extra glow effect on hover */}
              <div className="absolute -inset-2 bg-gradient-radial from-xsm-yellow/15 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 animate-pulse"></div>
              <div className="absolute -inset-6 bg-gradient-radial from-xsm-yellow/5 via-transparent to-transparent rounded-full animate-pulse opacity-70"></div>
              <img 
                src="/images/logo.png" 
                alt="XSM Market Logo" 
                className="h-10 md:h-[48px] object-contain relative z-10 drop-shadow-[0_0_4px_rgba(255,208,0,0.5)]"
              />
            </div>
            
            {/* Begin Selling Button (right) */}
            <button
              onClick={() => {navigate('/sell'); window.scrollTo({ top: 0, behavior: 'smooth' });}}
              className="bg-xsm-yellow text-black px-4 py-2 text-sm font-medium rounded hover:bg-yellow-500 transition-colors"
            >
              Begin Selling
            </button>
          </div>
          
          {/* Simple Navigation */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-xsm-light-gray">
            <button onClick={() => {navigate('/about'); window.scrollTo({ top: 0, behavior: 'smooth' });}} className="hover:text-xsm-yellow transition-colors">About Us</button>
            <button onClick={() => {navigate('/contact'); window.scrollTo({ top: 0, behavior: 'smooth' });}} className="hover:text-xsm-yellow transition-colors">Contact</button>
            <button onClick={() => {navigate('/terms'); window.scrollTo({ top: 0, behavior: 'smooth' });}} className="hover:text-xsm-yellow transition-colors">Terms of Service</button>
            <button onClick={() => {navigate('/privacy'); window.scrollTo({ top: 0, behavior: 'smooth' });}} className="hover:text-xsm-yellow transition-colors">Privacy Policy</button>
          </div>
          
          {/* Copyright */}
          <p className="mt-3 text-center text-xs text-xsm-medium-gray">
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
