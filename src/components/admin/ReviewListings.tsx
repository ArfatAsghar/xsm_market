import React, { useState } from 'react';
import { Search, MoreVertical, CheckCircle, XCircle, AlertCircle, Eye, MessageCircle, Flag, Trash, X, Star, Users, DollarSign, Shield, Ban, Unlock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from '@/context/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { deleteListing, banListing, unbanListing, getAdminAds } from '@/services/admin';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://xsmmarket.com/api');

interface ReviewListingsProps {
  onNavigateToChat?: (chatId: string) => void;
}

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
  // Ban fields
  isBanned?: boolean | number;
  banReason?: string;
  bannedAt?: string;
}

const ReviewListings: React.FC<ReviewListingsProps> = ({ onNavigateToChat }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isBanningListing, setIsBanningListing] = useState(false);

  const { isLoggedIn, user } = useAuth();
  const { toast } = useToast();

  const currentUserRole = (user as any)?.role || 'user';
  const isCurrentUserAdmin = currentUserRole === 'admin' || (user as any)?.isAdmin === true;
  const isCurrentUserViewer = currentUserRole === 'viewer';

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    getAdminAds()
      .then((data) => {
        const mapped = (data.ads || []).map((ad: any) => ({
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
          isBanned: ad.isBanned || false,
          banReason: ad.banReason || '',
          bannedAt: ad.bannedAt || '',
        }));
        setListings(mapped);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err.message || 'Failed to fetch listings');
        setLoading(false);
      });
  }, []);

  const handleViewDetails = (listing: Listing) => {
    setSelectedListing(listing);
    setShowDetailsModal(true);
  };

  /** Contact Seller — creates or finds a chat, then navigates admin directly to it */
  const handleContactSeller = async (listing: Listing) => {
    if (!isLoggedIn || !user) {
      toast({ variant: 'destructive', title: 'Authentication Required', description: 'Please log in to contact the seller' });
      return;
    }
    if (String(user.id) === String(listing.sellerId)) {
      toast({ variant: 'destructive', title: 'Invalid Action', description: "You can't contact yourself" });
      return;
    }

    try {
      setIsCreatingChat(true);
      const token = localStorage.getItem('token');

      // Check if a chat already exists with this seller
      const checkRes = await fetch(`${API_URL}/chat/check-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ sellerId: listing.sellerId, adId: listing.id })
      });

      if (checkRes.ok) {
        const checkResult = await checkRes.json();
        if (checkResult.exists && checkResult.chatId) {
          toast({ title: '💬 Opening Chat', description: 'Opening existing conversation with seller...' });
          if (onNavigateToChat) onNavigateToChat(String(checkResult.chatId));
          setShowDetailsModal(false);
          return;
        }
      }

      // Create new chat
      const createRes = await fetch(`${API_URL}/chat/ad-inquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          adId: listing.id,
          sellerId: listing.sellerId,
          message: `Hi, this is the platform admin contacting you regarding your listing "${listing.title}".`,
          sellerName: listing.sellerUsername
        })
      });

      if (!createRes.ok) throw new Error(`HTTP error! status: ${createRes.status}`);

      const chat = await createRes.json();
      const chatId = chat.chatId || chat.id || chat.data?.id;

      toast({ title: '💬 Chat Created', description: 'Navigating to conversation...' });
      if (onNavigateToChat && chatId) onNavigateToChat(String(chatId));
      setShowDetailsModal(false);

    } catch (err) {
      console.error('Error creating chat:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to open chat with seller' });
    } finally {
      setIsCreatingChat(false);
    }
  };

  /** Ban a listing — prompt for reason, call API, then send seller notification in chat */
  const handleBanListing = async (listing: Listing) => {
    const reason = window.prompt(
      `Ban Listing: "${listing.title}"\n\nEnter the reason for banning this listing (this will be shown to the seller):`
    );
    if (!reason || !reason.trim()) return;

    try {
      setIsBanningListing(true);
      await banListing(listing.id, reason.trim());

      // Update local state
      setListings(prev => prev.map(l => l.id === listing.id
        ? { ...l, isBanned: true, banReason: reason.trim(), bannedAt: new Date().toISOString() }
        : l
      ));
      if (selectedListing?.id === listing.id) {
        setSelectedListing(prev => prev ? { ...prev, isBanned: true, banReason: reason.trim() } : prev);
      }

      toast({ title: '🚫 Listing Banned', description: `"${listing.title}" has been banned.` });

      // Automatically notify the seller via chat
      try {
        const token = localStorage.getItem('token');
        if (!user || String(user.id) === String(listing.sellerId)) return;

        const checkRes = await fetch(`${API_URL}/chat/check-existing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ sellerId: listing.sellerId, adId: listing.id })
        });

        let chatId: string | null = null;

        if (checkRes.ok) {
          const checkResult = await checkRes.json();
          if (checkResult.exists && checkResult.chatId) {
            chatId = String(checkResult.chatId);
          }
        }

        if (!chatId) {
          const createRes = await fetch(`${API_URL}/chat/ad-inquiry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              adId: listing.id,
              sellerId: listing.sellerId,
              message: `🚫 Your listing "${listing.title}" has been banned.\n\nReason: ${reason}\n\nYou may edit your listing and resubmit it for review.`,
              sellerName: listing.sellerUsername
            })
          });
          if (createRes.ok) {
            const chat = await createRes.json();
            chatId = String(chat.chatId || chat.id || chat.data?.id);
          }
        } else {
          // Send ban message to existing chat
          await fetch(`${API_URL}/chat/admin/chats/${chatId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              content: `🚫 **Listing Banned**\n\nYour listing **"${listing.title}"** has been banned from XSM Market.\n\n**Reason:** ${reason}\n\nYou can edit your listing to address these issues and resubmit it for review.`
            })
          });
        }
      } catch (notifyErr) {
        console.warn('Failed to send ban notification to seller:', notifyErr);
        // Non-fatal: listing is banned even if notification fails
      }

    } catch (err) {
      console.error('Error banning listing:', err);
      toast({ variant: 'destructive', title: '❌ Ban Failed', description: err instanceof Error ? err.message : 'Failed to ban listing' });
    } finally {
      setIsBanningListing(false);
    }
  };

  /** Unban a listing */
  const handleUnbanListing = async (listing: Listing) => {
    const confirmed = window.confirm(`Unban listing "${listing.title}"? It will become visible to all users again.`);
    if (!confirmed) return;

    try {
      await unbanListing(listing.id);

      setListings(prev => prev.map(l => l.id === listing.id
        ? { ...l, isBanned: false, banReason: '', bannedAt: '' }
        : l
      ));
      if (selectedListing?.id === listing.id) {
        setSelectedListing(prev => prev ? { ...prev, isBanned: false, banReason: '' } : prev);
      }

      toast({ title: '✅ Listing Unbanned', description: `"${listing.title}" is now visible to all users.` });
    } catch (err) {
      toast({ variant: 'destructive', title: '❌ Unban Failed', description: err instanceof Error ? err.message : 'Failed to unban listing' });
    }
  };

  const handleDeleteListing = async (listing: Listing) => {
    const confirmed = window.confirm(
      `⚠️ DELETE CONFIRMATION ⚠️\n\nAre you sure you want to permanently delete this listing?\n\nTitle: "${listing.title}"\nSeller: ${listing.sellerUsername}\nPrice: ${listing.price}\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteListing(listing.id);
      setListings(prev => prev.filter(l => l.id !== listing.id));
      toast({ title: '✅ Listing Deleted', description: `"${listing.title}" has been permanently deleted.` });
      if (selectedListing?.id === listing.id) {
        setShowDetailsModal(false);
        setSelectedListing(null);
      }
    } catch (err) {
      toast({ variant: 'destructive', title: '❌ Delete Failed', description: err instanceof Error ? err.message : 'Failed to delete listing' });
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'banned' | 'pending' | 'rejected' | 'reported'>('all');

  const filteredListings = listings.filter(listing => {
    const matchesSearch = 
      listing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      listing.seller.toLowerCase().includes(searchTerm.toLowerCase());
      
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'banned') return matchesSearch && Boolean(listing.isBanned);
    return matchesSearch && listing.status === filterStatus && !listing.isBanned;
  });


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'rejected': return <XCircle className="w-5 h-5 text-red-400" />;
      case 'reported': return <Flag className="w-5 h-5 text-yellow-400" />;
      default: return <AlertCircle className="w-5 h-5 text-blue-400" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-400/10 text-green-400 border-green-400/20';
      case 'rejected': return 'bg-red-400/10 text-red-400 border-red-400/20';
      case 'reported': return 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20';
      default: return 'bg-blue-400/10 text-blue-400 border-blue-400/20';
    }
  };

  const getCardImage = (listing: Listing) =>
    listing.primary_image ||
    (listing.screenshots && listing.screenshots.length > 0 ? listing.screenshots[0].url || listing.screenshots[0] : null) ||
    listing.thumbnail ||
    '/placeholder.svg';

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
          <div className="w-full md:w-48">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full bg-xsm-dark-gray border border-xsm-medium-gray rounded-lg px-4 py-2 focus:outline-none focus:border-xsm-yellow text-white cursor-pointer"
            >
              <option value="all">All Listings</option>
              <option value="active">Active</option>
              <option value="banned">Banned</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
              <option value="reported">Reported</option>
            </select>
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
              <div key={listing.id} className={`bg-xsm-dark-gray rounded-xl border overflow-hidden ${listing.isBanned ? 'border-red-800/60' : 'border-xsm-medium-gray'}`}>
                {/* Listing Image */}
                <div className="aspect-video relative bg-xsm-medium-gray">
                  <img
                    src={getCardImage(listing)}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                  />
                  {/* Banned badge overlay */}
                  {listing.isBanned && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="bg-red-600 text-white text-sm font-bold px-4 py-1.5 rounded-full flex items-center gap-1.5">
                        <Ban className="w-4 h-4" /> BANNED
                      </span>
                    </div>
                  )}
                  {listing.reportCount > 0 && !listing.isBanned && (
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
                      {listing.isBanned && listing.banReason && (
                        <p className="text-xs text-red-400 mt-1 italic truncate max-w-[180px]" title={listing.banReason}>
                          Ban reason: {listing.banReason}
                        </p>
                      )}
                    </div>
                    <span className="text-xsm-yellow font-medium">{listing.price}</span>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-xsm-light-gray">{listing.category}</span>
                    <span className="text-sm text-xsm-light-gray">{listing.createdAt}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm border ${listing.isBanned ? 'bg-red-950 text-red-400 border-red-800' : getStatusBadgeClass(listing.status)}`}>
                      {listing.isBanned ? <Ban className="w-4 h-4 mr-1" /> : getStatusIcon(listing.status)}
                      <span className="ml-1 capitalize">{listing.isBanned ? 'Banned' : listing.status}</span>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger className="p-2 hover:bg-xsm-medium-gray rounded-lg transition-colors">
                        <MoreVertical className="h-5 w-5 text-xsm-light-gray" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-xsm-dark-gray border-xsm-medium-gray min-w-[180px]">
                        <DropdownMenuItem
                          className="text-white hover:text-xsm-yellow cursor-pointer"
                          onClick={() => handleViewDetails(listing)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        {!isCurrentUserViewer && (
                          <>
                            <DropdownMenuItem
                              className="text-blue-400 hover:text-blue-300 cursor-pointer"
                              onClick={() => handleContactSeller(listing)}
                              disabled={isCreatingChat}
                            >
                              <MessageCircle className="w-4 h-4 mr-2" />
                              {isCreatingChat ? 'Opening...' : 'Contact Seller'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-xsm-medium-gray" />
                            {listing.isBanned ? (
                              <DropdownMenuItem
                                className="text-green-400 hover:text-green-300 cursor-pointer"
                                onClick={() => handleUnbanListing(listing)}
                              >
                                <Unlock className="w-4 h-4 mr-2" />
                                Unban Listing
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-orange-400 hover:text-orange-300 cursor-pointer"
                                onClick={() => handleBanListing(listing)}
                                disabled={isBanningListing}
                              >
                                <Ban className="w-4 h-4 mr-2" />
                                Ban Listing
                              </DropdownMenuItem>
                            )}
                            {isCurrentUserAdmin && (
                              <>
                                <DropdownMenuSeparator className="bg-xsm-medium-gray" />
                                <DropdownMenuItem
                                  className="text-red-500 hover:text-red-400 cursor-pointer"
                                  onClick={() => handleDeleteListing(listing)}
                                >
                                  <Trash className="w-4 h-4 mr-2" />
                                  Delete Listing
                                </DropdownMenuItem>
                              </>
                            )}
                          </>
                        )}
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
          onClick={(e) => { if (e.target === e.currentTarget) setShowDetailsModal(false); }}
        >
          <div className="bg-xsm-dark-gray rounded-xl border border-xsm-medium-gray max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-xsm-dark-gray border-b border-xsm-medium-gray p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-xsm-yellow">Listing Details</h2>
                {selectedListing.isBanned && (
                  <span className="flex items-center gap-1 bg-red-950 text-red-400 border border-red-800 text-xs font-bold px-2 py-1 rounded-full">
                    <Ban className="w-3 h-3" /> BANNED
                  </span>
                )}
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Banned Reason Banner */}
              {selectedListing.isBanned && selectedListing.banReason && (
                <div className="mb-6 p-4 bg-red-950/40 border border-red-800/60 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Ban className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-400 font-semibold text-sm">This listing is currently banned</p>
                      <p className="text-red-300/80 text-sm mt-1">Reason: {selectedListing.banReason}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column */}
                <div>
                  <div className="aspect-video relative bg-xsm-medium-gray rounded-lg overflow-hidden mb-6">
                    <img
                      src={getCardImage(selectedListing)}
                      alt={selectedListing.title}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                    />
                    {selectedListing.isBanned && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="bg-red-600 text-white font-bold px-5 py-2 rounded-full flex items-center gap-2">
                          <Ban className="w-5 h-5" /> BANNED
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-2">{selectedListing.title}</h3>
                      <div className="flex items-center justify-between mb-4">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm border ${selectedListing.isBanned ? 'bg-red-950 text-red-400 border-red-800' : getStatusBadgeClass(selectedListing.status)}`}>
                          {selectedListing.isBanned ? <Ban className="w-4 h-4 mr-1" /> : getStatusIcon(selectedListing.status)}
                          <span className="ml-1 capitalize">{selectedListing.isBanned ? 'Banned' : selectedListing.status}</span>
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

                {/* Right Column */}
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
                      {selectedListing.reportCount > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xsm-light-gray">Reports:</span>
                          <span className="text-red-400 font-semibold">{selectedListing.reportCount}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <div className="bg-xsm-black rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-white mb-4">Features</h4>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-3 ${selectedListing.verified ? 'bg-green-400' : 'bg-gray-400'}`} />
                        <span className="text-white">Verified Channel</span>
                      </div>
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-3 ${selectedListing.isMonetized ? 'bg-xsm-yellow' : 'bg-gray-400'}`} />
                        <span className="text-white">Monetized</span>
                      </div>
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-3 ${selectedListing.premium ? 'bg-purple-400' : 'bg-gray-400'}`} />
                        <span className="text-white">Premium Listing</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {!isCurrentUserViewer && (
                    <div className="space-y-3">
                      {/* Contact Seller */}
                      <button
                        onClick={() => handleContactSeller(selectedListing)}
                        disabled={isCreatingChat}
                        className="w-full bg-xsm-yellow hover:bg-yellow-500 text-black font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                      >
                        <MessageCircle className="w-5 h-5" />
                        <span>{isCreatingChat ? 'Opening Chat...' : 'Contact Seller'}</span>
                      </button>

                      {/* Ban / Unban Listing */}
                      {selectedListing.isBanned ? (
                        <button
                          onClick={() => handleUnbanListing(selectedListing)}
                          className="w-full bg-green-700 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
                        >
                          <Unlock className="w-5 h-5" />
                          <span>Unban Listing</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBanListing(selectedListing)}
                          disabled={isBanningListing}
                          className="w-full bg-orange-700 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                        >
                          <Ban className="w-5 h-5" />
                          <span>{isBanningListing ? 'Banning...' : 'Ban Listing'}</span>
                        </button>
                      )}

                      {/* Delete Listing (Admin only) */}
                      {isCurrentUserAdmin && (
                        <button
                          onClick={() => handleDeleteListing(selectedListing)}
                          className="w-full bg-red-700 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
                        >
                          <Trash className="w-5 h-5" />
                          <span>Delete Listing</span>
                        </button>
                      )}
                    </div>
                  )}
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
