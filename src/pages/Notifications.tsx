import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBell, FaBan, FaTag, FaCheckCircle, FaEnvelope, FaCheck } from 'react-icons/fa';
import { useNotifications } from '@/context/NotificationContext';
import { useAuth } from '@/context/useAuth';

const Notifications: React.FC = () => {
  const { inAppNotifications, markRead, markAllRead, unreadBellCount } = useNotifications();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  // Only show ban/unban/deal notifications
  const bellNotifs = inAppNotifications.filter(n => ['ban', 'unban', 'deal'].includes(n.type));

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-xsm-black flex items-center justify-center">
        <div className="text-center">
          <FaBell className="text-5xl text-gray-700 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">Login Required</h2>
          <p className="text-gray-400 mb-6">Please log in to view your notifications.</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2.5 bg-xsm-yellow text-black font-bold rounded-xl hover:brightness-110 transition"
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-xsm-black to-xsm-dark-gray">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#ffd000,#ff9000)' }}
            >
              <FaBell className="text-black text-base" />
            </div>
            <div>
              <h1 className="text-white text-xl font-extrabold tracking-tight">Notifications</h1>
              <p className="text-gray-500 text-xs">Bans, deals, and platform events</p>
            </div>
            {unreadBellCount > 0 && (
              <span className="bg-xsm-yellow text-black text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                {unreadBellCount} new
              </span>
            )}
          </div>
          {unreadBellCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-xsm-yellow transition-colors border border-white/10 hover:border-xsm-yellow/40 px-3 py-1.5 rounded-lg"
            >
              <FaCheck className="text-[10px]" /> Mark all read
            </button>
          )}
        </div>
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, #111111, #0d0d0d)',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
          }}
        >
          {bellNotifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <FaBell className="text-5xl text-gray-700" />
              <p className="text-gray-400 text-base font-semibold">No notifications yet</p>
              <p className="text-gray-600 text-sm">Ban events and deal updates will appear here.</p>
            </div>
          ) : (
            bellNotifs.map((n, idx) => (
              <button
                key={n.id}
                onClick={() => {
                  markRead(n.id);
                  if (n.link) navigate(n.link);
                }}
                className={`flex items-start gap-4 w-full px-5 py-4 text-left transition-colors hover:bg-white/[0.04] ${
                  !n.isRead ? 'bg-xsm-yellow/[0.03]' : ''
                }`}
                style={idx < bellNotifs.length - 1 ? { borderBottom: '1px solid rgba(255,255,255,0.05)' } : {}}
              >
                <div className={`mt-0.5 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  n.type === 'ban' ? 'bg-red-500/20' :
                  n.type === 'unban' ? 'bg-emerald-500/20' :
                  !n.isRead ? 'bg-xsm-yellow/15' : 'bg-white/5'
                }`}>
                  {n.type === 'ban' ? (
                    <FaBan className="text-sm text-red-400" />
                  ) : n.type === 'unban' ? (
                    <FaCheckCircle className="text-sm text-emerald-400" />
                  ) : n.type === 'deal' ? (
                    <FaTag className={`text-sm ${!n.isRead ? 'text-xsm-yellow' : 'text-gray-500'}`} />
                  ) : (
                    <FaEnvelope className={`text-sm ${!n.isRead ? 'text-xsm-yellow' : 'text-gray-500'}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-bold truncate ${
                      n.type === 'ban' ? 'text-red-400' :
                      n.type === 'unban' ? 'text-emerald-400' :
                      !n.isRead ? 'text-xsm-yellow' : 'text-gray-300'
                    }`}>
                      {n.title}
                    </p>
                    {!n.isRead && (
                      <span className="w-2.5 h-2.5 bg-xsm-yellow rounded-full flex-shrink-0 shadow-[0_0_8px_#ffd000]" />
                    )}
                  </div>
                  <p className={`text-sm leading-snug mt-1 ${!n.isRead ? 'text-white font-medium' : 'text-gray-400'}`}>
                    {n.message}
                  </p>
                  <p className="text-[11px] text-gray-600 mt-1.5">
                    {new Date(n.createdAt).toLocaleString([], {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;
