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

      const result = await response.json();
      console.log('Create payment result:', result);

      if (result.success) {
        setPaymentData(result.payment);
      } else {
        setError(result.error || result.message || 'Failed to create payment');
      }
    } catch (error) {
      console.error('Payment creation error:', error);
      setError('Failed to connect to payment service. Please try again.');
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        className="border rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl transition-all"
        style={{
          background: 'var(--xsm-dark-gray)',
          borderColor: 'var(--xsm-border)',
          color: 'var(--xsm-text)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--xsm-border)' }}>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>
            <Bitcoin className="text-amber-500" size={24} />
            Cryptocurrency Payment
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
          {!paymentData ? (
            <>
              {/* Deal Summary */}
              <div className="rounded-xl p-4 border" style={{ background: 'var(--xsm-bg)', borderColor: 'var(--xsm-border)' }}>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--xsm-primary)' }}>Payment Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--xsm-light-gray)' }}>Channel:</span>
                    <span className="font-medium" style={{ color: 'var(--xsm-text)' }}>{deal.channel_title}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold" style={{ borderColor: 'var(--xsm-border)' }}>
                    <span style={{ color: 'var(--xsm-text)' }}>Escrow Fee:</span>
                    <span className="font-bold text-base" style={{ color: 'var(--xsm-primary)' }}>${Number(deal.escrow_fee).toFixed(2)} USD</span>
                  </div>
                </div>
              </div>

              {/* Currency Selection */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--xsm-text)' }}>Select Cryptocurrency</h3>
                <div className="grid grid-cols-2 gap-3">
                  {currencies.map((currency) => (
                    <button
                      key={currency.code}
                      onClick={() => setSelectedCurrency(currency.code)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selectedCurrency === currency.code
                          ? 'ring-2 ring-amber-500 font-bold'
                          : 'hover:opacity-90'
                      }`}
                      style={{
                        background: selectedCurrency === currency.code ? 'rgba(234, 179, 8, 0.12)' : 'var(--xsm-bg)',
                        borderColor: selectedCurrency === currency.code ? 'var(--xsm-primary)' : 'var(--xsm-border)',
                        color: 'var(--xsm-text)'
                      }}
                    >
                      <div className="font-semibold text-sm" style={{ color: selectedCurrency === currency.code ? 'var(--xsm-primary)' : 'var(--xsm-text)' }}>
                        {currency.code.toUpperCase()}
                      </div>
                      <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--xsm-light-gray)' }}>
                        {currency.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Important Notice */}
              <div className="rounded-xl border p-4" style={{ background: 'rgba(234, 179, 8, 0.08)', borderColor: 'rgba(234, 179, 8, 0.25)' }}>
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider mb-1.5" style={{ color: 'var(--xsm-primary)' }}>Important Notice</h4>
                    <ul className="text-xs space-y-1" style={{ color: 'var(--xsm-text)' }}>
                      <li>• Send the exact amount to the provided address</li>
                      <li>• Payment will be confirmed automatically</li>
                      <li>• Do not close this window until payment is complete</li>
                      <li>• Contact support if you experience any issues</li>
                    </ul>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border p-4" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                  <div className="flex items-center space-x-2 text-rose-500">
                    <AlertTriangle size={16} />
                    <span className="font-bold text-xs uppercase tracking-wider">Error</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--xsm-text)' }}>{error}</p>
                </div>
              )}

              {/* Create Payment Button */}
              <button
                onClick={createPayment}
                disabled={isCreating}
                className="w-full font-bold py-3 px-6 rounded-xl hover:brightness-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm shadow-md"
                style={{ background: 'var(--xsm-primary)', color: '#000000' }}
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
              <div className="rounded-xl p-4 border" style={{ background: 'var(--xsm-bg)', borderColor: 'var(--xsm-border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--xsm-text)' }}>Payment Status</h3>
                  <button
                    onClick={checkPaymentStatus}
                    disabled={isChecking}
                    className="p-1.5 rounded-lg border transition-colors hover:opacity-80 disabled:opacity-50"
                    style={{ borderColor: 'var(--xsm-border)', color: 'var(--xsm-light-gray)' }}
                    title="Refresh status"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className={`flex items-center space-x-3 p-3 rounded-xl ${getStatusColor(paymentData.status)}`}>
                  {getStatusIcon(paymentData.status)}
                  <span className="font-semibold text-sm">{getStatusText(paymentData.status)}</span>
                </div>
              </div>

              {/* Payment Information */}
              <div className="rounded-xl p-4 border" style={{ background: 'var(--xsm-bg)', borderColor: 'var(--xsm-border)' }}>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--xsm-text)' }}>Payment Information</h3>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between items-center">
                    <span style={{ color: 'var(--xsm-light-gray)' }}>Amount:</span>
                    <span className="font-mono font-bold" style={{ color: 'var(--xsm-text)' }}>
                      ${paymentData.amount} {paymentData.currency.toUpperCase()}
                      {paymentData.pay_amount && (
                        <span className="ml-2 font-bold" style={{ color: 'var(--xsm-primary)' }}>
                          ≈ {paymentData.pay_amount} {paymentData.pay_currency.toUpperCase()}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span style={{ color: 'var(--xsm-light-gray)' }}>Payment ID:</span>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold" style={{ color: 'var(--xsm-text)' }}>{paymentData.payment_id}</span>
                      <button
                        onClick={() => copyToClipboard(paymentData.payment_id)}
                        className="p-1 rounded hover:opacity-80 transition-opacity"
                        style={{ color: 'var(--xsm-primary)' }}
                        title="Copy payment ID"
                      >
                        <Copy className="w-3.5 h-3.5" />
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
                    className="w-full font-bold py-3 px-6 rounded-xl hover:brightness-105 transition-all flex items-center justify-center space-x-2 text-sm shadow-md"
                    style={{ background: 'var(--xsm-primary)', color: '#000000' }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open Payment Page</span>
                  </a>
                  
                  {paymentData.qr_code_url && (
                    <div className="text-center p-4 rounded-xl border" style={{ background: 'var(--xsm-bg)', borderColor: 'var(--xsm-border)' }}>
                      <img
                        src={paymentData.qr_code_url}
                        alt="Payment QR Code"
                        className="mx-auto rounded-lg bg-white p-2 shadow-md"
                        style={{ maxWidth: '180px' }}
                      />
                      <p className="text-xs mt-2 font-medium" style={{ color: 'var(--xsm-light-gray)' }}>Scan with your crypto wallet</p>
                    </div>
                  )}
                </div>
              )}

              {/* Success Message */}
              {['finished', 'confirmed'].includes(paymentData.status) && (
                <div className="rounded-xl border p-4" style={{ background: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)' }}>
                  <div className="flex items-center space-x-2 text-emerald-500">
                    <CheckCircle size={18} />
                    <span className="font-bold text-xs uppercase tracking-wider">Payment Completed!</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--xsm-text)' }}>
                    Your escrow fee has been successfully paid. The deal will now proceed to the next stage.
                  </p>
                </div>
              )}

              {/* Failure Message */}
              {['failed', 'expired'].includes(paymentData.status) && (
                <div className="rounded-xl border p-4" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                  <div className="flex items-center space-x-2 text-rose-500">
                    <AlertTriangle size={18} />
                    <span className="font-bold text-xs uppercase tracking-wider">Payment {paymentData.status === 'failed' ? 'Failed' : 'Expired'}</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--xsm-text)' }}>
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
