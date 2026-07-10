import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserAds, getUserAdsAlternative, deleteAd, togglePinAd, pullUpAd } from '../services/ads';
import { useAuth } from '../context/useAuth';
import { useNotifications } from '../context/NotificationContext';
import { Star, Eye, Trash2, Edit, AlertCircle, TrendingUp, Pin, DollarSign, CheckCircle, XCircle, Clock } from 'lucide-react';
import EditListingModal from './EditListingModal';
import { encodeId } from '@/utils/idEncoder';
import { getImageUrl } from '@/config/api';

// Custom scrollbar styles to match the main page
const scrollbarStyles = `
  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #ffd000 #1A1A1A;
  }
  
  .custom-scrollbar::-webkit-scrollbar {
    width: 10px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #1A1A1A;
    border-radius: 6px;
    border: 1px solid #333333;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #ffd000 0%, #ffaa00 100%);
    border-radius: 6px;
    border: 2px solid #1A1A1A;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #ffdd33 0%, #ffbb33 100%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:active {
    background: linear-gradient(180deg, #e6b800 0%, #cc9900 100%);
  }
`;

interface UserAd {
  id: number;
  title: string;
  platform: string;
  category: string;
  price: number;
  subscribers: number;
  monthlyIncome: number;
  isMonetized: boolean;
  status: 'active' | 'pending' | 'sold' | 'suspended' | 'rejected';
  views: number;
  createdAt: string;
  updatedAt: string;
  channelUrl: string;
  description: string;
  contentType?: string;
  contentCategory?: string;
  incomeDetails: string;
  promotionDetails: string;
  thumbnail?: string;
  screenshots?: any[];
  tags?: string[];
  pinned?: boolean;
  pinnedAt?: string;
  lastPulledAt?: string;
  seller?: {
    id: number;
    username: string;
    profilePicture?: string;
  };
}

interface UserAdListProps {
  onEditAd?: (ad: UserAd) => void;
}

