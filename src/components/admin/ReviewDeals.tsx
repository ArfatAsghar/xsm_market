import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, DollarSign, User, Eye, Calendar, TrendingUp, Send, Search, X } from 'lucide-react';
import { getAllDeals, markPrimaryOwnerMade, updateDealStatusAdmin } from '@/services/admin';
import { useAuth } from '@/context/useAuth';

// Get API URL from environment variables
const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://xsmmarket.com/api');
};

const getBaseUrl = () => {
  const apiUrl = getApiUrl();
  return apiUrl.replace('/api', '');
};

const API_URL = getBaseUrl();

interface Deal {
  id: number;
  channel_title: string;
  platform: string;
  price: number;
  buyer: {
    id: number;
    username: string;
    email: string;
  };
  seller: {
    id: number;
    username: string;
    email: string;
  };
  status: string;
  progress: number;
  seller_agreed: boolean;
  seller_agreed_at: string | null;
  transaction_fee_paid: boolean;
  transaction_fee_paid_at: string | null;
  transaction_fee_paid_by: string | null;
  transaction_fee_payment_method: string | null;
  agent_email_sent: boolean;
  agent_email_sent_at: string | null;
  seller_gave_rights: boolean;
  seller_gave_rights_at: string | null;
  seller_made_primary_owner: boolean;
  seller_made_primary_owner_at: string | null;
  platform_type: string | null;
  timer_completed: boolean;
  created_at: string;
  updated_at: string;
  transaction_id?: string;
}

const mapStatusToCategory = (status: string): 'Pending' | 'Accepted' | 'Rejected' | 'Cancelled' | 'Failed' | 'Completed' => {
  const s = (status || '').toLowerCase();
  if (s === 'pending') return 'Pending';
  if (s === 'rejected') return 'Rejected';
  if (s === 'cancelled' || s === 'canceled') return 'Cancelled';
  if (s === 'failed') return 'Failed';
  if (s === 'completed' || s === 'payment_confirmed') return 'Completed';
  
  // Any accepted/in-progress deal states (e.g. terms_agreed, fee_paid, agent_access_pending, waiting_promotion_timer, etc.) map to Accepted
  return 'Accepted';
};

