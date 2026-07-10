import React, { useState, useEffect } from 'react';
import { isAuthenticated, getCurrentUser } from '../services/auth';
import { AuthContext, User } from './AuthContext';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated());
  const [user, setUser] = useState<User | null>(getCurrentUser());

  // Check for authentication on mount and when localStorage changes
  useEffect(() => {
    const checkAuth = () => {
      const authenticated = isAuthenticated();
      setIsLoggedIn(authenticated);
      
      if (authenticated) {
        const userData = getCurrentUser();
        setUser(userData);
      } else {
        setUser(null);
      }
    };

    // Listen for storage changes (when user logs out in another tab)
    window.addEventListener('storage', checkAuth);
    
    // Listen for custom auth events (token expiry, logout)
    const handleAuthLogout = () => {
      console.log('Auth logout event received');
      setIsLoggedIn(false);
      setUser(null);
    };
    
    window.addEventListener('auth:logout', handleAuthLogout);
    
    // Initial check
    checkAuth();
    
    // Set up periodic token validation (every 5 minutes)
    const tokenCheckInterval = setInterval(() => {
      const stillAuthenticated = isAuthenticated();
      if (isLoggedIn && !stillAuthenticated) {
        console.log('Token expired, logging out user');
        setIsLoggedIn(false);
        setUser(null);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('auth:logout', handleAuthLogout);
      clearInterval(tokenCheckInterval);
    };
  }, [isLoggedIn]);

  return (
    <AuthContext.Provider 
      value={{ 
        isLoggedIn, 
        setIsLoggedIn, 
        user, 
        setUser 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
