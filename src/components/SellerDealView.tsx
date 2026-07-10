import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Clock, User, CreditCard, DollarSign, Calendar, FileText, Shield, Timer } from 'lucide-react';
import TransactionFeePayment from './TransactionFeePayment';

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
  transaction_fee_paid?: boolean;
  transaction_fee_paid_by?: string;
  transaction_fee_payment_method?: string;
  agent_email_sent?: boolean;
  agent_email_sent_at?: string | null;
  seller_gave_rights?: boolean;
  seller_gave_rights_at?: string | null;
  // New agent rights fields
  platform_type?: string;
  rights_timer_started_at?: string | null;
  rights_timer_expires_at?: string | null;
  timer_completed?: boolean;
  seller_made_primary_owner?: boolean;
  seller_made_primary_owner_at?: string | null;
  buyer_paid_seller?: boolean;
  buyer_paid_seller_at?: string | null;
  seller_confirmed_payment?: boolean;
  seller_confirmed_payment_at?: string | null;
}

interface SellerDealViewProps {
  isOpen: boolean;
  onClose: () => void;
  deal: Deal | null;
  onDealUpdate: () => void;
}

const SellerDealView: React.FC<SellerDealViewProps> = ({
  isOpen,
  onClose,
  deal,
  onDealUpdate
}) => {
  const [isAgreeing, setIsAgreeing] = useState(false);
  const [isConfirmingRights, setIsConfirmingRights] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [showFeePayment, setShowFeePayment] = useState(false);
  const [dealStatus, setDealStatus] = useState<any>(null);
  const [timerInfo, setTimerInfo] = useState<any>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const fetchDealStatus = async () => {
    if (!deal?.id) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/deals/${deal.id}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Deal status fetched:', result); // Debug logging
        setDealStatus(result);
        setTimerInfo(result);
      } else {
        console.error('Failed to fetch deal status:', response.status);
      }
    } catch (error) {
      console.error('Error fetching deal status:', error);
    }
  };

  useEffect(() => {
    if (isOpen && deal) {
      fetchDealStatus();
      // Refresh status every 30 seconds if deal is active
      const interval = setInterval(fetchDealStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen, deal?.id]);

  if (!isOpen || !deal) return null;

  const handleConfirmRights = async () => {
    try {
      setIsConfirmingRights(true);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/deals/${deal.id}/confirm-rights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        let message = `✅ Rights Confirmation Successful!

You have confirmed that you've given account access to our agent.

Transaction ID: ${deal.transaction_id}
Channel: ${deal.channel_title}
Status: Agent Access Confirmed`;

        // Add platform-specific messaging
        if (result.platform_type === 'youtube') {
          message += `

⏰ YouTube Channel Timer Started
Due to YouTube's requirements, you must wait 7 days before promoting our agent to Primary Owner. 

Timer started: Now
Timer expires: ${result.timer_expires_formatted || 'In 7 days'}

You will be able to promote the agent to Primary Owner after the timer expires. We'll notify you when it's time!`;
        } else {
          message += `

✅ Ready for Primary Owner Promotion
Since this is not a YouTube channel, you can immediately promote our agent to Primary Owner when ready.`;
        }

        message += `

Our agent will now verify the account access. Thank you for your cooperation in ensuring a secure transaction!`;

        alert(message);

        onDealUpdate();
        fetchDealStatus(); // Refresh status to get timer info
        onClose();
      } else {
        throw new Error(result.message || 'Failed to confirm rights');
      }
      
    } catch (error) {
      console.error('Error confirming rights:', error);
      alert('Failed to confirm rights: ' + error.message);
    } finally {
      setIsConfirmingRights(false);
    }
  };

  const handleConfirmPaymentReceived = async () => {
    try {
      setIsConfirmingPayment(true);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/deals/${deal.id}/seller-confirmed-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        alert(`✅ Payment Receipt Confirmed!

You have successfully confirmed that you received payment from the buyer.

Transaction ID: ${deal.transaction_id}
Channel: ${deal.channel_title}
Amount: $${deal.channel_price}

🎉 Deal Status: Payment Complete!

Both you and the buyer have now confirmed the payment. Our agent will complete the final account transfer and provide the buyer with final account credentials.

Thank you for using our secure marketplace!`);

        onDealUpdate();
        fetchDealStatus(); // Refresh status
        onClose();
      } else {
        throw new Error(result.message || 'Failed to confirm payment receipt');
      }
      
    } catch (error) {
      console.error('Error confirming payment receipt:', error);
      alert('Failed to confirm payment receipt: ' + error.message);
    } finally {
      setIsConfirmingPayment(false);
    }
  };

  const handleAgreeToTerms = async () => {
    try {
      setIsAgreeing(true);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/deals/${deal.id}/seller-agree`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        alert(`✅ Deal Agreement Successful!

You have successfully agreed to the terms for transaction ${deal.transaction_id}.

Channel: ${deal.channel_title}
Amount: $${deal.channel_price}
Buyer: ${deal.buyer_username}

The buyer will now be notified that you have accepted their payment methods. The transaction will proceed to the next step.

Deal Status: Terms Agreed - Awaiting Escrow Payment`);

        onDealUpdate();
        onClose();
      } else {
        throw new Error(result.message || 'Failed to agree to deal');
      }
      
    } catch (error) {
      console.error('Error agreeing to deal:', error);
      alert('Failed to agree to deal. Please try again.');
    } finally {
      setIsAgreeing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-500';
      case 'terms_agreed': return 'text-green-500';
      case 'completed': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Waiting for Your Review';
      case 'terms_agreed': return 'Terms Agreed - Awaiting Payment';
      case 'agent_access_pending': return 'Awaiting Agent Access Confirmation';
      case 'waiting_promotion_timer': return 'Waiting for YouTube Timer (7 days)';
      case 'promotion_timer_complete': return 'Transfer Complete';
      case 'admin_ownership_confirmed': return 'Admin Confirmed Primary Owner';
      case 'buyer_paid_seller': return 'Buyer Confirmed Payment';
      case 'seller_confirmed_payment': return 'Payment Complete - Deal Finalized';
      case 'completed': return 'Deal Completed';
      default: return status;
    }
  };

  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return '0 seconds';
    
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}, ${hours} hour${hours > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}, ${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-xsm-dark-gray rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Deal Review</h2>
            <p className="text-xsm-light-gray">Transaction ID: {deal.transaction_id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-xsm-light-gray hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Deal Status */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Clock className="text-xsm-yellow" size={20} />
                <span className="text-white font-medium">Deal Status</span>
              </div>
              <span className={`font-semibold ${getStatusColor(deal.deal_status)}`}>
                {getStatusText(deal.deal_status)}
              </span>
            </div>
          </div>

          {/* Channel Information */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-xsm-yellow mb-3">Channel Details</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-white">
                <span>Channel:</span>
                <span className="font-medium">{deal.channel_title}</span>
              </div>
              <div className="flex justify-between text-white">
                <span>Channel ID:</span>
                <span className="font-mono text-sm">{deal.channel_id}</span>
              </div>
              <div className="flex justify-between text-white">
                <span>Sale Price:</span>
                <span className="font-semibold text-green-400">${deal.channel_price}</span>
              </div>
              <div className="flex justify-between text-white">
                <span>Escrow Fee:</span>
                <span>${deal.escrow_fee}</span>
              </div>
              <div className="flex justify-between text-white">
                <span>Transaction Type:</span>
                <span className="capitalize">{deal.transaction_type}</span>
              </div>
            </div>
          </div>

          {/* Buyer Information */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-xsm-yellow mb-3">Buyer Information</h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <User className="text-xsm-light-gray" size={20} />
                <span className="text-white font-medium">{deal.buyer_username}</span>
              </div>
              <div className="flex items-center space-x-3">
                <Calendar className="text-xsm-light-gray" size={20} />
                <span className="text-xsm-light-gray">Deal created: {formatDate(deal.created_at)}</span>
              </div>
              {/* Note: Transfer email is hidden for seller privacy as requested */}
            </div>
          </div>

          {/* Payment Methods Selected by Buyer */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-xsm-yellow mb-3">
              <CreditCard className="inline mr-2" size={20} />
              Payment Methods Available
            </h3>
            <p className="text-xsm-light-gray mb-4">
              The buyer has selected these payment methods. If you're comfortable with any of these options, click "I Agree to Terms" below.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {deal.payment_methods.map((method, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg"
                >
                  <div className="w-8 h-8 bg-xsm-yellow rounded-full flex items-center justify-center">
                    <DollarSign size={16} className="text-black" />
                  </div>
                  <div>
                    <div className="text-white font-medium">{method.name}</div>
                    <div className="text-xsm-light-gray text-sm capitalize">{method.category}</div>
                  </div>
                </div>
              ))}
            </div>
            
            {deal.payment_methods.length === 0 && (
              <div className="text-center py-4">
                <p className="text-xsm-light-gray">No payment methods selected</p>
              </div>
            )}
          </div>

          {/* Transaction Process */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-xsm-yellow mb-3">Transaction Process</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle size={12} className="text-white" />
                </div>
                <span className="text-white">Buyer created deal and selected payment methods</span>
              </div>
              
              <div className={`flex items-center space-x-3 ${deal.seller_agreed ? 'opacity-100' : 'opacity-60'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  deal.seller_agreed ? 'bg-green-500' : 'bg-gray-600'
                }`}>
                  {deal.seller_agreed ? <CheckCircle size={12} className="text-white" /> : <span className="text-white text-xs">2</span>}
                </div>
                <span className="text-white">Seller agrees to payment methods</span>
                {deal.seller_agreed_at && (
                  <span className="text-xsm-light-gray text-sm">
                    (Agreed: {formatDate(deal.seller_agreed_at)})
                  </span>
                )}
              </div>
              
              <div className={`flex items-center space-x-3 ${(dealStatus?.transaction_fee_paid ?? deal.transaction_fee_paid) ? 'opacity-100' : 'opacity-60'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  (dealStatus?.transaction_fee_paid ?? deal.transaction_fee_paid) ? 'bg-green-500' : 'bg-gray-600'
                }`}>
                  {(dealStatus?.transaction_fee_paid ?? deal.transaction_fee_paid) ? <CheckCircle size={12} className="text-white" /> : <span className="text-white text-xs">3</span>}
                </div>
                <span className="text-white">Transaction fee paid</span>
              </div>
              
              <div className={`flex items-center space-x-3 ${(dealStatus?.seller_gave_rights ?? deal.seller_gave_rights) ? 'opacity-100' : 'opacity-60'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  (dealStatus?.seller_gave_rights ?? deal.seller_gave_rights) ? 'bg-green-500' : 'bg-gray-600'
                }`}>
                  {(dealStatus?.seller_gave_rights ?? deal.seller_gave_rights) ? <CheckCircle size={12} className="text-white" /> : <span className="text-white text-xs">4</span>}
                </div>
                <span className="text-white">Give agent manager access</span>
              </div>

              {/* YouTube Timer Step */}
              {dealStatus?.platform_type === 'youtube' && (
                <div className={`flex items-center space-x-3 ${dealStatus?.timer_completed ? 'opacity-100' : 'opacity-60'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    dealStatus?.timer_completed ? 'bg-green-500' : dealStatus?.seller_gave_rights ? 'bg-yellow-500' : 'bg-gray-600'
                  }`}>
                    {dealStatus?.timer_completed ? <CheckCircle size={12} className="text-white" /> : 
                     dealStatus?.seller_gave_rights ? <Timer size={12} className="text-white" /> : 
                     <span className="text-white text-xs">5</span>}
                  </div>
                  <span className="text-white">Wait 7 days (YouTube requirement)</span>
                  {dealStatus?.timer_remaining_seconds > 0 && (
                    <span className="text-yellow-400 text-sm">
                      ({formatTimeRemaining(dealStatus.timer_remaining_seconds)} remaining)
                    </span>
                  )}
                </div>
              )}
              
              <div className={`flex items-center space-x-3 ${dealStatus?.seller_made_primary_owner ? 'opacity-100' : 'opacity-60'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  dealStatus?.seller_made_primary_owner ? 'bg-green-500' : 'bg-gray-600'
                }`}>
                  {dealStatus?.seller_made_primary_owner ? <CheckCircle size={12} className="text-white" /> : 
                   <span className="text-white text-xs">{dealStatus?.platform_type === 'youtube' ? '6' : '5'}</span>}
                </div>
                <span className="text-white">Promote agent to primary owner</span>
              </div>
              
              <div className="flex items-center space-x-3 opacity-60">
                <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">{dealStatus?.platform_type === 'youtube' ? '7' : '6'}</span>
                </div>
                <span className="text-white">Buyer pays you via selected method</span>
              </div>
              
              <div className="flex items-center space-x-3 opacity-60">
                <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">{dealStatus?.platform_type === 'youtube' ? '8' : '7'}</span>
                </div>
                <span className="text-white">Channel transferred to buyer</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-700 text-white py-3 px-6 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Back
            </button>
            
            {!deal.seller_agreed && (
              <button
                onClick={handleAgreeToTerms}
                disabled={isAgreeing}
                className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isAgreeing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Agreeing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    <span>I Agree to Terms</span>
                  </>
                )}
              </button>
            )}
            
            {/* Show transaction fee payment button for seller if not paid yet - Use dealStatus for real-time data */}
            {(() => {
              const showPayButton = deal.seller_agreed && !(dealStatus?.transaction_fee_paid ?? deal.transaction_fee_paid);
              console.log('Pay Transaction Fee button - Show:', showPayButton, {
                seller_agreed: deal.seller_agreed,
                transaction_fee_paid_status: dealStatus?.transaction_fee_paid,
                transaction_fee_paid_fallback: deal.transaction_fee_paid,
                final_paid_value: (dealStatus?.transaction_fee_paid ?? deal.transaction_fee_paid)
              });
              return showPayButton;
            })() && (
              <button
                onClick={() => setShowFeePayment(true)}
                className="flex-1 bg-xsm-yellow text-black py-3 px-6 rounded-lg hover:bg-yellow-500 transition-colors flex items-center justify-center space-x-2 font-semibold"
              >
                <DollarSign size={20} />
                <span>Pay Transaction Fee</span>
              </button>
            )}
            
            {/* Show rights confirmation button once fee is paid - Use dealStatus for real-time data */}
            {(() => {
              const showRightsButton = deal.seller_agreed && (dealStatus?.transaction_fee_paid ?? deal.transaction_fee_paid) && !(dealStatus?.seller_gave_rights ?? deal.seller_gave_rights);
              console.log('I Have Given The Rights button - Show:', showRightsButton, {
                seller_agreed: deal.seller_agreed,
                transaction_fee_paid_status: dealStatus?.transaction_fee_paid,
                transaction_fee_paid_fallback: deal.transaction_fee_paid,
                seller_gave_rights_status: dealStatus?.seller_gave_rights,
                seller_gave_rights_fallback: deal.seller_gave_rights,
                final_paid_value: (dealStatus?.transaction_fee_paid ?? deal.transaction_fee_paid),
                final_rights_value: (dealStatus?.seller_gave_rights ?? deal.seller_gave_rights)
              });
              return showRightsButton;
            })() && (
              <button
                onClick={handleConfirmRights}
                disabled={isConfirmingRights}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-semibold"
              >
                {isConfirmingRights ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Confirming...</span>
                  </>
                ) : (
                  <>
                    <Shield size={20} />
                    <span>I Have Given The Rights</span>
                  </>
                )}
              </button>
            )}
            
            {/* Show timer status for all platforms - YouTube shows countdown, others show waiting for admin */}
            {deal.seller_agreed && (dealStatus?.transaction_fee_paid ?? deal.transaction_fee_paid) && (dealStatus?.seller_gave_rights ?? deal.seller_gave_rights) && !dealStatus?.seller_made_primary_owner && (
              <div className="flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg flex items-center justify-center space-x-2 opacity-75 cursor-not-allowed">
                <Timer size={20} />
                {dealStatus?.platform_type === 'youtube' && dealStatus?.timer_remaining_seconds > 0 ? (
                  <span>Wait {Math.ceil((dealStatus.timer_remaining_seconds || 0) / (24 * 60 * 60))} More Days</span>
                ) : (
                  <span>Waiting for Admin to Promote Agent</span>
                )}
              </div>
            )}

            {dealStatus?.seller_made_primary_owner && !dealStatus?.buyer_paid_seller && (
              <div className="flex-1 bg-yellow-600 text-white py-3 px-6 rounded-lg flex items-center justify-center space-x-2">
                <Clock size={20} />
                <span>Waiting for Buyer Payment</span>
              </div>
            )}

            {dealStatus?.seller_made_primary_owner && dealStatus?.buyer_paid_seller && !dealStatus?.seller_confirmed_payment && (
              <button
                onClick={handleConfirmPaymentReceived}
                disabled={isConfirmingPayment}
                className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-semibold"
              >
                {isConfirmingPayment ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Confirming...</span>
                  </>
                ) : (
                  <>
                    <DollarSign size={20} />
                    <span>I Have Received The Payment</span>
                  </>
                )}
              </button>
            )}

            {dealStatus?.seller_made_primary_owner && dealStatus?.buyer_paid_seller && dealStatus?.seller_confirmed_payment && (
              <div className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg flex items-center justify-center space-x-2">
                <CheckCircle size={20} />
                <span>Deal Complete - Both Payments Confirmed</span>
              </div>
            )}
          </div>

          {/* Payment Method Negotiation Note */}
          {!deal.seller_agreed && (
            <div className="bg-blue-900 border border-blue-700 rounded-lg p-4">
              <h4 className="text-blue-300 font-medium mb-2">Payment Method Negotiation</h4>
              <p className="text-blue-200 text-sm">
                If none of the buyer's selected payment methods work for you, you can contact them through the chat system to discuss alternative payment methods. Once you both agree on a method, come back here and click "I Agree to Terms".
              </p>
            </div>
          )}

          {/* Next Steps for Transaction Fee */}
          {deal.seller_agreed && !(dealStatus?.transaction_fee_paid ?? deal.transaction_fee_paid) && (
            <div className="bg-xsm-yellow bg-opacity-10 border border-xsm-yellow rounded-lg p-4">
              <h4 className="text-xsm-yellow font-medium mb-2 flex items-center">
                <FileText size={16} className="mr-2" />
                Transaction Fee Payment Required
              </h4>
              <p className="text-yellow-200 text-sm mb-3">
                The transaction fee ({formatCurrency(deal.escrow_fee)}) needs to be paid to proceed with the deal. 
                Either you or the buyer can pay this fee to move forward.
              </p>
              <div className="bg-yellow-800 rounded-lg p-3 space-y-2">
                <p className="text-yellow-200 text-sm font-medium">💰 Payment Options:</p>
                <ul className="text-yellow-200 text-xs space-y-1 ml-4">
                  <li>• Buyer pays (most common)</li>
                  <li>• You pay (if agreed upon)</li>
                  <li>• Either party can proceed</li>
                </ul>
              </div>
              <div className="mt-3 p-3 bg-yellow-800 rounded-lg">
                <p className="text-yellow-200 text-xs">
                  💡 Once either party pays the fee, the "I Have Given The Rights" button will appear automatically.
                </p>
              </div>
            </div>
          )}

          {/* Transaction Fee Paid Status */}
          {(dealStatus?.transaction_fee_paid ?? deal.transaction_fee_paid) && (
            <div className="bg-green-900 border border-green-700 rounded-lg p-4">
              <h4 className="text-green-300 font-medium mb-2 flex items-center">
                <CheckCircle size={16} className="mr-2" />
                Transaction Fee Paid
              </h4>
              <p className="text-green-200 text-sm">
                The transaction fee has been paid by {(dealStatus?.transaction_fee_paid_by ?? deal.transaction_fee_paid_by) === 'seller' ? 'you' : 'the buyer'} 
                via {(dealStatus?.transaction_fee_payment_method ?? deal.transaction_fee_payment_method)}. The deal will now proceed to the next stage.
              </p>
            </div>
          )}

          {/* Agent Email and Rights Instructions */}
          {(dealStatus?.transaction_fee_paid ?? deal.transaction_fee_paid) && (dealStatus?.agent_email_sent ?? deal.agent_email_sent) && !(dealStatus?.seller_gave_rights ?? deal.seller_gave_rights) && (
            <div className="bg-blue-900 border border-blue-700 rounded-lg p-4">
              <h4 className="text-blue-300 font-medium mb-3 flex items-center">
                <Shield size={16} className="mr-2" />
                Give Account Rights to Agent
              </h4>
              <div className="space-y-3">
                <div className="bg-blue-800 rounded-lg p-3">
                  <p className="text-blue-200 text-sm font-medium mb-1">📧 Agent Email:</p>
                  <p className="text-blue-100 font-mono text-sm bg-blue-700 p-2 rounded">
                    rebirthcar63@gmail.com
                  </p>
                </div>
                <div className="text-blue-200 text-sm space-y-2">
                  <p className="font-medium">Instructions:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Add the agent email as a manager/collaborator to your account</li>
                    <li>Give permissions to view and manage the account</li>
                    <li>DO NOT transfer ownership yet - our agent will handle that securely</li>
                    <li>Click "I Have Given The Rights" button below once completed</li>
                  </ol>
                </div>
                <div className="bg-yellow-800 border border-yellow-600 rounded-lg p-3">
                  <p className="text-yellow-200 text-xs">
                    ⚠️ Important: Only give manager/collaborator access, NOT ownership. Our agent will handle the ownership transfer process securely.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Rights Confirmation Status */}
          {(dealStatus?.seller_gave_rights ?? deal.seller_gave_rights) && (
            <div className="bg-green-900 border border-green-700 rounded-lg p-4">
              <h4 className="text-green-300 font-medium mb-2 flex items-center">
                <CheckCircle size={16} className="mr-2" />
                Rights Confirmed
              </h4>
              <p className="text-green-200 text-sm">
                You have confirmed giving account access to our agent. The agent is now verifying the account and will proceed with the secure transfer process. You will be updated once verification is complete.
              </p>
            </div>
          )}

          {/* YouTube Timer Display */}
          {dealStatus?.platform_type === 'youtube' && dealStatus?.seller_gave_rights && !dealStatus?.timer_completed && dealStatus?.timer_remaining_seconds > 0 && (
            <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4">
              <h4 className="text-yellow-300 font-medium mb-3 flex items-center">
                <Timer size={16} className="mr-2" />
                YouTube Primary Owner Timer
              </h4>
              <div className="space-y-3">
                <p className="text-yellow-200 text-sm">
                  YouTube requires a 7-day waiting period before you can promote our agent to Primary Owner.
                </p>
                <div className="bg-yellow-800 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-yellow-200 text-sm font-medium">Time Remaining:</span>
                    <span className="text-yellow-100 font-bold">
                      {formatTimeRemaining(dealStatus.timer_remaining_seconds)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-yellow-200 text-sm">Timer Expires:</span>
                    <span className="text-yellow-100 text-sm font-mono">
                      {dealStatus.timer_expires_formatted}
                    </span>
                  </div>
                </div>
                <p className="text-yellow-200 text-xs">
                  ⏰ You will be able to promote the agent to Primary Owner after this timer expires. We'll update the interface automatically when it's ready.
                </p>
              </div>
            </div>
          )}

          {/* Timer Completed - Admin Will Handle Primary Owner */}
          {dealStatus?.seller_gave_rights && ((dealStatus?.platform_type !== 'youtube') || (dealStatus?.platform_type === 'youtube' && (dealStatus?.timer_expired || dealStatus?.timer_completed))) && !dealStatus?.seller_made_primary_owner && (
            <div className="bg-blue-900 border border-blue-700 rounded-lg p-4">
              <h4 className="text-blue-300 font-medium mb-3 flex items-center">
                <Shield size={16} className="mr-2" />
                Ready for Admin to Promote Agent
              </h4>
              <div className="space-y-3">
                {dealStatus?.platform_type === 'youtube' ? (
                  <p className="text-blue-200 text-sm">
                    ✅ The 7-day YouTube timer has completed! Our admin will now promote the agent to Primary Owner of your channel.
                  </p>
                ) : (
                  <p className="text-blue-200 text-sm">
                    Since this is not a YouTube channel, our admin can promote the agent to Primary Owner immediately.
                  </p>
                )}
                <div className="bg-blue-800 rounded-lg p-3">
                  <p className="text-blue-200 text-sm font-medium mb-2">What happens next:</p>
                  <ol className="list-decimal list-inside space-y-1 text-blue-200 text-sm ml-2">
                    <li>Our admin will access your channel's management settings</li>
                    <li>Agent will be promoted to Primary Owner</li>
                    <li>You'll receive notification when the promotion is complete</li>
                    <li>Deal will proceed to final buyer payment stage</li>
                  </ol>
                </div>
                <div className="bg-yellow-800 border border-yellow-600 rounded-lg p-3">
                  <p className="text-yellow-200 text-xs">
                    ⚠️ No action required from you. Our admin team will handle the Primary Owner promotion securely.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Primary Owner Confirmation Complete */}
          {dealStatus?.seller_made_primary_owner && (
            <div className="bg-green-900 border border-green-700 rounded-lg p-4">
              <h4 className="text-green-300 font-medium mb-2 flex items-center">
                <CheckCircle size={16} className="mr-2" />
                Primary Owner Transfer Complete!
              </h4>
              <p className="text-green-200 text-sm">
                🎉 Congratulations! You have successfully transferred Primary Owner rights to our agent. The channel transfer is now complete and the deal is in its final stages.
              </p>
            </div>
          )}

          {/* Buyer Payment Confirmation Status */}
          {dealStatus?.seller_made_primary_owner && dealStatus?.buyer_paid_seller && (
            <div className="bg-blue-900 border border-blue-700 rounded-lg p-4">
              <h4 className="text-blue-300 font-medium mb-2 flex items-center">
                <DollarSign size={16} className="mr-2" />
                Buyer Payment Confirmed
              </h4>
              <p className="text-blue-200 text-sm">
                💰 The buyer has confirmed that they have paid you the agreed amount ($${dealStatus.channel_price || deal.channel_price}) for the channel transfer.
                {dealStatus?.buyer_paid_seller_at && (
                  <span className="block mt-2 text-blue-300 text-xs">
                    Confirmed on: {new Date(dealStatus.buyer_paid_seller_at).toLocaleDateString()}
                  </span>
                )}
              </p>
              {!dealStatus?.seller_confirmed_payment && (
                <div className="mt-3 p-3 bg-blue-800 rounded-lg">
                  <p className="text-blue-200 text-sm font-medium">⏳ Action Required:</p>
                  <p className="text-blue-200 text-xs">Please confirm once you have received the payment by clicking "I Have Received The Payment" button above.</p>
                </div>
              )}
            </div>
          )}

          {/* Seller Payment Confirmation Complete */}
          {dealStatus?.seller_confirmed_payment && (
            <div className="bg-green-900 border border-green-700 rounded-lg p-4">
              <h4 className="text-green-300 font-medium mb-2 flex items-center">
                <CheckCircle size={16} className="mr-2" />
                Payment Receipt Confirmed!
              </h4>
              <p className="text-green-200 text-sm">
                ✅ You have confirmed receiving payment from the buyer. Both parties have now confirmed the payment completion.
                {dealStatus?.seller_confirmed_payment_at && (
                  <span className="block mt-2 text-green-300 text-xs">
                    Confirmed on: {new Date(dealStatus.seller_confirmed_payment_at).toLocaleDateString()}
                  </span>
                )}
              </p>
              <div className="mt-3 p-3 bg-green-800 rounded-lg">
                <p className="text-green-200 text-sm">
                  🎊 The deal is now complete! Our agent will finalize the account transfer and provide the buyer with final account credentials.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Transaction Fee Payment Modal */}
      <TransactionFeePayment
        isOpen={showFeePayment}
        onClose={() => setShowFeePayment(false)}
        deal={deal}
        userType="seller"
        onPaymentComplete={() => {
          console.log('Payment completed, refreshing status...');
          setShowFeePayment(false);
          onDealUpdate();
          // Add small delay to ensure backend has processed the payment
          setTimeout(fetchDealStatus, 1000);
        }}
      />
    </div>
  );
};

export default SellerDealView;
