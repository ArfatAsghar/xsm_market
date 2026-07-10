import React, { useState } from 'react';
import { Search, MoreVertical, CheckCircle, XCircle, AlertCircle, Eye, MessageCircle, Flag, Trash, X, Star, Users, DollarSign, Shield } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAllAds } from '@/services/ads';
import { useAuth } from '@/context/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { deleteListing } from '@/services/admin';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://xsmmarket.com/api');

// Helper function to get proper image URL (same as AdList.tsx)
const getImageUrl = (ad: any) => {
  return ad.primary_image || 
         (ad.screenshots && ad.screenshots.length > 0 ? ad.screenshots[0].url || ad.screenshots[0] : null) || 
         ad.thumbnail || 
         '/placeholder.svg';
};

interface Listing {
  id: number;
  title: string;
  seller: string;
  sellerId: number;
  sellerUsername: string;
  price: string;
  priceNumber: number;
  category: string;
  platform: string;
  description: string;
  subscribers: number;
  monthlyIncome: number;
  views: number;
  status: 'active' | 'pending' | 'rejected' | 'reported';
  createdAt: string;
  reportCount: number;
  thumbnail: string;
  primary_image?: string;
  additional_images?: any[];
  screenshots?: any[];
  verified: boolean;
  premium: boolean;
  isMonetized: boolean;
}

