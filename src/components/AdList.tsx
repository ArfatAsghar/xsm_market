import { getImageUrl } from '../config/api';
import React, { useState, useEffect } from 'react';
import { getAllAds } from '../services/ads';
import { Star, Users, DollarSign, Shield, X, CreditCard, MessageCircle } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import DealCreationModal from './DealCreationModal';

interface Ad {
  id: number;
  title: string;
  description: string;
  platform: string;
  category: string;
  price: number;
  subscribers: number;
  monthlyIncome: number;
  isMonetized: boolean;
  views: number;
  thumbnail: string;
  primary_image?: string;
  additional_images?: any[];
  screenshots?: any[];
  verified: boolean;
  premium: boolean;
  rating: number;
  seller: {
    id: number;
    username: string;
    profilePicture: string;
  };
  createdAt: string;
}

interface AdListProps {
  onShowMore: (ad: Ad) => void;
  onNavigateToChat?: (chatId: string) => void;
  // Filter props from Home component
  searchQuery?: string;
  selectedPlatform?: string;
  selectedCategories?: string[];
  selectedTypes?: string[];
  subscriberRange?: { min: string; max: string };
  priceRange?: { min: string; max: string };
  incomeRange?: { min: string; max: string };
  monetizationEnabled?: boolean;
}

