import React, { useState, useEffect } from 'react';
import { X, Bitcoin, Copy, ExternalLink, RefreshCw, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

// Get API URL from environment variables
const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://xsmmarket.com/api');
};

const getBaseUrl = () => {
  const apiUrl = getApiUrl();
  return apiUrl.replace('/api', '');
};

const API_URL = getBaseUrl();

interface CryptoPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal: {
    id: number;
    channel_title: string;
    escrow_fee: number;
  } | null;
  onPaymentComplete: () => void;
}

interface Currency {
  code: string;
  name: string;
}

interface PaymentData {
  payment_id: string;
  payment_url?: string;
  qr_code_url?: string;
  amount: number;
  currency: string;
  pay_currency: string;
  pay_amount?: number;
  status: string;
  order_id: string;
  created_date?: string;
  updated_date?: string;
}

const CryptoPaymentModal: React.FC<CryptoPaymentModalProps> = ({
  isOpen,
  onClose,
  deal,
  onPaymentComplete
}) => {
  const [selectedCurrency, setSelectedCurrency] = useState<string>('btc');
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string>('');
  const [checkInterval, setCheckInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCurrencies();
    }
  }, [isOpen]);

  useEffect(() => {
    if (paymentData && ['waiting', 'confirming', 'sending'].includes(paymentData.status)) {
      // Start checking payment status every 10 seconds
      const interval = setInterval(() => {
        checkPaymentStatus();
      }, 10000);
      setCheckInterval(interval);

      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [paymentData]);

  useEffect(() => {
    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [checkInterval]);

  const fetchCurrencies = async () => {
    try {
      console.log('Fetching currencies from:', `${API_URL}/api/crypto-payments/currencies`);
      const response = await fetch(`${API_URL}/api/crypto-payments/currencies`);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Currencies result:', result);
      
      if (result.success) {
        setCurrencies(result.currencies);
        console.log('Currencies set:', result.currencies);
      } else {
        console.error('Failed to fetch currencies:', result.message);
        setError('Failed to load supported currencies');
      }
    } catch (error) {
      console.error('Failed to fetch currencies:', error);
      setError('Failed to connect to payment service');
    }
  };

  const createPayment = async () => {
    if (!deal) return;

    setIsCreating(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      console.log('Creating payment for deal:', deal.id, 'with currency:', selectedCurrency);
      console.log('Token exists:', !!token);
      
      const response = await fetch(`${API_URL}/api/crypto-payments/create-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          deal_id: deal.id,
          pay_currency: selectedCurrency
        })
      });

      console.log('Create payment response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Create payment result:', result);

      if (result.success) {
        setPaymentData(result.payment);
      } else {
        setError(result.message || 'Failed to create payment');
      }
    } catch (error) {
      console.error('Payment creation error:', error);
      setError('Failed to create payment. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!deal || !paymentData) return;

    setIsChecking(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/crypto-payments/payments/${deal.id}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (result.success) {
        setPaymentData(prev => prev ? { ...prev, ...result.payment } : null);
        
        if (['finished', 'confirmed'].includes(result.payment.status)) {
          if (checkInterval) {
            clearInterval(checkInterval);
            setCheckInterval(null);
          }
          setTimeout(() => {
            onPaymentComplete();
            onClose();
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Failed to check payment status:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'waiting':
        return <Clock className="w-5 h-5 text-yellow-400" />;
      case 'confirming':
      case 'sending':
        return <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />;
      case 'finished':
      case 'confirmed':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'failed':
      case 'expired':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'Waiting for payment';
      case 'confirming':
        return 'Confirming payment';
      case 'sending':
        return 'Processing payment';
      case 'finished':
      case 'confirmed':
        return 'Payment completed';
      case 'failed':
        return 'Payment failed';
      case 'expired':
        return 'Payment expired';
      default:
        return 'Unknown status';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'text-yellow-400 bg-yellow-400/10';
      case 'confirming':
      case 'sending':
        return 'text-blue-400 bg-blue-400/10';
      case 'finished':
      case 'confirmed':
        return 'text-green-400 bg-green-400/10';
      case 'failed':
      case 'expired':
        return 'text-red-400 bg-red-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  if (!isOpen || !deal) return null;

  console.log('CryptoPaymentModal rendering:', { isOpen, deal, currencies: currencies.length });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-xsm-dark-bg border border-gray-700 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white flex items-center">
            <Bitcoin className="mr-3 text-orange-400" size={24} />
            Cryptocurrency Payment
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!paymentData ? (
            <>
              {/* Deal Summary */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-xsm-yellow mb-3">Payment Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-white">
                    <span>Channel:</span>
                    <span>{deal.channel_title}</span>
                  </div>
                  <div className="flex justify-between text-white border-t border-gray-600 pt-2 font-semibold">
                    <span>Escrow Fee:</span>
                    <span className="text-xsm-yellow">${Number(deal.escrow_fee).toFixed(2)} USD</span>
                  </div>
                </div>
              </div>

              {/* Currency Selection */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Select Cryptocurrency</h3>
                <div className="grid grid-cols-2 gap-3">
                  {currencies.map((currency) => (
                    <button
                      key={currency.code}
                      onClick={() => setSelectedCurrency(currency.code)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        selectedCurrency === currency.code
                          ? 'border-orange-400 bg-orange-400/10 text-orange-400'
                          : 'border-gray-600 bg-gray-800 text-white hover:border-gray-500'
                      }`}
                    >
                      <div className="font-semibold">{currency.code.toUpperCase()}</div>
                      <div className="text-sm text-gray-400">{currency.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Important Notice */}
              <div className="bg-orange-900/20 border border-orange-700 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="text-orange-400 mt-0.5" size={20} />
                  <div>
                    <h4 className="text-orange-400 font-medium mb-2">Important Notice</h4>
                    <ul className="text-orange-200 text-sm space-y-1">
                      <li>• Send the exact amount to the provided address</li>
                      <li>• Payment will be confirmed automatically</li>
                      <li>• Do not close this window until payment is complete</li>
                      <li>• Contact support if you experience any issues</li>
                    </ul>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-red-400">
                    <AlertTriangle size={16} />
                    <span className="font-medium">Error</span>
                  </div>
                  <p className="text-red-200 text-sm mt-1">{error}</p>
                </div>
              )}

              {/* Create Payment Button */}
              <button
                onClick={createPayment}
                disabled={isCreating}
                className="w-full bg-orange-600 text-white py-3 px-6 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating Payment...</span>
                  </>
                ) : (
                  <>
                    <Bitcoin className="w-4 h-4" />
                    <span>Create Payment</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              {/* Payment Status */}
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Payment Status</h3>
                  <button
                    onClick={checkPaymentStatus}
                    disabled={isChecking}
                    className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className={`flex items-center space-x-3 p-3 rounded-lg ${getStatusColor(paymentData.status)}`}>
                  {getStatusIcon(paymentData.status)}
                  <span className="font-medium">{getStatusText(paymentData.status)}</span>
                </div>
              </div>

              {/* Payment Information */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">Payment Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Amount:</span>
                    <span className="text-white font-mono">
                      ${paymentData.amount} {paymentData.currency.toUpperCase()}
                      {paymentData.pay_amount && (
                        <span className="text-orange-400 ml-2">
                          ≈ {paymentData.pay_amount} {paymentData.pay_currency.toUpperCase()}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Payment ID:</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-mono text-sm">{paymentData.payment_id}</span>
                      <button
                        onClick={() => copyToClipboard(paymentData.payment_id)}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Links */}
              {paymentData.payment_url && (
                <div className="space-y-3">
                  <a
                    href={paymentData.payment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open Payment Page</span>
                  </a>
                  
                  {paymentData.qr_code_url && (
                    <div className="text-center">
                      <img
                        src={paymentData.qr_code_url}
                        alt="Payment QR Code"
                        className="mx-auto rounded-lg bg-white p-2"
                        style={{ maxWidth: '200px' }}
                      />
                      <p className="text-sm text-gray-400 mt-2">Scan with your crypto wallet</p>
                    </div>
                  )}
                </div>
              )}

              {/* Success Message */}
              {['finished', 'confirmed'].includes(paymentData.status) && (
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-green-400">
                    <CheckCircle size={20} />
                    <span className="font-medium">Payment Completed!</span>
                  </div>
                  <p className="text-green-200 text-sm mt-1">
                    Your escrow fee has been successfully paid. The deal will now proceed to the next stage.
                  </p>
                </div>
              )}

              {/* Failure Message */}
              {['failed', 'expired'].includes(paymentData.status) && (
                <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-red-400">
                    <AlertTriangle size={20} />
                    <span className="font-medium">Payment {paymentData.status === 'failed' ? 'Failed' : 'Expired'}</span>
                  </div>
                  <p className="text-red-200 text-sm mt-1">
                    {paymentData.status === 'failed' 
                      ? 'The payment could not be processed. Please try again or contact support.'
                      : 'The payment has expired. Please create a new payment to continue.'
                    }
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CryptoPaymentModal;