const ReviewDeals: React.FC = () => {
  const { user } = useAuth();
  const userRole = (user as any)?.role || 'user';
  const isCurrentUserViewer = userRole === 'viewer';

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [sendingMessage, setSendingMessage] = useState<number | null>(null);
  const [searchTxnId, setSearchTxnId] = useState('');
  const [selectedStatusTab, setSelectedStatusTab] = useState('All');

  // Auto-open deal modal when exact transaction ID is typed/found
  useEffect(() => {
    const q = searchTxnId.trim().toUpperCase();
    if (!q) return;
    const match = deals.find(d => (d.transaction_id || '').toUpperCase() === q);
    if (match) setSelectedDeal(match);
  }, [searchTxnId, deals]);

  // Find exact transaction match if any
  const exactMatch = searchTxnId.trim()
    ? deals.find(d => (d.transaction_id || '').toUpperCase() === searchTxnId.trim().toUpperCase())
    : null;

  // Filtered deals list used by the table
  const filteredDeals = (exactMatch
    ? [exactMatch]
    : searchTxnId.trim()
      ? deals.filter(d => (d.transaction_id || '').toUpperCase().includes(searchTxnId.trim().toUpperCase()))
      : deals
  ).filter(d => {
    if (selectedStatusTab === 'All') return true;
    return mapStatusToCategory(d.status) === selectedStatusTab;
  });

  useEffect(() => {
    fetchDeals();
  }, []);

  const fetchDeals = async () => {
    try {
      setLoading(true);
      const data = await getAllDeals();
      // Backend returns { deals: [...], pagination: {...} }
      const rawDeals = data.deals || data || [];
      // Backend returns flat buyer_username, buyer_email, seller_username, seller_email
      // but frontend expects nested deal.buyer.username, deal.seller.username
      const normalizedDeals = rawDeals.map((deal: any) => ({
        ...deal,
        price: parseFloat(deal.channel_price || deal.price || 0),
        platform: deal.platform_type || deal.platform || 'unknown',
        status: deal.deal_status || deal.status || 'pending',
        buyer: {
          id: deal.buyer_id,
          username: deal.buyer_username || 'Unknown',
          email: deal.buyer_email || '',
        },
        seller: {
          id: deal.seller_id,
          username: deal.seller_username || 'Unknown',
          email: deal.seller_email || '',
        },
      }));
      setDeals(normalizedDeals);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const [primaryOwnerDealModal, setPrimaryOwnerDealModal] = useState<Deal | null>(null);
  const [isSubmittingPrimaryOwner, setIsSubmittingPrimaryOwner] = useState(false);
  const [primaryModalError, setPrimaryModalError] = useState<string | null>(null);
  const [primaryModalSuccess, setPrimaryModalSuccess] = useState<string | null>(null);

  const handleConfirmPrimaryOwner = async () => {
    if (!primaryOwnerDealModal) return;
    setIsSubmittingPrimaryOwner(true);
    setPrimaryModalError(null);
    setPrimaryModalSuccess(null);

    try {
      const result = await markPrimaryOwnerMade(primaryOwnerDealModal.id);
      if (result.success) {
        setPrimaryModalSuccess('✅ Primary owner status confirmed successfully! Deal status has been updated.');
        fetchDeals();
        setTimeout(() => {
          setPrimaryOwnerDealModal(null);
          setPrimaryModalSuccess(null);
        }, 1800);
      } else {
        throw new Error(result.message || 'Failed to confirm primary owner status');
      }
    } catch (err: any) {
      console.error('Error confirming primary owner made:', err);
      setPrimaryModalError(err.message || 'Failed to confirm primary owner status. Please try again.');
    } finally {
      setIsSubmittingPrimaryOwner(false);
    }
  };

  const getStatusColor = (status: string) => {
    const category = mapStatusToCategory(status);
    switch (category) {
      case 'Completed':
        return 'text-green-400 bg-green-400/10 border border-green-500/20';
      case 'Accepted':
        return 'text-blue-400 bg-blue-400/10 border border-blue-500/20';
      case 'Pending':
        return 'text-yellow-400 bg-yellow-400/10 border border-yellow-500/20';
      case 'Rejected':
        return 'text-red-400 bg-red-400/10 border border-red-500/20';
      case 'Cancelled':
        return 'text-orange-400 bg-orange-400/10 border border-orange-500/20';
      case 'Failed':
        return 'text-rose-500 bg-rose-500/10 border border-rose-500/20';
      default:
        return 'text-gray-400 bg-gray-400/10 border border-gray-500/20';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-xsm-yellow"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-4">
        <p className="text-red-400">Error loading deals: {error}</p>
        <button
          onClick={fetchDeals}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Deal Management</h2>
        <button
          onClick={fetchDeals}
          className="px-4 py-2 bg-xsm-yellow text-black rounded-lg hover:bg-yellow-400 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Deal Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-xsm-dark-gray p-4 rounded-lg border border-xsm-medium-gray">
          <div className="flex items-center space-x-3">
            <TrendingUp className="w-6 h-6 text-xsm-yellow" />
            <div>
              <p className="text-sm text-gray-400">Total Deals</p>
              <p className="text-xl font-bold text-white">{deals.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-xsm-dark-gray p-4 rounded-lg border border-xsm-medium-gray">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <div>
              <p className="text-sm text-gray-400">Completed</p>
              <p className="text-xl font-bold text-white">
                {deals.filter(d => d.status === 'Completed').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-xsm-dark-gray p-4 rounded-lg border border-xsm-medium-gray">
          <div className="flex items-center space-x-3">
            <Clock className="w-6 h-6 text-yellow-400" />
            <div>
              <p className="text-sm text-gray-400">In Progress</p>
              <p className="text-xl font-bold text-white">
                {deals.filter(d => d.status !== 'Completed').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-xsm-dark-gray p-4 rounded-lg border border-xsm-medium-gray">
          <div className="flex items-center space-x-3">
            <DollarSign className="w-6 h-6 text-green-400" />
            <div>
              <p className="text-sm text-gray-400">Total Value</p>
              <p className="text-xl font-bold text-white">
                {formatPrice(deals.reduce((sum, deal) => sum + deal.price, 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-4 bg-xsm-dark-gray p-2 rounded-lg border border-xsm-medium-gray">
        {['All', 'Pending', 'Accepted', 'Rejected', 'Cancelled', 'Failed', 'Completed'].map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedStatusTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              selectedStatusTab === tab
                ? 'bg-xsm-yellow text-black shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-xsm-medium-gray/30'
            }`}
          >
            {tab}
            <span className="ml-1.5 text-xs opacity-75">
              ({tab === 'All' 
                ? deals.length 
                : deals.filter(d => mapStatusToCategory(d.status) === tab).length
              })
            </span>
          </button>
        ))}
      </div>

      {/* Transaction ID Search */}
      <div className="relative max-w-md mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          id="txn-search"
          value={searchTxnId}
          onChange={e => setSearchTxnId(e.target.value)}
          placeholder="Search by Transaction ID (e.g. TXN-000001)"
          className="w-full bg-xsm-dark-gray border border-xsm-medium-gray rounded-lg pl-10 pr-10 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-xsm-yellow transition-colors text-sm"
        />
        {searchTxnId && (
          <button
            onClick={() => setSearchTxnId('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {exactMatch && (
        <div className="mb-4 p-3 bg-xsm-yellow/10 border border-xsm-yellow/30 rounded-lg flex items-center justify-between">
          <span className="text-xs text-xsm-yellow font-medium">🎯 Exact Transaction Match Found! Automatically opening deal modal...</span>
          <button 
            onClick={() => setSelectedDeal(exactMatch)}
            className="text-xs text-black bg-xsm-yellow px-2 py-1 rounded font-bold hover:bg-yellow-400 transition-colors"
          >
            Open Modal
          </button>
        </div>
      )}

      {/* Deals Table */}
      <div className="bg-xsm-dark-gray rounded-lg border border-xsm-medium-gray overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-xsm-medium-gray">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Transaction ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Channel</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Price</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Buyer</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Seller</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Progress</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Created</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-xsm-medium-gray">
              {filteredDeals.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  {searchTxnId ? `No deals found matching "${searchTxnId}"` : 'No deals found'}
                </td></tr>
              )}
              {filteredDeals.map((deal) => (
                <tr key={deal.id} className="hover:bg-xsm-medium-gray/30">
                  <td className="px-4 py-3 text-sm font-mono text-xsm-yellow font-semibold">
                    {deal.transaction_id || `#${deal.id}`}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{deal.channel_title}</p>
                      <p className="text-xs text-gray-400">{deal.platform}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-green-400">
                    {formatPrice(deal.price)}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm text-white">{deal.buyer.username}</p>
                      <p className="text-xs text-gray-400">{deal.buyer.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm text-white">{deal.seller.username}</p>
                      <p className="text-xs text-gray-400">{deal.seller.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(deal.status)}`}>
                      {deal.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-xsm-yellow h-2 rounded-full transition-all duration-300"
                          style={{ width: `${deal.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-400">{deal.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {new Date(deal.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedDeal(deal)}
                        className="text-xsm-yellow hover:text-yellow-400 transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      
                      {/* Admin/Manager: "I HAVE MADE THE PRIMARY OWNER" Button — hidden for viewers */}
                      {!isCurrentUserViewer && deal.seller_gave_rights && !deal.seller_made_primary_owner && (
                        <button
                          onClick={() => {
                            setPrimaryOwnerDealModal(deal);
                            setPrimaryModalError(null);
                            setPrimaryModalSuccess(null);
                          }}
                          className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer"
                          title="Click when you (admin) have made the agent Primary Owner of the channel"
                        >
                          I HAVE MADE THE PRIMARY OWNER
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {deals.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            No deals found
          </div>
        )}
      </div>

      {/* Deal Details Modal */}
      {selectedDeal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-xsm-dark-gray rounded-lg p-6 max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-white">Deal Details</h3>
                <p className="text-xsm-yellow font-mono text-sm">{selectedDeal.transaction_id || `#${selectedDeal.id}`}</p>
              </div>
              <button
                onClick={() => setSelectedDeal(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Channel Info */}
              <div className="bg-xsm-medium-gray p-4 rounded-lg">
                <h4 className="font-medium text-white mb-2">Channel Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-400">Title:</span>
                    <p className="text-white">{selectedDeal.channel_title}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Platform:</span>
                    <p className="text-white">{selectedDeal.platform}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Price:</span>
                    <p className="text-green-400 font-bold">{formatPrice(selectedDeal.price)}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Status:</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedDeal.status)}`}>
                      {selectedDeal.status}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400">Transaction ID:</span>
                    <p className="text-xsm-yellow font-mono font-bold text-lg">{selectedDeal.transaction_id || `#${selectedDeal.id}`}</p>
                  </div>
                </div>
              </div>

              {/* Parties Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-xsm-medium-gray p-4 rounded-lg">
                  <h4 className="font-medium text-white mb-2">Buyer</h4>
                  <p className="text-white">{selectedDeal.buyer.username}</p>
                  <p className="text-gray-400 text-sm">{selectedDeal.buyer.email}</p>
                </div>
                <div className="bg-xsm-medium-gray p-4 rounded-lg">
                  <h4 className="font-medium text-white mb-2">Seller</h4>
                  <p className="text-white">{selectedDeal.seller.username}</p>
                  <p className="text-gray-400 text-sm">{selectedDeal.seller.email}</p>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-xsm-medium-gray p-4 rounded-lg">
                <h4 className="font-medium text-white mb-2">Deal Timeline</h4>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="text-white">Deal Created</p>
                      <p className="text-sm text-gray-400">{formatDate(selectedDeal.created_at)}</p>
                    </div>
                  </div>
                  
                  {selectedDeal.seller_agreed && (
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <div>
                        <p className="text-white">Seller Agreed</p>
                        <p className="text-sm text-gray-400">{formatDate(selectedDeal.seller_agreed_at)}</p>
                      </div>
                    </div>
                  )}
                  
                  {selectedDeal.transaction_fee_paid && (
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <div>
                        <p className="text-white">Transaction Fee Paid</p>
                        <p className="text-sm text-gray-400">
                          {formatDate(selectedDeal.transaction_fee_paid_at)}
                          {selectedDeal.transaction_fee_payment_method && (
                            <span> via {selectedDeal.transaction_fee_payment_method}</span>
                          )}
                        </p>
                        {selectedDeal.transaction_fee_paid_by && (
                          <p className="text-sm text-gray-400">Paid by: {selectedDeal.transaction_fee_paid_by}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedDeal.agent_email_sent && (
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-blue-400" />
                      <div>
                        <p className="text-white">Agent Email Sent</p>
                        <p className="text-sm text-gray-400">
                          {formatDate(selectedDeal.agent_email_sent_at)}
                        </p>
                        <p className="text-sm text-blue-300">Agent email provided to seller for account access</p>
                      </div>
                    </div>
                  )}

                  {selectedDeal.seller_gave_rights && (
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <div>
                        <p className="text-white">Agent Access Confirmed</p>
                        <p className="text-sm text-gray-400">
                          {formatDate(selectedDeal.seller_gave_rights_at)}
                        </p>
                        <p className="text-sm text-green-300">Seller confirmed giving rights to agent</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Admin Deal Status Force Override Dropdown */}
              {!isCurrentUserViewer && (
                <div className="bg-xsm-medium-gray p-4 rounded-lg border border-xsm-medium-gray/50">
                  <h4 className="font-semibold text-xsm-yellow mb-2 text-sm">Force Update Status (Admin Override)</h4>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <select
                      value={selectedDeal.status.toLowerCase()}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        const conf = window.confirm(`⚠️ WARNING: You are about to override this deal status to "${newStatus.toUpperCase()}". Do you want to proceed?`);
                        if (conf) {
                          try {
                            const res = await updateDealStatusAdmin(selectedDeal.id, newStatus);
                            if (res.success) {
                              alert(`✅ Deal status successfully updated to "${newStatus.toUpperCase()}"`);
                              fetchDeals(); // Refresh list
                              setSelectedDeal(prev => prev ? { ...prev, status: newStatus } : null);
                            }
                          } catch (err: any) {
                            alert('❌ Status update failed: ' + err.message);
                          }
                        }
                      }}
                      className="bg-xsm-dark-gray text-white border border-xsm-medium-gray rounded-md px-3 py-2 text-sm focus:outline-none focus:border-xsm-yellow font-medium"
                    >
                      <option value="pending">Pending</option>
                      <option value="accepted">Accepted (Terms Agreed)</option>
                      <option value="terms_agreed">Terms Agreed</option>
                      <option value="fee_paid">Fee Paid</option>
                      <option value="rejected">Rejected</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="failed">Failed</option>
                      <option value="completed">Completed (Payment Confirmed)</option>
                    </select>
                    <span className="text-xs text-gray-400">
                      Changes status immediately in the database and updates deal timeline log.
                    </span>
                  </div>
                </div>
              )}

              {/* Progress */}
              <div className="bg-xsm-medium-gray p-4 rounded-lg">
                <h4 className="font-medium text-white mb-2">Progress</h4>
                <div className="flex items-center space-x-3">
                  <div className="flex-1 bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-xsm-yellow h-3 rounded-full transition-all duration-300"
                      style={{ width: `${selectedDeal.progress}%` }}
                    ></div>
                  </div>
                  <span className="text-white font-medium">{selectedDeal.progress}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Primary Owner Confirmation Modal */}
      {primaryOwnerDealModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-xsm-dark-gray border border-amber-500/50 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden relative">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-950/60 to-xsm-dark-gray p-5 border-b border-xsm-medium-gray/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xsm-yellow font-bold text-lg">
                  👑
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Confirm Primary Owner Promotion</h3>
                  <p className="text-xs text-xsm-light-gray">
                    Deal #{primaryOwnerDealModal.id} • {primaryOwnerDealModal.channel_title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isSubmittingPrimaryOwner) setPrimaryOwnerDealModal(null);
                }}
                disabled={isSubmittingPrimaryOwner}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-xsm-medium-gray/50 transition-colors cursor-pointer"
                title="Close (X)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              {primaryModalSuccess ? (
                <div className="p-4 bg-green-950/80 border border-green-500/60 rounded-xl text-green-300 text-sm font-medium">
                  {primaryModalSuccess}
                </div>
              ) : (
                <>
                  <div className="bg-xsm-black/60 p-4 rounded-xl border border-xsm-medium-gray/30 space-y-2.5 text-xs text-xsm-light-gray">
                    <p className="font-semibold text-white text-sm mb-1">Please confirm the following steps before continuing:</p>
                    <ul className="space-y-1.5 list-disc list-inside">
                      <li>You logged into the account and verified management permissions.</li>
                      <li>The website agent has been promoted to <strong className="text-xsm-yellow">Primary Owner</strong>.</li>
                      <li>Agent has full administrative ownership control over the channel.</li>
                    </ul>
                  </div>

                  {primaryModalError && (
                    <div className="p-3 bg-red-950/80 border border-red-500/60 rounded-xl text-red-300 text-xs font-medium">
                      ⚠️ {primaryModalError}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer / Actions */}
            {!primaryModalSuccess && (
              <div className="bg-xsm-black/50 p-4 border-t border-xsm-medium-gray/40 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPrimaryOwnerDealModal(null)}
                  disabled={isSubmittingPrimaryOwner}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-xsm-medium-gray/50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPrimaryOwner}
                  disabled={isSubmittingPrimaryOwner}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-500 via-xsm-yellow to-yellow-400 text-black hover:brightness-110 transition-all flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingPrimaryOwner ? (
                    <>
                      <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                      <span>Confirming...</span>
                    </>
                  ) : (
                    <>
                      <span>OK</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewDeals;
