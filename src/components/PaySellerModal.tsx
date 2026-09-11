import React, { useState } from 'react';
import { X, DollarSign, CheckCircle, Shield } from 'lucide-react';
import DealAlertModal, { DealAlertModalProps } from './DealAlertModal';

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
  const [alertConfig, setAlertConfig] = useState<Omit<DealAlertModalProps, 'onClose'> | null>(null);

  if (!isOpen) return null;

  const executeConfirmPayment = async () => {
    try {
      setIsProcessing(true);
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
        onPaymentConfirmed(deal.id);
        onClose();
      } else {
        throw new Error(result.message || 'Failed to confirm payment');
      }
    } catch (error: any) {
      console.error('Error confirming payment:', error);
      setAlertConfig({
        title: 'Payment Confirmation Error',
        message: error?.message || 'Failed to confirm payment to seller. Please try again or contact support.',
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmPayment = () => {
    setAlertConfig({
      title: 'Confirm Payment to Seller',
      message: 'Please confirm that you have sent the required funds to the seller. This will notify the seller and prompt the agent to finalize account transfer.',
      type: 'info',
      confirmText: 'Yes, I Have Paid',
      cancelText: 'Cancel',
      details: [
        { label: 'Channel', value: deal.channel_title },
        { label: 'Amount', value: `$${deal.channel_price}` },
        { label: 'Seller', value: deal.seller_name || 'Seller' }
      ],
      onConfirm: executeConfirmPayment
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div 
        className="rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border shadow-2xl transition-all"
        style={{
          background: 'var(--xsm-dark-gray)',
          borderColor: 'var(--xsm-border)',
          color: 'var(--xsm-text)'
        }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b" style={{ borderColor: 'var(--xsm-border)' }}>
            <h2 className="text-xl font-bold flex items-center" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>
              <DollarSign className="mr-2.5 text-emerald-500" size={24} />
              Confirm Payment to Seller
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

          {/* Deal Info */}
          <div className="rounded-xl p-4 mb-6 border" style={{ background: 'var(--xsm-bg)', borderColor: 'var(--xsm-border)' }}>
            <h3 className="font-bold text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--xsm-primary)' }}>Deal Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span style={{ color: 'var(--xsm-light-gray)' }}>Channel:</span>
                <p className="font-semibold" style={{ color: 'var(--xsm-text)' }}>{deal.channel_title}</p>
              </div>
              <div>
                <span style={{ color: 'var(--xsm-light-gray)' }}>Amount:</span>
                <p className="text-emerald-500 font-bold text-lg">${typeof deal.channel_price === 'number' ? deal.channel_price.toFixed(2) : parseFloat(deal.channel_price || '0').toFixed(2)}</p>
              </div>
              <div>
                <span style={{ color: 'var(--xsm-light-gray)' }}>Seller:</span>
                <p className="font-medium" style={{ color: 'var(--xsm-text)' }}>{deal.seller_name || deal.seller_email}</p>
              </div>
              <div>
                <span style={{ color: 'var(--xsm-light-gray)' }}>Transaction ID:</span>
                <p className="font-mono text-xs font-bold" style={{ color: 'var(--xsm-text)' }}>{deal.transaction_id || `#${deal.id}`}</p>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="rounded-xl p-4 mb-6 border" style={{ background: 'rgba(34, 197, 94, 0.08)', borderColor: 'rgba(34, 197, 94, 0.25)' }}>
            <div className="flex items-start space-x-3">
              <Shield className="text-emerald-500 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="text-emerald-500 font-bold text-xs uppercase tracking-wider mb-1">Secure Payment Process</h4>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--xsm-text)' }}>
                  By confirming payment, you certify that you have transferred the agreed funds to the seller. The website agent will proceed with the final ownership transfer once verified.
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

export default PaySellerModal;
