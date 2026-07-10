import React, { useState } from 'react';
import { X, DollarSign, CheckCircle, Shield } from 'lucide-react';

// Get API URL from environment variables
const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://xsmmarket.com/api');
};

const getBaseUrl = () => {
  const apiUrl = getApiUrl();
  return apiUrl.replace('/api', '');
};

interface PaySellerModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal: {
    id: number;
    channel_title: string;
    channel_price: number | string;
    seller_name?: string;
    seller_email?: string;
    transaction_id?: string;
  };
  onPaymentConfirmed: (dealId: number) => void;
}

const PaySellerModal: React.FC<PaySellerModalProps> = ({ 
  isOpen, 
  onClose, 
  deal, 
  onPaymentConfirmed 
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleConfirmPayment = async () => {
    try {
      setIsProcessing(true);
      
      const confirmed = window.confirm(
        '💰 CONFIRM PAYMENT TO SELLER\n\n' +
        'Please confirm that you have successfully paid the seller.\n\n' +
        '⚠️ IMPORTANT:\n' +
        '• Only confirm if payment was completed successfully\n' +
        '• You have received payment confirmation from your payment provider\n' +
        '• The seller should receive the funds\n\n' +
        'This will notify the seller and complete the transaction.\n\n' +
        'Continue?'
      );

      if (!confirmed) {
        setIsProcessing(false);
        return;
      }

      // Call the API to confirm payment
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBaseUrl()}/deals/${deal.id}/buyer-paid-seller`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        alert(`✅ Payment Confirmation Successful!

🎉 Transaction Complete!

✓ Payment to seller confirmed
✓ Chat message sent to notify seller
✓ Deal status updated

Thank you for using our secure marketplace!`);
        
        onPaymentConfirmed(deal.id);
        onClose();
      } else {
        throw new Error(result.message || 'Failed to confirm payment');
      }
      
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert(`Failed to confirm payment: ${error.message}\n\nPlease try again or contact support.`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-xsm-dark-gray rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <DollarSign className="mr-3 text-xsm-yellow" size={28} />
              Confirm Payment to Seller
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Deal Info */}
          <div className="bg-xsm-medium-gray rounded-lg p-4 mb-6">
            <h3 className="text-white font-medium mb-2">Deal Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Channel:</span>
                <p className="text-white font-medium">{deal.channel_title}</p>
              </div>
              <div>
                <span className="text-gray-400">Amount:</span>
                <p className="text-green-400 font-bold text-lg">${typeof deal.channel_price === 'number' ? deal.channel_price.toFixed(2) : parseFloat(deal.channel_price || '0').toFixed(2)}</p>
              </div>
              <div>
                <span className="text-gray-400">Seller:</span>
                <p className="text-white">{deal.seller_name || deal.seller_email}</p>
              </div>
              <div>
                <span className="text-gray-400">Transaction ID:</span>
                <p className="text-gray-300 font-mono text-xs">{deal.transaction_id || `#${deal.id}`}</p>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="bg-green-900 border border-green-700 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <Shield className="text-green-400 mt-1" size={20} />
              <div>
                <h4 className="text-green-300 font-medium mb-1">Secure Payment Process</h4>
                <p className="text-green-200 text-sm">
                  Our agent now has full control of the channel. You can safely proceed with payment as the 
                  account is secured and ready for transfer.
                </p>
              </div>
            </div>
          </div>

          {/* Payment Instructions */}
          <div className="bg-blue-900 border border-blue-700 rounded-lg p-4 mb-6">
            <h4 className="text-blue-300 font-medium mb-2">Payment Instructions</h4>
            <div className="text-blue-200 text-sm space-y-2">
              <p>• Contact the seller using your agreed payment method (PayPal, Bank Transfer, etc.)</p>
              <p>• Send the payment amount: <strong className="text-white">${typeof deal.channel_price === 'number' ? deal.channel_price.toFixed(2) : parseFloat(deal.channel_price || '0').toFixed(2)}</strong></p>
              <p>• Ensure you receive payment confirmation from your payment provider</p>
              <p>• Only click "I Have Paid The Seller" after successful payment completion</p>
            </div>
          </div>

          {/* Warning Notice */}
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-200 text-sm">
              <strong>⚠️ Final Confirmation Required</strong><br />
              Only click "I Have Paid The Seller" if you have successfully sent the payment to the seller. 
              This action will notify the seller and mark the transaction as complete.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmPayment}
              disabled={isProcessing}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isProcessing ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Confirming...</span>
                </div>
              ) : (
                <>
                  <CheckCircle className="mr-2" size={20} />
                  I Have Paid The Seller
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaySellerModal;