const ReviewListings: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  
  const { isLoggedIn, user } = useAuth();
  const { toast } = useToast();

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    getAllAds()
      .then((data) => {
        // Map backend ads to Listing interface
        const mapped = (data.ads || []).map(ad => ({
          id: ad.id,
          title: ad.title,
          seller: ad.seller?.username || 'Unknown',
          sellerId: ad.seller?.id || ad.User?.id || 0,
          sellerUsername: ad.seller?.username || ad.User?.username || 'Unknown',
          price: ad.price ? `$${ad.price}` : '',
          priceNumber: ad.price || 0,
          category: ad.category || 'Other',
          platform: ad.platform || 'Unknown',
          description: ad.description || '',
          subscribers: ad.subscribers || 0,
          monthlyIncome: ad.monthlyIncome || 0,
          views: ad.views || 0,
          status: ad.status || 'active',
          createdAt: ad.createdAt ? ad.createdAt.split('T')[0] : '',
          reportCount: ad.reportCount || 0,
          thumbnail: ad.thumbnail || '/placeholder.svg',
          primary_image: ad.primary_image,
          additional_images: ad.additional_images,
          screenshots: ad.screenshots,
          verified: ad.verified || false,
          premium: ad.premium || false,
          isMonetized: ad.isMonetized || false,
        }));
        setListings(mapped);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch listings');
        setLoading(false);
      });
  }, []);

  const handleViewDetails = (listing: Listing) => {
    setSelectedListing(listing);
    setShowDetailsModal(true);
  };

  const handleContactSeller = async (listing: Listing) => {
    if (!isLoggedIn || !user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please log in to contact the seller",
      });
      return;
    }

    if (String(user.id) === String(listing.sellerId)) {
      toast({
        variant: "destructive",
        title: "Invalid Action",
        description: "You can't contact yourself",
      });
      return;
    }

    try {
      setIsCreatingChat(true);
      const token = localStorage.getItem('token');
      
      // First, check if a chat already exists with this seller
      const checkChatResponse = await fetch(`${API_URL}/chat/check-existing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sellerId: listing.sellerId,
          adId: listing.id
        })
      });

      if (!checkChatResponse.ok) {
        throw new Error(`HTTP error! status: ${checkChatResponse.status}`);
      }

      const checkResult = await checkChatResponse.json();
      
      if (checkResult.exists) {
        toast({
          title: "Chat Exists",
          description: "A chat with this seller already exists. Redirecting to chat...",
        });
        // You can add navigation to chat here if needed
        return;
      }

      // No existing chat, create a new one with initial message
      const response = await fetch(`${API_URL}/chat/ad-inquiry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          adId: listing.id,
          sellerId: listing.sellerId,
          message: `This is admin of the website and regarding this message I am contacting`,
          sellerName: listing.sellerUsername
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Chat creation failed:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const chat = await response.json();
      
      toast({
        title: "Chat Created",
        description: "Successfully created chat with seller. You can now communicate directly.",
      });
      
    } catch (error) {
      console.error('Error creating chat:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create chat with seller",
      });
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleDeleteListing = async (listing: Listing) => {
    const confirmed = window.confirm(
      `⚠️ DELETE CONFIRMATION ⚠️\n\n` +
      `Are you sure you want to permanently delete this listing?\n\n` +
      `Title: "${listing.title}"\n` +
      `Seller: ${listing.sellerUsername}\n` +
      `Price: ${listing.price}\n\n` +
      `This action cannot be undone and will permanently remove the listing from the database.`
    );
    
    if (!confirmed) {
      return;
    }

    try {
      await deleteListing(listing.id);
      
      // Remove the deleted listing from the state
      setListings(prevListings => prevListings.filter(l => l.id !== listing.id));
      
      toast({
        title: "✅ Listing Deleted",
        description: `"${listing.title}" has been permanently deleted.`,
      });
      
      // Close the details modal if it's open for the deleted listing
      if (selectedListing && selectedListing.id === listing.id) {
        setShowDetailsModal(false);
        setSelectedListing(null);
      }
      
    } catch (error) {
      console.error('Error deleting listing:', error);
      toast({
        variant: "destructive",
        title: "❌ Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete listing. Please try again.",
      });
    }
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

  const filteredListings = listings.filter(listing => {
    const matchesSearch = listing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         listing.seller.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'reported':
        return <Flag className="w-5 h-5 text-yellow-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-blue-400" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-400/10 text-green-400 border-green-400/20';
      case 'rejected':
        return 'bg-red-400/10 text-red-400 border-red-400/20';
      case 'reported':
        return 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20';
      default:
        return 'bg-blue-400/10 text-blue-400 border-blue-400/20';
    }
  };

  return (
    <div className="p-6 bg-xsm-black min-h-screen">
      <div className="mb-8">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search listings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-xsm-dark-gray border border-xsm-medium-gray rounded-lg px-4 py-2 pl-10 focus:outline-none focus:border-xsm-yellow text-white"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-xsm-medium-gray" />
          </div>
        </div>

        {/* Listings Grid */}
        {loading ? (
          <div className="text-center text-xsm-light-gray py-8">Loading listings...</div>
        ) : error ? (
          <div className="text-center text-red-400 py-8">{error}</div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((listing) => (
            <div key={listing.id} className="bg-xsm-dark-gray rounded-xl border border-xsm-medium-gray overflow-hidden">
              {/* Listing Image */}
              <div className="aspect-video relative bg-xsm-medium-gray">
                <img
                  src={
                    listing.primary_image || 
                    (listing.screenshots && listing.screenshots.length > 0 ? listing.screenshots[0].url || listing.screenshots[0] : null) || 
                    listing.thumbnail || 
                    '/placeholder.svg'
                  }
                  alt={listing.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.src = '/placeholder.svg';
                  }}
                />
                {listing.reportCount > 0 && (
                  <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {listing.reportCount} reports
                  </div>
                )}
              </div>

              {/* Listing Details */}
              <div className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-medium text-white mb-1">{listing.title}</h3>
                    <p className="text-sm text-xsm-light-gray">by {listing.seller}</p>
                  </div>
                  <span className="text-xsm-yellow font-medium">{listing.price}</span>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-xsm-light-gray">{listing.category}</span>
                  <span className="text-sm text-xsm-light-gray">{listing.createdAt}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm border ${getStatusBadgeClass(listing.status)}`}>
                    {getStatusIcon(listing.status)}
                    <span className="ml-2 capitalize">{listing.status}</span>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger className="p-2 hover:bg-xsm-medium-gray rounded-lg transition-colors">
                      <MoreVertical className="h-5 w-5 text-xsm-light-gray" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-xsm-dark-gray border-xsm-medium-gray">
                      <DropdownMenuItem 
                        className="text-white hover:text-xsm-yellow cursor-pointer"
                        onClick={() => handleViewDetails(listing)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-white hover:text-xsm-yellow cursor-pointer"
                        onClick={() => handleContactSeller(listing)}
                        disabled={isCreatingChat}
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        {isCreatingChat ? 'Connecting...' : 'Contact Seller'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-red-500 hover:text-red-400 cursor-pointer"
                        onClick={() => handleDeleteListing(listing)}
                      >
                        <Trash className="w-4 h-4 mr-2" />
                        Delete Listing
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedListing && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDetailsModal(false);
            }
          }}
        >
          <div className="bg-xsm-dark-gray rounded-xl border border-xsm-medium-gray max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-xsm-dark-gray border-b border-xsm-medium-gray p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-xsm-yellow">Listing Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Image and Basic Info */}
                <div>
                  <div className="aspect-video relative bg-xsm-medium-gray rounded-lg overflow-hidden mb-6">
                    <img
                      src={
                        selectedListing.primary_image || 
                        (selectedListing.screenshots && selectedListing.screenshots.length > 0 ? selectedListing.screenshots[0].url || selectedListing.screenshots[0] : null) || 
                        selectedListing.thumbnail || 
                        '/placeholder.svg'
                      }
                      alt={selectedListing.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = '/placeholder.svg';
                      }}
                    />
                    {selectedListing.reportCount > 0 && (
                      <div className="absolute top-4 right-4 bg-red-500 text-white text-sm px-3 py-1 rounded-full">
                        {selectedListing.reportCount} reports
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-2">{selectedListing.title}</h3>
                      <div className="flex items-center justify-between mb-4">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm border ${getStatusBadgeClass(selectedListing.status)}`}>
                          {getStatusIcon(selectedListing.status)}
                          <span className="ml-2 capitalize">{selectedListing.status}</span>
                        </div>
                        <span className="text-3xl font-bold text-xsm-yellow">{selectedListing.price}</span>
                      </div>
                    </div>
                    
                    {selectedListing.description && (
                      <div>
                        <h4 className="text-lg font-semibold text-white mb-2">Description</h4>
                        <p className="text-xsm-light-gray leading-relaxed">{selectedListing.description}</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Right Column - Stats and Seller Info */}
                <div className="space-y-6">
                  {/* Stats */}
                  <div className="bg-xsm-black rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-white mb-4">Channel Statistics</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-2">
                          <Users className="w-5 h-5 text-xsm-yellow mr-2" />
                          <span className="text-xsm-light-gray">Subscribers</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{formatNumber(selectedListing.subscribers)}</div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-2">
                          <Eye className="w-5 h-5 text-xsm-yellow mr-2" />
                          <span className="text-xsm-light-gray">Views</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{formatNumber(selectedListing.views)}</div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-2">
                          <DollarSign className="w-5 h-5 text-xsm-yellow mr-2" />
                          <span className="text-xsm-light-gray">Monthly Income</span>
                        </div>
                        <div className="text-2xl font-bold text-white">${formatNumber(selectedListing.monthlyIncome)}</div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-2">
                          <Flag className="w-5 h-5 text-xsm-yellow mr-2" />
                          <span className="text-xsm-light-gray">Platform</span>
                        </div>
                        <div className="text-lg font-bold text-white capitalize">{selectedListing.platform}</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Seller Info */}
                  <div className="bg-xsm-black rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-white mb-4">Seller Information</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xsm-light-gray">Username:</span>
                        <span className="text-white font-medium">{selectedListing.sellerUsername}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xsm-light-gray">Listed Date:</span>
                        <span className="text-white">{selectedListing.createdAt}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xsm-light-gray">Category:</span>
                        <span className="text-white">{selectedListing.category}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Features */}
                  <div className="bg-xsm-black rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-white mb-4">Features</h4>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-3 ${selectedListing.verified ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                        <span className="text-white">Verified Channel</span>
                      </div>
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-3 ${selectedListing.isMonetized ? 'bg-xsm-yellow' : 'bg-gray-400'}`}></div>
                        <span className="text-white">Monetized</span>
                      </div>
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-3 ${selectedListing.premium ? 'bg-purple-400' : 'bg-gray-400'}`}></div>
                        <span className="text-white">Premium Listing</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <button 
                      onClick={() => handleContactSeller(selectedListing)}
                      disabled={isCreatingChat}
                      className="w-full bg-xsm-yellow hover:bg-yellow-500 text-black font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span>{isCreatingChat ? 'Connecting...' : 'Contact Seller'}</span>
                    </button>
                    
                    <button 
                      onClick={() => handleDeleteListing(selectedListing)}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
                    >
                      <Trash className="w-5 h-5" />
                      <span>Delete Listing</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewListings;