const UserAdList: React.FC<UserAdListProps> = ({ onEditAd }) => {
  const [ads, setAds] = useState<UserAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingAd, setEditingAd] = useState<UserAd | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [pullCooldowns, setPullCooldowns] = useState<Record<number, {
    canPull: boolean;
    remainingTime?: {
      days: number;
      hours: number;
      minutes: number;
      seconds: number;
    };
  }>>({});
  const [showPullModal, setShowPullModal] = useState(false);
  const [selectedAdForPull, setSelectedAdForPull] = useState<UserAd | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedAdForPin, setSelectedAdForPin] = useState<UserAd | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAdForDelete, setSelectedAdForDelete] = useState<UserAd | null>(null);
  const { user } = useAuth();
  const { showSuccess, showError, showInfo } = useNotifications();
  const navigate = useNavigate();

  const handleViewAd = (ad: UserAd) => {
    const encodedId = encodeId(ad.id);
    navigate(`/ad/${encodedId}`);
  };

  useEffect(() => {
    fetchUserAds();
  }, [user]);

  // Calculate pull cooldowns for all ads
  useEffect(() => {
    const calculateCooldowns = () => {
      const cooldowns: Record<number, {
        canPull: boolean;
        remainingTime?: {
          days: number;
          hours: number;
          minutes: number;
          seconds: number;
        };
      }> = {};

      ads.forEach(ad => {
        // Only check cooldown for ads that have been pulled before
        if (ad.lastPulledAt) {
          const lastPulledAt = new Date(ad.lastPulledAt);
          const now = new Date();
          const timeDiff = now.getTime() - lastPulledAt.getTime();
          const fourDaysInMs = 4 * 24 * 60 * 60 * 1000;

          if (timeDiff >= fourDaysInMs) {
            cooldowns[ad.id] = { canPull: true };
          } else {
            const remainingMs = fourDaysInMs - timeDiff;
            const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
            const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
            const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
            const seconds = Math.floor((remainingMs % (60 * 1000)) / 1000);

            cooldowns[ad.id] = {
              canPull: false,
              remainingTime: { days, hours, minutes, seconds }
            };
          }
        } else {
          // Ads that have never been pulled can always be pulled
          cooldowns[ad.id] = { canPull: true };
        }
      });

      setPullCooldowns(cooldowns);
    };

    if (ads.length > 0) {
      calculateCooldowns();
      // Update cooldowns every second for live countdown
      const interval = setInterval(calculateCooldowns, 1000);
      return () => clearInterval(interval);
    }
  }, [ads]);

  const fetchUserAds = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if user is logged in
      if (!user?.id) {
        throw new Error('User not logged in');
      }
      
      console.log('🔍 Fetching ads for user:', user.id, user.username);
      
      // Use the alternative method which is more reliable (no filters)
      const response = await getUserAdsAlternative({});
      
      console.log('📊 User ads response:', response);
      console.log('📊 Ads array:', response.ads);
      console.log('📊 Ads count:', response.ads?.length || 0);
      
      // Convert pinned property to boolean to ensure proper display
      const adsWithBooleanPinned = (response.ads || []).map(ad => {
        // Parse screenshots if they are a JSON string
        let parsedScreenshots = ad.screenshots;
        if (typeof ad.screenshots === 'string') {
          try {
            parsedScreenshots = JSON.parse(ad.screenshots);
          } catch (e) {
            console.warn('Failed to parse screenshots for ad:', ad.id, e);
            parsedScreenshots = [];
          }
        }
        
        return {
          ...ad,
          pinned: Boolean(ad.pinned), // Convert 0/1 to false/true
          isMonetized: Boolean(ad.isMonetized), // Also fix monetization display
          screenshots: parsedScreenshots, // Use parsed screenshots
        };
      });
      
      setAds(adsWithBooleanPinned);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch user ads:', err);
      setError(err.message || 'Failed to fetch your ads');
      setAds([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (ad: UserAd) => {
    setEditingAd(ad);
    setShowEditModal(true);
  };

  const handleEditModalClose = () => {
    setShowEditModal(false);
    setEditingAd(null);
  };

  const handleAdUpdate = (updatedAd: UserAd) => {
    // Update the ad in the local state
    setAds(prevAds => 
      prevAds.map(ad => 
        ad.id === updatedAd.id ? { ...ad, ...updatedAd } : ad
      )
    );
  };

  const handleDelete = async (id: number) => {
    // Find the ad and show delete confirmation modal
    const ad = ads.find(a => a.id === id);
    if (!ad) return;
    
    setSelectedAdForDelete(ad);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedAdForDelete) return;

    try {
      await deleteAd(selectedAdForDelete.id);
      await fetchUserAds(); // Refresh the list
      setShowDeleteModal(false);
      setSelectedAdForDelete(null);
      showSuccess('Listing Deleted!', 'Your listing has been deleted successfully!');
    } catch (err: any) {
      showError('Error', err.message || 'Failed to delete ad');
    }
  };

  const handlePullUp = async (id: number) => {
    // Find the ad
    const ad = ads.find(a => a.id === id);
    if (!ad) return;
    
    // Check if the ad can be pulled up
    const cooldown = pullCooldowns[id];
    
    if (cooldown && cooldown.canPull) {
      // Can pull up - do it directly
      try {
        const result = await pullUpAd(id);
        if (result.success) {
          // Show success notification
          showSuccess('Listing Pulled Up!', 'Your listing has been pulled up successfully!');
          // Refresh the ads list to show the updated position
          await fetchUserAds();
        }
      } catch (err: any) {
        showError('Error', err.message || 'Failed to pull up listing');
      }
    } else {
      // Cannot pull up - show modal with countdown
      setSelectedAdForPull(ad);
      setShowPullModal(true);
    }
  };

  const confirmPullUp = async () => {
    if (!selectedAdForPull) return;
    
    try {
      const result = await pullUpAd(selectedAdForPull.id);
      if (result.success) {
        // Refresh the ads list to show the updated position
        await fetchUserAds();
        setShowPullModal(false);
        setSelectedAdForPull(null);
      }
    } catch (err: any) {
      // Keep modal open to show error
      console.error('Pull up error:', err);
    }
  };

  const handlePin = async (id: number) => {
    // Find the ad
    const ad = ads.find(a => a.id === id);
    if (!ad) return;
    
    // Set the selected ad and show modal
    setSelectedAdForPin(ad);
    setShowPinModal(true);
  };

  const confirmPin = async () => {
    if (!selectedAdForPin) return;
    
    try {
      const result = await togglePinAd(selectedAdForPin.id);
      
      // Update the local ads state to reflect the change
      setAds(prevAds => 
        prevAds.map(ad => 
          ad.id === selectedAdForPin.id 
            ? { ...ad, pinned: result.pinned, pinnedAt: result.pinnedAt }
            : ad
        )
      );
      
      // Close modal and refresh the ads list to get updated order
      setShowPinModal(false);
      setSelectedAdForPin(null);
      await fetchUserAds();
      
    } catch (err: any) {
      console.error('Pin error:', err);
      // Keep modal open to show error
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'sold':
        return 'bg-blue-500/20 text-blue-400';
      case 'suspended':
        return 'bg-red-500/20 text-red-400';
      case 'rejected':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getPlatformIcon = (platform: string) => {
    const platformColors = {
      youtube: 'text-red-500',
      facebook: 'text-blue-500',
      instagram: 'text-pink-500',
      twitter: 'text-blue-400',
      tiktok: 'text-black'
    };
    
    return (
      <span className={`text-sm font-semibold ${platformColors[platform] || 'text-white'}`}>
        {platform.toUpperCase()}
      </span>
    );
  };

  const getPlatformIconSmall = (platform: string) => {
    const iconMap: { [key: string]: JSX.Element } = {
      'youtube': (
        <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </div>
      ),
      'instagram': (
        <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        </div>
      ),
      'tiktok': (
        <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
          </svg>
        </div>
      ),
      'facebook': (
        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </div>
      ),
      'twitter': (
        <div className="w-6 h-6 bg-blue-400 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
          </svg>
        </div>
      ),
    };
    return iconMap[platform.toLowerCase()] || (
      <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center">
        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
        </svg>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-xsm-black/50 rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-xsm-medium-gray rounded mb-2"></div>
            <div className="h-4 bg-xsm-medium-gray rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-white font-semibold mb-2">Error loading your ads</h3>
        <p className="text-xsm-light-gray">{error}</p>
        <button 
          onClick={fetchUserAds}
          className="mt-4 xsm-button-secondary"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Inject custom scrollbar styles */}
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
      
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-xsm-yellow">My Listings</h3>
        <span className="text-2xl font-bold text-xsm-yellow">
          {ads.length}
        </span>
      </div>

      {/* Ad List */}
      {ads.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-bold text-white mb-2">No ads found</h3>
          <p className="text-xsm-light-gray mb-4">
            You haven't created any listings yet.
          </p>
        </div>
      ) : (
        <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {ads.map((ad) => (
              <div 
                key={ad.id} 
                className="bg-xsm-black/50 rounded-lg p-3 border border-xsm-medium-gray/20 shadow-sm flex flex-col items-center hover:border-xsm-yellow/30 transition-colors w-full max-w-[240px] mx-auto cursor-pointer"
                onClick={() => handleViewAd(ad)}
              >
                {/* Ad Thumbnail Circle with Platform Icon */}
                <div className="relative mb-2 flex items-center">
                  {/* Platform Icon on Left Side */}
                  <div className="absolute -left-4 -top-0">
                    {getPlatformIconSmall(ad.platform)}
                  </div>
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-xsm-medium-gray/30">
                    <img
                      src={(() => {
                        // Product cards must use the listing profile image only, not gallery screenshots.
                        const thumbnail = typeof ad.thumbnail === 'string' ? ad.thumbnail.trim() : '';
                        if (thumbnail && thumbnail !== '0') return getImageUrl(thumbnail) || thumbnail;
                        return '/default-avatar.png';
                      })()}
                      alt="Ad Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

              {/* Channel Name */}
              <h4 className="text-white font-semibold text-xs text-center mb-0.5 truncate w-full">
                {ad.title}
              </h4>

              {/* Pinned Badge */}
              {ad.pinned && (
                <div className="flex justify-center mb-0.5">
                  <span className="bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full font-semibold flex items-center">
                    <Pin className="w-3 h-3 mr-1" />
                    PINNED
                  </span>
                </div>
              )}

              {/* Subscribers */}
              <div className="text-center mb-0.5">
                <span className="text-blue-400 font-medium text-xs">
                  Subscribers: {formatNumber(ad.subscribers)}
                </span>
              </div>

              {/* Price */}
              <div className="text-center mb-0.5">
                <span className="text-xsm-yellow font-semibold text-xs">
                  Price: {formatPrice(ad.price)}
                </span>
              </div>

              {/* Monetization */}
              <div className="text-center mb-1.5">
                <span className={`text-xs ${ad.isMonetized ? 'text-green-400' : 'text-red-400'}`}>
                  Monetization: {ad.isMonetized ? 'Yes' : 'No'}
                </span>
              </div>

              {/* Action Buttons - 4 Circles */}
              <div className="flex justify-center space-x-1 w-full" onClick={(e) => e.stopPropagation()}>
                {/* Edit Button - Yellow */}
                <button
                  onClick={() => handleEdit(ad)}
                  className="w-6 h-6 bg-xsm-yellow hover:bg-yellow-500 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
                  title="Edit"
                >
                  <Edit className="w-3 h-3 text-xsm-black" />
                </button>

                {/* Delete Button - Red */}
                <button
                  onClick={() => handleDelete(ad.id)}
                  className="w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3 text-white" />
                </button>

                {/* Pull Up Button - Always Green and Clickable */}
                <button
                  onClick={() => handlePullUp(ad.id)}
                  className="w-6 h-6 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
                  title="Pull Up"
                >
                  <TrendingUp className="w-3 h-3 text-white" />
                </button>

                {/* Pin Button - Orange/Yellow based on pinned status */}
                <button
                  onClick={() => handlePin(ad.id)}
                  className={`w-6 h-6 ${ad.pinned ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-orange-500 hover:bg-orange-600'} rounded-full flex items-center justify-center transition-colors flex-shrink-0`}
                  title={ad.pinned ? "Unpin Listing" : "Pin Listing"}
                >
                  <Pin className={`w-3 h-3 text-white ${ad.pinned ? 'fill-current' : ''}`} />
                </button>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      {/* Edit Listing Modal */}
      {editingAd && (
        <EditListingModal
          ad={editingAd}
          isOpen={showEditModal}
          onClose={handleEditModalClose}
          onUpdate={handleAdUpdate}
        />
      )}

      {/* Pull Up Modal */}
      {showPullModal && selectedAdForPull && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
            <div className="text-center">
              <div className="mb-4">
                <TrendingUp className="w-16 h-16 text-xsm-yellow mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  Pull Up Listing
                </h3>
                <p className="text-sm text-gray-300 mb-4">
                  "{selectedAdForPull.title}"
                </p>
              </div>

              {/* Check if ad can be pulled or is on cooldown */}
              {pullCooldowns[selectedAdForPull.id] && !pullCooldowns[selectedAdForPull.id].canPull ? (
                /* Show countdown if on cooldown */
                <div className="mb-6">
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-300 mb-3">
                    <Clock className="w-5 h-5 text-red-400" />
                    <span className="font-medium">Pull-up available in:</span>
                  </div>
                  <div className="flex items-center justify-center space-x-4 text-sm font-mono bg-gray-800 rounded-lg p-4 border border-gray-600">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-400">
                        {pullCooldowns[selectedAdForPull.id].remainingTime?.days || 0}
                      </div>
                      <div className="text-gray-400 text-xs">days</div>
                    </div>
                    <div className="text-gray-500 text-xl">:</div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-400">
                        {String(pullCooldowns[selectedAdForPull.id].remainingTime?.hours || 0).padStart(2, '0')}
                      </div>
                      <div className="text-gray-400 text-xs">hrs</div>
                    </div>
                    <div className="text-gray-500 text-xl">:</div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-400">
                        {String(pullCooldowns[selectedAdForPull.id].remainingTime?.minutes || 0).padStart(2, '0')}
                      </div>
                      <div className="text-gray-400 text-xs">min</div>
                    </div>
                    <div className="text-gray-500 text-xl">:</div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">
                        {String(pullCooldowns[selectedAdForPull.id].remainingTime?.seconds || 0).padStart(2, '0')}
                      </div>
                      <div className="text-gray-400 text-xs">sec</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    Listings can only be pulled up every 4 days
                  </p>
                </div>
              ) : (
                /* Show confirmation if can be pulled */
                <div className="mb-6">
                  <p className="text-gray-300">
                    Are you sure you want to pull up this listing? It will appear at the top of the marketplace.
                  </p>
                  {selectedAdForPull.lastPulledAt && (
                    <p className="text-xs text-gray-400 mt-2">
                      Last pulled: {new Date(selectedAdForPull.lastPulledAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowPullModal(false);
                    setSelectedAdForPull(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors border border-gray-600"
                >
                  Close
                </button>
                {pullCooldowns[selectedAdForPull.id]?.canPull && (
                  <button
                    onClick={confirmPullUp}
                    className="flex-1 px-4 py-2 bg-xsm-yellow text-xsm-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
                  >
                    Pull Up
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pin/Unpin Modal */}
      {showPinModal && selectedAdForPin && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
            <div className="text-center">
              <div className="mb-4">
                <Pin className="w-16 h-16 text-xsm-yellow mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  {selectedAdForPin.pinned ? 'Unpin Listing' : 'Pin Listing'}
                </h3>
                <p className="text-sm text-gray-300 mb-4">
                  "{selectedAdForPin.title}"
                </p>
              </div>

              {/* Confirmation message */}
              <div className="mb-6">
                <p className="text-gray-300">
                  {selectedAdForPin.pinned 
                    ? 'Are you sure you want to unpin this listing? It will no longer appear at the top of your listings.'
                    : 'Are you sure you want to pin this listing? It will appear at the top of your listings.'
                  }
                </p>
                {selectedAdForPin.pinnedAt && (
                  <p className="text-xs text-gray-400 mt-2">
                    Pinned on: {new Date(selectedAdForPin.pinnedAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowPinModal(false);
                    setSelectedAdForPin(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors border border-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmPin}
                  className="flex-1 px-4 py-2 bg-xsm-yellow text-xsm-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
                >
                  {selectedAdForPin.pinned ? 'Unpin' : 'Pin'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedAdForDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
            <div className="text-center">
              <div className="mb-4">
                <Trash2 className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  Delete Listing
                </h3>
                <p className="text-sm text-gray-300 mb-4">
                  "{selectedAdForDelete.title}"
                </p>
              </div>

              <div className="mb-6">
                <p className="text-gray-300">
                  Are you sure you want to delete this listing? This action cannot be undone.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedAdForDelete(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors border border-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAdList;
