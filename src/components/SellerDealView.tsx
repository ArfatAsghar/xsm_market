import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Clock, User, CreditCard, DollarSign, Calendar, FileText, Shield, Timer } from 'lucide-react';
import TransactionFeePayment from './TransactionFeePayment';
import DealAlertModal, { DealAlertModalProps } from './DealAlertModal';
import { API_URL } from '@/services/auth';
import { useAuth } from '@/context/useAuth';

interface PaymentMethod {
  id: string;
  name: string;
  category: string;
}

interface Deal {
  id: number;
  deal_id?: number;
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
  assigned_email?: string | null;
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
  const { user } = useAuth();
  const isAdmin = Boolean((user as any)?.isAdmin || (user as any)?.role === 'admin' || (user as any)?.role === 'manager');
  const [isAgreeing, setIsAgreeing] = useState(false);
  const [isConfirmingRights, setIsConfirmingRights] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [showFeePayment, setShowFeePayment] = useState(false);
  const [dealStatus, setDealStatus] = useState<any>(null);
  const [timerInfo, setTimerInfo] = useState<any>(null);
  const [alertConfig, setAlertConfig] = useState<Omit<DealAlertModalProps, 'onClose'> | null>(null);

  const getDealIdentifier = () => {
    if (!deal) return '';
    if (deal.transaction_id && typeof deal.transaction_id === 'string' && deal.transaction_id.trim().toUpperCase().startsWith('TXN')) {
      return deal.transaction_id.trim();
    }
    return deal.id || deal.deal_id || deal.transaction_id || '';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const fetchDealStatus = async () => {
    const id = getDealIdentifier();
    if (!id) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/deals/${id}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
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
      const interval = setInterval(fetchDealStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen, deal?.id, deal?.transaction_id]);

  if (!isOpen || !deal) return null;

  const handleConfirmRights = async () => {
    const id = getDealIdentifier();
    try {
      setIsConfirmingRights(true);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/deals/${id}/confirm-rights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json().catch(() => ({}));
      
      if (response.ok && result.success !== false) {
        let noticeMessage = `You have confirmed that you've given account access to our agent.`;
        if (result.platform_type === 'youtube') {
          noticeMessage += `\n\n⏰ YouTube Channel Timer Started\nDue to YouTube's requirements, you must wait 7 days before promoting our agent to Primary Owner. Timer expires: ${result.timer_expires_formatted || 'In 7 days'}.\n\nYou will be notified when the timer completes.`;
        } else {
          noticeMessage += `\n\n✅ Ready for Primary Owner Promotion\nYou can immediately promote our agent to Primary Owner when ready.`;
        }
        noticeMessage += `\n\nOur agent will now verify the account access.`;

        setAlertConfig({
          title: 'Rights Confirmation Successful!',
          message: noticeMessage,
          type: 'success',
          details: [
            { label: 'Transaction ID', value: deal.transaction_id },
            { label: 'Channel', value: deal.channel_title },
            { label: 'Status', value: 'Agent Access Confirmed' }
          ],
          actionText: 'OK',
          onAction: () => {
            setAlertConfig(null);
            onDealUpdate();
            fetchDealStatus();
            onClose();
          }
        });
      } else {
        throw new Error(result.message || 'Failed to confirm rights');
      }
      
    } catch (error: any) {
      console.error('Error confirming rights:', error);
      setAlertConfig({
        title: 'Rights Confirmation',
        message: error.message || 'Failed to confirm rights. Please try again.',
        type: 'error',
        actionText: 'Close',
        onAction: () => setAlertConfig(null)
      });
    } finally {
      setIsConfirmingRights(false);
    }
  };

  const handleConfirmPaymentReceived = async () => {
    const id = getDealIdentifier();
    try {
      setIsConfirmingPayment(true);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/deals/${id}/seller-confirmed-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json().catch(() => ({}));
      
      if (response.ok && result.success !== false) {
        setAlertConfig({
          title: 'Payment Receipt Confirmed!',
          message: `You have successfully confirmed that you received payment from the buyer.\n\n🎉 Deal Status: Payment Complete!\n\nBoth you and the buyer have now confirmed the payment. Our agent will complete the final account transfer and provide the buyer with final account credentials.`,
          type: 'success',
          details: [
            { label: 'Transaction ID', value: deal.transaction_id },
            { label: 'Channel', value: deal.channel_title },
            { label: 'Amount', value: `$${deal.channel_price}` }
          ],
          actionText: 'Great!',
          onAction: () => {
            setAlertConfig(null);
            onDealUpdate();
            fetchDealStatus();
            onClose();
          }
        });
      } else {
        throw new Error(result.message || 'Failed to confirm payment receipt');
      }
      
    } catch (error: any) {
      console.error('Error confirming payment receipt:', error);
      setAlertConfig({
        title: 'Payment Confirmation',
        message: error.message || 'Failed to confirm payment receipt. Please try again.',
        type: 'error',
        actionText: 'Close',
        onAction: () => setAlertConfig(null)
      });
    } finally {
      setIsConfirmingPayment(false);
    }
  };

  const handleAgreeToTerms = async () => {
    const id = getDealIdentifier();
    try {
      setIsAgreeing(true);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/deals/${id}/seller-agree`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transaction_id: deal.transaction_id,
          deal_id: deal.id || deal.deal_id,
          channel_title: deal.channel_title,
          channel_price: deal.channel_price
        })
      });

      const result = await response.json().catch(() => ({}));
      
      if (response.ok && result.success !== false) {
        setAlertConfig({
          title: 'Deal Agreement Successful!',
          message: `You have successfully agreed to the terms for transaction ${deal.transaction_id}.\n\nThe buyer will now be notified that you have accepted their payment methods. The transaction will proceed to the next step.`,
          type: 'success',
          details: [
            { label: 'Transaction ID', value: deal.transaction_id },
            { label: 'Channel', value: deal.channel_title },
            { label: 'Price', value: `$${deal.channel_price}` },
            { label: 'Buyer', value: deal.buyer_username }
          ],
          actionText: 'Continue',
          onAction: () => {
            setAlertConfig(null);
            onDealUpdate();
            onClose();
          }
        });
      } else {
        throw new Error(result.message || 'Failed to agree to deal');
      }
      
    } catch (error: any) {
      console.error('Error agreeing to deal:', error);
      setAlertConfig({
        title: 'Deal Agreement Notice',
        message: error.message || 'Failed to agree to deal. Please try again.',
        type: 'error',
        actionText: 'Close',
        onAction: () => setAlertConfig(null)
      });
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
      case 'pending': return 'text-amber-500';
      case 'seller_reviewing': return 'text-amber-500';
      case 'terms_agreed': return 'text-emerald-500';
      case 'completed': return 'text-blue-500';
      default: return 'text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Waiting for Your Review';
      case 'seller_reviewing': return 'Waiting for Your Review';
      case 'terms_agreed': return 'Terms Agreed - Awaiting Payment';
      case 'agent_access_pending': return 'Awaiting Agent Access Confirmation';
      case 'waiting_promotion_timer': return 'Waiting for YouTube Timer (7 days)';
      case 'promotion_timer_complete': return 'Transfer Complete';
      case 'admin_ownership_confirmed': return 'Admin Confirmed Primary Owner';
      case 'buyer_paid_seller': return 'Buyer Confirmed Payment';
      case 'seller_confirmed_payment': return 'Payment Complete - Deal Finalized';
      case 'completed': return 'Deal Completed';
      default: return status ? status.replace(/_/g, ' ') : 'Pending';
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
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div 
        className="rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border shadow-2xl transition-colors duration-200"
        style={{
          background: 'var(--xsm-dark-gray)',
          borderColor: 'var(--xsm-border)',
          color: 'var(--xsm-text)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--xsm-border)' }}>
          <div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>Deal Review</h2>
            <p className="text-sm font-mono mt-0.5" style={{ color: 'var(--xsm-light-gray)' }}>Transaction ID: {deal.transaction_id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border transition-colors hover:opacity-80"
            style={{ borderColor: 'var(--xsm-border)', color: 'var(--xsm-light-gray)' }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Deal Status Card */}
          <div className="rounded-xl p-4 border" style={{ background: 'var(--xsm-bg)', borderColor: 'var(--xsm-border)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5" style={{ color: 'var(--xsm-primary)' }} />
                <span className="font-semibold text-sm" style={{ color: 'var(--xsm-text)' }}>Deal Status</span>
              </div>
              <span className={`font-bold text-sm ${getStatusColor(deal.deal_status)}`}>
                {getStatusText(deal.deal_status)}
              </span>
            </div>
          </div>

          {/* Channel Information */}
          <div className="rounded-xl p-4 border" style={{ background: 'var(--xsm-bg)', borderColor: 'var(--xsm-border)' }}>
            <h3 className="text-base font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--xsm-primary)' }}>
              <FileText className="w-4 h-4" />
              Channel Details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: 'var(--xsm-light-gray)' }}>Channel:</span>
                <span className="font-medium" style={{ color: 'var(--xsm-text)' }}>{deal.channel_title}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--xsm-light-gray)' }}>Channel ID:</span>
                <span className="font-mono text-xs" style={{ color: 'var(--xsm-text)' }}>{deal.channel_id}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--xsm-light-gray)' }}>Sale Price:</span>
                <span className="font-bold text-emerald-500">${deal.channel_price}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--xsm-light-gray)' }}>Escrow Fee:</span>
                <span style={{ color: 'var(--xsm-text)' }}>${deal.escrow_fee}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--xsm-light-gray)' }}>Transaction Type:</span>
                <span className="capitalize" style={{ color: 'var(--xsm-text)' }}>{deal.transaction_type}</span>
              </div>
            </div>
          </div>

          {/* Buyer Information */}
          <div className="rounded-xl p-4 border" style={{ background: 'var(--xsm-bg)', borderColor: 'var(--xsm-border)' }}>
            <h3 className="text-base font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--xsm-primary)' }}>
              <User className="w-4 h-4" />
              Buyer Information
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-3">
                <User className="w-4 h-4" style={{ color: 'var(--xsm-light-gray)' }} />
                <span className="font-semibold" style={{ color: 'var(--xsm-text)' }}>{deal.buyer_username}</span>
              </div>
              <div className="flex items-center space-x-3">
                <Calendar className="w-4 h-4" style={{ color: 'var(--xsm-light-gray)' }} />
                <span style={{ color: 'var(--xsm-light-gray)' }}>Deal created: {formatDate(deal.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Payment Methods Selected by Buyer */}
          <div className="rounded-xl p-4 border" style={{ background: 'var(--xsm-bg)', borderColor: 'var(--xsm-border)' }}>
            <h3 className="text-base font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--xsm-primary)' }}>
              <CreditCard className="w-4 h-4" />
              Payment Methods Available
            </h3>
            <p className="text-xs mb-3" style={{ color: 'var(--xsm-light-gray)' }}>
              The buyer has selected these payment methods. If you're comfortable with any of these options, click "I Agree to Terms" below.
            </p>

            {(() => {
              const methods: any[] = Array.isArray(deal?.payment_methods)
                ? deal.payment_methods
                : (typeof (deal as any)?.buyer_payment_methods === 'string'
                    ? (() => { try { return JSON.parse((deal as any).buyer_payment_methods) || []; } catch { return []; } })()
                    : (Array.isArray((deal as any)?.buyer_payment_methods) ? (deal as any).buyer_payment_methods : []));

              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {methods.map((method, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-3 p-3 rounded-xl border"
                        style={{ background: 'var(--xsm-dark-gray)', borderColor: 'var(--xsm-border)' }}
                      >
                        <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0" style={{ background: 'var(--xsm-primary)', color: '#000' }}>
                          $
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs truncate" style={{ color: 'var(--xsm-text)' }}>{method.name || method.id || 'Payment Method'}</div>
                          {method.category && <div className="text-[11px] capitalize" style={{ color: 'var(--xsm-light-gray)' }}>{method.category}</div>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {methods.length === 0 && (
                    <div className="text-center py-3 text-xs" style={{ color: 'var(--xsm-light-gray)' }}>
                      No payment methods selected
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Transaction Steps */}
          <div className="rounded-xl p-4 border" style={{ background: 'var(--xsm-bg)', borderColor: 'var(--xsm-border)' }}>
            <h3 className="text-base font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--xsm-primary)' }}>
              <Shield className="w-4 h-4" />
              Transaction Steps
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shrink-0 shadow-sm">
                  <CheckCircle size={14} className="text-white" />
                </div>
                <span className="font-medium" style={{ color: 'var(--xsm-text)' }}>Buyer started deal and selected payment methods</span>
              </div>
              
              <div className={`flex items-center space-x-3 ${deal.seller_agreed ? 'opacity-100' : 'opacity-85'}`}>
                <div 
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                    deal.seller_agreed ? 'bg-emerald-500 text-white' : ''
                  }`}
                  style={!deal.seller_agreed ? { background: 'var(--xsm-medium-gray)', color: 'var(--xsm-text)' } : undefined}
                >
                  {deal.seller_agreed ? <CheckCircle size={14} className="text-white" /> : <span>2</span>}
                </div>
                <span className="font-medium" style={{ color: 'var(--xsm-text)' }}>Seller agrees to payment methods</span>
              </div>
              
              <div className={`flex items-center space-x-3 ${(dealStatus?.transaction_fee_paid ?? deal.transaction_fee_paid) ? 'opacity-100' : 'opacity-60'}`}>
                <div 
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                    (dealStatus?.transaction_fee_paid ?? deal.transaction_fee_paid) ? 'bg-emerald-500 text-white' : ''
                  }`}
                  style={!(dealStatus?.transaction_fee_paid ?? deal.transaction_fee_paid) ? { background: 'var(--xsm-medium-gray)', color: 'var(--xsm-text)' } : undefined}
                >
                  {(dealStatus?.transaction_fee_paid ?? deal.transaction_fee_paid) ? <CheckCircle size={14} className="text-white" /> : <span>3</span>}
                </div>
                <span className="font-medium" style={{ color: 'var(--xsm-text)' }}>Transaction fee paid</span>
              </div>
              
              <div className={`flex items-center space-x-3 ${(dealStatus?.seller_gave_rights ?? deal.seller_gave_rights) ? 'opacity-100' : 'opacity-60'}`}>
                <div 
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                    (dealStatus?.seller_gave_rights ?? deal.seller_gave_rights) ? 'bg-emerald-500 text-white' : ''
                  }`}
                  style={!(dealStatus?.seller_gave_rights ?? deal.seller_gave_rights) ? { background: 'var(--xsm-medium-gray)', color: 'var(--xsm-text)' } : undefined}
                >
                  {(dealStatus?.seller_gave_rights ?? deal.seller_gave_rights) ? <CheckCircle size={14} className="text-white" /> : <span>4</span>}
                </div>
                <span className="font-medium" style={{ color: 'var(--xsm-text)' }}>Give agent manager access</span>
              </div>
              
