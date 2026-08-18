import { getImageUrl } from '../config/api';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllAds } from '../services/ads';
import { Star, Users, DollarSign, Shield, X, CreditCard, MessageCircle, Crown } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import DealCreationModal from './DealCreationModal';
import { generateAdSlug } from '@/utils/idEncoder';

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
    isVip?: boolean;
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
  const navigate = useNavigate();

  const navigateToDetail = (ad: Ad, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const slug = generateAdSlug(ad.id, ad.title);
    navigate(`/ad/${slug}`);
  };

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
          // Ensure data types are consistent and preserve VIP flags
          const formattedAds = response.ads.map((ad: any) => ({
            ...ad,
            id: Number(ad.id),
            isVip: Boolean(ad.isVip || ad.seller_isVip || ad.seller?.isVip),
            seller_isVip: Boolean(ad.isVip || ad.seller_isVip || ad.seller?.isVip),
            seller: {
              id: Number(ad.seller?.id || ad.User?.id || 0),
              username: ad.seller?.username || ad.User?.username || 'Anonymous',
              profilePicture: ad.seller?.profilePicture || ad.User?.profilePicture || '',
              isVip: Boolean(ad.seller?.isVip || ad.isVip || ad.seller_isVip),
              vipUntil: ad.seller?.vipUntil || null
            }
          }));
          
          // Sort: pinned first, then newest first by createdAt
          formattedAds.sort((a: any, b: any) => {
            if (b.pinned !== a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });

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
        (ad.title || '').toLowerCase().includes(query) ||
        (ad.category || '').toLowerCase().includes(query) ||
        (ad.description || '').toLowerCase().includes(query)
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

    // Always keep newest-first order (pinned first, then by createdAt DESC)
    filtered.sort((a: any, b: any) => {
      if (b.pinned !== a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

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
    const p = platform?.toLowerCase() || '';

    const icons: Record<string, JSX.Element> = {
      youtube: (
        <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#FF0000" xmlns="http://www.w3.org/2000/svg">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      ),
      instagram: (
        <svg viewBox="0 0 24 24" className="w-7 h-7" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
              <stop offset="0%" stopColor="#fdf497"/>
              <stop offset="5%" stopColor="#fdf497"/>
              <stop offset="45%" stopColor="#fd5949"/>
              <stop offset="60%" stopColor="#d6249f"/>
              <stop offset="90%" stopColor="#285AEB"/>
            </radialGradient>
          </defs>
          <path fill="url(#ig-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      ),
      facebook: (
        <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
      twitter: (
        <svg viewBox="0 0 24 24" className="w-7 h-7" fill="white" xmlns="http://www.w3.org/2000/svg">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
      tiktok: (
        <svg viewBox="0 0 24 24" className="w-7 h-7" fill="white" xmlns="http://www.w3.org/2000/svg">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
        </svg>
      ),
    };

    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 shadow-lg">
        {icons[p] || (
          <span className="text-[10px] font-black text-white uppercase tracking-tight">{platform?.slice(0,2)}</span>
        )}
      </div>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {displayAds.map((ad) => {
          const isVipListing = Boolean(
            ad.seller?.isVip ||
            (ad as any).seller_isVip ||
            (ad as any).sellerIsVip ||
            (ad as any).isVip ||
            (ad.seller?.vipUntil && new Date(ad.seller.vipUntil) > new Date()) ||
            ((ad as any).seller_vipUntil && new Date((ad as any).seller_vipUntil) > new Date())
          );

          return (
            <div 
              key={ad.id} 
              className={`xsm-card !p-3 group transition-all duration-300 cursor-pointer h-full flex flex-col relative overflow-hidden ${
                isVipListing
                  ? 'border-2 border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:shadow-[0_0_28px_rgba(245,158,11,0.45)] bg-gradient-to-b from-amber-950/20 via-xsm-dark-gray to-xsm-dark-gray'
                  : ''
              }`}
              onClick={() => onShowMore(ad)}
            >
              {/* Thumbnail */}
              <div 
                className="relative h-36 bg-gradient-to-br from-xsm-medium-gray to-xsm-dark-gray rounded-lg mb-2.5 overflow-hidden group/image cursor-pointer"
                onClick={(e) => navigateToDetail(ad, e)}
              >
                <div className="w-full h-full overflow-hidden">
                  <img 
                    src={getListingImage(ad)}
                    alt={ad.title}
                    className="w-full h-full object-contain bg-black transition-all duration-500 ease-in-out p-2"
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

                {/* Premium/Verified/VIP Badges */}
                <div className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1">
                  {isVipListing && (
                    <span
                      className="flex items-center justify-center w-7 h-7 rounded-full shadow-lg border border-yellow-300/60"
                      style={{ background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 60%, #FF8C00 100%)' }}
                      title="VIP Listing"
                    >
                      <Crown className="w-3.5 h-3.5 fill-black text-black" />
                    </span>
                  )}
                  <div className="flex space-x-1">
                    {ad.verified && (
                      <span className="bg-blue-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                        ✓ VERIFIED
                      </span>
                    )}
                    {ad.premium && (
                      <span className="xsm-badge-premium">PREMIUM</span>
                    )}
                  </div>
                </div>

              </div>

            {/* Content */}
            <div className="space-y-1.5 flex flex-col flex-1">
              <div className="flex items-start justify-between gap-2">
                {/* Clickable title */}
                <h3
                  className="text-white font-semibold text-sm line-clamp-1 group-hover:text-xsm-yellow transition-colors flex-1 cursor-pointer hover:underline"
                  onClick={(e) => navigateToDetail(ad, e)}
                >
                  {ad.title}
                </h3>
                <div className="text-green-400 font-bold whitespace-nowrap text-sm">
                  {formatPrice(ad.price)}
                </div>
              </div>

              {/* Stats */}
              <div className="flex flex-col gap-0.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 font-medium">Category:</span>
                  <span className="text-xsm-light-gray truncate">{ad.category}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 font-medium">Subscribers:</span>
                  <span className="text-white">{formatNumber(ad.subscribers)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 font-medium">Monetization:</span>
                  <span className={`font-semibold ${ad.isMonetized ? 'text-green-400' : 'text-red-400'}`}>
                    {ad.isMonetized ? 'YES' : 'NO'}
                  </span>
                </div>
                {ad.monthlyIncome > 0 && (
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-3 h-3 text-green-400" />
                    <span className="text-green-400 text-xs">{formatPrice(ad.monthlyIncome)}/mo</span>
                  </div>
                )}
              </div>

              {/* Seller info — Profile Picture + Username → Seller Profile */}
              <div
                className="flex items-center gap-1.5 pt-1.5 border-t border-xsm-medium-gray/30 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/u/${ad.seller.username}`);
                }}
                title={`View ${ad.seller.username}'s profile`}
              >
                {/* Seller Profile Picture → Seller Profile */}
                <div className="w-7 h-7 rounded-full overflow-hidden border border-xsm-medium-gray/40 flex-shrink-0 hover:ring-2 hover:ring-xsm-yellow/60 transition-all duration-200">
                  {ad.seller.profilePicture ? (
                    <img
                      src={getImageUrl(ad.seller.profilePicture) || ad.seller.profilePicture}
                      alt={ad.seller.username}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/images/logo.png'; }}
                    />
                  ) : (
                    <div className="w-full h-full bg-xsm-medium-gray flex items-center justify-center text-xsm-light-gray text-xs font-bold">
                      {ad.seller.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                {/* Seller Username → Seller Profile */}
                <span className="text-xsm-light-gray text-xs hover:text-xsm-yellow hover:underline transition-colors truncate flex items-center gap-1">
                  {ad.seller.username}
                  {Boolean(ad.seller?.isVip || (ad as any).seller_isVip || (ad as any).sellerIsVip || (ad as any).isVip) && <Crown className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="mt-auto w-full pt-1.5">
                <button
                  onClick={(e) => handlePurchase(ad, e)}
                  className="w-full bg-xsm-yellow text-black py-2 rounded-lg hover:bg-yellow-500 transition-colors font-semibold text-sm"
                >
                  Make Purchase
                </button>
              </div>
            </div>
          </div>
        );
      })}
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
