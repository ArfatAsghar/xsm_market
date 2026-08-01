import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Menu, X, User, PlusCircle, LogOut, Settings, Heart, Star,
  MessageSquare, FileText, Crown, Bell, ShoppingBag, Inbox,
  Store, LayoutGrid, Shield
} from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { logout, API_URL } from '@/services/auth';
import { isCurrentUserAdmin } from '@/utils/adminConfig';
import VipSubscriptionModal from './VipSubscriptionModal';
import AuthWidget from './AuthWidget';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavbarProps {}

const Navbar: React.FC<NavbarProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAuthWidget, setShowAuthWidget] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [showVipModal, setShowVipModal] = useState(false);
  const { isLoggedIn, setIsLoggedIn, user, setUser } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Array<{id: number; text: string; read: boolean; time: string}>>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  // Fetch unread messages count
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
        // silent
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  // Close notification panel on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Seed sample notifications based on unread count
  useEffect(() => {
    if (!isLoggedIn) {
      setNotifications([]);
      return;
    }
    const base: Array<{id: number; text: string; read: boolean; time: string}> = [];
    if (unreadCount > 0) {
      base.push({ id: 1, text: `You have ${unreadCount} unread message${unreadCount > 1 ? 's' : ''}`, read: false, time: 'Just now' });
    }
    setNotifications(base);
  }, [unreadCount, isLoggedIn]);

  const unreadNotifCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Navigate helper
  const navigateToPage = (page: string) => {
    if (page === 'home') page = '/';
    navigate(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsMenuOpen(false);
  };

  // Admin check
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (isLoggedIn && user) {
        const role = (user as any).role;
        if (role === 'admin' || role === 'manager' || role === 'viewer') { setIsUserAdmin(true); return; }
        if ((user as any).isAdmin === true) { setIsUserAdmin(true); return; }
        if (user.email || user.username) {
          const adminStatus = await isCurrentUserAdmin(user.email, user.username);
          setIsUserAdmin(adminStatus);
        } else { setIsUserAdmin(false); }
      } else { setIsUserAdmin(false); }
    };
    checkAdminStatus();
  }, [isLoggedIn, user?.email, user?.username, (user as any)?.isAdmin, (user as any)?.role]);

  const handleLogout = () => {
    logout();
    setIsLoggedIn(false);
    navigateToPage('/');
  };

  const isActive = (path: string) => location.pathname === path || (path === '/' && location.pathname === '/');

  return (
    <>
      {showAuthWidget && (
        <AuthWidget
          onClose={() => setShowAuthWidget(false)}
          onNavigate={(page) => { navigateToPage(page); }}
        />
      )}

      <nav className="bg-xsm-black border-b border-xsm-medium-gray/60 sticky top-0 z-50" style={{ boxShadow: '0 2px 20px rgba(255,208,0,0.06)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[62px]">

            {/* ── LEFT: Logo ── */}
            <div
              className="flex items-center flex-shrink-0 cursor-pointer group"
              onClick={() => navigateToPage('/')}
            >
              <div className="relative">
                <div className="absolute -inset-3 bg-gradient-radial from-xsm-yellow/20 via-transparent to-transparent rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <img
                  src="/images/logo.png"
                  alt="XSM Market"
                  className="h-9 md:h-10 object-contain relative z-10 drop-shadow-[0_0_6px_rgba(255,208,0,0.4)] group-hover:drop-shadow-[0_0_12px_rgba(255,208,0,0.7)] transition-all duration-300"
                />
              </div>
            </div>

            {/* ── CENTER: Nav Items (desktop) ── */}
            <div className="hidden md:flex items-center gap-1">
              {/* Sell */}
              <button
                onClick={() => isLoggedIn ? navigateToPage('/sell') : setShowAuthWidget(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive('/sell')
                    ? 'bg-xsm-yellow text-black shadow-[0_0_12px_rgba(255,208,0,0.4)]'
                    : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Sell</span>
              </button>

              {/* Marketplace */}
              <button
                onClick={() => navigateToPage('/')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive('/')
                    ? 'bg-xsm-yellow text-black shadow-[0_0_12px_rgba(255,208,0,0.4)]'
                    : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'
                }`}
              >
                <Store className="w-4 h-4" />
                <span>Marketplace</span>
              </button>

              {/* Inbox */}
              <button
                onClick={() => isLoggedIn ? navigateToPage('/chat') : setShowAuthWidget(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 relative ${
                  isActive('/chat')
                    ? 'bg-xsm-yellow text-black shadow-[0_0_12px_rgba(255,208,0,0.4)]'
                    : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Inbox</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 shadow border border-xsm-black">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Admin Dashboard */}
              {isLoggedIn && isUserAdmin && (
                <button
                  onClick={() => navigateToPage('/admin-dashboard')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    isActive('/admin-dashboard')
                      ? 'bg-xsm-yellow text-black shadow-[0_0_12px_rgba(255,208,0,0.4)]'
                      : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Dashboard</span>
                </button>
              )}
            </div>

            {/* ── RIGHT: Notifications + Profile ── */}
            <div className="hidden md:flex items-center gap-2">

              {/* Notifications Bell */}
              {isLoggedIn && (
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => setShowNotifications(prev => !prev)}
                    className="relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-xsm-yellow hover:bg-white/5 border border-transparent hover:border-white/10 transition-all duration-200"
                    title="Notifications"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadNotifCount > 0 && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-xsm-black" />
                    )}
                  </button>

                  {/* Notifications Dropdown Panel */}
                  {showNotifications && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-[#151515] border border-xsm-medium-gray/60 rounded-xl shadow-2xl overflow-hidden z-50" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,208,0,0.08)' }}>
                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-xsm-medium-gray/40">
                        <span className="text-sm font-semibold text-white">Notifications</span>
                        {unreadNotifCount > 0 && (
                          <button onClick={markAllRead} className="text-xs text-xsm-yellow hover:text-yellow-400 transition-colors">
                            Mark all read
                          </button>
                        )}
                      </div>

                      {/* Items */}
                      <div className="max-h-64 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <Bell className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                            <p className="text-gray-400 text-sm">No notifications</p>
                          </div>
                        ) : (
                          notifications.map(notif => (
                            <div
                              key={notif.id}
                              onClick={() => { navigateToPage('/chat'); setShowNotifications(false); }}
                              className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/5 border-b border-xsm-medium-gray/20 last:border-0 ${
                                !notif.read ? 'bg-xsm-yellow/5' : ''
                              }`}
                            >
                              <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                !notif.read ? 'bg-xsm-yellow/20' : 'bg-white/5'
                              }`}>
                                <MessageSquare className={`w-4 h-4 ${!notif.read ? 'text-xsm-yellow' : 'text-gray-500'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm leading-tight ${!notif.read ? 'text-white font-medium' : 'text-gray-400'}`}>
                                  {notif.text}
                                </p>
                                <p className="text-xs text-gray-600 mt-0.5">{notif.time}</p>
                              </div>
                              {!notif.read && (
                                <span className="w-2 h-2 bg-xsm-yellow rounded-full flex-shrink-0 mt-1" />
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      {/* Footer */}
                      <div className="border-t border-xsm-medium-gray/40 px-4 py-2.5">
                        <button
                          onClick={() => { navigateToPage('/chat'); setShowNotifications(false); }}
                          className="text-xs text-xsm-yellow hover:text-yellow-400 transition-colors w-full text-center"
                        >
                          Go to Inbox →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Profile Dropdown or Login */}
              {isLoggedIn ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 transition-all duration-200 group">
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ${
                        (user as any)?.isVip
                          ? 'ring-2 ring-xsm-yellow bg-gradient-to-tr from-yellow-500 to-amber-500'
                          : 'bg-xsm-yellow'
                      }`}>
                        {user?.profilePicture ? (
                          <img src={user.profilePicture} alt={user.username} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-black m-2" />
                        )}
                      </div>
                      {/* Name */}
                      <div className="flex flex-col items-start">
                        <span className="text-white text-xs font-semibold leading-tight group-hover:text-xsm-yellow transition-colors">
                          {user?.username || 'Account'}
                        </span>
                        {(user as any)?.isVip && (
                          <span className="text-[10px] text-yellow-400 font-medium leading-tight flex items-center gap-0.5">
                            <Crown className="w-2.5 h-2.5 fill-yellow-400/50" /> VIP
                          </span>
                        )}
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-[#151515] border-xsm-medium-gray/60 min-w-[200px] shadow-2xl" align="end">
                    <DropdownMenuLabel className="text-gray-400 text-xs px-2">My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-xsm-medium-gray/30" />
                    <DropdownMenuItem onClick={() => navigateToPage(`/u/${user?.username}`)} className="cursor-pointer text-gray-200 hover:text-white focus:text-white hover:bg-white/5 focus:bg-white/5">
                      <User className="mr-2 h-4 w-4 text-gray-400" />
                      <span>Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigateToPage('/my-deals')} className="cursor-pointer text-gray-200 hover:text-white focus:text-white hover:bg-white/5 focus:bg-white/5">
                      <FileText className="mr-2 h-4 w-4 text-gray-400" />
                      <span>My Deals</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigateToPage('/seller-deals')} className="cursor-pointer text-gray-200 hover:text-white focus:text-white hover:bg-white/5 focus:bg-white/5">
                      <FileText className="mr-2 h-4 w-4 text-gray-400" />
                      <span>Seller Deals</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-xsm-medium-gray/30" />
                    <DropdownMenuItem onClick={() => setShowVipModal(true)} className="cursor-pointer text-yellow-400 hover:text-yellow-300 focus:text-yellow-300 hover:bg-yellow-400/10 focus:bg-yellow-400/10 font-semibold">
                      <Crown className="mr-2 h-4 w-4 fill-yellow-400/30" />
                      <span>VIP Membership</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-xsm-medium-gray/30" />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-400 hover:text-red-300 focus:text-red-300 hover:bg-red-400/10 focus:bg-red-400/10">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Logout</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <button
                  onClick={() => setShowAuthWidget(true)}
                  className="bg-xsm-yellow hover:bg-yellow-400 text-black px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 flex items-center gap-2 shadow-[0_0_12px_rgba(255,208,0,0.25)] hover:shadow-[0_0_20px_rgba(255,208,0,0.4)]"
                >
                  <User className="w-4 h-4" />
                  <span>Login</span>
                </button>
              )}
            </div>

            {/* ── MOBILE: Hamburger + unread badge ── */}
            <div className="md:hidden flex items-center gap-2">
              {isLoggedIn && unreadCount > 0 && (
                <button
                  onClick={() => navigateToPage('/chat')}
                  className="relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-xsm-yellow"
                >
                  <MessageSquare className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-xsm-black" />
                </button>
              )}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>
        </div>

        {/* ── MOBILE MENU ── */}
        {isMenuOpen && (
          <div className="md:hidden bg-[#0d0d0d] border-t border-xsm-medium-gray/40">
            <div className="px-3 py-3 space-y-1">
              {/* User greeting */}
              {isLoggedIn && (
                <div className="flex items-center gap-3 px-3 py-2 mb-2">
                  <div className={`w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ${(user as any)?.isVip ? 'ring-2 ring-xsm-yellow' : 'bg-xsm-yellow'}`}>
                    {user?.profilePicture ? (
                      <img src={user.profilePicture} alt={user.username} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-black m-2" />
                    )}
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">{user?.username}</p>
                    {(user as any)?.isVip && <p className="text-yellow-400 text-xs flex items-center gap-1"><Crown className="w-3 h-3" /> VIP Member</p>}
                  </div>
                </div>
              )}

              {/* Nav Links */}
              {[
                { label: 'Sell', path: '/sell', icon: PlusCircle, requireAuth: true },
                { label: 'Marketplace', path: '/', icon: Store, requireAuth: false },
                { label: 'Inbox', path: '/chat', icon: MessageSquare, requireAuth: true, badge: unreadCount },
              ].map(item => (
                <button
                  key={item.path}
                  onClick={() => {
                    if (item.requireAuth && !isLoggedIn) { setIsMenuOpen(false); setShowAuthWidget(true); return; }
                    navigateToPage(item.path);
                  }}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                    isActive(item.path)
                      ? 'bg-xsm-yellow text-black'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </button>
              ))}

              {isLoggedIn && isUserAdmin && (
                <button
                  onClick={() => navigateToPage('/admin-dashboard')}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin Dashboard</span>
                </button>
              )}

              <div className="border-t border-xsm-medium-gray/30 pt-2 mt-2 space-y-1">
                {isLoggedIn ? (
                  <>
                    <button onClick={() => navigateToPage(`/u/${user?.username}`)} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                      <User className="w-4 h-4" /> <span>Profile</span>
                    </button>
                    <button onClick={() => navigateToPage('/my-deals')} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                      <FileText className="w-4 h-4" /> <span>My Deals</span>
                    </button>
                    <button onClick={() => navigateToPage('/seller-deals')} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                      <FileText className="w-4 h-4" /> <span>Seller Deals</span>
                    </button>
                    <button onClick={() => { setShowVipModal(true); setIsMenuOpen(false); }} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-semibold text-yellow-400 hover:bg-yellow-400/10 transition-colors">
                      <Crown className="w-4 h-4 fill-yellow-400/30" /> <span>VIP Membership</span>
                    </button>
                    <button onClick={() => { handleLogout(); }} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-400/10 transition-colors">
                      <LogOut className="w-4 h-4" /> <span>Logout</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setIsMenuOpen(false); setShowAuthWidget(true); }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-bold bg-xsm-yellow text-black hover:bg-yellow-400 transition-colors"
                  >
                    <User className="w-4 h-4" /> <span>Login / Sign Up</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {isLoggedIn && (
        <VipSubscriptionModal
          isOpen={showVipModal}
          onClose={() => setShowVipModal(false)}
          onSuccess={(vipUntil) => {
            if (user) {
              const updatedUser = { ...user, isVip: true, vipUntil };
              localStorage.setItem('userData', JSON.stringify(updatedUser));
              setUser(updatedUser as any);
            }
          }}
        />
      )}
    </>
  );
};

export default Navbar;
