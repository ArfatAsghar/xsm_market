import { useEffect } from 'react';
import { useAuth } from '@/context/useAuth';
import { useToast } from '@/components/ui/use-toast';

export const useTokenManager = () => {
  const { setIsLoggedIn, setUser } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    // Handle automatic logout when token expires
    const handleAuthLogout = () => {
      console.log('📱 Token Manager: Session expired, logging out user');
      setIsLoggedIn(false);
      setUser(null);
      
      toast({
        variant: "destructive",
        title: "Session Expired",
        description: "Your session has expired. Please login again to continue.",
        duration: 5000,
      });
    };

    // Listen for auth logout events
    window.addEventListener('auth:logout', handleAuthLogout);

    // Optional: Set up periodic token validation check
    const tokenCheckInterval = setInterval(() => {
      const token = localStorage.getItem('token');
      const expiry = localStorage.getItem('tokenExpiry');
      
      if (token && expiry) {
        const expiryTime = parseInt(expiry);
        const currentTime = Date.now();
        const timeUntilExpiry = expiryTime - currentTime;
        
        // Log token status periodically (every 5 minutes)
        console.log('📱 Token Manager: Token check', {
          hasToken: !!token,
          expiryTime: new Date(expiryTime).toLocaleString(),
          timeUntilExpiry: Math.round(timeUntilExpiry / 1000 / 60) + ' minutes',
        });
        
        // Show warning when token will expire in 10 minutes
        if (timeUntilExpiry > 0 && timeUntilExpiry <= 10 * 60 * 1000) {
          toast({
            title: "Session Expiring Soon",
            description: "Your session will expire in 10 minutes. Please save any work.",
            duration: 8000,
          });
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout);
      clearInterval(tokenCheckInterval);
    };
  }, [setIsLoggedIn, setUser, toast]);

  // Return a function to manually check token status
  return {
    checkTokenStatus: () => {
      const token = localStorage.getItem('token');
      const expiry = localStorage.getItem('tokenExpiry');
      
      if (!token) return { hasToken: false };
      
      const expiryTime = parseInt(expiry || '0');
      const currentTime = Date.now();
      const timeUntilExpiry = expiryTime - currentTime;
      
      return {
        hasToken: true,
        isExpired: timeUntilExpiry <= 0,
        expiresAt: new Date(expiryTime),
        timeUntilExpiry: Math.round(timeUntilExpiry / 1000),
      };
    }
  };
};

export default useTokenManager;
