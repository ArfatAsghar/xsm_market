import React, { createContext, useContext, useState, useEffect } from 'react';
import { isAuthenticated, getCurrentUser } from '../services/auth';

// Define user type based on your backend User model
export interface User {
  id: string;
  username: string;
  fullName?: string;
  email: string;
  profilePicture?: string;
  authProvider?: string;
  isEmailVerified?: boolean;
  isAdmin?: boolean;
}

export interface AuthContextType {
  isLoggedIn: boolean;
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Export the useAuth hook
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated());
  const [user, setUser] = useState<User | null>(getCurrentUser());

  // Check for authentication on mount and when localStorage changes
  useEffect(() => {
    const checkAuth = () => {
      const authStatus = isAuthenticated();
      const userData = getCurrentUser();
      
      console.log('🔍 Auth check results:', { 
        authStatus, 
        userData,
        authProvider: userData?.authProvider,
        token: localStorage.getItem('token') ? 'exists' : 'missing',
        userDataString: localStorage.getItem('userData')
      });
      
      setIsLoggedIn(authStatus);
      setUser(userData);
    };

    window.addEventListener('storage', checkAuth);
    checkAuth();
    
    return () => {
      window.removeEventListener('storage', checkAuth);
    };
  }, []);

  const value = {
    isLoggedIn,
    setIsLoggedIn,
    user,
    setUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
