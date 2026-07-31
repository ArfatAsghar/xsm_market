import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, Users, Shield, MessageCircle, CreditCard, ArrowLeft, Edit, Trash2, Zap, TrendingUp, Pin, Clock, Crown, X, FileText, MoreHorizontal, User } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { useNotifications } from '@/context/NotificationContext';
import DealCreationModal from '@/components/DealCreationModal';
import EditListingModal from '@/components/EditListingModal';
import { extractIdFromSlug } from '@/utils/idEncoder';
import { pullUpAd, togglePinAd } from '@/services/ads';
import { getImageUrl } from '@/config/api';

// Get API URL from environment variables
const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://xsmmarket.com/api');
};

const API_URL = getApiUrl();

interface ChannelData {
  id: string;
  name: string;
  category: string;
  platform: 'youtube' | 'tiktok' | 'facebook' | 'instagram' | 'twitter';
  channelUrl: string;
  subscribers: number;
  price: number;
  monthlyIncome?: number;
  description: string;
  verified: boolean;
  premium: boolean;
  rating: number;
  views: number;
  thumbnail: string;
  screenshots?: string[];
  monetized: boolean;
  earningMethods?: string[];
  promotionStrategies?: string[];
  contentType?: string;
  incomeDetails?: string;
  promotionDetails?: string;
  preferredPaymentMethods?: string[];
  seller: {
    id: number;
    name: string;
    username: string;
    rating: number;
    sales: number;
    profilePicture?: string;
    lastSeenAt?: string;
    isVip?: boolean;
  };
}

