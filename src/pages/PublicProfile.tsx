import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User as UserIcon, Edit, Calendar, MessageCircle, Crown, Clock, DollarSign, CheckCircle2, ShieldCheck, Users, ChevronDown, ChevronUp, X, Check, Camera, Upload, Lock } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { useNotifications } from '@/context/NotificationContext';
import { getPublicProfile, updateProfile, API_URL, SellerMetrics, ReviewItem } from '@/services/auth';
import UserAdList from '@/components/UserAdList';
import PublicAdList from '@/components/PublicAdList';

const DEFAULT_DESCRIPTION = "Welcome to my marketplace profile! I specialize in buying and selling verified social media accounts, YouTube channels, and digital assets with safe and secure escrow transactions.";

interface PublicUser {
  id: string;
  username: string;
  fullName?: string;
  profilePicture?: string;
  description?: string;
  createdAt: string;
  adCount?: number;
  isEmailVerified?: boolean;
  isVip?: boolean;
  vipUntil?: string | null;
  averageResponseTime?: string;
  sellerMetrics?: SellerMetrics;
  lastSeenAt?: string | null;
  isOnline?: boolean;
}

// Format response time label to ensure "Usually replies in __ mins" is communicated clearly and completely
const formatResponseTimeLabel = (rawResponseTime?: string) => {
  if (!rawResponseTime) return 'Usually replies in 15 mins';
  
  // Clean emojis, unicode replacement characters, or leading non-alphanumeric chars
  const clean = rawResponseTime
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\uFFFD]/gu, '')
    .replace(/^[^a-zA-Z0-9]+/, '')
    .trim();
  
  if (!clean) return 'Usually replies in 15 mins';

  // If format is like "Under 15 min" or "Under 5 min" -> "Usually replies in 15 mins"
  const underMinMatch = clean.match(/under\s+(\d+)\s*min/i);
  if (underMinMatch) {
    return `Usually replies in ${underMinMatch[1]} mins`;
  }

  // If format is "15 minutes" or "15 min"
  const minMatch = clean.match(/(\d+)\s*min/i);
  if (minMatch && !/hour|day/i.test(clean)) {
    return `Usually replies in ${minMatch[1]} mins`;
  }

  // If "Under 1 hour" or "Within 1 hour"
  if (/1\s*hour/i.test(clean)) {
    return 'Usually replies in 1 hour';
  }

  // If "Within a few hours" or "few hours"
  if (/few\s*hours/i.test(clean)) {
    return 'Usually replies in few hours';
  }

  // If "1+ day" or "1+ Day"
  if (/1\+\s*day/i.test(clean)) {
    return 'Usually replies within 1+ day';
  }

  // If already starts with "usually replies in"
  if (/^usually\s+replies\s+in\s+/i.test(clean)) {
    return clean.replace(/minutes/i, 'mins');
  }

  // If starts with "usually replies within"
  if (/^usually\s+replies\s+within\s+/i.test(clean)) {
    return clean;
  }

  // If starts with "usually"
  if (/^usually\s+/i.test(clean)) {
    return clean.replace(/^usually\s+/i, 'Usually replies in ');
  }

  return `Usually replies in ${clean}`;
};