const AdList: React.FC<AdListProps> = ({ 
  onShowMore, 
  onNavigateToChat,
  searchQuery = '',
  selectedPlatform = 'All Platforms',
  selectedCategories = [],
  selectedTypes = [],
  subscriberRange = { min: '', max: '' },
  priceRange = { min: '', max: '' },
  incomeRange = { min: '', max: '' },
  monetizationEnabled = false
}) => {
  const [allAds, setAllAds] = useState<Ad[]>([]);
  const [filteredAds, setFilteredAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDealModal, setShowDealModal] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const { user, isLoggedIn } = useAuth();

  // Fetch all ads once on component mount
  useEffect(() => {
    const fetchAds = async () => {
      try {
        console.log('📡 AdList: Fetching ads...');
        setLoading(true);
        setError(null);
        
        const response = await getAllAds({
          platform: 'all',
          category: 'all',
          sortBy: 'createdAt',
          sortOrder: 'DESC'
        });
        console.log('📡 AdList: Response received:', response);
        
        if (response && response.ads) {
          // Ensure data types are consistent
          const formattedAds = response.ads.map((ad: any) => ({
            ...ad,
            id: Number(ad.id),
            seller: {
              id: Number(ad.seller?.id || ad.User?.id || 0),
              username: ad.seller?.username || ad.User?.username || 'Anonymous',
              profilePicture: ad.seller?.profilePicture || ad.User?.profilePicture || ''
            }
          }));
          
          console.log('📡 AdList: Formatted ads:', formattedAds.length);
          setAllAds(formattedAds);
        } else {
          console.warn('📡 AdList: No ads in response');
          setAllAds([]);
        }
      } catch (err: any) {
        console.error('❌ AdList: Error fetching ads:', err);
        setError(err.message || 'Failed to fetch ads');
        setAllAds([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAds();
  }, []); // Only fetch once on mount

  // Apply filters whenever filter props change
  useEffect(() => {
    console.log('🔍 AdList: Applying filters...', {
      searchQuery,
      selectedPlatform,
      selectedCategories,
      selectedTypes,
      subscriberRange,
      priceRange,
      incomeRange,
      monetizationEnabled
    });

    let filtered = [...allAds];

    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ad => 
        ad.title.toLowerCase().includes(query) ||
        ad.category.toLowerCase().includes(query) ||
        ad.description.toLowerCase().includes(query)
      );
    }

    // Apply platform filter
    if (selectedPlatform && selectedPlatform !== 'All Platforms') {
      filtered = filtered.filter(ad => 
        ad.platform.toLowerCase() === selectedPlatform.toLowerCase()
      );
    }

    // Apply category filters
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(ad => 
        selectedCategories.includes(ad.category)
      );
    }

    // Apply type filters
    if (selectedTypes.length > 0) {
      filtered = filtered.filter(ad => {
        return selectedTypes.some(type => {
          if (type === 'Non Monitied') return !ad.isMonetized;
          if (type === 'Premium') return ad.premium;
          if (type === 'Monetized') return ad.isMonetized && ad.monthlyIncome > 0;
          if (type === 'New') return true; // Would filter for new ads in a real app
          return false;
        });
      });
    }

    // Apply monetization filter
    if (monetizationEnabled) {
      filtered = filtered.filter(ad => ad.isMonetized && ad.monthlyIncome > 0);
    }

    // Subscriber range filter
    if (subscriberRange.min || subscriberRange.max) {
      filtered = filtered.filter(ad => {
        const min = subscriberRange.min ? parseInt(subscriberRange.min) : 0;
        const max = subscriberRange.max ? parseInt(subscriberRange.max) : Infinity;
        return ad.subscribers >= min && ad.subscribers <= max;
      });
    }

    // Price range filter
    if (priceRange.min || priceRange.max) {
      filtered = filtered.filter(ad => {
        const min = priceRange.min ? parseInt(priceRange.min) : 0;
        const max = priceRange.max ? parseInt(priceRange.max) : Infinity;
        return ad.price >= min && ad.price <= max;
      });
    }

    // Income range filter
    if (incomeRange.min || incomeRange.max) {
      filtered = filtered.filter(ad => {
        if (!ad.monthlyIncome) return false;
        const min = incomeRange.min ? parseInt(incomeRange.min) : 0;
        const max = incomeRange.max ? parseInt(incomeRange.max) : Infinity;
        return ad.monthlyIncome >= min && ad.monthlyIncome <= max;
      });
    }

    console.log('📊 AdList: Filtered results:', filtered.length, 'out of', allAds.length);
    setFilteredAds(filtered);
  }, [
    allAds,
    searchQuery,
    selectedPlatform,
    selectedCategories,
    selectedTypes,
    subscriberRange,
    priceRange,
    incomeRange,
    monetizationEnabled
  ]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const handlePurchase = (ad: Ad, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (!isLoggedIn) {
      alert('Please log in to start a deal');
      return;
    }
    setSelectedAd(ad);
    setShowDealModal(true);
  };

  const handleCloseDealModal = () => {
    setShowDealModal(false);
    setSelectedAd(null);
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

  const getListingImage = (ad: Ad) => {
  const primaryImage = getImageUrl(ad.primary_image || null);
  const thumbnailImage = getImageUrl(ad.thumbnail || null);

  return primaryImage || thumbnailImage || '/images/logo.png';
};
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="xsm-card animate-pulse">
            <div className="h-48 bg-xsm-medium-gray rounded mb-4"></div>
            <div className="h-4 bg-xsm-medium-gray rounded mb-2"></div>
            <div className="h-4 bg-xsm-medium-gray rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">😞</div>
        <h3 className="text-2xl font-bold text-white mb-2">Error loading ads</h3>
        <p className="text-xsm-light-gray">{error}</p>
      </div>
    );
  }

  if (allAds.length === 0 && !loading) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">📭</div>
        <h3 className="text-2xl font-bold text-white mb-2">No ads found</h3>
        <p className="text-xsm-light-gray">Be the first to create a listing!</p>
      </div>
    );
  }

  const displayAds = filteredAds.length > 0 ? filteredAds : allAds;

  if (displayAds.length === 0 && allAds.length > 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-2xl font-bold text-white mb-2">No ads match your filters</h3>
        <p className="text-xsm-light-gray">Try adjusting your search criteria</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ad Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {displayAds.map((ad) => (
          <div 
            key={ad.id} 
            className="xsm-card group transition-all duration-300 cursor-pointer h-full flex flex-col"
            onClick={() => onShowMore(ad)}
          >
            {/* Thumbnail */}
            <div className="relative h-48 bg-gradient-to-br from-xsm-medium-gray to-xsm-dark-gray rounded-lg mb-4 overflow-hidden group/image">
              <div className="w-full h-full overflow-hidden">
                <img 
  src={getListingImage(ad)}
  alt={ad.title}
  className="w-full h-full object-contain bg-black transition-all duration-500 ease-in-out p-4"
  style={{ objectPosition: 'center' }}
  onError={(e) => {
    const target = e.target as HTMLImageElement;
    target.onerror = null;
    target.src = '/images/logo.png';
  }}
/>
              </div>
              
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity duration-300"></div>
              
              {/* Platform Badge */}
              <div className="absolute top-2 left-2">
                {getPlatformIcon(ad.platform)}
              </div>

              {/* Premium/Verified Badges */}
              <div className="absolute top-2 right-2 flex space-x-1">
                {ad.verified && (
                  <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-bold">
                    ✓ VERIFIED
                  </span>
                )}
                {ad.premium && (
                  <span className="xsm-badge-premium">PREMIUM</span>
                )}
              </div>

            </div>

            {/* Content */}
            <div className="space-y-3 flex flex-col flex-1">
              <div className="flex items-start justify-between gap-4 min-h-[56px]">
                <h3 className="text-white font-semibold text-lg line-clamp-2 group-hover:text-xsm-yellow transition-colors flex-1">
                  {ad.title}
                </h3>
                <div className="text-green-400 font-bold whitespace-nowrap text-lg">
                  {formatPrice(ad.price)}
                </div>
              </div>

              {/* Stats */}
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">Category:</span>
                  <span className="text-xsm-light-gray">{ad.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">Subscribers:</span>
                  <span className="text-white">{formatNumber(ad.subscribers)}</span>
                </div>
                {/* Monetization Status */}
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">Monetization:</span>
                  <span className={`font-medium ${ad.isMonetized ? 'text-green-400' : 'text-red-400'}`}>
                    {ad.isMonetized ? 'YES' : 'NO'}
                  </span>
                </div>
                {ad.monthlyIncome > 0 && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">{formatPrice(ad.monthlyIncome)}/mo</span>
                  </div>
                )}
              </div>

              

              {/* Action Buttons */}
              <div className="mt-auto w-full pt-4">
  {/* Purchase Button */}
  <button
    onClick={(e) => handlePurchase(ad, e)}
    className="w-full bg-xsm-yellow text-black py-3 rounded-lg hover:bg-yellow-500 transition-colors font-medium"
  >
                  Make Purchase
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Deal Creation Modal */}
      {showDealModal && selectedAd && (
        <DealCreationModal
          isOpen={showDealModal}
          onClose={handleCloseDealModal}
          channelPrice={selectedAd.price}
          channelTitle={selectedAd.title}
          sellerId={selectedAd.seller.id.toString()}
          onNavigateToChat={() => onNavigateToChat && onNavigateToChat('')}
        />
      )}
    </div>
  );
};

export default AdList;