              {dealStatus?.platform_type === 'youtube' && (
                <div className={`flex items-center space-x-3 ${dealStatus?.timer_completed ? 'opacity-100' : 'opacity-60'}`}>
                  <div 
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                      dealStatus?.timer_completed ? 'bg-emerald-500 text-white' : ''
                    }`}
                    style={!dealStatus?.timer_completed ? { background: 'var(--xsm-medium-gray)', color: 'var(--xsm-text)' } : undefined}
                  >
                    {dealStatus?.timer_completed ? <CheckCircle size={14} className="text-white" /> : <span>5</span>}
                  </div>
                  <span className="font-medium" style={{ color: 'var(--xsm-text)' }}>YouTube 7-day primary owner timer</span>
                  {dealStatus?.seller_gave_rights && !dealStatus?.timer_completed && dealStatus?.timer_remaining_seconds > 0 && (
                    <span className="text-amber-500 text-xs font-semibold">
                      ({formatTimeRemaining(dealStatus.timer_remaining_seconds)} remaining)
                    </span>
                  )}
                </div>
              )}
              
              <div className={`flex items-center space-x-3 ${dealStatus?.seller_made_primary_owner ? 'opacity-100' : 'opacity-60'}`}>
                <div 
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                    dealStatus?.seller_made_primary_owner ? 'bg-emerald-500 text-white' : ''
                  }`}
                  style={!dealStatus?.seller_made_primary_owner ? { background: 'var(--xsm-medium-gray)', color: 'var(--xsm-text)' } : undefined}
                >
                  {dealStatus?.seller_made_primary_owner ? <CheckCircle size={14} className="text-white" /> : 
                   <span>{dealStatus?.platform_type === 'youtube' ? '6' : '5'}</span>}
                </div>
                <span className="font-medium" style={{ color: 'var(--xsm-text)' }}>Promote agent to primary owner</span>
              </div>
              
              <div className="flex items-center space-x-3 opacity-60">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm" style={{ background: 'var(--xsm-medium-gray)', color: 'var(--xsm-text)' }}>
                  <span>{dealStatus?.platform_type === 'youtube' ? '7' : '6'}</span>
                </div>
                <span className="font-medium" style={{ color: 'var(--xsm-text)' }}>Buyer pays you via selected method</span>
              </div>
              
              <div className="flex items-center space-x-3 opacity-60">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm" style={{ background: 'var(--xsm-medium-gray)', color: 'var(--xsm-text)' }}>
                  <span>{dealStatus?.platform_type === 'youtube' ? '8' : '7'}</span>
                </div>
                <span className="font-medium" style={{ color: 'var(--xsm-text)' }}>Channel transferred to buyer</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-6 rounded-xl font-semibold border transition-colors hover:opacity-80 text-sm"
              style={{ background: 'var(--xsm-medium-gray)', color: 'var(--xsm-text)', borderColor: 'var(--xsm-border)' }}
            >
              Back
            </button>
            
            {!deal.seller_agreed && (
              <button
                onClick={handleAgreeToTerms}
                disabled={isAgreeing}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg shadow-emerald-900/30 text-sm"
              >
                {isAgreeing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Agreeing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    <span>I Agree to Terms</span>
                  </>
                )}
              </button>
            )}
            
            {(() => {
              const showPayButton = deal.seller_agreed && !(dealStatus?.transaction_fee_paid ?? deal.transaction_fee_paid);
              return showPayButton;
            })() && (
              <button
                onClick={() => setShowFeePayment(true)}
                className="flex-1 font-bold py-3 px-6 rounded-xl hover:brightness-105 transition-all flex items-center justify-center space-x-2 text-sm shadow-md"
                style={{ background: 'var(--xsm-primary)', color: '#000000' }}
              >
                <DollarSign size={18} />
                <span>Pay Transaction Fee</span>
              </button>
            )}
            
            {(() => {
              const showRightsButton = deal.seller_agreed && (dealStatus?.transaction_fee_paid ?? deal.transaction_fee_paid) && !(dealStatus?.seller_gave_rights ?? deal.seller_gave_rights);
              return showRightsButton;
            })() && (
              <button
                onClick={handleConfirmRights}
                disabled={isConfirmingRights}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm shadow-lg shadow-blue-900/30"
              >
                {isConfirmingRights ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Confirming...</span>
                  </>
                ) : (
                  <>
                    <Shield size={18} />
                    <span>I Have Given The Rights</span>
                  </>
                )}
              </button>
            )}
            
            {deal.seller_agreed && (dealStatus?.transaction_fee_paid ?? deal.transaction_fee_paid) && (dealStatus?.seller_gave_rights ?? deal.seller_gave_rights) && !dealStatus?.seller_made_primary_owner && (
              <div 
                className="flex-1 py-3 px-6 rounded-xl flex items-center justify-center space-x-2 opacity-75 cursor-not-allowed border text-xs font-semibold"
                style={{ background: 'var(--xsm-medium-gray)', color: 'var(--xsm-text)', borderColor: 'var(--xsm-border)' }}
              >
                <Timer size={16} />
                {dealStatus?.platform_type === 'youtube' && dealStatus?.timer_remaining_seconds > 0 ? (
                  <span>Wait {Math.ceil((dealStatus.timer_remaining_seconds || 0) / (24 * 60 * 60))} More Days</span>
                ) : (
                  <span>Waiting for Admin to Promote Agent</span>
                )}
              </div>
            )}

            {dealStatus?.seller_made_primary_owner && !dealStatus?.buyer_paid_seller && (
              <div className="flex-1 bg-amber-500/20 border border-amber-500/40 text-amber-400 py-3 px-6 rounded-xl flex items-center justify-center space-x-2 text-xs font-bold">
                <Clock size={16} />
                <span>Waiting for Buyer Payment</span>
              </div>
            )}

            {dealStatus?.seller_made_primary_owner && dealStatus?.buyer_paid_seller && !dealStatus?.seller_confirmed_payment && (
              <button
                onClick={handleConfirmPaymentReceived}
                disabled={isConfirmingPayment}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm shadow-lg shadow-emerald-900/30"
              >
                {isConfirmingPayment ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Confirming...</span>
                  </>
                ) : (
                  <>
                    <DollarSign size={18} />
                    <span>I Have Received The Payment</span>
                  </>
                )}
              </button>
            )}

            {dealStatus?.seller_made_primary_owner && dealStatus?.buyer_paid_seller && dealStatus?.seller_confirmed_payment && (
              <div className="flex-1 bg-blue-500/20 border border-blue-500/40 text-blue-400 py-3 px-6 rounded-xl flex items-center justify-center space-x-2 text-xs font-bold">
                <CheckCircle size={16} />
                <span>Deal Complete - Both Payments Confirmed</span>
              </div>
            )}
          </div>

          {/* Payment Method Negotiation Note */}
          {!deal.seller_agreed && (
            <div 
              className="rounded-xl p-4 border"
              style={{
                background: 'rgba(59, 130, 246, 0.08)',
                borderColor: 'rgba(59, 130, 246, 0.25)'
              }}
            >
              <h4 className="font-bold text-sm mb-1.5 flex items-center gap-2" style={{ color: 'var(--xsm-primary, #3b82f6)' }}>
                💬 Payment Method Negotiation
              </h4>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--xsm-text)' }}>
                If none of the buyer's selected payment methods work for you, you can contact them through the chat system to discuss alternative payment methods. Once you both agree on a method, come back here and click "I Agree to Terms".
              </p>
            </div>
          )}

          {/* Next Steps for Transaction Fee */}
          {deal.seller_agreed && !(dealStatus?.transaction_fee_paid ?? deal.transaction_fee_paid) && (
            <div 
              className="rounded-xl p-4 border"
              style={{
                background: 'rgba(234, 179, 8, 0.08)',
                borderColor: 'rgba(234, 179, 8, 0.3)'
              }}
            >
              <h4 className="font-bold text-sm mb-2 flex items-center gap-2" style={{ color: 'var(--xsm-primary)' }}>
                <FileText size={16} />
                Transaction Fee Payment Required
              </h4>
              <p className="text-xs mb-3" style={{ color: 'var(--xsm-text)' }}>
                The transaction fee ({formatCurrency(deal.escrow_fee)}) needs to be paid to proceed with the deal. 
                Either you or the buyer can pay this fee to move forward.
              </p>
              <div className="rounded-lg p-3 space-y-1.5 text-xs border" style={{ background: 'var(--xsm-bg)', borderColor: 'var(--xsm-border)' }}>
                <p className="font-bold" style={{ color: 'var(--xsm-text)' }}>💰 Payment Options:</p>
                <ul className="space-y-1 ml-3" style={{ color: 'var(--xsm-light-gray)' }}>
                  <li>• Buyer pays (most common)</li>
                  <li>• You pay (if agreed upon)</li>
                  <li>• Either party can proceed</li>
                </ul>
              </div>
              <p className="text-[11px] mt-2.5 italic" style={{ color: 'var(--xsm-light-gray)' }}>
                💡 Once either party pays the fee, the "I Have Given The Rights" button will appear automatically.
              </p>
            </div>
          )}

          {/* Transaction Fee Paid Status */}
          {(dealStatus?.transaction_fee_paid ?? deal.transaction_fee_paid) && (
            <div 
              className="rounded-xl p-4 border"
              style={{
                background: 'rgba(34, 197, 94, 0.08)',
                borderColor: 'rgba(34, 197, 94, 0.3)'
              }}
            >
              <h4 className="text-emerald-500 font-bold text-sm mb-1.5 flex items-center gap-2">
                <CheckCircle size={16} />
                Transaction Fee Paid
              </h4>
              <p className="text-xs" style={{ color: 'var(--xsm-text)' }}>
                The transaction fee has been paid by {(dealStatus?.transaction_fee_paid_by ?? deal.transaction_fee_paid_by) === 'seller' ? 'you' : 'the buyer'} 
                via {(dealStatus?.transaction_fee_payment_method ?? deal.transaction_fee_payment_method)}. The deal will now proceed to the next stage.
              </p>
            </div>
          )}

          {/* Agent Email and Rights Instructions */}
          {(dealStatus?.transaction_fee_paid ?? deal.transaction_fee_paid) && (dealStatus?.agent_email_sent ?? deal.agent_email_sent) && !(dealStatus?.seller_gave_rights ?? deal.seller_gave_rights) && (
            <div 
              className="rounded-xl p-4 border"
              style={{
                background: 'rgba(59, 130, 246, 0.08)',
                borderColor: 'rgba(59, 130, 246, 0.3)'
              }}
            >
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--xsm-primary, #3b82f6)' }}>
                <Shield size={16} />
                Give Account Rights to Agent
              </h4>
              <div className="space-y-3">
                <div className="rounded-lg p-3 border" style={{ background: 'var(--xsm-bg)', borderColor: 'var(--xsm-border)' }}>
                  <p className="text-xs font-bold mb-1" style={{ color: 'var(--xsm-text)' }}>📧 Agent Email:</p>
                  <p className="font-mono text-xs p-2 rounded border select-all" style={{ background: 'var(--xsm-dark-gray)', borderColor: 'var(--xsm-border)', color: 'var(--xsm-primary)' }}>
                    {dealStatus?.assigned_email || deal?.assigned_email || 'novaflowa4@gmail.com'}
                  </p>
                </div>
                <div className="text-xs space-y-1.5" style={{ color: 'var(--xsm-text)' }}>
                  <p className="font-bold">Instructions:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-1" style={{ color: 'var(--xsm-light-gray)' }}>
                    <li>Add the agent email as a manager/collaborator to your account</li>
                    <li>Give permissions to view and manage the account</li>
                    <li>DO NOT transfer ownership yet - our agent will handle that securely</li>
                    <li>Click "I Have Given The Rights" button above once completed</li>
                  </ol>
                </div>
                <p className="text-[11px] p-2 rounded border" style={{ background: 'rgba(234, 179, 8, 0.08)', borderColor: 'rgba(234, 179, 8, 0.25)', color: 'var(--xsm-text)' }}>
                  ⚠️ Important: Only give manager/collaborator access, NOT ownership. Our agent will handle the ownership transfer process securely.
                </p>
              </div>
            </div>
          )}

          {/* Rights Confirmation Status */}
          {(dealStatus?.seller_gave_rights ?? deal.seller_gave_rights) && (
            <div 
              className="rounded-xl p-4 border"
              style={{
                background: 'rgba(34, 197, 94, 0.08)',
                borderColor: 'rgba(34, 197, 94, 0.3)'
              }}
            >
              <h4 className="text-emerald-500 font-bold text-sm mb-1.5 flex items-center gap-2">
                <CheckCircle size={16} />
                Rights Confirmed
              </h4>
              <p className="text-xs" style={{ color: 'var(--xsm-text)' }}>
                You have confirmed giving account access to our agent. The agent is now verifying the account and will proceed with the secure transfer process. You will be updated once verification is complete.
              </p>
            </div>
          )}

          {/* YouTube Timer Display */}
          {dealStatus?.platform_type === 'youtube' && dealStatus?.seller_gave_rights && !dealStatus?.timer_completed && dealStatus?.timer_remaining_seconds > 0 && (
            <div 
              className="rounded-xl p-4 border"
              style={{
                background: 'rgba(234, 179, 8, 0.08)',
                borderColor: 'rgba(234, 179, 8, 0.3)'
              }}
            >
              <h4 className="font-bold text-sm mb-2 flex items-center gap-2" style={{ color: 'var(--xsm-primary)' }}>
                <Timer size={16} />
                YouTube Primary Owner Timer
              </h4>
              <div className="space-y-2.5">
                <p className="text-xs" style={{ color: 'var(--xsm-text)' }}>
                  YouTube requires a 7-day waiting period before you can promote our agent to Primary Owner.
                </p>
                <div className="rounded-lg p-3 border" style={{ background: 'var(--xsm-bg)', borderColor: 'var(--xsm-border)' }}>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--xsm-light-gray)' }}>Time Remaining:</span>
                    <span className="font-bold" style={{ color: 'var(--xsm-text)' }}>
                      {formatTimeRemaining(dealStatus.timer_remaining_seconds)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1.5">
                    <span style={{ color: 'var(--xsm-light-gray)' }}>Timer Expires:</span>
                    <span className="font-mono text-[11px]" style={{ color: 'var(--xsm-text)' }}>
                      {dealStatus.timer_expires_formatted}
                    </span>
                  </div>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--xsm-light-gray)' }}>
                  ⏰ You will be able to promote the agent to Primary Owner after this timer expires. We'll update the interface automatically when it's ready.
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
          setShowFeePayment(false);
          onDealUpdate();
          setTimeout(fetchDealStatus, 1000);
        }}
      />

      {/* Custom Theme-Adaptive Alert Modal */}
      {alertConfig && (
        <DealAlertModal
          {...alertConfig}
          onClose={() => {
            if (alertConfig.onClose) {
              alertConfig.onClose();
            }
            setAlertConfig(null);
          }}
        />
      )}
    </div>
  );
};

export default SellerDealView;
