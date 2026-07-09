import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, ShoppingCart } from 'lucide-react';
import { encodeId } from '@/utils/idEncoder';
import { getImageUrl } from '@/config/api';

// Get API URL from environment variables
const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://xsmmarket.com/api');
};

const API_URL = getApiUrl();

interface PublicAd {
  id: number;
  title: string;
  platform: string;
  category: string;
  price: number;
  subscribers: number;
  monthlyIncome: number;
  isMonetized: boolean;
  createdAt: string;
  images?: string[];
  screenshots?: any[];
  thumbnail?: string;
  description?: string;
}

interface PublicAdListProps {
  userId: string;
  username: string;
}

const PublicAdList: React.FC<PublicAdListProps> = ({ userId, username }) => {
  const navigate = useNavigate();
  const [ads, setAds] = useState<PublicAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicAds();
  }, [userId]);

  const fetchPublicAds = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/ads/user/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch listings');
      }

      const data = await response.json();

      if (data.success) {
        setAds(data.data || []);
      } else {
        setError(data.message || 'Failed to load listings');
      }
    } catch (error) {
      console.error('Error fetching public ads:', error);
      setError('Failed to load listings');
    } finally {
      setLoading(false);
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

  const formatSubscribers = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }

    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }

    return count.toString();
  };

  const getPlatformIconSmall = (platform: string) => {
    const iconMap: { [key: string]: JSX.Element } = {
      youtube: (
        <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        </div>
      ),
      instagram: (
        <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
          </svg>
        </div>
      ),
      tiktok: (
        <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
          </svg>
        </div>
      ),
      facebook: (
        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        </div>
      ),
      twitter: (
        <div className="w-6 h-6 bg-blue-400 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
          </svg>
        </div>
      ),
    };

    return iconMap[platform.toLowerCase()] || (
      <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center">
        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
        </svg>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-xsm-yellow mx-auto mb-4"></div>
        <p className="text-xsm-light-gray">Loading listings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-xsm-medium-gray rounded-full flex items-center justify-center mx-auto mb-4">
          <Eye className="w-8 h-8 text-xsm-light-gray" />
        </div>
        <p className="text-red-400 mb-2">Failed to load listings</p>
        <p className="text-xsm-light-gray text-sm">{error}</p>
        <button
          type="button"
          onClick={fetchPublicAds}
          className="mt-4 bg-xsm-yellow text-black px-4 py-2 rounded-lg hover:bg-yellow-500 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (ads.length === 0) {
    return (
      <div className="text-center py-12">
        <Eye className="w-12 h-12 text-xsm-light-gray mx-auto mb-4" />
        <p className="text-xsm-light-gray text-lg mb-2">No listings yet</p>
        <p className="text-xsm-medium-gray text-sm">
          {username} hasn't created any listings yet.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {ads.map((ad) => (
        <div
          key={ad.id}
          className="bg-xsm-black/50 rounded-lg p-3 border border-xsm-medium-gray/20 shadow-sm flex flex-col items-center hover:border-xsm-yellow/30 transition-colors w-full max-w-[240px] mx-auto"
        >
          {/* Profile Picture Circle with Platform Icon */}
          <div className="relative mb-2 flex items-center">
            {/* Platform Icon on Left Side */}
            <div className="absolute -left-4 -top-0">
              {getPlatformIconSmall(ad.platform)}
            </div>

            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-xsm-medium-gray/30">
              <img
                src={getImageUrl(ad.thumbnail && String(ad.thumbnail).trim() !== '0' ? ad.thumbnail : null) || '/default-avatar.png'}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Channel Name */}
          <h4 className="text-white font-semibold text-xs text-center mb-0.5 truncate w-full">
            {ad.title}
          </h4>

          {/* Subscribers */}
          <div className="text-center mb-0.5">
            <span className="text-blue-400 font-medium text-xs">
              Subscribers: {formatSubscribers(ad.subscribers)}
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

          {/* Requirement 16: Buy Button for Seller Profile Listings */}
          <div className="flex items-center justify-center space-x-1 mt-auto">
            <button
              type="button"
              onClick={() => navigate(`/ad/${encodeId(ad.id)}`)}
              className="bg-xsm-yellow text-black px-3 py-1.5 rounded-lg hover:bg-yellow-500 transition-colors text-xs font-medium"
            >
              <ShoppingCart className="w-3 h-3 inline mr-1" />
              Buy
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PublicAdList;