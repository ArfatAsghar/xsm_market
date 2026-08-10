import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FaStore, FaInbox, FaTag, FaBell, FaUser, FaSignOutAlt,
  FaFileAlt, FaCrown, FaTachometerAlt, FaBars, FaTimes,
  FaChevronDown, FaEnvelope, FaCheck, FaBan, FaCheckCircle
} from 'react-icons/fa';
import { useAuth } from '@/context/useAuth';
import { useNotifications } from '@/context/NotificationContext';
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

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAuthWidget, setShowAuthWidget] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [showVipModal, setShowVipModal] = useState(false);
  const { isLoggedIn, setIsLoggedIn, user, setUser } = useAuth();
  const { inAppNotifications, unreadInAppCount, markRead, markAllRead } = useNotifications();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Helper: format remaining ban duration
  const formatBanDuration = (banExpires: string | null | undefined): string => {
    if (!banExpires) return 'permanent';
    const ms = new Date(banExpires).getTime() - Date.now();
    if (ms <= 0) return 'expired';
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hours}h remaining`;
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${mins}m remaining`;
  };

  // Fetch unread messages
  useEffect(() => {
    if (!isLoggedIn) { setUnreadCount(0); return; }
    const fetchUnread = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch(`${API_URL}/chat/unread-count`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          if (typeof data.unreadCount === 'number') setUnreadCount(data.unreadCount);
        }
      } catch {}
    };
    fetchUnread();
    const iv = setInterval(fetchUnread, 15000);
    return () => clearInterval(iv);
  }, [isLoggedIn]);

  // Close notif panel on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const navigateTo = (path: string) => {
    navigate(path === 'home' ? '/' : path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsMenuOpen(false);
  };

  // Admin check
  useEffect(() => {
    const check = async () => {
      if (isLoggedIn && user) {
        const role = (user as any).role;
        if (['admin', 'manager', 'viewer'].includes(role) || (user as any).isAdmin === true) { setIsUserAdmin(true); return; }
        if (user.email || user.username) setIsUserAdmin(await isCurrentUserAdmin(user.email, user.username));
        else setIsUserAdmin(false);
      } else setIsUserAdmin(false);
    };
    check();
  }, [isLoggedIn, user?.email, user?.username, (user as any)?.isAdmin, (user as any)?.role]);

  const handleLogout = () => { logout(); setIsLoggedIn(false); navigateTo('/'); };

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname === path || location.pathname.startsWith(path + '/');

  // Nav link with animated underline
  const NavLink = ({
    path, icon, label, badge, requireAuth = false
  }: { path: string; icon: React.ReactNode; label: string; badge?: number; requireAuth?: boolean }) => {
    const active = isActive(path);
    return (
      <button
        onClick={() => {
          if (requireAuth && !isLoggedIn) { setShowAuthWidget(true); return; }
          navigateTo(path);
        }}
        className={`relative group flex items-center gap-2 px-1 py-1 text-[13.5px] font-semibold tracking-wide transition-colors duration-200 ${
          active ? 'text-xsm-yellow' : 'text-gray-300 hover:text-white'
        }`}
        style={{ background: 'none', border: 'none' }}
      >
        <span className={`text-base transition-transform duration-200 group-hover:scale-110 ${active ? 'text-xsm-yellow' : 'text-gray-400 group-hover:text-xsm-yellow'}`}>
          {icon}
        </span>
        <span>{label}</span>
        {badge && badge > 0 ? (
          <span className="ml-0.5 bg-red-500 text-white text-[9px] font-extrabold min-w-[17px] h-[17px] flex items-center justify-center rounded-full px-1 shadow-md border border-black/30">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
        {/* Animated underline */}
        <span
          className={`absolute bottom-[-4px] left-0 h-[2px] bg-gradient-to-r from-xsm-yellow via-yellow-400 to-xsm-yellow rounded-full transition-all duration-300 ${
            active ? 'w-full opacity-100' : 'w-0 opacity-0 group-hover:w-full group-hover:opacity-100'
          }`}
        />
      </button>
    );
  };

  return (
    <>
      {showAuthWidget && (
        <AuthWidget onClose={() => setShowAuthWidget(false)} onNavigate={navigateTo} />
      )}

      <nav
        className="sticky top-0 z-50 border-b border-white/[0.06]"
        style={{
          background: 'linear-gradient(135deg, rgba(10,10,10,0.98) 0%, rgba(18,18,18,0.98) 50%, rgba(10,10,10,0.98) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 1px 40px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,208,0,0.08), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        {/* Subtle yellow top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-[1px]"
          style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,208,0,0.6) 30%, rgba(255,208,0,0.9) 50%, rgba(255,208,0,0.6) 70%, transparent 100%)' }}
        />

        <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-[64px]">

            {/* ── LEFT: Logo ── */}
            <button
              onClick={() => navigateTo('/')}
              className="flex items-center gap-3 flex-shrink-0 group focus:outline-none"
            >
              <div className="relative">
                <div
                  className="absolute -inset-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'radial-gradient(circle, rgba(255,208,0,0.18) 0%, transparent 70%)' }}
                />
                <img
                  src="/images/logo.png"
                  alt="XSM Market"
                  className="h-9 object-contain relative z-10 transition-all duration-300"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(255,208,0,0.35))' }}
                />
              </div>
            </button>

            {/* ── CENTER: Desktop Nav Links ── */}
            <div className="hidden md:flex items-center gap-7">
              {/* Sell (most left) */}
              <button
                onClick={() => {
                  if (!isLoggedIn) { setShowAuthWidget(true); return; }
                  navigateTo('/sell');
                }}
                className="relative group inline-flex items-center gap-2 px-4 py-1.5 text-[13.5px] font-extrabold tracking-wide text-black rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-[0_0_12px_rgba(255,208,0,0.4)] hover:shadow-[0_0_20px_rgba(255,208,0,0.75)] cursor-pointer border border-yellow-300/30"
                style={{
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%)',
                }}
              >
                <FaTag className="text-xs transition-transform duration-300 group-hover:rotate-12" />
                <span>Sell</span>
              </button>

              {/* Marketplace (middle) */}
              <NavLink path="/" icon={<FaStore />} label="Marketplace" />

              {/* Inbox (most right) */}
              <NavLink path="/chat" icon={<FaInbox />} label="Inbox" badge={unreadCount} requireAuth />
            </div>

            {/* ── RIGHT: Actions ── */}
            <div className="hidden md:flex items-center gap-2">

              {/* Notification Bell */}
              {isLoggedIn && (
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => setShowNotifications(p => !p)}
                    className="relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-xsm-yellow transition-colors duration-200"
                    style={{ background: showNotifications ? 'rgba(255,208,0,0.08)' : 'transparent' }}
                    title="Notifications"
                  >
                    <FaBell className="text-[16px]" />
                    {unreadInAppCount > 0 && (
                      <span className="absolute top-[7px] right-[7px] w-[8px] h-[8px] bg-red-500 rounded-full border-[1.5px] border-[#0a0a0a] animate-pulse" />
                    )}
                  </button>

                  {showNotifications && (
                    <div
                      className="absolute right-0 top-full mt-3 w-[320px] rounded-xl overflow-hidden z-50"
                      style={{
                        background: 'linear-gradient(145deg, #111111, #0d0d0d)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,208,0,0.06)',
                      }}
                    >
                      {/* Panel header */}
                      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex items-center gap-2">
                          <FaBell className="text-xsm-yellow text-sm" />
                          <span className="text-sm font-bold text-white tracking-wide">Notifications</span>
                          {unreadInAppCount > 0 && (
                            <span className="bg-xsm-yellow text-black text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                              {unreadInAppCount}
                            </span>
                          )}
                        </div>
                        {unreadInAppCount > 0 && (
                          <button onClick={() => markAllRead()} className="text-xs text-gray-500 hover:text-xsm-yellow transition-colors flex items-center gap-1">
                            <FaCheck className="text-[10px]" /> All read
                          </button>
                        )}
                      </div>

                      {/* Account Restricted Banner if Banned */}
                      {(user as any)?.isBanned && (
                        <div className="p-3.5 bg-gradient-to-r from-red-950/90 to-neutral-900 border-b border-red-500/40 text-left">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                              <FaBan className="text-red-400 text-xs" />
                            </div>
                            <span className="text-xs font-bold text-red-300 uppercase tracking-wide">Account Restricted</span>
                          </div>
                          {(user as any)?.banReason && (
                            <p className="text-xs text-red-200/90 leading-snug font-medium mb-1">
                              Reason: {(user as any).banReason}
                            </p>
                          )}
                          <p className="text-xs font-semibold text-red-400">
                            ⏳ Ban Duration: {formatBanDuration((user as any)?.banExpires)}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-1">
                            Messaging restricted. You may only contact Website Agent / Admin.
                          </p>
                        </div>
                      )}

                      {/* Items */}
                      <div className="max-h-72 overflow-y-auto">
                        {inAppNotifications.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 gap-2">
                            <FaBell className="text-3xl text-gray-700" />
                            <p className="text-gray-500 text-sm">You're all caught up!</p>
                          </div>
                        ) : (
                          inAppNotifications.map(n => (
                            <button
                              key={n.id}
                              onClick={() => {
                                markRead(n.id);
                                if (n.link) navigateTo(n.link);
                                else navigateTo('/chat');
                                setShowNotifications(false);
                              }}
                              className={`flex items-start gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-white/[0.04] ${!n.isRead ? 'bg-xsm-yellow/[0.03]' : ''}`}
                              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                            >
                              <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                n.type === 'ban' ? 'bg-red-500/20' :
                                n.type === 'unban' ? 'bg-emerald-500/20' :
                                !n.isRead ? 'bg-xsm-yellow/15' : 'bg-white/5'
                              }`}>
                                {n.type === 'ban' ? (
                                  <FaBan className="text-xs text-red-400" />
                                ) : n.type === 'unban' ? (
                                  <FaCheckCircle className="text-xs text-emerald-400" />
                                ) : n.type === 'deal' ? (
                                  <FaTag className={`text-xs ${!n.isRead ? 'text-xsm-yellow' : 'text-gray-500'}`} />
                                ) : n.type === 'admin_message' ? (
                                  <FaEnvelope className={`text-xs ${!n.isRead ? 'text-amber-400' : 'text-gray-500'}`} />
                                ) : (
                                  <FaEnvelope className={`text-xs ${!n.isRead ? 'text-xsm-yellow' : 'text-gray-500'}`} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-semibold ${
                                  n.type === 'ban' ? 'text-red-400' :
                                  n.type === 'unban' ? 'text-emerald-400' :
                                  !n.isRead ? 'text-xsm-yellow' : 'text-gray-300'
                                }`}>{n.title}</p>
                                <p className={`text-xs leading-snug truncate ${!n.isRead ? 'text-white font-medium' : 'text-gray-400'}`}>{n.message}</p>
                                <p className="text-[10px] text-gray-600 mt-0.5">{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                              </div>
                              {!n.isRead && <span className="w-2 h-2 bg-xsm-yellow rounded-full mt-1.5 flex-shrink-0" />}
                            </button>
                          ))
                        )}
                      </div>

                      <button
                        onClick={() => { navigateTo('/chat'); setShowNotifications(false); }}
                        className="block w-full px-4 py-2.5 text-xs font-semibold text-xsm-yellow hover:text-yellow-400 text-center transition-colors"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        Open Inbox →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Divider */}
              {isLoggedIn && <div className="w-px h-6 bg-white/10" />}

              {/* Profile Dropdown or Login */}
              {isLoggedIn ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all duration-200 hover:bg-white/[0.05] border border-transparent hover:border-white/[0.08] group focus:outline-none">
                      {/* Avatar with ban badge overlay */}
                      <div className="relative flex-shrink-0">
                        <div
                          className={`w-[30px] h-[30px] rounded-full overflow-hidden flex items-center justify-center ${
                            (user as any)?.isBanned
                              ? 'ring-[1.5px] ring-red-500'
                              : (user as any)?.isVip
                              ? 'ring-[1.5px] ring-xsm-yellow bg-gradient-to-tr from-yellow-500 to-amber-600'
                              : 'bg-xsm-yellow'
                          }`}
                        >
                          {user?.profilePicture
                            ? <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
                            : <FaUser className="text-black text-[11px]" />
                          }
                        </div>
                        {/* Ban badge */}
                        {(user as any)?.isBanned && (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-red-600 rounded-full border-[1.5px] border-[#0a0a0a] flex items-center justify-center"
                            title="Account Banned"
                          >
                            <FaBan className="text-[7px] text-white" />
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-start leading-tight">
                        <span className="text-[12.5px] font-bold text-white group-hover:text-xsm-yellow transition-colors">
                          {user?.username || 'Account'}
                        </span>
                        {(user as any)?.isBanned ? (
                          <span className="text-[10px] text-red-400 flex items-center gap-0.5 font-medium">
                            <FaBan className="text-[8px]" /> Banned
                          </span>
                        ) : (user as any)?.isVip && (
                          <span className="text-[10px] text-yellow-400 flex items-center gap-0.5 font-medium">
                            <FaCrown className="text-[8px]" /> VIP
                          </span>
                        )}
                      </div>
                      <FaChevronDown className="text-gray-500 text-[10px] group-hover:text-gray-300 transition-colors" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="min-w-[210px] rounded-xl overflow-hidden p-1"
                    style={{
                      background: 'linear-gradient(145deg, #111111, #0d0d0d)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,208,0,0.06)',
                    }}
                  >
                    <DropdownMenuLabel className="px-3 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-widest">My Account</DropdownMenuLabel>
                    
                    <DropdownMenuItem
                      onClick={() => navigateTo(`/u/${user?.username}`)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-gray-300 hover:text-white hover:bg-white/[0.05] focus:bg-white/[0.05] focus:text-white transition-colors"
                    >
                      <FaUser className="text-gray-500 text-sm flex-shrink-0" />
                      <span className="text-sm font-medium">Profile</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => navigateTo('/my-deals')}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-gray-300 hover:text-white hover:bg-white/[0.05] focus:bg-white/[0.05] focus:text-white transition-colors"
                    >
                      <FaFileAlt className="text-gray-500 text-sm flex-shrink-0" />
                      <span className="text-sm font-medium">My Deals</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => navigateTo('/seller-deals')}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-gray-300 hover:text-white hover:bg-white/[0.05] focus:bg-white/[0.05] focus:text-white transition-colors"
                    >
                      <FaFileAlt className="text-gray-500 text-sm flex-shrink-0" />
                      <span className="text-sm font-medium">Seller Deals</span>
                    </DropdownMenuItem>

                    {isUserAdmin && (
                      <>
                        <DropdownMenuSeparator className="my-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
                        <DropdownMenuItem
                          onClick={() => navigateTo('/admin-dashboard')}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 focus:bg-blue-500/10 focus:text-blue-300 transition-colors"
                        >
                          <FaTachometerAlt className="text-sm flex-shrink-0" />
                          <span className="text-sm font-semibold">Admin Dashboard</span>
                        </DropdownMenuItem>
                      </>
                    )}

                    <DropdownMenuSeparator className="my-1" style={{ background: 'rgba(255,255,255,0.06)' }} />

                    <DropdownMenuItem
                      onClick={() => setShowVipModal(true)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer font-semibold transition-colors"
                      style={{ color: '#facc15' }}
                    >
                      <FaCrown className="text-sm flex-shrink-0 opacity-70" />
                      <span className="text-sm">VIP Membership</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="my-1" style={{ background: 'rgba(255,255,255,0.06)' }} />

                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-red-400 hover:text-red-300 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-300 transition-colors"
                    >
                      <FaSignOutAlt className="text-sm flex-shrink-0" />
                      <span className="text-sm font-medium">Logout</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <button
                  onClick={() => setShowAuthWidget(true)}
                  className="relative flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-black overflow-hidden transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
                  style={{
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFC200 50%, #FFD700 100%)',
                    boxShadow: '0 0 20px rgba(255,208,0,0.3), 0 4px 15px rgba(0,0,0,0.3)',
                  }}
                >
                  <FaUser className="text-[12px]" />
                  <span>Login</span>
                </button>
              )}
            </div>

            {/* ── MOBILE hamburger ── */}
            <div className="md:hidden flex items-center gap-2">
              {isLoggedIn && unreadCount > 0 && (
                <button
                  onClick={() => navigateTo('/chat')}
                  className="relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-xsm-yellow"
                >
                  <FaInbox className="text-base" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[#0a0a0a]" />
                </button>
              )}
              <button
                onClick={() => setIsMenuOpen(p => !p)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                {isMenuOpen ? <FaTimes className="text-base" /> : <FaBars className="text-base" />}
              </button>
            </div>

          </div>
        </div>

        {/* ── MOBILE MENU ── */}
        {isMenuOpen && (
          <div
            className="md:hidden border-t"
            style={{
              background: 'linear-gradient(180deg, #0d0d0d 0%, #080808 100%)',
              borderColor: 'rgba(255,255,255,0.06)',
            }}
          >
            <div className="px-4 py-4 space-y-1">
              {isLoggedIn && (
                <div className="flex items-center gap-3 px-2 py-3 mb-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                  {/* Mobile avatar with ban badge */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center ${
                      (user as any)?.isBanned
                        ? 'ring-2 ring-red-500'
                        : (user as any)?.isVip
                        ? 'ring-2 ring-xsm-yellow bg-gradient-to-tr from-yellow-500 to-amber-600'
                        : 'bg-xsm-yellow'
                    }`}>
                      {user?.profilePicture
                        ? <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
                        : <FaUser className="text-black text-sm" />
                      }
                    </div>
                    {(user as any)?.isBanned && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-red-600 rounded-full border-2 border-[#0d0d0d] flex items-center justify-center">
                        <FaBan className="text-[8px] text-white" />
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold">{user?.username}</p>
                    {(user as any)?.isBanned
                      ? <p className="text-red-400 text-xs flex items-center gap-1"><FaBan className="text-[9px]" /> Banned · {formatBanDuration((user as any)?.banExpires)}</p>
                      : (user as any)?.isVip && <p className="text-yellow-400 text-xs flex items-center gap-1"><FaCrown className="text-[9px]" /> VIP Member</p>
                    }
                  </div>
                </div>
              )}

              {/* Mobile nav items */}
              {[
                { path: '/sell', icon: <FaTag />, label: 'Sell', requireAuth: true },
                { path: '/', icon: <FaStore />, label: 'Marketplace' },
                { path: '/chat', icon: <FaInbox />, label: 'Inbox', badge: unreadCount, requireAuth: true },
              ].map(item => (
                <button
                  key={item.path}
                  onClick={() => {
                    if (item.requireAuth && !isLoggedIn) { setIsMenuOpen(false); setShowAuthWidget(true); return; }
                    navigateTo(item.path);
                  }}
                  className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive(item.path)
                      ? 'bg-xsm-yellow/10 text-xsm-yellow border border-xsm-yellow/20'
                      : 'text-gray-300 hover:text-white hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <span className={isActive(item.path) ? 'text-xsm-yellow' : 'text-gray-500'}>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span className="ml-auto bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  ) : null}
                </button>
              ))}

              <div className="border-t pt-2 mt-2 space-y-1" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                {isLoggedIn ? (
                  <>
                    <button onClick={() => navigateTo(`/u/${user?.username}`)} className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors">
                      <FaUser className="text-sm text-gray-600" /><span>Profile</span>
                    </button>
                    <button onClick={() => navigateTo('/my-deals')} className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors">
                      <FaFileAlt className="text-sm text-gray-600" /><span>My Deals</span>
                    </button>
                    <button onClick={() => navigateTo('/seller-deals')} className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors">
                      <FaFileAlt className="text-sm text-gray-600" /><span>Seller Deals</span>
                    </button>
                    {isUserAdmin && (
                      <button onClick={() => navigateTo('/admin-dashboard')} className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors">
                        <FaTachometerAlt className="text-sm" /><span>Admin Dashboard</span>
                      </button>
                    )}
                    <button onClick={() => { setShowVipModal(true); setIsMenuOpen(false); }} className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-yellow-400 hover:bg-yellow-400/10 transition-colors">
                      <FaCrown className="text-sm opacity-80" /><span>VIP Membership</span>
                    </button>
                    <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors">
                      <FaSignOutAlt className="text-sm" /><span>Logout</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setIsMenuOpen(false); setShowAuthWidget(true); }}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-bold text-black transition-colors"
                    style={{ background: 'linear-gradient(135deg, #FFD700, #FFC200)' }}
                  >
                    <FaUser /><span>Login / Sign Up</span>
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
              const updated = { ...user, isVip: true, vipUntil };
              localStorage.setItem('userData', JSON.stringify(updated));
              setUser(updated as any);
            }
          }}
        />
      )}
    </>
  );
};

export default Navbar;