const PlatformIcon = ({ platform }: { platform: ChannelData['platform'] }) => {
  const getIconColorClass = () => {
    switch (platform) {
      case 'youtube':
        return 'text-red-600';
      case 'tiktok':
        return 'text-black';
      case 'facebook':
        return 'text-blue-600';
      case 'instagram':
        return 'text-pink-600';
      case 'twitter':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  switch (platform) {
    case 'youtube':
      return (
        <svg className={`w-full h-full ${getIconColorClass()}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      );
    case 'tiktok':
      return (
        <svg className={`w-full h-full ${getIconColorClass()}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298 0 .593.057.87.168V9.43a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.69a6.34 6.34 0 0 0 10.86 4.49 6.47 6.47 0 0 0 1.83-4.49V7.85a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-.87.72z"/>
        </svg>
      );
    case 'facebook':
      return (
        <svg className={`w-full h-full ${getIconColorClass()}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      );
    case 'instagram':
      return (
        <svg className={`w-full h-full ${getIconColorClass()}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
        </svg>
      );
    case 'twitter':
      return (
        <svg className={`w-full h-full ${getIconColorClass()}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      );
    default:
      return null;
  }
};

const AdDetails: React.FC = () => {
  const { adId: encodedAdId } = useParams<{ adId: string }>();
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const { showError, showSuccess } = useNotifications();
  
  const [channel, setChannel] = useState<ChannelData | null>(null);
  const [loading, setLoading] = useState(true);

  const isOwnListing = Boolean(
    isLoggedIn && user && channel &&
    String(user.id) === String(channel.seller?.id)
  );
  const [error, setError] = useState<string | null>(null);
  const [showDealModal, setShowDealModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPullModal, setShowPullModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pullCooldown, setPullCooldown] = useState<{
    canPull: boolean;
    remainingTime?: {
      days: number;
      hours: number;
      minutes: number;
      seconds: number;
    };
  }>({ canPull: true });
  const [isPinned, setIsPinned] = useState(false);
  const [activeScreenshot, setActiveScreenshot] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Decode the ID from the URL parameter
  console.log('AdDetails - received encodedAdId:', encodedAdId);
  
  const decodedAdId = encodedAdId ? extractIdFromSlug(encodedAdId) : null;
  console.log('AdDetails - decodedAdId:', decodedAdId);

  useEffect(() => {
    if (encodedAdId) {
      // If we have an encoded ID but can't decode it, show error immediately
      if (!decodedAdId) {
        setError('Invalid ad ID');
        setLoading(false);
        return;
      }
      fetchAdDetails();
    } else {
      setError('No ad ID provided');
      setLoading(false);
    }
  }, [encodedAdId, decodedAdId]);

  // Close lightbox on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveScreenshot(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchAdDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Debug logging
      console.log('Raw encodedAdId from URL:', encodedAdId);
      console.log('Decoded ID:', decodedAdId);
      
      if (!decodedAdId) {
        console.error('Failed to decode ad ID from:', encodedAdId);
        throw new Error('Invalid ad ID - could not decode');
      }
      
      const adIdStr = decodedAdId.toString();
      console.log('Making API request to:', `${API_URL}/ads/${adIdStr}`);
      
      // Add timeout to prevent indefinite loading
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${API_URL}/ads/${adIdStr}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.status === 404) {
        throw new Error('Ad not found');
      } else if (!response.ok) {
        throw new Error('Failed to fetch ad details');
      }
      
      const data = await response.json();
      
      // Normalize screenshots from either JSON string, array of URLs, or array of uploaded objects.
      const normalizeScreenshot = (item: any): string => {
        if (!item) return '';
        if (typeof item === 'string') return item;
        return item.url || item.data || item.thumbnail || '';
      };

      let screenshots: string[] = [];
      if (data.screenshots) {
        try {
          const rawScreenshots = Array.isArray(data.screenshots)
            ? data.screenshots
            : JSON.parse(data.screenshots);
          screenshots = Array.isArray(rawScreenshots)
            ? rawScreenshots.map(normalizeScreenshot).filter(Boolean)
            : [];
        } catch (e) {
          console.warn('Failed to parse screenshots JSON:', e);
          screenshots = [];
        }
      }
      
      // Transform the API response to match our ChannelData interface
      const channelData: ChannelData = {
        id: data.id.toString(),
        name: data.title,
        description: data.description,
        platform: data.platform?.toLowerCase() as ChannelData['platform'] || 'youtube',
        category: data.category,
        channelUrl: data.channelUrl || `https://${data.platform?.toLowerCase()}.com`,
        subscribers: data.subscribers,
        price: data.price,
        monthlyIncome: data.monthlyIncome,
        verified: data.verified || false,
        premium: data.premium || false,
        rating: data.rating || 4.5,
        views: data.views || data.totalViews || data.subscribers * 10,
        // Product profile image comes from channel/profile metadata, not uploaded screenshots.
        thumbnail: (data.thumbnail && String(data.thumbnail).trim() !== '0') ? data.thumbnail : (data.primary_image || '/default-thumbnail.jpg'),
        screenshots: screenshots,
        monetized: data.isMonetized || data.monthlyIncome > 0 || false,
        contentType: data.contentType,
        incomeDetails: data.incomeDetails,
        promotionDetails: data.promotionDetails,
        preferredPaymentMethods: Array.isArray(data.preferredPaymentMethods)
          ? data.preferredPaymentMethods
          : typeof data.preferredPaymentMethods === 'string'
          ? (function() { try { return JSON.parse(data.preferredPaymentMethods); } catch { return []; } })()
          : [],
        earningMethods: data.earningMethods || ['Ad Revenue', 'Sponsorships'],
        promotionStrategies: data.promotionStrategies || ['SEO Optimization', 'Social Media'],
        seller: {
          id: data.seller?.id || data.sellerId || data.userId || 0,
          name: data.seller?.name || data.seller?.username || data.sellerName || 'Unknown',
          username:
            data.seller?.username ||
            data.sellerUsername ||
            data.username ||
            data.ownerUsername ||
            data.user?.username ||
            data.seller?.name ||
            'Unknown',
          rating: data.seller?.rating || 4.8,
          sales: data.seller?.sales || 0,
          profilePicture: data.seller?.profilePicture,
          lastSeenAt: data.seller?.lastSeenAt,
          isVip: Boolean(data.seller?.isVip || data.seller_isVip || data.sellerIsVip || data.isVip)
        }
      };
      
      setChannel(channelData);
      
      // Initialize isPinned state from API data
      if (data.pinned !== undefined) {
        setIsPinned(Boolean(data.pinned));
      }
      
      // Calculate pull/bump cooldown from lastPulledAt
      if (data.lastPulledAt) {
        const isUserVip = Boolean(
          (user as any)?.isVip ||
          ((user as any)?.vipUntil && new Date((user as any).vipUntil) > new Date())
        );
        const cooldownDays = isUserVip ? 3 : 4;
        const lastPulled = new Date(data.lastPulledAt);
        const now = new Date();
        const diffMs = now.getTime() - lastPulled.getTime();
        const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
        
        if (diffMs < cooldownMs) {
          // Still on cooldown
          const remainingMs = cooldownMs - diffMs;
          const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
          const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
          const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
          const seconds = Math.floor((remainingMs % (60 * 1000)) / 1000);
          
          setPullCooldown({
            canPull: false,
            remainingTime: { days, hours, minutes, seconds }
          });
          
          // Update countdown every second
          const interval = setInterval(() => {
            const now = new Date();
            const diffMs = now.getTime() - lastPulled.getTime();
            
            if (diffMs >= cooldownMs) {
              // Cooldown expired
              setPullCooldown({ canPull: true });
              clearInterval(interval);
            } else {
              const remainingMs = cooldownMs - diffMs;
              const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
              const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
              const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
              const seconds = Math.floor((remainingMs % (60 * 1000)) / 1000);
              
              setPullCooldown({
                canPull: false,
                remainingTime: { days, hours, minutes, seconds }
              });
            }
          }, 1000);
          
          // Cleanup interval on unmount
          return () => clearInterval(interval);
        } else {
          // Cooldown expired, can pull
          setPullCooldown({ canPull: true });
        }
      } else {
        // Never pulled before, can pull
        setPullCooldown({ canPull: true });
      }
    } catch (error) {
      console.error('Error fetching ad details:', error);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          setError('Request timed out. Please check your connection and try again.');
          showError('Request timed out');
        } else {
          setError(error.message);
          showError(error.message);
        }
      } else {
        setError('Failed to load ad details. Please try again.');
        showError('Failed to load ad details');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const getOnlineStatus = (lastSeenAt?: string) => {
    if (!lastSeenAt) return { status: 'offline', text: 'Offline' };
    
    // Parse the date string properly with timezone handling
    let lastSeen: Date;
    if (lastSeenAt.includes('T') || lastSeenAt.includes('Z')) {
      // Already has timezone info
      lastSeen = new Date(lastSeenAt);
    } else {
      // No timezone info, assume it's UTC from server
      lastSeen = new Date(lastSeenAt.replace(' ', 'T') + 'Z');
    }
    
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 5) {
      return { status: 'online', text: 'Online' };
    } else if (diffInMinutes < 60) {
      return { status: 'offline', text: `${diffInMinutes} minutes ago` };
    } else if (diffInMinutes < 1440) { // Less than 24 hours
      const hours = Math.floor(diffInMinutes / 60);
      return { status: 'offline', text: `${hours} hour${hours > 1 ? 's' : ''} ago` };
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return { status: 'offline', text: `${days} day${days > 1 ? 's' : ''} ago` };
    }
  };

  const handlePurchase = () => {
    if (!isLoggedIn) {
      showError('Please log in to start a deal');
      navigate('/login');
      return;
    }
    setShowDealModal(true);
  };

  const handleCloseDealModal = () => {
    setShowDealModal(false);
  };

  const handleContact = async () => {
    if (!isLoggedIn || !user) {
      showError('Please log in to contact the seller');
      navigate('/login');
      return;
    }

    if (!channel) return;

    if (String(user.id) === String(channel.seller.id)) {
      showError("You can't contact yourself");
      return;
    }

    try {
      setIsCreating(true);
      const token = localStorage.getItem('token');
      
      // First, check if a chat already exists with this seller
      const checkChatResponse = await fetch(`${API_URL}/chat/check-existing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sellerId: channel.seller.id
        })
      });

      if (!checkChatResponse.ok) {
        throw new Error(`HTTP error! status: ${checkChatResponse.status}`);
      }

      const checkResult = await checkChatResponse.json();
      
      if (checkResult.exists) {
        // Chat exists, just navigate to it
        navigate(`/chat?chatId=${checkResult.chatId}`);
        return;
      }

      // No existing chat, create a new one without automatically sending a message
      const response = await fetch(`${API_URL}/chat/ad-inquiry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          adId: channel.id,
          sellerId: channel.seller.id,
          sellerName: channel.seller.name
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Chat creation failed:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const chat = await response.json();
      
      // Chat created successfully
      navigate(`/chat?chatId=${chat.id}`);
      showSuccess('Chat created successfully!');
    } catch (error) {
      console.error('Error creating chat:', error);
      showError('Failed to create chat');
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-xsm-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-xsm-yellow mx-auto mb-4"></div>
          <p className="text-xsm-light-gray">Loading channel details...</p>
        </div>
      </div>
    );
  }

  if (error || !channel) {
    const getErrorTitle = () => {
      if (error?.includes('Invalid ad ID') || error?.includes('could not decode')) {
        return 'Invalid Link';
      } else if (error?.includes('Ad not found')) {
        return 'Channel Not Found';
      } else {
        return 'Channel Not Available';
      }
    };

    const getErrorMessage = () => {
      if (error?.includes('Invalid ad ID') || error?.includes('could not decode')) {
        return 'The link you\'re trying to access is invalid or corrupted.';
      } else if (error?.includes('Ad not found')) {
        return 'This channel may have been removed or is no longer available.';
      } else {
        return error || 'The requested channel could not be loaded.';
      }
    };

    return (
      <div className="min-h-screen bg-xsm-black text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-24 h-24 bg-xsm-yellow rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-xsm-yellow mb-4">{getErrorTitle()}</h2>
          <p className="text-xsm-light-gray mb-6 leading-relaxed">{getErrorMessage()}</p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/')}
              className="w-full bg-xsm-yellow text-black px-6 py-3 rounded-lg hover:bg-yellow-500 transition-colors font-medium"
            >
              Browse All Channels
            </button>
            <button
              onClick={() => navigate(-1)}
              className="w-full bg-transparent border border-xsm-medium-gray text-xsm-light-gray px-6 py-3 rounded-lg hover:bg-xsm-medium-gray transition-colors font-medium"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const adminFee = channel.price * 0.075;
  const isOwner = isLoggedIn && user && String(user.id) === String(channel.seller.id);

  const handleEdit = () => {
    setShowEditModal(true);
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/ads/${channel.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        showSuccess('Listing deleted successfully');
        setShowDeleteModal(false);
        if (user?.username) {
          navigate(`/u/${user.username}`);
        } else {
          navigate('/profile');
        }
      } else {
        throw new Error('Failed to delete listing');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showError('Failed to delete listing');
    }
  };

  const handlePullListing = async () => {
    if (!channel) return;
    
    // Always show modal with cooldown information or pull up button
    setShowPullModal(true);
  };

  const confirmPullUp = async () => {
    if (!channel) return;
    
    // Double-check cooldown before attempting
    if (!pullCooldown.canPull) {
      showError('Cooldown Active', 'Please wait until the cooldown expires');
      return;
    }
    
    try {
      const result = await pullUpAd(Number(channel.id));
      if (result.success) {
        showSuccess('Listing Pulled Up!', 'Your listing has been pulled up successfully!');
        setShowPullModal(false);
        // Reload the page to show updated data
        window.location.reload();
      }
    } catch (err: any) {
      console.error('Pull up error:', err);
      // Only show error for unexpected failures, not cooldown errors
      if (err.message && !err.message.includes('cooldown')) {
        showError('Error', err.message || 'Failed to pull up listing');
      }
    }
  };

  const handlePin = () => {
    setShowPinModal(true);
  };

  const confirmPin = async () => {
    if (!channel) return;
    
    try {
      const result = await togglePinAd(Number(channel.id));
      setIsPinned(result.pinned);
      setShowPinModal(false);
      showSuccess(result.pinned ? 'Listing Pinned!' : 'Listing Unpinned!', result.pinned ? 'Your listing has been pinned to the top' : 'Your listing has been unpinned');
    } catch (err: any) {
      console.error('Pin error:', err);
      showError('Error', err.message || 'Failed to pin listing');
    }
  };

  return (
    <div className="min-h-screen bg-xsm-black text-white">
      {/* Header with back button */}
      <div className="bg-xsm-dark-gray border-b border-xsm-medium-gray">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-xsm-yellow hover:text-yellow-400 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <h1 className="text-2xl font-bold text-xsm-yellow">Account Details</h1>
            <div className="w-16"></div> {/* Spacer for centering */}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Owner Action Buttons */}
        {isOwner && (
          <div className="mb-6 flex justify-end gap-3">
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg transition-colors font-semibold"
            >
              <Edit className="w-5 h-5" />
              EDIT
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-lg transition-colors font-semibold"
            >
              <Trash2 className="w-5 h-5" />
              DELETE
            </button>
            <button
              onClick={handlePullListing}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-lg transition-colors font-semibold"
            >
              <Zap className="w-5 h-5 fill-current text-yellow-300" />
              PULL UP
            </button>
            <button
              onClick={handlePin}
              className={`flex items-center gap-2 ${isPinned ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-orange-600 hover:bg-orange-700'} text-white px-5 py-3 rounded-lg transition-colors font-semibold`}
            >
              <Pin className={`w-5 h-5 ${isPinned ? 'fill-current' : ''}`} />
              {isPinned ? 'UNPIN' : 'PIN'}
            </button>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Seller Info (moved to top left) */}
          <div className="lg:col-span-1 space-y-6">
            {/* Seller Info */}
            <div className="xsm-card">
              <h4 className="text-lg font-semibold text-xsm-yellow mb-4 text-center">Seller Information</h4>
              <div className="flex flex-col items-center space-y-4">
                <div className="flex flex-col items-center">
                  {/* Profile Picture */}
                  <div className="mb-3">
                    {channel.seller.profilePicture ? (
                      <img
                        src={channel.seller.profilePicture}
                        alt={channel.seller.name}
                        className="w-20 h-20 rounded-full object-cover border-2 border-xsm-yellow"
                        onError={(e) => {
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(channel.seller.name)}&background=FFD700&color=000&size=80`;
                        }}
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-xsm-yellow flex items-center justify-center text-black font-bold text-2xl">
                        {channel.seller.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Seller Details */}
                  <div className="text-center">
                    <button
                      onClick={() => navigate(`/u/${encodeURIComponent(channel.seller.username)}`)}
                      className="text-white font-semibold text-lg hover:text-xsm-yellow transition-colors underline decoration-dotted cursor-pointer mb-1 flex items-center gap-1.5 justify-center"
                    >
                      {channel.seller.name}
                      {channel.seller.isVip && <Crown className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
                    </button>
                    {channel.seller.isVip && (
                      <div className="flex justify-center mb-2">
                        <span className="flex items-center gap-0.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-[10px] px-2 py-0.5 rounded-full font-black shadow shadow-yellow-900/40">
                          <Crown className="w-2.5 h-2.5" /> VIP Seller
                        </span>
                      </div>
                    )}
                    {channel.seller.rating > 0 && (
                      <div className="flex items-center justify-center space-x-1 mb-2">
                        <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                        <span className="text-white font-medium">{channel.seller.rating}</span>
                      </div>
                    )}

                    {/* Online/Offline Status */}
                    {(() => {
                      const status = getOnlineStatus(channel.seller.lastSeenAt);
                      return (
                        <div className="flex items-center justify-center space-x-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${status.status === 'online' ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                          <span className={`text-sm ${status.status === 'online' ? 'text-green-400' : 'text-gray-400'}`}>
                            {status.text}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {isOwnListing ? (
                  <button 
                    disabled
                    className="w-full bg-xsm-medium-gray/40 text-xsm-light-gray flex items-center justify-center space-x-2 py-3 rounded-md font-medium cursor-not-allowed opacity-75 border border-xsm-medium-gray/30"
                    title="You are the seller of this listing"
                  >
                    <User className="w-5 h-5" />
                    <span>Your Listing</span>
                  </button>
                ) : (
                  <button 
                    onClick={handleContact}
                    disabled={isCreating}
                    className="w-full xsm-button-secondary flex items-center justify-center space-x-2 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>{isCreating ? 'Connecting...' : 'Contact Seller'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Price Card */}
            <div className="xsm-card">
              <div className="text-center">
                <div className="text-5xl font-bold text-xsm-yellow mb-6">
                  {formatPrice(channel.price)}
                </div>

                {isOwnListing ? (
                  <button
                    disabled
                    className="w-full bg-xsm-medium-gray/40 text-xsm-light-gray text-xl py-5 rounded-md font-bold cursor-not-allowed opacity-75 border border-xsm-medium-gray/30 flex items-center justify-center space-x-2"
                    title="You cannot purchase your own listing"
                  >
                    <span>YOUR LISTING</span>
                  </button>
                ) : (
                  <button
                    onClick={handlePurchase}
                    className="w-full xsm-button text-xl py-5 flex items-center justify-center space-x-2"
                  >
                    <CreditCard className="w-6 h-6" />
                    <span>BUY</span>
                  </button>
                )}

                {/* Preferred Payment Methods under BUY Button */}
                {channel.preferredPaymentMethods && channel.preferredPaymentMethods.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-xsm-medium-gray/30 text-center">
                    <div className="text-xs font-semibold text-xsm-yellow mb-2.5 uppercase tracking-wider">
                      Preferred Payment Methods
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      {channel.preferredPaymentMethods.slice(0, 3).map((pm, idx) => (
                        <span
                          key={idx}
                          className="bg-xsm-black/80 text-white border border-xsm-medium-gray/40 text-[11px] font-medium px-2.5 py-1 rounded-md shadow-sm"
                        >
                          {pm}
                        </span>
                      ))}

                      {channel.preferredPaymentMethods.length > 3 && (
                        <button
                          type="button"
                          onClick={() => setShowPaymentModal(true)}
                          className="bg-xsm-yellow text-xsm-black hover:bg-yellow-400 font-black text-xs px-2.5 py-1 rounded-md shadow-md transition-all flex items-center gap-1 cursor-pointer"
                          title="View all preferred payment methods"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                          <span>+{channel.preferredPaymentMethods.length - 3}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="text-center mt-4 text-sm text-xsm-light-gray">
                  Secure payment with buyer protection
                </div>
              </div>
            </div>

          </div>

          {/* Middle & Right Columns - Channel Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Channel Header - Centered */}
            <div className="text-center">
              {/* Display channel thumbnail if available */}
              {channel.thumbnail && channel.thumbnail !== '/default-thumbnail.jpg' ? (
                <div className="relative w-32 h-32 mx-auto mb-4">
                  <img
                    src={channel.thumbnail}
                    alt={`${channel.name} thumbnail`}
                    className="w-full h-full object-cover rounded-full border-4 border-xsm-yellow"
                    onError={(e) => {
                      console.error('Thumbnail failed to load:', channel.thumbnail);
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center p-6 hidden">
                    <div className="w-full h-full">
                      <PlatformIcon platform={channel.platform} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-32 h-32 bg-white rounded-full mx-auto mb-4 flex items-center justify-center p-6">
                  <div className="w-full h-full">
                    <PlatformIcon platform={channel.platform} />
                  </div>
                </div>
              )}
              <h3 className="text-3xl font-bold text-white mb-3">{channel.name}</h3>
              <a 
                href={channel.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 mb-4 text-xsm-light-gray hover:text-xsm-yellow transition-colors"
              >
                <div className="w-5 h-5">
                  <PlatformIcon platform={channel.platform} />
                </div>
                <span className="underline">{channel.channelUrl}</span>
              </a>
              <div className="flex items-center justify-center space-x-4 mb-4">
                {channel.premium && (
                  <span className="xsm-badge-premium">PREMIUM</span>
                )}
                {channel.verified && (
                  <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center">
                    <Shield className="w-4 h-4 mr-1" />
                    VERIFIED
                  </span>
                )}
                <span className="bg-xsm-yellow text-xsm-black px-3 py-1 rounded-full text-sm font-bold">
                  {channel.category}
                </span>
              </div>

            </div>

            {/* Stats Cards Row: Subscribers | Channel Status | Content Type - side by side */}
            <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto">
              {/* Subscribers Card */}
              <div className="xsm-card flex flex-col items-center justify-center py-4 px-3 text-center">
                <Users className="w-6 h-6 text-xsm-yellow mx-auto mb-1.5" />
                <div className="text-xl font-bold text-white">{formatNumber(channel.subscribers)}</div>
                <div className="text-xs text-xsm-light-gray mt-0.5">Subscribers</div>
              </div>

              {/* Channel Status Card */}
              <div className="xsm-card flex flex-col items-center justify-center py-4 px-3 text-center">
                <div className={`w-3 h-3 rounded-full mx-auto mb-1.5 ${channel.monetized ? 'bg-green-500' : 'bg-gray-500'}`} />
                <div className={`text-sm font-bold ${channel.monetized ? 'text-green-400' : 'text-gray-400'}`}>
                  {channel.monetized ? 'Monetized' : 'Not Monetized'}
                </div>
                <div className="text-xs text-xsm-light-gray mt-0.5">Channel Status</div>
              </div>

              {/* Content Type Card */}
              <div className="xsm-card flex flex-col items-center justify-center py-4 px-3 text-center">
                <div className="text-lg mb-1">🎬</div>
                <div className="text-sm font-bold text-blue-300 break-words leading-tight">
                  {channel.contentType && channel.contentType.trim() ? channel.contentType : '—'}
                </div>
                <div className="text-xs text-xsm-light-gray mt-0.5">Content Type</div>
              </div>
            </div>

            {/* Description - Centered */}
            {channel.description && channel.description.trim() && (
              <div className="xsm-card max-w-3xl mx-auto">
                <h4 className="text-lg font-semibold text-xsm-yellow mb-4 text-center">Description</h4>
                <p className="text-white leading-relaxed text-center whitespace-pre-wrap break-words overflow-wrap-anywhere">{channel.description}</p>
              </div>
            )}

            {/* Income Details - Centered */}
            {channel.incomeDetails && channel.incomeDetails.trim() && (
              <div className="xsm-card max-w-3xl mx-auto">
                <h4 className="text-lg font-semibold text-xsm-yellow mb-4 text-center">Income Details</h4>
                <p className="text-white leading-relaxed text-center whitespace-pre-wrap break-words overflow-wrap-anywhere">{channel.incomeDetails}</p>
              </div>
            )}

            {/* Promotion Details - Centered */}
            {channel.promotionDetails && channel.promotionDetails.trim() && (
              <div className="xsm-card max-w-3xl mx-auto">
                <h4 className="text-lg font-semibold text-xsm-yellow mb-4 text-center">Promotion Details</h4>
                <p className="text-white leading-relaxed text-center whitespace-pre-wrap break-words overflow-wrap-anywhere">{channel.promotionDetails}</p>
              </div>
            )}

            {/* Screenshots/Images Gallery - Moved to bottom */}
            {channel.screenshots && channel.screenshots.length > 0 && (
              <div className="xsm-card max-w-3xl mx-auto">
                <h4 className="text-lg font-semibold text-xsm-yellow mb-4 text-center">Channel Screenshots</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   {channel.screenshots.map((screenshot, index) => {
                    const imageUrl = getImageUrl(screenshot);
                    return (
                      <div
                        key={index}
                        className="relative group cursor-pointer overflow-hidden rounded-lg border border-xsm-medium-gray/30 hover:border-xsm-yellow transition-all duration-300"
                        onClick={() => imageUrl && setActiveScreenshot(imageUrl)}
                      >
                        <img
                          src={imageUrl || undefined}
                          alt={`${channel.name} screenshot ${index + 1}`}
                          className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-110"
                          onError={(e) => {
                            console.error('Image failed to load:', screenshot, 'Resolved to:', imageUrl);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <div className="bg-black/60 text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                            View Full Size
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xsm-medium-gray text-sm mt-3 text-center">
                  {channel.screenshots.length} screenshot{channel.screenshots.length > 1 ? 's' : ''} uploaded by seller
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Deal Creation Modal - exactly like the ChannelModal */}
      {showDealModal && (
        <DealCreationModal
          isOpen={showDealModal}
          onClose={handleCloseDealModal}
          channelPrice={channel.price}
          channelTitle={channel.name}
          sellerId={channel.seller.id.toString()}
          onNavigateToChat={() => navigate('/chat')}
        />
      )}

      {/* Pull Up / Bump Modal */}
      {showPullModal && channel && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-xsm-dark-gray border border-xsm-medium-gray/50 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-950/50 to-xsm-dark-gray p-5 border-b border-xsm-medium-gray/40 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                Boolean((user as any)?.isVip || ((user as any)?.vipUntil && new Date((user as any).vipUntil) > new Date()))
                  ? 'bg-gradient-to-br from-amber-500/30 to-yellow-400/20 border border-amber-500/40'
                  : 'bg-blue-500/20 border border-blue-500/30'
              }`}>
                <Zap className={`w-5 h-5 ${
                  Boolean((user as any)?.isVip || ((user as any)?.vipUntil && new Date((user as any).vipUntil) > new Date()))
                    ? 'text-amber-400'
                    : 'text-blue-400'
                }`} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Pull Up Listing 🚀</h3>
                <p className="text-xs text-xsm-light-gray truncate max-w-[260px]">"{channel.name}"</p>
              </div>
            </div>

            <div className="p-5">
              {/* VIP benefit callout */}
              {Boolean((user as any)?.isVip || ((user as any)?.vipUntil && new Date((user as any).vipUntil) > new Date())) && (
                <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-amber-950/60 to-xsm-dark-gray border border-amber-500/40 flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <p className="text-amber-300 text-xs font-medium">
                    <span className="font-bold">VIP Benefit:</span> Your bump cooldown is <span className="text-amber-400 font-black">3 days</span> instead of 4
                  </p>
                </div>
              )}

              {/* Check if ad can be pulled or is on cooldown */}
              {!pullCooldown.canPull ? (
                /* Show countdown if on cooldown */
                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-300 mb-3">
                    <Clock className="w-4 h-4 text-red-400" />
                    <span className="font-medium">Pull-up available in:</span>
                  </div>
                  <div className="flex items-center justify-center gap-3 font-mono bg-xsm-black/60 rounded-xl p-4 border border-xsm-medium-gray/30 mb-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-400">
                        {pullCooldown.remainingTime?.days || 0}
                      </div>
                      <div className="text-gray-500 text-xs">days</div>
                    </div>
                    <div className="text-gray-600 text-xl">:</div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-400">
                        {String(pullCooldown.remainingTime?.hours || 0).padStart(2, '0')}
                      </div>
                      <div className="text-gray-500 text-xs">hrs</div>
                    </div>
                    <div className="text-gray-600 text-xl">:</div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-400">
                        {String(pullCooldown.remainingTime?.minutes || 0).padStart(2, '0')}
                      </div>
                      <div className="text-gray-500 text-xs">min</div>
                    </div>
                    <div className="text-gray-600 text-xl">:</div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">
                        {String(pullCooldown.remainingTime?.seconds || 0).padStart(2, '0')}
                      </div>
                      <div className="text-gray-500 text-xs">sec</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    You can bump this listing again after {
                      Boolean((user as any)?.isVip || ((user as any)?.vipUntil && new Date((user as any).vipUntil) > new Date())) ? 3 : 4
                    } days.
                  </p>
                </div>
              ) : (
                /* Show confirmation if can be pulled */
                <div>
                  <p className="text-gray-300 text-sm mb-2">
                    Are you sure you want to pull up this listing? It will appear at the top of the marketplace.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3 mt-5">
                <button
                  onClick={() => setShowPullModal(false)}
                  className="flex-1 px-4 py-2 bg-xsm-black text-gray-300 rounded-xl hover:bg-xsm-medium-gray transition-colors border border-xsm-medium-gray/50 cursor-pointer"
                >
                  Close
                </button>
                {pullCooldown.canPull && (
                  <button
                    onClick={confirmPullUp}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-500 via-xsm-yellow to-yellow-400 text-xsm-black font-bold rounded-xl hover:brightness-110 transition-all cursor-pointer shadow-lg"
                  >
                    Pull Up
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-xsm-dark-gray rounded-xl p-8 max-w-md w-full border border-xsm-medium-gray shadow-2xl">
            <div className="flex items-center justify-center w-16 h-16 bg-red-500/10 rounded-full mx-auto mb-6">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-3 text-center">Delete Listing?</h3>
            <p className="text-xsm-light-gray text-center mb-8">
              This action cannot be undone. Your listing will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-6 py-3 bg-xsm-medium-gray text-white rounded-lg hover:bg-xsm-light-gray transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Listing Modal */}
      {showEditModal && channel && (
        <EditListingModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onUpdate={() => {
            setShowEditModal(false);
            fetchAdDetails();
          }}
          ad={{
            id: Number(channel.id),
            title: channel.name,
            platform: channel.platform,
            category: channel.category,
            price: channel.price,
            subscribers: channel.subscribers,
            isMonetized: channel.monetized,
            status: 'active',
            views: channel.views,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            channelUrl: channel.channelUrl,
            description: channel.description,
            contentType: channel.contentType,
            incomeDetails: channel.incomeDetails || '',
            promotionDetails: channel.promotionDetails || '',
            preferredPaymentMethods: channel.preferredPaymentMethods || [],
            thumbnail: channel.thumbnail === '/default-thumbnail.jpg' ? '' : channel.thumbnail,
            screenshots: channel.screenshots || [],
            tags: []
          }}
        />
      )}

      {/* Pin Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-xsm-dark-gray rounded-xl p-8 max-w-md w-full border border-xsm-medium-gray shadow-2xl">
            <div className="flex items-center justify-center w-16 h-16 bg-orange-500/10 rounded-full mx-auto mb-6">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-3 text-center">
              {isPinned ? 'Unpin Listing?' : 'Pin Listing?'}
            </h3>
            <p className="text-xsm-light-gray text-center mb-8">
              {isPinned 
                ? 'Your listing will be unpinned and return to normal order.' 
                : 'Your listing will be pinned to the top of your profile for better visibility.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPinModal(false)}
                className="flex-1 px-6 py-3 bg-xsm-medium-gray text-white rounded-lg hover:bg-xsm-light-gray transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmPin}
                className={`flex-1 px-6 py-3 ${isPinned ? 'bg-gray-500 hover:bg-gray-600' : 'bg-orange-500 hover:bg-orange-600'} text-white rounded-lg transition-colors font-medium`}
              >
                {isPinned ? 'Unpin' : 'Pin'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Screenshot Lightbox */}
      {activeScreenshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 backdrop-blur-md p-4"
          onClick={() => setActiveScreenshot(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button — glass-morphism style */}
            <button
              onClick={() => setActiveScreenshot(null)}
              aria-label="Close screenshot preview"
              className="
                absolute top-3 right-3 z-20
                w-10 h-10
                flex items-center justify-center
                rounded-full
                bg-white/10 backdrop-blur-lg
                border border-white/20
                text-white
                shadow-[0_4px_24px_rgba(0,0,0,0.5)]
                hover:bg-white/20 hover:border-white/40
                hover:shadow-[0_0_0_3px_rgba(255,255,255,0.15)]
                active:scale-90
                transition-all duration-200
              "
            >
              <X className="w-5 h-5" strokeWidth={2.5} />
            </button>
            <img
              src={activeScreenshot}
              alt="Screenshot fullscreen"
              className="max-w-full max-h-[88vh] object-contain rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] border border-white/10"
            />
          </div>
          <p className="absolute bottom-5 text-white/30 text-xs tracking-wide select-none">
            Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-white/50 font-mono text-[10px]">Esc</kbd> or click outside to close
          </p>
        </div>
      )}

      {/* Payment Methods Popup Modal */}
      {showPaymentModal && channel?.preferredPaymentMethods && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowPaymentModal(false)}
        >
          <div
            className="relative bg-xsm-dark-gray border border-xsm-medium-gray/50 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-xsm-medium-gray/30 bg-xsm-black/40">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-xsm-yellow" />
                <h3 className="text-white font-bold text-base">All Payment Methods</h3>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white transition-all"
                aria-label="Close payment methods modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Methods list */}
            <div className="p-5">
              <p className="text-xsm-light-gray text-xs mb-3">
                This seller accepts the following payment methods:
              </p>
              <div className="flex flex-wrap gap-2">
                {channel.preferredPaymentMethods.map((pm, idx) => (
                  <span
                    key={idx}
                    className="bg-xsm-black/80 text-white border border-xsm-medium-gray/40 text-sm font-medium px-3 py-1.5 rounded-lg shadow-sm"
                  >
                    {pm}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdDetails;