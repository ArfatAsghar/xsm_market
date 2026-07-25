import React, { useState, useEffect, cloneElement } from 'react';
import { useNavigate } from 'react-router-dom';
import ChannelCard from '../components/ChannelCard';
import AdList from '../components/AdList';
import AuthWidget from '../components/AuthWidget';
import { TrendingUp, Zap, Shield, Search, Check, Sliders } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { useToast } from "@/components/ui/use-toast";
import { getAllAds } from '../services/ads';
import { generateAdSlug } from '@/utils/idEncoder';

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
  primary_image?: string;
  additional_images?: any[];
  screenshots?: any[];
  monetized: boolean;
  earningMethods?: string[];
  promotionStrategies?: string[];
  seller: {
    id: number;
    name: string;
    rating: number;
    sales: number;
  };
}

interface HomeProps {
  // No longer need setCurrentPage
}

const Home: React.FC<HomeProps> = () => {
  const navigate = useNavigate();
  const [showAuthWidget, setShowAuthWidget] = useState(false);
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('All Platforms');
  const [monetizationEnabled, setMonetizationEnabled] = useState(false);
  const [subscriberRange, setSubscriberRange] = useState({ min: '', max: '' });
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [incomeRange, setIncomeRange] = useState({ min: '', max: '' });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Add debug logging
  console.log('🏠 Home component rendering, isLoggedIn:', isLoggedIn);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showBackToTop, setShowBackToTop] = useState(false);
  
  // Add scroll event listener to show/hide back to top button
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Category and type options
  const categories = [
    "Cars & Bikes", 
    "Luxury & Motivation", 
    "Pets & Animals", 
    "Games",
    "Movies & Music", 
    "Fashion & Style", 
    "Education & Q&A",
    "Food",
    "Nature & Travel", 
    "Fitness & Sports", 
    "Models & Celebs",
    "Reviews & How-To", 
    "YT Shorts & FB Reels",
    "Crypto & NFT",
    "Cartoon & Funny",
    "Religious & Spiritual"
  ];
  
  const channelTypes = ['Non Monitied', 'Premium', 'Monetized', 'New'];

  interface FilterOptions {
    categories: string[];
    subscriberRange: { min: string; max: string };
    priceRange: { min: string; max: string };
    incomeRange: { min: string; max: string };
    types: string[];
  }

  // Toggle a category selection
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category) 
        : [...prev, category]
    );
  };

  // Toggle a type filter selection
  const toggleType = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type) 
        : [...prev, type]
    );
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedPlatform('All Platforms');
    setMonetizationEnabled(false);
    setSubscriberRange({ min: '', max: '' });
    setPriceRange({ min: '', max: '' });
    setIncomeRange({ min: '', max: '' });
    setSelectedCategories([]);
    setSelectedTypes([]);
    
    // Hide search bar and advanced filters after clearing
    setShowSearchBar(false);
    setShowAdvancedFilters(false);
  };

  const handleShowMore = (item: any) => {
    if (!isLoggedIn) {
      toast({
        title: "Login Required",
        description: "Please log in to view channel details",
        className: "bg-amber-500 text-white",
      });
      
      setShowAuthWidget(true);
      return;
    }
    
    // Navigate to the individual ad page with encoded ID
    const adId = parseInt(item.id?.toString() || item.id);
    const adTitle = item.title || item.name || 'channel';
    
    console.log('Navigating to ad:', { adId, adTitle, item });
    
    const slug = generateAdSlug(adId, adTitle);
    console.log('Generated slug:', slug);
    
    navigate(`/ad/${slug}`);
  };

  // Apply filters when any filter criteria changes
  // Filter logic has been delegated directly to AdList component
  
  // Platform data with SVG logos
  const platforms = [
    {
      id: 'all',
      name: 'All Platforms',
      logo: null
    },
    {
      id: 'youtube',
      name: 'YouTube',
      logo: (
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      )
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      logo: (
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
        </svg>
      )
    },
    {
      id: 'twitter',
      name: 'Twitter',
      logo: (
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
        </svg>
      )
    },
    {
      id: 'instagram',
      name: 'Instagram',
      logo: (
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
        </svg>
      )
    },
    {
      id: 'facebook',
      name: 'Facebook',
      logo: (
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      )
    },
    {
      id: 'telegram',
      name: 'Telegram',
      logo: (
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      )
    }
  ];



  return (
    <>
      {showAuthWidget && (
        <AuthWidget 
          onClose={() => setShowAuthWidget(false)} 
          onNavigate={(page) => {
            navigate(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
      <div className="min-h-screen bg-gradient-to-b from-xsm-black to-xsm-dark-gray">
        {/* Main content area */}
        <div className="flex-grow">
          {/* Search & Filter Section */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-10">
            <div className="bg-xsm-dark-gray rounded-lg p-6 mb-8 shadow-lg border border-xsm-medium-gray/30 relative overflow-hidden">
            {/* Fade gradient effect for search section */}
            <div className="absolute inset-0 bg-gradient-radial from-xsm-yellow/10 via-xsm-dark-gray/80 to-xsm-dark-gray pointer-events-none"></div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {!showSearchBar ? (
                    <button 
                      className="w-11 h-11 p-2.5 rounded-xl bg-gradient-to-r from-yellow-400 via-xsm-yellow to-amber-500 text-black shadow-md hover:brightness-110 border border-yellow-300/40 flex items-center justify-center transition-all shrink-0 cursor-pointer"
                      onClick={() => setShowSearchBar(true)}
                      title="Show Search"
                    >
                      <Search className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  ) : (
                    <>
                      <button 
                        className="w-11 h-11 p-2.5 rounded-xl bg-gradient-to-r from-yellow-400 via-xsm-yellow to-amber-500 text-black shadow-md hover:brightness-110 border border-yellow-300/40 flex items-center justify-center transition-all shrink-0 cursor-pointer"
                        onClick={() => setShowSearchBar(false)}
                        title="Hide Search"
                      >
                        <Search className="w-5 h-5 stroke-[2.5]" />
                      </button>
                      
                      <button 
                        className="w-11 h-11 p-2.5 rounded-xl bg-gradient-to-r from-yellow-400 via-xsm-yellow to-amber-500 text-black shadow-md hover:brightness-110 border border-yellow-300/40 flex items-center justify-center transition-all shrink-0 cursor-pointer"
                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        title="Advanced Filters"
                      >
                        <Sliders className="w-5 h-5 stroke-[2.5]" />
                      </button>
                    </>
                  )}
                </div>
                {showSearchBar && (
                  <button 
                    onClick={clearAllFilters}
                    className="text-sm text-xsm-light-gray hover:text-xsm-yellow transition-colors font-medium"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
              
              {showSearchBar && (
                <>
                  {/* Platform quick filter buttons */}
                  <div className="flex flex-wrap items-center gap-3 mb-5 py-2">
                    <span className="text-sm text-white mr-2 font-medium">Quick Filter:</span>
                    {platforms.filter(p => p.id !== 'all' && p.id !== 'telegram').map(platform => {
                      const isYouTube = platform.id === 'youtube';

                      return (
                        <div key={platform.id} className="relative group/platform">
                          <button
                            onClick={() => {
                              if (isYouTube) {
                                setSelectedPlatform(platform.name);
                              } else {
                                toast({
                                  title: `${platform.name} — Coming Soon`,
                                  description: "Invalid URL. Currently, only YouTube URLs are supported.",
                                });
                              }
                            }}
                            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all border-2 shadow-lg relative ${
                              selectedPlatform === platform.name 
                                ? 'bg-xsm-yellow text-black border-xsm-yellow ring-2 ring-xsm-yellow ring-offset-2 ring-offset-xsm-dark-gray' 
                                : isYouTube
                                ? 'bg-xsm-black text-xsm-yellow border-xsm-yellow/50 hover:bg-xsm-yellow/10 hover:border-xsm-yellow'
                                : 'bg-xsm-black/50 text-gray-500 border-gray-700/50 hover:border-gray-500 opacity-70'
                            }`}
                            title={isYouTube ? platform.name : `${platform.name} (Coming Soon)`}
                          >
                            {platform.logo && cloneElement(platform.logo as React.ReactElement, { className: "w-6 h-6" })}
                            {!isYouTube && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border border-xsm-black"></span>
                            )}
                          </button>
                        </div>
                      );
                    })}
                    <button
                      onClick={() => setSelectedPlatform('All Platforms')}
                      className={`text-xs py-2 px-4 rounded-full border-2 shadow-md transition-all ${
                        selectedPlatform === 'All Platforms' 
                          ? 'bg-xsm-yellow text-black border-xsm-yellow font-bold' 
                          : 'bg-xsm-black text-white border-xsm-yellow/50 hover:bg-xsm-yellow/10 hover:border-xsm-yellow hover:text-xsm-yellow'
                      }`}
                    >
                      All Platforms
                    </button>
                  </div>
                
                  <div className="grid grid-cols-1 items-end">
                    {/* Main search */}
                    <div className="w-full">
                      <label className="block text-white font-medium mb-2">Search by name or category</label>
                      <div className="relative flex items-center">
                        <Search className="absolute left-3.5 w-5 h-5 text-xsm-yellow pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search channels..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="xsm-input w-full pl-11 pr-4 py-3 rounded-xl border border-xsm-medium-gray/40 bg-xsm-black/70 text-white placeholder-xsm-light-gray focus:border-xsm-yellow transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
              
              {/* Basic Range Filters - shown when either search bar or advanced filters are visible */}
              {(showSearchBar || showAdvancedFilters) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-xsm-light-gray text-sm mb-1">Subscribers</label>
                    <div className="grid grid-cols-2 gap-4">
                      <input 
                        type="number" 
                        placeholder="Min" 
                        className="xsm-input" 
                        value={subscriberRange.min}
                        onChange={(e) => setSubscriberRange(prev => ({ ...prev, min: e.target.value }))}
                      />
                      <input 
                        type="number" 
                        placeholder="Max" 
                        className="xsm-input" 
                        value={subscriberRange.max}
                        onChange={(e) => setSubscriberRange(prev => ({ ...prev, max: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xsm-light-gray text-sm mb-1">Price ($)</label>
                    <div className="grid grid-cols-2 gap-4">
                      <input 
                        type="number" 
                        placeholder="Min" 
                        className="xsm-input" 
                        value={priceRange.min}
                        onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                      />
                      <input 
                        type="number" 
                        placeholder="Max" 
                        className="xsm-input" 
                        value={priceRange.max}
                        onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Advanced filters */}
              {showAdvancedFilters && (
                <div className="mt-6 pt-6 border-t border-xsm-medium-gray/30">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Categories */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-white font-medium">Categories</h3>
                        {selectedCategories.length > 0 && (
                          <button 
                            onClick={() => setSelectedCategories([])}
                            className="text-xs text-xsm-light-gray hover:text-xsm-yellow transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {categories.map((category) => (
                          <label key={category} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedCategories.includes(category)}
                              onChange={() => toggleCategory(category)}
                              className="hidden"
                            />
                            <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                              selectedCategories.includes(category)
                                ? 'bg-xsm-yellow border-xsm-yellow'
                                : 'border-xsm-light-gray'
                            }`}>
                              {selectedCategories.includes(category) && (
                                <Check className="w-3 h-3 text-xsm-black" />
                              )}
                            </div>
                            <span className="text-white text-sm">{category}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    {/* Channel Types */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-white font-medium">Channel Type</h3>
                        {selectedTypes.length > 0 && (
                          <button 
                            onClick={() => setSelectedTypes([])}
                            className="text-xs text-xsm-light-gray hover:text-xsm-yellow transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {channelTypes.map((type) => (
                          <label key={type} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedTypes.includes(type)}
                              onChange={() => toggleType(type)}
                              className="hidden"
                            />
                            <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                              selectedTypes.includes(type)
                                ? 'bg-xsm-yellow border-xsm-yellow'
                                : 'border-xsm-light-gray'
                            }`}>
                              {selectedTypes.includes(type) && (
                                <Check className="w-3 h-3 text-xsm-black" />
                              )}
                            </div>
                            <span className="text-white text-sm">{type}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Main Content */}
          <div className="w-full">
            {/* Ad List - Using real database data with filters */}
            <AdList 
              onShowMore={handleShowMore} 
              onNavigateToChat={() => navigate('/chat')}
              // Pass all the filter states to AdList
              searchQuery={searchQuery}
              selectedPlatform={selectedPlatform}
              selectedCategories={selectedCategories}
              selectedTypes={selectedTypes}
              subscriberRange={subscriberRange}
              priceRange={priceRange}
              incomeRange={incomeRange}
              monetizationEnabled={monetizationEnabled}
            />
          </div>
        </div>
        
        {/* Modal removed - now using individual ad pages */}
        
        {/* Fixed back to top button */}
        {showBackToTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-8 left-8 bg-xsm-yellow text-black rounded-full p-3 shadow-lg hover:bg-yellow-500 transition-colors z-50 animate-fade-in"
            aria-label="Back to top"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        )}
        </div>

        {/* Home Marketing Section (above global footer) */}
        <footer className="bg-gradient-to-r from-xsm-black via-xsm-dark-gray to-xsm-black py-16 pb-8 mt-auto border-t border-xsm-medium-gray/30 relative w-full">
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Hero Section */}
            <div className="text-center mb-12">
              <div className="space-y-8 mb-12">
                {/* Main title with gradient effect */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-radial from-xsm-yellow/20 via-transparent to-transparent opacity-75 blur-xl"></div>
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white relative z-10 tracking-tight">
                    XSM-Market is a versatile platform for secure social media account transactions
                  </h1>
                </div>

                {/* Main description with gradient background */}
                <div className="relative max-w-3xl mx-auto">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-xsm-yellow/5 to-transparent"></div>
                  <p className="text-base md:text-lg text-xsm-light-gray py-4 px-6 relative z-10">
                    XSM-Market is your trusted platform for securely making deals between sellers and buyers of all kinds of social media accounts.
                  </p>
                </div>

                {/* Buyer & Seller Benefits */}
                <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                  <div className="bg-xsm-black/50 p-6 rounded-lg border border-xsm-medium-gray/30">
                    <h3 className="text-xl font-medium text-xsm-yellow mb-3">For Buyers</h3>
                    <p className="text-white">
                      We guarantee the transfer of your new channel to you or your money back. Our website agent service ensures your investment is protected.
                    </p>
                  </div>
                  <div className="bg-xsm-black/50 p-6 rounded-lg border border-xsm-medium-gray/30">
                    <h3 className="text-xl font-medium text-xsm-yellow mb-3">For Sellers</h3>
                    <p className="text-white">
                      You can be sure that you either get your agreed upon payment, or your channel will be returned to you. Our platform ensures secure transactions.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Features Section - Simple Row */}
              <div className="flex flex-wrap justify-center gap-8 text-sm mt-12">
                <div className="flex items-center space-x-2 text-white">
                  <Shield className="w-5 h-5 text-xsm-yellow" />
                  <span>Secure Website Agent</span>
                </div>
                <div className="flex items-center space-x-2 text-white">
                  <TrendingUp className="w-5 h-5 text-xsm-yellow" />
                  <span>Verified Growth</span>
                </div>
                <div className="flex items-center space-x-2 text-white">
                  <Zap className="w-5 h-5 text-xsm-yellow" />
                  <span>Instant Transfers</span>
                </div>
              </div>
            </div>
            
            {/* Supported Platforms section removed as requested */}
            
            {/* No navigation links or copyright here - those are in the global footer */}
          </div>
        </footer>
      </div>
    </>
  );
};

export default Home;
