import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User as UserIcon, Edit, Calendar, MessageCircle, Crown, Clock } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { useNotifications } from '@/context/NotificationContext';
import { getPublicProfile, API_URL, SellerMetrics } from '@/services/auth';
import UserAdList from '@/components/UserAdList';
import PublicAdList from '@/components/PublicAdList';
import SellerMetricsCard from '@/components/SellerMetricsCard';

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

interface PreviousListing {
  id: number;
  title: string;
  platform?: string;
  price: number;
  status?: string;
  createdAt?: string | null;
}

interface SellerActivity {
  totalListings: number;
  activeListings: number;
  previousListings: number;
  soldListings: number;
  lastListedAt?: string | null;
  previousItems: PreviousListing[];
}

const PublicProfile: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user: currentUser, isLoggedIn } = useAuth();
  const { showError, showSuccess } = useNotifications();

  const [profileUser, setProfileUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<SellerActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  const isOwnProfile = isLoggedIn && currentUser?.username === username;

  useEffect(() => {
    if (!username) {
      setError('Username not provided');
      setLoading(false);
      return;
    }

    if (isOwnProfile) {
      navigate(`/u/${username}/edit`, { replace: true });
      return;
    }

    fetchPublicProfile();
  }, [username, isOwnProfile, navigate]);

  const fetchPublicProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getPublicProfile(username!);

      if (data.success) {
        setProfileUser(data.data);
        fetchSellerActivity(data.data.id);
      } else {
        setError(data.message || 'Failed to load profile');
      }
    } catch (error) {
      console.error('Error fetching public profile:', error);

      if (error instanceof Error) {
        setError(error.message);

        if (error.message !== 'User not found') {
          showError('Failed to load profile');
        }
      } else {
        setError('Failed to load profile. Please try again.');
        showError('Failed to load profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchSellerActivity = async (sellerId: string) => {
    try {
      setActivityLoading(true);

      const response = await fetch(`${API_URL}/ads/user/${sellerId}/activity`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setActivity(data.data);
      } else {
        console.error('Failed to load seller activity:', data);
        setActivity(null);
      }
    } catch (error) {
      console.error('Error fetching seller activity:', error);
      setActivity(null);
    } finally {
      setActivityLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price || 0);
  };

  const formatStatus = (status?: string) => {
    if (!status) return 'Previous';

    const clean = status.toString().trim();

    if (clean === '1') return 'Active';

    return clean.charAt(0).toUpperCase() + clean.slice(1);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Recently joined';

    try {
      const joinDate = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - joinDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const diffWeeks = Math.floor(diffDays / 7);
      const diffMonths = Math.floor(diffDays / 30);
      const diffYears = Math.floor(diffDays / 365);

      if (diffDays < 1) return 'Today';
      if (diffDays === 1) return '1 day ago';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffWeeks === 1) return '1 week ago';
      if (diffWeeks < 4) return `${diffWeeks} weeks ago`;
      if (diffMonths === 1) return '1 month ago';
      if (diffMonths < 12) return `${diffMonths} months ago`;
      if (diffYears === 1) return '1 year ago';

      return `${diffYears} years ago`;
    } catch {
      return 'Unknown';
    }
  };

  const handleEditProfile = () => {
    navigate('/profile/edit');
  };

  const handleMessageSeller = async () => {
    if (!profileUser) return;

    if (!isLoggedIn || !currentUser) {
      showError('Please log in to message this seller');
      navigate('/login');
      return;
    }

    if (
      isOwnProfile ||
      String(currentUser.id) === String(profileUser.id) ||
      currentUser.username === profileUser.username
    ) {
      showError("You can't message yourself");
      return;
    }

    try {
      const token = localStorage.getItem('token');

      if (!token) {
        showError('Please log in to message this seller');
        navigate('/login');
        return;
      }

      const response = await fetch(`${API_URL}/chat/chats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          participantId: profileUser.id,
          type: 'direct'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to open chat');
      }

      const chat = await response.json();

      if (!chat?.id) {
        throw new Error('Chat opened but no chat ID was returned');
      }

      showSuccess(`Chat opened with ${profileUser.username}`);
      navigate(`/chat?chatId=${chat.id}`);
    } catch (error) {
      console.error('Error opening seller chat:', error);
      showError('Failed to open chat. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-xsm-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-xsm-yellow mx-auto mb-4"></div>
          <p className="text-xsm-light-gray">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profileUser) {
    return (
      <div className="min-h-screen bg-xsm-black text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-xsm-medium-gray rounded-full flex items-center justify-center mx-auto mb-4">
            <UserIcon className="w-8 h-8 text-xsm-light-gray" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Profile Not Found</h1>
          <p className="text-xsm-light-gray mb-6">
            {error || 'The user you\'re looking for doesn\'t exist.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="bg-xsm-yellow text-black px-6 py-2 rounded-lg hover:bg-yellow-500 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-xsm-black text-white py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-xsm-dark-gray rounded-xl p-6 shadow-lg border border-xsm-medium-gray/30">
              {/* Profile Picture */}
              <div className="relative w-32 h-32 mx-auto mb-4">
                <div className="w-full h-full rounded-full bg-xsm-yellow flex items-center justify-center overflow-hidden ring-4 ring-xsm-yellow/20">
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
                    <UserIcon className="w-16 h-16 text-black" />
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
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-white mb-1 flex items-center justify-center gap-1.5">
                  {profileUser.fullName || profileUser.username}
                  {profileUser.isVip && (
                    <Crown className="w-5 h-5 text-yellow-400 fill-yellow-400/20 animate-pulse" title="VIP Seller" />
                  )}
                </h1>

                <p className="text-xsm-light-gray text-sm mb-3">
                  @{profileUser.username}
                </p>

                <div className="flex justify-center gap-2 mb-3">
                  {profileUser.isVip && (
                    <span className="flex items-center gap-0.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-[10px] px-2 py-0.5 rounded-full font-black shadow shadow-yellow-900/40">
                      <Crown className="w-2.5 h-2.5" /> VIP Seller
                    </span>
                  )}
                  {profileUser.isEmailVerified && (
                    <div className="inline-flex items-center gap-1 bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs">
                      <div className="w-2.5 h-2.5 bg-green-400 rounded-full"></div>
                      Verified
                    </div>
                  )}
                </div>

                {/* Single Response Time Badge */}
                <div className="mb-4 inline-flex items-center gap-1.5 bg-xsm-yellow/10 border border-xsm-yellow/30 px-3 py-1.5 rounded-full text-xs font-semibold text-xsm-yellow">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{profileUser.sellerMetrics?.responseTime || 'Usually replies within 15 min'}</span>
                </div>

                {/* 🛡️ Seller Profile Card — 4 Metrics (Theme-aligned with Lucide Icons) */}
                <SellerMetricsCard metrics={profileUser.sellerMetrics} className="mt-4" />
              </div>

              {isOwnProfile && (
                <div className="mb-6">
                  <button
                    type="button"
                    onClick={handleEditProfile}
                    className="w-full bg-xsm-yellow text-black px-4 py-2 rounded-lg hover:bg-yellow-500 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Profile
                  </button>
                </div>
              )}

              {/* Profile Stats */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-xsm-light-gray">Member since</span>
                  <span className="text-white flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {formatDate(profileUser.createdAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xsm-light-gray">Active listings</span>
                  <span className="text-xsm-yellow font-bold">
                    {profileUser.adCount || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-xsm-medium-gray/20">
                  <span className="text-xsm-light-gray text-xs flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-xsm-yellow" /> Response time
                  </span>
                  <span className="text-xsm-yellow text-xs font-semibold bg-xsm-yellow/10 px-2.5 py-1 rounded-full border border-xsm-yellow/30">
                    {profileUser.averageResponseTime || 'Usually replies within a few hours'}
                  </span>
                </div>
              </div>

              {!isOwnProfile && (
                <div className="mb-6">
                  <button
                    type="button"
                    onClick={handleMessageSeller}
                    className="w-full bg-xsm-yellow text-black px-4 py-3 rounded-lg hover:bg-yellow-500 transition-colors font-semibold flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Message
                  </button>
                </div>
              )}

              {!isLoggedIn && (
                <div className="text-center">
                  <p className="text-xsm-light-gray text-sm mb-3">
                    Join XSM Market to connect with sellers
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/signup')}
                    className="w-full bg-xsm-medium-gray text-white px-4 py-2 rounded-lg hover:bg-xsm-yellow hover:text-black transition-colors font-medium"
                  >
                    Sign Up
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Profile Description */}
            {(profileUser.description || isOwnProfile) && (
              <div className="bg-xsm-dark-gray rounded-xl p-6 shadow-lg border border-xsm-medium-gray/30">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-xsm-yellow">About</h2>
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
                  <p className="text-xsm-light-gray leading-relaxed whitespace-pre-wrap">
                    {profileUser.description}
                  </p>
                ) : isOwnProfile ? (
                  <div className="text-center py-8">
                    <p className="text-xsm-light-gray mb-4">
                      Tell others about yourself...
                    </p>
                    <button
                      type="button"
                      onClick={handleEditProfile}
                      className="bg-xsm-yellow text-black px-4 py-2 rounded-lg hover:bg-yellow-500 transition-colors"
                    >
                      Add Description
                    </button>
                  </div>
                ) : (
                  <p className="text-xsm-light-gray italic">
                    This user hasn't added a description yet.
                  </p>
                )}
              </div>
            )}



            {/* User's Listings */}
            <div className="bg-xsm-dark-gray rounded-xl p-6 shadow-lg border border-xsm-medium-gray/30">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-xsm-yellow">
                  {isOwnProfile ? 'My Listings' : `${profileUser.username}'s Listings`}
                </h2>
                <span className="text-xsm-light-gray bg-xsm-medium-gray px-3 py-1 rounded-full text-sm">
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
        </div>
      </div>
    </div>
  );
};

export default PublicProfile;