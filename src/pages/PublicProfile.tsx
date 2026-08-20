import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User as UserIcon, Edit, Calendar, MessageCircle, Crown, Clock, DollarSign, CheckCircle2, ShieldCheck, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { useNotifications } from '@/context/NotificationContext';
import { getPublicProfile, API_URL, SellerMetrics, ReviewItem } from '@/services/auth';
import UserAdList from '@/components/UserAdList';
import PublicAdList from '@/components/PublicAdList';

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
}

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
  const { startConversation } = useNotifications();

  const [profileUser, setProfileUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

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
  }, [username]);

  const handleEditProfile = () => {
    navigate('/profile');
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
      <div className="min-h-screen bg-xsm-black pt-16 flex items-center justify-center">
        <div className="text-xsm-yellow text-xl">Loading profile...</div>
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

  return (
    <div className="min-h-screen bg-xsm-black text-white pt-6 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ── 3-COLUMN LAYOUT: Left Sidebar (3 cols) | Main Content (6 cols) | Right Sidebar (3 cols) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── LEFT SIDEBAR (3 Columns on Desktop) ── */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-xsm-dark-gray rounded-xl p-5 shadow-lg border border-xsm-medium-gray/30 text-center">
              
              {/* Profile Avatar */}
              <div className="relative w-28 h-28 mx-auto mb-4">
                <div className="w-full h-full rounded-full bg-xsm-yellow flex items-center justify-center overflow-hidden ring-4 ring-xsm-yellow/20 shadow-lg">
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
                    <UserIcon className="w-14 h-14 text-black" />
                  )}
                </div>

                {isOwnProfile && (
                  <button
                    type="button"
                    onClick={handleEditProfile}
                    className="absolute bottom-0 right-0 bg-xsm-yellow text-black p-2 rounded-full hover:bg-yellow-500 transition-colors shadow-lg"
                    title="Edit Profile"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* User Info */}
              <div className="mb-4">
                <h1 className="text-xl font-bold text-white mb-1 flex items-center justify-center gap-1.5">
                  {profileUser.fullName || profileUser.username}
                  {profileUser.isVip && (
                    <Crown className="w-5 h-5 text-yellow-400 fill-yellow-400/20 animate-pulse" title="VIP Seller" />
                  )}
                </h1>

                <p className="text-xsm-light-gray text-xs mb-3">
                  @{profileUser.username}
                </p>

                <div className="flex justify-center gap-2 mb-3">
                  {profileUser.isVip && (
                    <span className="flex items-center gap-0.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-[10px] px-2 py-0.5 rounded-full font-black shadow shadow-yellow-900/40">
                      <Crown className="w-2.5 h-2.5" /> VIP Seller
                    </span>
                  )}
                  {profileUser.isEmailVerified && (
                    <div className="inline-flex items-center gap-1 bg-green-500/20 text-green-400 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                      Verified
                    </div>
                  )}
                </div>

                {/* SINGLE Response Time Badge */}
                <div className="mb-4 inline-flex items-center gap-1.5 bg-xsm-yellow/10 border border-xsm-yellow/30 px-3 py-1.5 rounded-full text-xs font-semibold text-xsm-yellow">
                  <Clock className="w-3.5 h-3.5 text-xsm-yellow" />
                  <span>{profileUser.sellerMetrics?.responseTime || 'Usually replies in 10 minutes'}</span>
                </div>

                {/* 🛡️ Reputation Score Card */}
                <div className="w-full text-left bg-xsm-black/80 border border-xsm-medium-gray/40 rounded-xl p-3.5 mb-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-xsm-yellow/10 border border-xsm-yellow/20 text-xsm-yellow">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-white text-xs">Reputation Score</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-xsm-yellow text-sm">{(profileUser.sellerMetrics?.reputationScore ?? 0).toLocaleString()}</div>
                      <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                        +{(profileUser.sellerMetrics?.thisMonthPoints ?? 0).toLocaleString()} this month
                      </div>
                    </div>
                  </div>
                </div>

                {/* 🔁 Returning Partners Card */}
                <div className="w-full text-left bg-xsm-black/80 border border-xsm-medium-gray/40 rounded-xl p-3.5 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-xsm-yellow/10 border border-xsm-yellow/20 text-xsm-yellow">
                        <Users className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-white text-xs">Returning Partners</span>
                    </div>
                    <span className="font-bold text-white text-sm">{(profileUser.sellerMetrics?.returningPartners ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {isOwnProfile && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={handleEditProfile}
                    className="w-full bg-xsm-yellow text-black px-4 py-2 rounded-lg hover:bg-yellow-500 transition-colors font-medium flex items-center justify-center gap-2 text-xs"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Edit Profile
                  </button>
                </div>
              )}

              {/* Profile Stats */}
              <div className="space-y-2.5 pt-3 border-t border-xsm-medium-gray/20 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xsm-light-gray">Member since</span>
                  <span className="text-white font-medium flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-xsm-yellow" />
                    {formatDate(profileUser.createdAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xsm-light-gray">Active listings</span>
                  <span className="text-xsm-yellow font-bold">
                    {profileUser.adCount || 0}
                  </span>
                </div>
              </div>

              {!isOwnProfile && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleMessageSeller}
                    className="w-full bg-xsm-yellow text-black px-4 py-2.5 rounded-lg hover:bg-yellow-500 transition-colors font-bold text-xs flex items-center justify-center gap-2 shadow-lg"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Message Seller
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── MIDDLE MAIN CONTENT SECTION (6 Columns on Desktop) ── */}
          <div className="lg:col-span-6 space-y-6">
            {/* Profile Description */}
            {(profileUser.description || isOwnProfile) && (
              <div className="bg-xsm-dark-gray rounded-xl p-5 shadow-lg border border-xsm-medium-gray/30">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-xsm-yellow">About</h2>
                  {isOwnProfile && (
                    <button
                      type="button"
                      onClick={handleEditProfile}
                      className="text-xsm-light-gray hover:text-white transition-colors"
                      title="Edit Description"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {profileUser.description ? (
                  <p className="text-xsm-light-gray text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                    {profileUser.description}
                  </p>
                ) : isOwnProfile ? (
                  <div className="text-center py-6">
                    <p className="text-xsm-light-gray text-xs mb-3">
                      Tell others about yourself...
                    </p>
                    <button
                      type="button"
                      onClick={handleEditProfile}
                      className="bg-xsm-yellow text-black px-4 py-1.5 rounded-lg hover:bg-yellow-500 transition-colors text-xs font-semibold"
                    >
                      Add Description
                    </button>
                  </div>
                ) : (
                  <p className="text-xsm-light-gray text-xs italic">
                    This user hasn't added a description yet.
                  </p>
                )}
              </div>
            )}

            {/* Seller's Listings */}
            <div className="bg-xsm-dark-gray rounded-xl p-5 shadow-lg border border-xsm-medium-gray/30">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-xsm-yellow">
                  {isOwnProfile ? 'My Listings' : `${profileUser.username}'s Listings`}
                </h2>
                <span className="text-xsm-light-gray bg-xsm-medium-gray px-2.5 py-0.5 rounded-full text-xs font-semibold">
                  {profileUser.adCount || 0}
                </span>
              </div>

              {isOwnProfile ? (
                <UserAdList />
              ) : (
                <PublicAdList
                  userId={profileUser.id}
                  username={profileUser.username}
                />
              )}
            </div>
          </div>

          {/* ── RIGHT SIDEBAR (3 Columns on Desktop): Trading Volume & Completed Deals with Reviews Dropdown ── */}
          <div className="lg:col-span-3 space-y-6">

            {/* 💵 Trading Volume Card */}
            <div className="bg-xsm-dark-gray border border-xsm-yellow/40 rounded-xl p-4 shadow-xl text-left relative overflow-hidden bg-gradient-to-br from-xsm-dark-gray via-xsm-black/90 to-xsm-dark-gray">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-xsm-yellow/20 border border-xsm-yellow/40 text-xsm-yellow flex-shrink-0">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-xsm-light-gray">Trading Volume</h3>
                  <p className="text-xl font-black text-xsm-yellow">
                    ${(profileUser.sellerMetrics?.tradingVolume ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-gray-400">Total value of completed transactions</p>
            </div>

            {/* 🤝 Completed Deals & Ratings Card */}
            <div className="bg-xsm-dark-gray border border-xsm-medium-gray/40 rounded-xl p-4 shadow-xl text-left space-y-3.5">
              <div className="flex items-center justify-between pb-2.5 border-b border-xsm-medium-gray/30">
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

              {/* Rating Breakdown Badges */}
              <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-1.5">
                  <div className="font-bold text-emerald-400">{profileUser.sellerMetrics?.positiveReviews ?? 0}</div>
                  <div className="text-[9px] text-emerald-300">Positive</div>
                </div>
                <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-1.5">
                  <div className="font-bold text-gray-300">{profileUser.sellerMetrics?.noReviews ?? 0}</div>
                  <div className="text-[9px] text-gray-400">No Review</div>
                </div>
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-1.5">
                  <div className="font-bold text-rose-400">{profileUser.sellerMetrics?.negativeReviews ?? 0}</div>
                  <div className="text-[9px] text-rose-300">Negative</div>
                </div>
              </div>

              {/* 💬 Completed Deals & Reviews Dropdown List */}
              <ReviewsDropdownList reviews={profileUser.sellerMetrics?.recentReviews} />
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default PublicProfile;