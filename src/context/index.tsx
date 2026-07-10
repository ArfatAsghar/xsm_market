import React, { createContext, useContext, useState, useEffect } from 'react';
import { isAuthenticated } from '../services/auth';

// Define user type based on your backend User model
export interface User {
  id: string;
  username: string;
  email: string;
  profilePicture?: string;
}

export interface AuthContextType {
  isLoggedIn: boolean;
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

// Create the auth context
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create the useAuth hook
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// AuthProvider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated());
  const [user, setUser] = useState<User | null>(null);

  // Check for authentication on mount and when localStorage changes
  useEffect(() => {
    const checkAuth = () => {
      setIsLoggedIn(isAuthenticated());
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
