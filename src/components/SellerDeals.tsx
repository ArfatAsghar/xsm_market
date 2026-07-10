import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock, Eye, DollarSign, Calendar } from 'lucide-react';
import SellerDealView from './SellerDealView';

// Get API URL from environment variables
const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://xsmmarket.com/api');
};

const getBaseUrl = () => {
  const apiUrl = getApiUrl();
  return apiUrl.replace('/api', '');
};

const API_URL = getBaseUrl();

interface PaymentMethod {
  id: string;
  name: string;
  category: string;
}

interface Deal {
  id: number;
  transaction_id: string;
  buyer_id: number;
  seller_id: number;
  channel_id: string;
  channel_title: string;
  channel_price: number;
  escrow_fee: number;
  transaction_type: string;
  buyer_payment_methods: string;
  seller_agreed: boolean;
  seller_agreed_at: string | null;
  buyer_agreed: boolean;
  buyer_agreed_at: string;
  deal_status: string;
  created_at: string;
  updated_at: string;
  buyer_username: string;
  payment_methods: PaymentMethod[];
}

const SellerDeals: React.FC = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  const fetchSellerDeals = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/api/deals/seller`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        setDeals(result.deals || []);
        setError(null);
      } else {
        throw new Error(result.message || 'Failed to fetch deals');
      }
    } catch (error) {
      console.error('Error fetching seller deals:', error);
      setError('Failed to load deals. Please try again.');
      setDeals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellerDeals();
  }, []);

  const handleViewDeal = (deal: Deal) => {
    setSelectedDeal(deal);
    setIsViewOpen(true);
  };

  const handleCloseView = () => {
    setIsViewOpen(false);
    setSelectedDeal(null);
  };

  const handleDealUpdate = () => {
    fetchSellerDeals(); // Refresh the deals list
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'terms_agreed': return 'bg-green-100 text-green-800';
      case 'agent_access_pending': return 'bg-blue-100 text-blue-800';
      case 'waiting_promotion_timer': return 'bg-orange-100 text-orange-800';
      case 'promotion_timer_complete': return 'bg-purple-100 text-purple-800';
      case 'admin_ownership_confirmed': return 'bg-indigo-100 text-indigo-800';
      case 'buyer_paid_seller': return 'bg-cyan-100 text-cyan-800';
      case 'seller_confirmed_payment': return 'bg-emerald-100 text-emerald-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Awaiting Review';
      case 'terms_agreed': return 'Terms Agreed';
      case 'agent_access_pending': return 'Awaiting Rights Confirmation';
      case 'waiting_promotion_timer': return 'YouTube Timer Active';
      case 'promotion_timer_complete': return 'Transfer Complete';
      case 'admin_ownership_confirmed': return 'Admin Confirmed Primary Owner';
      case 'buyer_paid_seller': return 'Buyer Confirmed Payment';
      case 'seller_confirmed_payment': return 'Payment Complete';
      case 'completed': return 'Completed';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-xsm-dark-blue p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-xsm-yellow"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-xsm-dark-blue p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-900 border border-red-700 rounded-lg p-6 text-center">
            <AlertCircle className="mx-auto mb-4 text-red-400" size={48} />
            <h2 className="text-xl font-bold text-white mb-2">Error Loading Deals</h2>
            <p className="text-red-200 mb-4">{error}</p>
            <button
              onClick={fetchSellerDeals}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-xsm-dark-blue p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Seller Deals</h1>
          <p className="text-xsm-light-gray">Review and manage your incoming deal requests</p>
        </div>

        {deals.length === 0 ? (
          <div className="bg-xsm-dark-gray rounded-lg p-8 text-center">
            <DollarSign className="mx-auto mb-4 text-xsm-light-gray" size={48} />
            <h2 className="text-xl font-bold text-white mb-2">No Deals Yet</h2>
            <p className="text-xsm-light-gray">
              When buyers create deals for your channels, they will appear here for your review.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {deals.map((deal) => (
              <div
                key={deal.id}
                className="bg-xsm-dark-gray rounded-lg p-6 border border-gray-700 hover:border-xsm-yellow transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-4">
                      <h3 className="text-xl font-bold text-white">{deal.channel_title}</h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(deal.deal_status)}`}>
                        {getStatusText(deal.deal_status)}
                      </span>
                      {!deal.seller_agreed && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                          Action Required
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-xsm-light-gray text-sm">Transaction ID</p>
                        <p className="text-white font-mono text-sm">{deal.transaction_id}</p>
                      </div>
                      <div>
                        <p className="text-xsm-light-gray text-sm">Buyer</p>
                        <p className="text-white font-medium">{deal.buyer_username}</p>
                      </div>
                      <div>
                        <p className="text-xsm-light-gray text-sm">Created</p>
                        <p className="text-white">{formatDate(deal.created_at)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-xsm-light-gray text-sm">Sale Price</p>
                        <p className="text-green-400 font-bold text-lg">${deal.channel_price}</p>
                      </div>
                      <div>
                        <p className="text-xsm-light-gray text-sm">Escrow Fee</p>
                        <p className="text-white">${deal.escrow_fee}</p>
                      </div>
                      <div>
                        <p className="text-xsm-light-gray text-sm">Payment Methods</p>
                        <p className="text-white">{deal.payment_methods.length} selected</p>
                      </div>
                    </div>

                    {deal.payment_methods.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xsm-light-gray text-sm mb-2">Available Payment Methods:</p>
                        <div className="flex flex-wrap gap-2">
                          {deal.payment_methods.slice(0, 3).map((method, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-gray-700 text-white rounded text-sm"
                            >
                              {method.name}
                            </span>
                          ))}
                          {deal.payment_methods.length > 3 && (
                            <span className="px-2 py-1 bg-gray-600 text-white rounded text-sm">
                              +{deal.payment_methods.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {deal.seller_agreed && deal.seller_agreed_at && (
                      <div className="flex items-center space-x-2 text-green-400 text-sm">
                        <CheckCircle size={16} />
                        <span>You agreed to terms on {formatDate(deal.seller_agreed_at)}</span>
                      </div>
                    )}
                  </div>

                  <div className="lg:ml-6 mt-4 lg:mt-0">
                    <button
                      onClick={() => handleViewDeal(deal)}
                      className="w-full lg:w-auto bg-xsm-yellow text-black px-6 py-3 rounded-lg hover:bg-yellow-400 transition-colors flex items-center justify-center space-x-2 font-medium"
                    >
                      <Eye size={20} />
                      <span>{deal.seller_agreed ? 'View Deal' : 'Review Deal'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Deal View Modal */}
        <SellerDealView
          isOpen={isViewOpen}
          onClose={handleCloseView}
          deal={selectedDeal}
          onDealUpdate={handleDealUpdate}
        />
      </div>
    </div>
  );
};

export default SellerDeals;
