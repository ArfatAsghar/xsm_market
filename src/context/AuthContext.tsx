import React, { createContext, useContext, useState, useEffect } from 'react';
import { isAuthenticated, getCurrentUser, SellerMetrics } from '../services/auth';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Define user type based on your backend User model
export interface User {
  id: string;
  username: string;
  displayName?: string;
  fullName?: string;
  email: string;
  profilePicture?: string;
  authProvider?: string;
  isEmailVerified?: boolean;
  isAdmin?: boolean;
  sellerMetrics?: SellerMetrics;
  // Ban fields
  isBanned?: boolean | number;
  banReason?: string | null;
  banExpires?: string | null;
  bannedAt?: string | null;
}

export interface AuthContextType {
  isLoggedIn: boolean;
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
  user: User | null;
  setUser: (userOrUpdater: User | null | ((prev: User | null) => User | null)) => void;
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
  const [user, _setUserRaw] = useState<User | null>(getCurrentUser());

  // Wrapped setUser: always keeps localStorage.userData in sync with React state.
  // This prevents Profile.tsx (or any other caller) from updating React state
  // without also persisting the change — which was causing the "ban disappears
  // on profile open" bug.
  const setUser = React.useCallback(
    (userOrUpdater: User | null | ((prev: User | null) => User | null)) => {
      _setUserRaw(prev => {
        const next =
          typeof userOrUpdater === 'function' ? userOrUpdater(prev) : userOrUpdater;
        if (next === null) {
          localStorage.removeItem('userData');
        } else {
          // Preserve ban fields from prev when the incoming value omits them.
          // This is the critical guard: if updatedUser from the API somehow
          // lacks ban fields, we fall back to what was already persisted.
          const prevBanFields =
            prev && prev.isBanned !== undefined
              ? {
                  isBanned: prev.isBanned,
                  banReason: prev.banReason,
                  banExpires: prev.banExpires,
                  bannedAt: prev.bannedAt,
                }
              : {};
          const merged = {
            ...prevBanFields,
            ...next,
            // If the incoming value explicitly has isBanned (not undefined), use it.
            // Otherwise fall back to preserved prev ban state.
            isBanned: next.isBanned !== undefined ? next.isBanned : prev?.isBanned,
            banReason: next.banReason !== undefined ? next.banReason : prev?.banReason,
            banExpires: next.banExpires !== undefined ? next.banExpires : prev?.banExpires,
            bannedAt: next.bannedAt !== undefined ? next.bannedAt : prev?.bannedAt,
          };
          localStorage.setItem('userData', JSON.stringify(merged));
          return merged;
        }
        return next;
      });
    },
    []
  );

  // Check for authentication on mount and when localStorage changes
  useEffect(() => {
    const checkAuth = () => {
      const authStatus = isAuthenticated();
      const userData = getCurrentUser();
      setIsLoggedIn(authStatus);
      setUser(userData);
    };

    window.addEventListener('storage', checkAuth);
    checkAuth();

    return () => {
      window.removeEventListener('storage', checkAuth);
    };
  }, []);

  // ── Periodic ban-status refresh ──────────────────────────────────────────
  // Every 15 s: fetch /auth/ban-status so the user picks up a ban immediately
  // without needing a page reload.
  useEffect(() => {
    if (!isLoggedIn) return;

    const refreshBanStatus = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/auth/ban-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          // data: { isBanned, banReason, banExpires, bannedAt }
          const current = getCurrentUser();
          if (current) {
            const updated = {
              ...current,
              isBanned: data.isBanned ?? current.isBanned,
              banReason: data.banReason ?? current.banReason,
              banExpires: data.banExpires ?? current.banExpires,
              bannedAt: data.bannedAt ?? current.bannedAt,
            };
            const prev = JSON.stringify(current);
            const next = JSON.stringify(updated);
            if (prev !== next) {
              localStorage.setItem('userData', next);
              setUser(updated);
            }
          }
        }
      } catch {
        // silent – don't spam console
      }
    };

    refreshBanStatus();
    const iv = setInterval(refreshBanStatus, 15000);
    return () => clearInterval(iv);
  }, [isLoggedIn]);

  const value: AuthContextType = {
    isLoggedIn,
    setIsLoggedIn,
    user,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
