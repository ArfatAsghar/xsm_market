import React, { useState } from 'react';
import { X, CreditCard, Bitcoin, Zap, DollarSign, User, AlertCircle, CheckCircle } from 'lucide-react';
import CryptoPaymentModal from './CryptoPaymentModal';

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
        alert('Payment failed: ' + result.message);
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed. Please try again.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-xsm-dark-bg border border-gray-700 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">
            Transaction Fee Payment
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!showConfirmation ? (
            <>
              {/* Deal Summary */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-xsm-yellow mb-3">Deal Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-white">
                    <span>Transaction ID:</span>
                    <span className="font-mono">{deal.transaction_id}</span>
                  </div>
                  <div className="flex justify-between text-white">
                    <span>Channel:</span>
                    <span>{deal.channel_title}</span>
                  </div>
                  <div className="flex justify-between text-white">
                    <span>Channel Price:</span>
                    <span>{formatCurrency(deal.channel_price)}</span>
                  </div>
                  <div className="flex justify-between text-white border-t border-gray-600 pt-2 font-semibold">
                    <span>Transaction Fee:</span>
                    <span className="text-xsm-yellow">{formatCurrency(deal.escrow_fee)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Responsibility Info */}
              <div className="bg-blue-900 border border-blue-700 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="text-blue-300 mt-0.5" size={20} />
                  <div>
                    <h4 className="text-blue-300 font-medium mb-2">Payment Responsibility</h4>
                    <p className="text-blue-200 text-sm">
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
                <h3 className="text-lg font-semibold text-white mb-4">Choose Payment Method</h3>
                <div className="grid grid-cols-1 gap-4">
                  {/* Stripe Option */}
                 

                  {/* Crypto Option */}
                  <button
                    onClick={() => handlePaymentMethodSelect('crypto')}
                    className="flex items-center justify-between p-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-xsm-yellow rounded-lg transition-all group"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="bg-orange-600 p-3 rounded-lg group-hover:bg-orange-500 transition-colors">
                        <Bitcoin className="text-white" size={24} />
                      </div>
                      <div className="text-left">
                        <h4 className="text-white font-semibold">Cryptocurrency</h4>
                        <p className="text-gray-400 text-sm">Bitcoin, Ethereum, USDT, and more</p>
                        <p className="text-yellow-400 text-xs">Lower fees, secure & private</p>
                      </div>
                    </div>
                    <Zap className="text-xsm-yellow opacity-0 group-hover:opacity-100 transition-opacity" size={20} />
                  </button>
                </div>
              </div>

              {/* Additional Info */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-white font-medium mb-2">Important Notes</h4>
                <ul className="text-gray-300 text-sm space-y-1">
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
    </div>
  );
};

export default TransactionFeePayment;
