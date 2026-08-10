import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://xsmmarket.com/api';

export interface NotificationProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  autoClose?: boolean;
}

interface NotificationState extends NotificationProps {
  id: string;
  visible: boolean;
}

export interface InAppNotification {
  id: number;
  userId: number;
  type: 'message' | 'admin_message' | 'deal' | 'announcement' | 'system' | 'ban' | 'unban';
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationContextType {
  notifications: NotificationState[];
  inAppNotifications: InAppNotification[];
  unreadInAppCount: number;
  showSuccess: (title: string, message?: string, options?: Partial<NotificationProps>) => string;
  showError: (title: string, message?: string, options?: Partial<NotificationProps>) => string;
  showWarning: (title: string, message?: string, options?: Partial<NotificationProps>) => string;
  showInfo: (title: string, message?: string, options?: Partial<NotificationProps>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  fetchInAppNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Web Audio API helper for Ping/Ding sound
const playPingSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // High-pitched crystal bell sound (Ping/Ding)
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08); // E6
    
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // Audio context may be blocked prior to user interaction
  }
};

// Notification component
const Notification: React.FC<NotificationState & { onRemove: (id: string) => void }> = ({
  id,
  type,
  title,
  message,
  duration = 5000,
  autoClose = true,
  visible,
  onRemove
}) => {
  const [isExiting, setIsExiting] = React.useState(false);

  React.useEffect(() => {
    if (autoClose && visible) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, autoClose]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(id);
    }, 300);
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-amber-400" />;
      case 'info':
        return <Info className="w-5 h-5 text-xsm-yellow" />;
    }
  };

  const getColorClasses = () => {
    switch (type) {
      case 'success':
        return 'bg-gradient-to-r from-emerald-950 to-xsm-black border-emerald-500/40 text-emerald-100';
      case 'error':
        return 'bg-gradient-to-r from-red-950 to-xsm-black border-red-500/40 text-red-100';
      case 'warning':
        return 'bg-gradient-to-r from-amber-950 to-xsm-black border-amber-500/40 text-amber-100';
      case 'info':
        return 'bg-gradient-to-r from-neutral-900 to-xsm-black border-xsm-yellow/50 text-white';
    }
  };

  return (
    <div
      className={`
        transform transition-all duration-300 ease-in-out mb-3
        ${visible && !isExiting ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-full opacity-0 scale-95'}
      `}
    >
      <div className={`border rounded-xl shadow-2xl p-4 max-w-sm backdrop-blur-md ${getColorClasses()}`}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm text-xsm-yellow tracking-wide">{title}</h4>
            {message && (
              <p className="text-xs text-gray-200 opacity-90 mt-1 leading-relaxed">{message}</p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 ml-2 p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Provider component
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationState[]>([]);
  const [inAppNotifications, setInAppNotifications] = useState<InAppNotification[]>([]);
  const [unreadInAppCount, setUnreadInAppCount] = useState(0);
  const prevUnreadRef = useRef<number>(0);
  const seenNotifIdsRef = useRef<Set<number>>(new Set());
  const isInitialFetchRef = useRef<boolean>(true);

  const fetchInAppNotifications = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setInAppNotifications([]);
      setUnreadInAppCount(0);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.notifications)) {
          const list: InAppNotification[] = data.notifications;
          setInAppNotifications(list);
          const count = typeof data.unreadCount === 'number' ? data.unreadCount : 0;
          setUnreadInAppCount(count);

          // Track new unread notifications and pop up toast notification
          if (isInitialFetchRef.current) {
            list.forEach(n => seenNotifIdsRef.current.add(n.id));
            isInitialFetchRef.current = false;
          } else {
            const newlyReceived = list.filter(n => !n.isRead && !seenNotifIdsRef.current.has(n.id));
            if (newlyReceived.length > 0) {
              playPingSound();
              newlyReceived.forEach(n => {
                seenNotifIdsRef.current.add(n.id);

                // Ban/unban: update localStorage so Navbar ban badge appears instantly
                if (n.type === 'ban' || n.type === 'unban') {
                  try {
                    const raw = localStorage.getItem('userData');
                    if (raw) {
                      const u = JSON.parse(raw);
                      if (n.type === 'ban') {
                        u.isBanned = true;
                        u.banReason = n.message;
                      } else {
                        u.isBanned = false;
                        u.banReason = null;
                        u.banExpires = null;
                        u.bannedAt = null;
                      }
                      localStorage.setItem('userData', JSON.stringify(u));
                      // Trigger AuthContext storage listener
                      window.dispatchEvent(new Event('storage'));
                    }
                  } catch {/* silent */}
                }

                addNotification({
                  type: n.type === 'ban' ? 'error' : n.type === 'unban' ? 'success' : 'info',
                  title: n.title || 'New Notification',
                  message: n.message,
                  duration: n.type === 'ban' || n.type === 'unban' ? 10000 : 6000,
                  autoClose: true
                });
              });
            }
          }
          prevUnreadRef.current = count;
        }
      }
    } catch (e) {
      // Silent catch
    }
  };

  useEffect(() => {
    fetchInAppNotifications();
    const interval = setInterval(fetchInAppNotifications, 8000);
    return () => clearInterval(interval);
  }, []);

  const markRead = async (id: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      await fetch(`${API_URL}/notifications/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });
      setInAppNotifications(prev =>
        prev.map(n => (n.id === Number(id) ? { ...n, isRead: true } : n))
      );
      setUnreadInAppCount(prev => Math.max(0, prev - 1));
      prevUnreadRef.current = Math.max(0, prevUnreadRef.current - 1);
    } catch (e) {
      // Silent catch
    }
  };

  const markAllRead = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      await fetch(`${API_URL}/notifications/mark-all-read`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setInAppNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadInAppCount(0);
      prevUnreadRef.current = 0;
    } catch (e) {
      // Silent catch
    }
  };

  const addNotification = (notification: NotificationProps) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification: NotificationState = {
      ...notification,
      id,
      visible: true
    };

    setNotifications(prev => [...prev, newNotification]);
    return id;
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const showSuccess = (title: string, message?: string, options?: Partial<NotificationProps>) => {
    return addNotification({ type: 'success', title, message, ...options });
  };

  const showError = (title: string, message?: string, options?: Partial<NotificationProps>) => {
    return addNotification({ type: 'error', title, message, ...options });
  };

  const showWarning = (title: string, message?: string, options?: Partial<NotificationProps>) => {
    return addNotification({ type: 'warning', title, message, ...options });
  };

  const showInfo = (title: string, message?: string, options?: Partial<NotificationProps>) => {
    return addNotification({ type: 'info', title, message, ...options });
  };

  const value = {
    notifications,
    inAppNotifications,
    unreadInAppCount,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeNotification,
    clearAll,
    markRead,
    markAllRead,
    fetchInAppNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {/* Toast Notification Container in Bottom-Right Corner */}
      <div className="fixed bottom-5 right-5 z-[9999] pointer-events-none">
        <div className="space-y-2 pointer-events-auto">
          {notifications.map((notification) => (
            <Notification
              key={notification.id}
              {...notification}
              onRemove={removeNotification}
            />
          ))}
        </div>
      </div>
    </NotificationContext.Provider>
  );
};

// Hook to use notifications
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