// Calculate online/offline and dynamic last seen status
const getOnlineStatusDisplay = (lastSeenAt?: string | null, isOnlineFlag?: boolean, isOwn?: boolean) => {
  if (isOwn) {
    return {
      isOnline: true,
      badgeText: 'Online',
      detailText: 'Active Now',
    };
  }

  if (isOnlineFlag) {
    return {
      isOnline: true,
      badgeText: 'Online',
      detailText: 'Active Now',
    };
  }

  if (!lastSeenAt) {
    return {
      isOnline: false,
      badgeText: 'Offline',
      detailText: 'Offline',
    };
  }

  let lastSeen: Date;
  if (lastSeenAt.includes('T') || lastSeenAt.includes('Z')) {
    lastSeen = new Date(lastSeenAt);
  } else {
    lastSeen = new Date(lastSeenAt.replace(' ', 'T') + 'Z');
    if (isNaN(lastSeen.getTime())) {
      lastSeen = new Date(lastSeenAt);
    }
  }

  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));

  if (diffInMinutes >= 0 && diffInMinutes < 5) {
    return {
      isOnline: true,
      badgeText: 'Online',
      detailText: 'Active Now',
    };
  }

  let text = 'Offline';
  if (diffInMinutes <= 1 || isNaN(diffInMinutes)) {
    text = 'Last seen 1 minute ago';
  } else if (diffInMinutes < 60) {
    text = `Last seen ${diffInMinutes} minutes ago`;
  } else if (diffInMinutes < 1440) {
    const hours = Math.floor(diffInMinutes / 60);
    text = `Last seen ${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(diffInMinutes / 1440);
    text = `Last seen ${days} day${days > 1 ? 's' : ''} ago`;
  }

  return {
    isOnline: false,
    badgeText: 'Offline',
    detailText: text,
  };
};

// Helper sub-component for Reviews Dropdown in Right Sidebar
const ReviewsDropdownList: React.FC<{ reviews?: ReviewItem[] }> = ({ reviews = [] }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="pt-2 border-t border-xsm-medium-gray/30">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-2 text-xs font-bold text-xsm-yellow hover:text-yellow-400 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <MessageCircle className="w-3.5 h-3.5 text-xsm-yellow" />
          Completed Deals & Reviews ({reviews.length})
        </span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-xsm-yellow" /> : <ChevronDown className="w-4 h-4 text-xsm-yellow" />}
      </button>

      {isOpen && (
        <div className="mt-2 space-y-2 max-h-64 overflow-y-auto pr-1">
          {reviews.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-3 text-center bg-xsm-black/40 rounded-lg border border-xsm-medium-gray/20">
              No public reviews recorded yet.
            </p>
          ) : (
            reviews.map((rev, idx) => (
              <div key={rev.id || idx} className="bg-xsm-black/80 border border-xsm-medium-gray/30 rounded-xl p-3 text-xs space-y-1.5 shadow">
                <div className="flex items-center justify-between">
                  <span className={`font-bold flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${
                    rev.rating === 'positive'
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                      : rev.rating === 'negative'
                      ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                      : 'text-gray-300 bg-gray-500/10 border-gray-500/20'
                  }`}>
                    {rev.rating === 'positive' ? '👍 Positive' : rev.rating === 'negative' ? '👎 Negative' : '⚪ Completed'}
                  </span>
                  <span className="text-gray-400 text-[10px]">{rev.date}</span>
                </div>
                {rev.comment && <p className="text-gray-200 text-[11px] leading-snug font-medium italic">"{rev.comment}"</p>}
                <div className="text-[10px] text-xsm-yellow font-bold">${rev.price} transaction</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const PublicProfile: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user: currentUser, isLoggedIn } = useAuth();
  const { startConversation, showSuccess, showError } = useNotifications();

  const [profileUser, setProfileUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Response Time Info Modal State
  const [showResponseInfoModal, setShowResponseInfoModal] = useState(false);
  const [, setTick] = useState(0);

  // Edit Profile / Description Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editProfilePicture, setEditProfilePicture] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Timer to dynamically update relative last seen times every 30s
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) return;
      try {
        setLoading(true);
        const res = await getPublicProfile(username);
        const userData = res?.data ? res.data : res;
        setProfileUser(userData);
      } catch (err) {
        console.error('Error fetching public profile:', err);
        setProfileUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    // Background polling every 45 seconds to keep online/last seen status accurate
    const pollInterval = setInterval(async () => {
      try {
        const res = await getPublicProfile(username);
        const userData = res?.data ? res.data : res;
        if (userData) {
          setProfileUser(prev => prev ? { ...prev, ...userData } : userData);
        }
      } catch {
        // ignore background poll errors
      }
    }, 45000);

    return () => clearInterval(pollInterval);
  }, [username]);

  const handleOpenEditModal = () => {
    if (!profileUser) return;
    setEditFullName(profileUser.fullName || '');
    setEditDescription(profileUser.description || DEFAULT_DESCRIPTION);
    setEditProfilePicture(profileUser.profilePicture || '');
    setShowEditModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const updated = await updateProfile({
        fullName: editFullName,
        description: editDescription,
        profilePicture: editProfilePicture,
      });

      setProfileUser(prev => prev ? {
        ...prev,
        fullName: updated.fullName || editFullName,
        description: updated.description || editDescription,
        profilePicture: updated.profilePicture || editProfilePicture,
      } : null);

      showSuccess('Profile updated successfully!');
      setShowEditModal(false);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      showError(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleMessageSeller = async () => {
    if (!profileUser) return;
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }
    try {
      await startConversation(profileUser.id);
      navigate(`/chat?user=${profileUser.username}`);
    } catch (err) {
      console.error('Failed to start conversation:', err);
      navigate('/chat');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Recently';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Recently';
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
      });
    } catch (e) {
      return 'Recently';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-xsm-black text-white pt-6 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-pulse">
            
            {/* Left Sidebar Skeleton */}
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-xsm-dark-gray rounded-xl p-5 border border-xsm-medium-gray/30 text-center space-y-4">
                <div className="w-28 h-28 rounded-full bg-xsm-medium-gray/40 mx-auto ring-4 ring-xsm-medium-gray/20" />
                <div className="space-y-2">
                  <div className="h-5 bg-xsm-medium-gray/40 rounded w-3/4 mx-auto" />
                  <div className="h-3 bg-xsm-medium-gray/30 rounded w-1/2 mx-auto" />
                </div>
                <div className="h-6 bg-xsm-medium-gray/30 rounded-full w-4/5 mx-auto" />

                {/* Reputation score skeleton */}
                <div className="w-full bg-xsm-black/80 border border-xsm-medium-gray/40 rounded-xl py-2 px-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-xsm-medium-gray/40" />
                    <div className="h-3 bg-xsm-medium-gray/40 rounded w-20" />
                  </div>
                  <div className="h-3.5 bg-xsm-medium-gray/40 rounded w-8" />
                </div>

                {/* Returning partners skeleton */}
                <div className="w-full bg-xsm-black/80 border border-xsm-medium-gray/40 rounded-xl py-2 px-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-xsm-medium-gray/40" />
                    <div className="h-3 bg-xsm-medium-gray/40 rounded w-24" />
                  </div>
                  <div className="h-3.5 bg-xsm-medium-gray/40 rounded w-6" />
                </div>

                <div className="h-8 bg-xsm-medium-gray/40 rounded-lg w-full" />

                <div className="pt-3 border-t border-xsm-medium-gray/20 flex items-center justify-between">
                  <div className="h-3 bg-xsm-medium-gray/30 rounded w-20" />
                  <div className="h-3 bg-xsm-medium-gray/40 rounded w-24" />
                </div>
              </div>
            </div>

            {/* Middle Main Content Skeleton */}
            <div className="lg:col-span-6 space-y-6">
              {/* About card */}
              <div className="bg-xsm-dark-gray rounded-xl p-5 border border-xsm-medium-gray/30 space-y-3">
                <div className="h-5 bg-xsm-medium-gray/40 rounded w-20" />
                <div className="h-3 bg-xsm-medium-gray/30 rounded w-full" />
                <div className="h-3 bg-xsm-medium-gray/30 rounded w-5/6" />
                <div className="h-3 bg-xsm-medium-gray/30 rounded w-4/6" />
              </div>

              {/* Listings card */}
              <div className="bg-xsm-dark-gray rounded-xl p-5 border border-xsm-medium-gray/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-5 bg-xsm-medium-gray/40 rounded w-28" />
                  <div className="h-5 bg-xsm-medium-gray/30 rounded-full w-8" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-xsm-black/80 border border-xsm-medium-gray/30 rounded-none p-2.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-none bg-xsm-medium-gray/40 flex-shrink-0" />
                        <div className="flex-1 space-y-1">
                          <div className="h-3 bg-xsm-medium-gray/40 rounded-none w-4/5" />
                          <div className="h-2.5 bg-xsm-medium-gray/30 rounded-none w-1/2" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1.5 border-t border-xsm-medium-gray/20">
                        <div className="h-3.5 bg-xsm-medium-gray/40 rounded-none w-14" />
                        <div className="h-3.5 bg-xsm-medium-gray/30 rounded-none w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Sidebar Skeleton */}
            <div className="lg:col-span-3 space-y-6">
              {/* Trading volume card */}
              <div className="bg-xsm-dark-gray border border-xsm-medium-gray/30 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-xsm-medium-gray/40 flex-shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-2.5 bg-xsm-medium-gray/30 rounded w-20" />
                    <div className="h-5 bg-xsm-medium-gray/40 rounded w-16" />
                  </div>
                </div>
                <div className="h-2.5 bg-xsm-medium-gray/20 rounded w-3/4" />
              </div>

              {/* Completed deals card */}
              <div className="bg-xsm-dark-gray border border-xsm-medium-gray/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-xsm-medium-gray/20">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-xsm-medium-gray/40" />
                    <div className="h-3.5 bg-xsm-medium-gray/40 rounded w-24" />
                  </div>
                  <div className="h-5 bg-xsm-medium-gray/40 rounded w-6" />
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="h-10 bg-xsm-medium-gray/20 rounded-lg" />
                  <div className="h-10 bg-xsm-medium-gray/20 rounded-lg" />
                  <div className="h-10 bg-xsm-medium-gray/20 rounded-lg" />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="min-h-screen bg-xsm-black pt-16 flex flex-col items-center justify-center">
        <div className="text-white text-2xl font-bold mb-4">User Not Found</div>
        <p className="text-xsm-light-gray mb-6">
          The user @{username} doesn't exist or has been removed.
        </p>
        <button
          onClick={() => navigate('/')}
          className="bg-xsm-yellow text-black px-6 py-2 rounded-lg hover:bg-yellow-500 transition-colors font-medium"
        >
          Back to Marketplace
        </button>
      </div>
    );
  }

  const isOwnProfile = isLoggedIn && !!currentUser && currentUser.username?.toLowerCase() === profileUser.username?.toLowerCase();
  const onlineStatusInfo = getOnlineStatusDisplay(profileUser.lastSeenAt, profileUser.isOnline, isOwnProfile);

  return (
    <div className="min-h-screen bg-xsm-black text-white pt-6 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ── 3-COLUMN LAYOUT: Left Sidebar (3 cols) | Main Content (6 cols) | Right Sidebar (3 cols) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── LEFT SIDEBAR (3 Columns on Desktop) ── */}
          <div className="lg:col-span-3">
            <div className="bg-xsm-dark-gray rounded-xl p-3.5 shadow-lg border border-xsm-medium-gray/30 space-y-2.5">
              
              {/* ── Compact Profile Picture + Status Row (Left: Response Time | Center: Avatar | Right: Online/Offline) ── */}
              <div className="bg-xsm-black/50 border border-xsm-medium-gray/30 rounded-xl p-2 flex items-center justify-between gap-1.5 shadow-inner">
                
                {/* Left: Response Time Box (Clickable) */}
                <button
                  type="button"
                  onClick={() => setShowResponseInfoModal(true)}
                  className="flex-1 min-w-0 min-h-[74px] h-[74px] flex flex-col items-center justify-center p-1.5 rounded-lg bg-xsm-dark-gray/90 border border-xsm-yellow/30 hover:border-xsm-yellow hover:bg-xsm-black/80 transition-all text-center group cursor-pointer shadow-sm"
                  title="Click to view seller response time info"
                >
                  <Clock className="w-3.5 h-3.5 text-xsm-yellow mb-1 flex-shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="text-[9.5px] font-semibold text-xsm-yellow leading-[1.25] px-0.5 break-words">
                    {formatResponseTimeLabel(profileUser.sellerMetrics?.responseTime || profileUser.averageResponseTime)}
                  </span>
                </button>

                {/* Center: Profile Picture + Online Green Ring/Dot */}
                <div className="relative flex-shrink-0 flex items-center justify-center">
                  <div className={`w-[74px] h-[74px] rounded-full overflow-hidden flex items-center justify-center transition-all ${
                    onlineStatusInfo.isOnline
                      ? 'ring-3 ring-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.45)]'
                      : 'ring-2 ring-xsm-medium-gray/40 shadow'
                  }`}>
                    {profileUser.profilePicture ? (
                      <img
                        src={profileUser.profilePicture}
                        alt={`${profileUser.username}'s profile`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-xsm-yellow flex items-center justify-center">
                        <UserIcon className="w-9 h-9 text-black" />
                      </div>
                    )}
                  </div>

                  {/* Online Status Dot */}
                  {onlineStatusInfo.isOnline && (
                    <span
                      className="absolute top-0 right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-xsm-dark-gray rounded-full shadow-sm"
                      title="Currently Online"
                    />
                  )}

                  {/* Edit Profile Picture Button (Own Profile) */}
                  {isOwnProfile && (
                    <button
                      type="button"
                      onClick={handleOpenEditModal}
                      className="absolute -bottom-1 -right-1 bg-xsm-yellow text-black p-1.5 rounded-full hover:bg-yellow-400 transition-colors shadow-lg border border-black/40"
                      title="Upload Profile Picture"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Right: Online / Offline Status Box */}
                <div className={`flex-1 min-w-0 min-h-[74px] h-[74px] flex flex-col items-center justify-center p-1.5 rounded-lg border text-center transition-all shadow-sm ${
                  onlineStatusInfo.isOnline
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                    : 'bg-xsm-dark-gray/90 border-xsm-medium-gray/30 text-gray-300'
                }`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      onlineStatusInfo.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
                    }`} />
                    <span className={`text-[10px] font-bold ${
                      onlineStatusInfo.isOnline ? 'text-emerald-400' : 'text-gray-400'
                    }`}>
                      {onlineStatusInfo.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <span className={`text-[9.5px] font-medium leading-[1.25] px-0.5 break-words ${
                    onlineStatusInfo.isOnline ? 'text-emerald-300' : 'text-gray-400'
                  }`}>
                    {onlineStatusInfo.isOnline ? 'Active Now' : onlineStatusInfo.detailText}
                  </span>
                </div>

              </div>

              {/* User Info (Username, Crown, VIP badge) */}
              <div className="text-center pt-0.5">
                <h1 className="text-lg font-bold text-white flex items-center justify-center gap-1.5 leading-snug">
                  {profileUser.fullName || profileUser.username}
                  {profileUser.isVip && (
                    <Crown className="w-4 h-4 text-yellow-400 fill-yellow-400/20 animate-pulse" title="VIP Seller" />
                  )}
                </h1>

                <p className="text-xsm-light-gray text-xs font-mono">
                  @{profileUser.username}
                </p>

                {profileUser.isVip && (
                  <div className="flex justify-center mt-1">
                    <span className="inline-flex items-center gap-1 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-[10px] px-2 py-0.5 rounded-full font-black shadow-sm">
                      <Crown className="w-2.5 h-2.5" /> VIP Seller
                    </span>
                  </div>
                )}
              </div>

              {/* 🛡️ Reputation Score Card (Compact height) */}
              <div className="w-full text-left bg-xsm-black/80 border border-xsm-medium-gray/40 rounded-xl py-2 px-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-md bg-xsm-yellow/10 border border-xsm-yellow/20 text-xsm-yellow">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-semibold text-white text-xs">Reputation Score</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-xsm-yellow text-xs leading-tight">{(profileUser.sellerMetrics?.reputationScore ?? 0).toLocaleString()}</div>
                    <div className="text-[9px] text-emerald-400 font-semibold leading-none">
                      +{(profileUser.sellerMetrics?.thisMonthPoints ?? 0).toLocaleString()} this month
                    </div>
                  </div>
                </div>
              </div>

              {/* 🔁 Returning Partners Card (Compact height) */}
              <div className="w-full text-left bg-xsm-black/80 border border-xsm-medium-gray/40 rounded-xl py-2 px-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-md bg-xsm-yellow/10 border border-xsm-yellow/20 text-xsm-yellow">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-semibold text-white text-xs">Returning Partners</span>
                  </div>
                  <span className="font-bold text-white text-xs">{(profileUser.sellerMetrics?.returningPartners ?? 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Action Button: Edit Profile or Message Seller */}
              {isOwnProfile ? (
                <div>
                  <button
                    type="button"
                    onClick={handleOpenEditModal}
                    className="w-full bg-xsm-yellow text-black px-4 py-2 rounded-lg hover:bg-yellow-500 transition-colors font-bold flex items-center justify-center gap-2 text-xs shadow-md"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Edit Profile
                  </button>
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={handleMessageSeller}
                    className="w-full bg-xsm-yellow text-black px-4 py-2 rounded-lg hover:bg-yellow-500 transition-colors font-bold text-xs flex items-center justify-center gap-2 shadow-md"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Message Seller
                  </button>
                </div>
              )}

              {/* Profile Stats */}
              <div className="pt-2 border-t border-xsm-medium-gray/20 text-xs flex items-center justify-between">
                <span className="text-xsm-light-gray">Member since</span>
                <span className="text-white font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-xsm-yellow" />
                  {formatDate(profileUser.createdAt)}
                </span>
              </div>

            </div>
          </div>

          {/* ── MAIN CONTENT AREA (9 Columns on Desktop) ── */}
          <div className="lg:col-span-9 space-y-4">
            
            {/* Top Row: About Section (left) + Combined Deals & Volume Card (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              
              {/* Profile Description (About Section) */}
              <div className="lg:col-span-7 bg-xsm-dark-gray rounded-xl pt-3 pb-3.5 px-4 sm:px-5 shadow-lg border border-xsm-medium-gray/30 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-base sm:text-lg font-bold text-xsm-yellow">About</h2>
                  {isOwnProfile && (
                    <button
                      type="button"
                      onClick={handleOpenEditModal}
                      className="text-xsm-light-gray hover:text-xsm-yellow transition-colors flex items-center gap-1 text-xs font-semibold"
                      title="Edit Description"
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                </div>

                {/* Fixed height container for ~5 lines with internal vertical scrollbar if longer */}
                <div className="h-[105px] overflow-y-auto pr-1.5 custom-scrollbar flex-1">
                  <p className="text-xsm-light-gray text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                    {profileUser.description || DEFAULT_DESCRIPTION}
                  </p>
                </div>
              </div>

              {/* Combined Completed Deals & Trading Volume Card */}
              <div className="lg:col-span-5 bg-xsm-dark-gray border border-xsm-medium-gray/40 rounded-xl pt-3 pb-3 px-4 shadow-xl text-left flex flex-col justify-between space-y-2">
                
                {/* 1. Completed Deals Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-xs">Completed Deals</h3>
                      <p className="text-[10px] text-gray-400">Successful sales</p>
                    </div>
                  </div>
                  <span className="text-lg font-black text-white">
                    {(profileUser.sellerMetrics?.completedDeals ?? 0).toLocaleString()}
                  </span>
                </div>

                {/* 2. Separator */}
                <div className="border-t border-xsm-medium-gray/30 my-0.5" />

                {/* 3. Trading Volume Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-xsm-yellow/20 border border-xsm-yellow/40 text-xsm-yellow flex-shrink-0">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-xs">Trading Volume</h3>
                      <p className="text-[10px] text-gray-400">Total Value of Completed Transactions</p>
                    </div>
                  </div>
                  <span className="text-lg font-black text-xsm-yellow">
                    ${(profileUser.sellerMetrics?.tradingVolume ?? 0).toLocaleString()}
                  </span>
                </div>

                {/* 4. Completed Deals & Transactions Information (Badges + Reviews Dropdown) */}
                <div className="pt-2 border-t border-xsm-medium-gray/30 space-y-1.5">
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg py-1.5 px-0.5 min-w-0">
                      <div className="font-black text-emerald-400 text-sm leading-none tabular-nums">
                        {(profileUser.sellerMetrics?.positiveReviews ?? 0) >= 1000
                          ? `${((profileUser.sellerMetrics?.positiveReviews ?? 0) / 1000).toFixed(1)}k`
                          : (profileUser.sellerMetrics?.positiveReviews ?? 0)}
                      </div>
                      <div className="text-[9px] text-emerald-400/80 mt-0.5 font-medium tracking-wide">Positive</div>
                    </div>
                    <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg py-1.5 px-0.5 min-w-0">
                      <div className="font-black text-gray-300 text-sm leading-none tabular-nums">
                        {(profileUser.sellerMetrics?.noReviews ?? 0) >= 1000
                          ? `${((profileUser.sellerMetrics?.noReviews ?? 0) / 1000).toFixed(1)}k`
                          : (profileUser.sellerMetrics?.noReviews ?? 0)}
                      </div>
                      <div className="text-[9px] text-gray-400/80 mt-0.5 font-medium tracking-wide">No Review</div>
                    </div>
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg py-1.5 px-0.5 min-w-0">
                      <div className="font-black text-rose-400 text-sm leading-none tabular-nums">
                        {(profileUser.sellerMetrics?.negativeReviews ?? 0) >= 1000
                          ? `${((profileUser.sellerMetrics?.negativeReviews ?? 0) / 1000).toFixed(1)}k`
                          : (profileUser.sellerMetrics?.negativeReviews ?? 0)}
                      </div>
                      <div className="text-[9px] text-rose-400/80 mt-0.5 font-medium tracking-wide">Negative</div>
                    </div>
                  </div>
                  <ReviewsDropdownList reviews={profileUser.sellerMetrics?.recentReviews} />
                </div>
              </div>

            </div>

            {/* Seller's Listings (Spans full width for channels) */}
            <div className="bg-xsm-dark-gray rounded-xl p-4 shadow-lg border border-xsm-medium-gray/30">
              {isOwnProfile ? (
                <UserAdList />
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-xsm-yellow">
                      {`${profileUser.username}'s Listings`}
                    </h2>
                    <span className="text-xsm-light-gray bg-xsm-medium-gray px-2.5 py-0.5 rounded-full text-xs font-semibold">
                      {profileUser.adCount || 0}
                    </span>
                  </div>
                  <PublicAdList
                    userId={profileUser.id}
                    username={profileUser.username}
                  />
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── EDIT PROFILE & DESCRIPTION MODAL ── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-xsm-dark-gray border border-xsm-yellow/40 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-xsm-medium-gray/30 pb-3">
              <h3 className="text-lg font-bold text-xsm-yellow flex items-center gap-2">
                <Edit className="w-5 h-5" /> Edit Profile & Description
              </h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Profile Picture Image Upload */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Profile Picture</label>
                <div className="flex items-center gap-4 bg-xsm-black/60 p-3 rounded-xl border border-xsm-medium-gray/30">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-xsm-yellow flex items-center justify-center flex-shrink-0 ring-2 ring-xsm-yellow/30 shadow">
                    {editProfilePicture ? (
                      <img src={editProfilePicture} alt="Avatar Preview" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-8 h-8 text-black" />
                    )}
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      id="avatar-file-upload"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            showError('Image size should be under 5MB');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            setEditProfilePicture(evt.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <label
                      htmlFor="avatar-file-upload"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-xsm-yellow text-black text-xs font-bold rounded-lg cursor-pointer hover:bg-yellow-400 transition-colors shadow-sm"
                    >
                      <Upload className="w-3.5 h-3.5" /> Upload Image File
                    </label>
                    <p className="text-[10px] text-gray-400">PNG, JPG, WEBP up to 5MB</p>
                  </div>
                </div>
              </div>

              {/* Username (Locked / Cannot be changed) */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1 flex items-center justify-between">
                  <span>Username</span>
                  <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Permanent
                  </span>
                </label>
                <input
                  type="text"
                  value={`@${profileUser.username}`}
                  disabled
                  className="xsm-input w-full text-xs opacity-60 cursor-not-allowed bg-xsm-black/60 font-semibold text-xsm-yellow"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Full Name / Display Name</label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="xsm-input w-full text-xs"
                  placeholder="Enter your full name or display title"
                />
              </div>

              {/* About Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">About / Bio Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="xsm-input w-full text-xs min-h-[120px] resize-y"
                  placeholder="Describe your background, specialty, and channel portfolio..."
                  rows={4}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-xsm-medium-gray/30">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-300 bg-xsm-black hover:bg-xsm-medium-gray/50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2 text-xs font-bold text-black bg-xsm-yellow hover:bg-yellow-400 rounded-lg transition-colors flex items-center gap-1.5 shadow"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── SELLER RESPONSE TIME INFO MODAL ── */}
      {showResponseInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-xsm-dark-gray border border-xsm-yellow/40 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-xsm-medium-gray/30 pb-3">
              <h3 className="text-sm font-bold text-xsm-yellow flex items-center gap-2">
                <Clock className="w-4 h-4 text-xsm-yellow" /> Typical Response Time
              </h3>
              <button
                type="button"
                onClick={() => setShowResponseInfoModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-xsm-black/60 p-3.5 rounded-xl border border-xsm-medium-gray/30 space-y-2 text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-xsm-yellow/10 border border-xsm-yellow/30 rounded-full text-xs font-bold text-xsm-yellow">
                <Clock className="w-3.5 h-3.5" />
                {formatResponseTimeLabel(profileUser.sellerMetrics?.responseTime || profileUser.averageResponseTime)}
              </span>
              <p className="text-xs text-gray-300 leading-relaxed pt-1">
                This seller typically replies within this timeframe based on recent marketplace conversation activity.
              </p>
              <p className="text-[11px] text-gray-400">
                Faster response times lead to faster deal completion and seamless escrow transactions.
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowResponseInfoModal(false)}
                className="w-full px-4 py-2 text-xs font-bold text-black bg-xsm-yellow hover:bg-yellow-400 rounded-lg transition-colors shadow"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicProfile;