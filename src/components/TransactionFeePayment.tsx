import React, { useState } from 'react';
import { X, CreditCard, Bitcoin, Zap, DollarSign, User, AlertCircle, CheckCircle, ShieldAlert } from 'lucide-react';
import CryptoPaymentModal from './CryptoPaymentModal';
import DealAlertModal, { DealAlertModalProps } from './DealAlertModal';

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
  transaction_id: string;
  buyer_id: number;
  seller_id: number;
  channel_id: string;
  channel_title: string;
  channel_price: number;
  escrow_fee: number;
  transaction_type: string;
  deal_status: string;
  seller_username?: string;
  buyer_username?: string;
  created_at: string;
}

interface TransactionFeePaymentProps {
  isOpen: boolean;
  onClose: () => void;
  deal: Deal | null;
  userType: 'buyer' | 'seller'; // Whether current user is buyer or seller
  onPaymentComplete: () => void;
}

type PaymentMethod = 'stripe' | 'crypto';

const TransactionFeePayment: React.FC<TransactionFeePaymentProps> = ({
  isOpen,
  onClose,
  deal,
  userType,
  onPaymentComplete
}) => {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showCryptoModal, setShowCryptoModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState<Omit<DealAlertModalProps, 'onClose'> | null>(null);

  if (!isOpen || !deal) return null;

  console.log('TransactionFeePayment state:', { 
    isOpen, 
    deal: !!deal, 
    showCryptoModal, 
    selectedPaymentMethod,
    showConfirmation 
  });

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    console.log('Payment method selected:', method);
    setSelectedPaymentMethod(method);
    if (method === 'crypto') {
      console.log('Opening crypto modal');
      setShowCryptoModal(true);
    } else {
      setShowConfirmation(true);
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedPaymentMethod) return;

    setIsProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/deals/${deal.id}/pay-transaction-fee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          payment_method: selectedPaymentMethod,
          payer_type: userType
        })
      });

      const result = await response.json();

      if (result.success) {
        onPaymentComplete();
        onClose();
      } else {
        setAlertConfig({
          title: 'Payment Failed',
          message: result.message || 'Payment could not be completed. Please try again.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Payment error:', error);
      setAlertConfig({
        title: 'Payment Error',
        message: 'Could not connect to payment service. Please try again.',
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBack = () => {
    setShowConfirmation(false);
    setSelectedPaymentMethod(null);
  };

  const handleCryptoPaymentComplete = () => {
    console.log('Crypto payment completed');
    setShowCryptoModal(false);
    onPaymentComplete();
    onClose();
  };

  const handleCloseCryptoModal = () => {
    console.log('Closing crypto modal');
    setShowCryptoModal(false);
    setSelectedPaymentMethod(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div 
        className="rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border shadow-2xl transition-colors duration-200"
        style={{
          background: 'var(--xsm-dark-gray)',
          borderColor: 'var(--xsm-border)',
          color: 'var(--xsm-text)',
          display: showCryptoModal ? 'none' : 'block'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--xsm-border)' }}>
          <h2 className="text-xl font-bold" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>
            Transaction Fee Payment
          </h2>
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
          {!showConfirmation ? (
            <>
              {/* Deal Summary */}
              <div className="rounded-xl p-4 border" style={{ background: 'var(--xsm-bg)', borderColor: 'var(--xsm-border)' }}>
                <h3 className="text-base font-bold mb-3" style={{ color: 'var(--xsm-primary)' }}>Deal Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--xsm-light-gray)' }}>Transaction ID:</span>
                    <span className="font-mono text-xs" style={{ color: 'var(--xsm-text)' }}>{deal.transaction_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--xsm-light-gray)' }}>Channel:</span>
                    <span className="font-medium" style={{ color: 'var(--xsm-text)' }}>{deal.channel_title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--xsm-light-gray)' }}>Channel Price:</span>
                    <span style={{ color: 'var(--xsm-text)' }}>{formatCurrency(deal.channel_price)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-bold" style={{ borderColor: 'var(--xsm-border)' }}>
                    <span style={{ color: 'var(--xsm-text)' }}>Transaction Fee:</span>
                    <span style={{ color: 'var(--xsm-primary)' }}>{formatCurrency(deal.escrow_fee)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Responsibility Info */}
              <div 
                className="rounded-xl p-4 border"
                style={{
                  background: 'rgba(59, 130, 246, 0.08)',
                  borderColor: 'rgba(59, 130, 246, 0.25)'
                }}
              >
                <div className="flex items-start space-x-3">
                  <AlertCircle className="mt-0.5 shrink-0" size={18} style={{ color: 'var(--xsm-primary, #3b82f6)' }} />
                  <div>
                    <h4 className="font-bold text-sm mb-1.5" style={{ color: 'var(--xsm-primary, #3b82f6)' }}>Payment Responsibility</h4>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--xsm-text)' }}>
                      {userType === 'buyer' 
                        ? "As the buyer, you are typically responsible for paying the transaction fee. However, if you and the seller have agreed otherwise, the seller can also pay this fee."
                        : "As the seller, you can choose to pay the transaction fee if you and the buyer have reached an agreement, or if the buyer is unable to pay."
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div>
                <h3 className="text-base font-bold mb-3" style={{ color: 'var(--xsm-text)' }}>Choose Payment Method</h3>
                <div className="grid grid-cols-1 gap-3">
                  {/* Crypto Option */}
                  <button
                    onClick={() => handlePaymentMethodSelect('crypto')}
                    className="flex items-center justify-between p-4 rounded-xl border transition-all hover:border-amber-500/50 group text-left"
                    style={{ background: 'var(--xsm-bg)', borderColor: 'var(--xsm-border)' }}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="bg-amber-500/20 text-amber-500 p-3 rounded-xl group-hover:bg-amber-500 group-hover:text-black transition-colors">
                        <Bitcoin size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm" style={{ color: 'var(--xsm-text)' }}>Cryptocurrency</h4>
                        <p className="text-xs" style={{ color: 'var(--xsm-light-gray)' }}>Bitcoin, Ethereum, USDT, and more</p>
                        <p className="text-[11px] font-semibold text-amber-500">Lower fees, secure & private</p>
                      </div>
                    </div>
                    <Zap className="opacity-0 group-hover:opacity-100 transition-opacity" size={20} style={{ color: 'var(--xsm-primary)' }} />
                  </button>
                </div>
              </div>

              {/* Additional Info */}
              <div className="rounded-xl p-4 border text-xs" style={{ background: 'var(--xsm-bg)', borderColor: 'var(--xsm-border)' }}>
                <h4 className="font-bold mb-2" style={{ color: 'var(--xsm-text)' }}>Important Notes</h4>
                <ul className="space-y-1" style={{ color: 'var(--xsm-light-gray)' }}>
                  <li>• The transaction fee ensures secure escrow service</li>
                  <li>• Payment is processed securely through our trusted partners</li>
                  <li>• Once paid, the deal will proceed to the next stage</li>
                  <li>• Both parties will be notified when payment is complete</li>
                </ul>
              </div>
            </>
          ) : (
            <>
              {/* Payment Confirmation */}
              <div className="text-center space-y-6">
                <div className="bg-gray-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                  {selectedPaymentMethod === 'stripe' ? (
                    <CreditCard className="text-purple-400" size={32} />
                  ) : (
                    <Bitcoin className="text-orange-400" size={32} />
                  )}
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Confirm Payment Details
                  </h3>
                  <p className="text-gray-400">
                    You are about to pay the transaction fee using{' '}
                    <span className="text-xsm-yellow font-medium">
                      {selectedPaymentMethod === 'stripe' ? 'Stripe' : 'Cryptocurrency'}
                    </span>
                  </p>
                </div>

                {/* Payment Summary */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between text-white">
                      <span>Payment Method:</span>
                      <span className="font-medium capitalize">{selectedPaymentMethod}</span>
                    </div>
                    <div className="flex justify-between text-white">
                      <span>Transaction Fee:</span>
                      <span className="font-semibold text-xsm-yellow">{formatCurrency(deal.escrow_fee)}</span>
                    </div>
                    <div className="flex justify-between text-white">
                      <span>Paying as:</span>
                      <span className="font-medium capitalize flex items-center">
                        <User size={16} className="mr-1" />
                        {userType}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Security Notice */}
                <div className="bg-green-900 border border-green-700 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-green-300">
                    <CheckCircle size={20} />
                    <span className="font-medium">Secure Payment</span>
                  </div>
                  <p className="text-green-200 text-sm mt-1">
                    Your payment is protected by our secure escrow system and will be processed safely.
                  </p>
                </div>
              </div>

              {/* Confirmation Buttons */}
              <div className="flex space-x-4">
                <button
                  onClick={handleBack}
                  disabled={isProcessing}
                  className="flex-1 bg-gray-700 text-white py-3 px-6 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmPayment}
                  disabled={isProcessing}
                  className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <DollarSign size={20} />
                      <span>Confirm Payment</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Crypto Payment Modal */}
      <CryptoPaymentModal
        isOpen={showCryptoModal}
        onClose={handleCloseCryptoModal}
        deal={deal ? {
          id: deal.id,
          channel_title: deal.channel_title,
          escrow_fee: deal.escrow_fee
        } : null}
        onPaymentComplete={handleCryptoPaymentComplete}
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

export default TransactionFeePayment;
