import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Shield, DollarSign, CreditCard, Smartphone, Check, HelpCircle, Crown, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { getBuyerStats } from '@/services/auth';
import { useToast } from '@/components/ui/use-toast';

const minWebsiteAgentFee = 2;

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
  icon: string | React.ReactNode;
  category: 'bank' | 'digital' | 'crypto' | 'other';
}

type SupportedPlatform = 'youtube' | 'tiktok' | 'facebook' | 'instagram' | 'twitter' | 'telegram';

interface DealCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelPrice: number;
  channelTitle: string;
  sellerId: string;
  platform?: SupportedPlatform;
  onNavigateToChat?: () => void;
}

const platformMeta: Record<SupportedPlatform, { label: string; color: string; emoji: string }> = {
  youtube:   { label: 'YouTube',    color: '#FF0000', emoji: '▶️' },
  tiktok:    { label: 'TikTok',     color: '#010101', emoji: '🎵' },
  facebook:  { label: 'Facebook',   color: '#1877F2', emoji: '🔵' },
  instagram: { label: 'Instagram',  color: '#E1306C', emoji: '📸' },
  twitter:   { label: 'Twitter (X)', color: '#1DA1F2', emoji: '🐦' },
  telegram:  { label: 'Telegram',   color: '#2AABEE', emoji: '✈️' },
};

const DealCreationModal: React.FC<DealCreationModalProps> = ({
  isOpen,
  onClose,
  channelPrice,
  channelTitle,
  sellerId,
  platform = 'youtube',
  onNavigateToChat
}) => {
  // Normalize to our supported set
  const activePlatform: SupportedPlatform = (
    ['youtube','tiktok','facebook','instagram','twitter','telegram'].includes(platform)
      ? platform
      : 'youtube'
  ) as SupportedPlatform;
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const [selectedTransactionType, setSelectedTransactionType] = useState<'safest' | 'fastest'>('safest');
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [step, setStep] = useState<'fee-selection' | 'payment-selection' | 'email-confirmation' | 'terms-conditions'>('fee-selection');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isCreatingDeal, setIsCreatingDeal] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [activeInstructionTab, setActiveInstructionTab] = useState<SupportedPlatform>(activePlatform);
  const [buyerTier, setBuyerTier] = useState<'standard' | 'repeat' | 'vip' | 'vip_repeat'>('standard');
  const [buyerIsVip, setBuyerIsVip] = useState(false);
  const [countdown, setCountdown] = useState<number>(3);
  const [successData, setSuccessData] = useState<{
    txnId: string;
    channelTitle: string;
    amount: number;
    serviceFee: number;
    buyerEmail: string;
  } | null>(null);

  const resetModal = () => {
    setStep('fee-selection');
    setSelectedPaymentMethods([]);
    setBuyerEmail('');
    setSelectedTransactionType('safest');
    setAgreedToTerms(false);
    setIsCreatingDeal(false);
    setShowInfo(false);
    setActiveInstructionTab(activePlatform);
  };

  const redirectToChat = () => {
    setSuccessData(null);
    resetModal();
    onClose();
    if (onNavigateToChat) {
      onNavigateToChat();
    } else {
      navigate('/chat');
    }
  };

  // Auto-redirect directly to chat in 3 seconds after deal creation
  useEffect(() => {
    if (!successData) return;

    setCountdown(3);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const timer = setTimeout(() => {
      redirectToChat();
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [successData]);

  // Fetch buyer stats (VIP + repeat buyer tier) when modal opens
  useEffect(() => {
    if (!isOpen || !isLoggedIn) return;
    getBuyerStats().then(stats => {
      setBuyerTier(stats.tier);
      setBuyerIsVip(stats.isVip);
    }).catch(() => {});
  }, [isOpen, isLoggedIn]);

  // Payment methods data (reordered: Cryptocurrency, Bank Payment, Payoneer, Bitcoin, then rest)
  const paymentMethods: PaymentMethod[] = [
    { id: 'cryptocurrency', name: 'Cryptocurrency', icon: '₮', category: 'crypto' },
    { id: 'bank-transfer', name: 'Bank Payment', icon: '🏦', category: 'bank' },
    { id: 'payoneer', name: 'Payoneer', icon: '💼', category: 'digital' },
    { id: 'bitcoin', name: 'Bitcoin', icon: '₿', category: 'crypto' },
    { id: 'paypal', name: 'PayPal', icon: '💳', category: 'digital' },
    { id: 'venmo', name: 'Venmo', icon: '💸', category: 'digital' },
    { id: 'zelle', name: 'Zelle', icon: '⚡', category: 'digital' },
    { id: 'cashapp', name: 'Cash App', icon: '💰', category: 'digital' },
    { id: 'transferwise', name: 'TransferWise', icon: '🌍', category: 'bank' },
    { id: 'western-union', name: 'Western Union', icon: '🌐', category: 'bank' },
    { id: 'other', name: 'Other', icon: '📋', category: 'other' }
  ];

  // Ensure channelPrice is a number
  const numericPrice = typeof channelPrice === 'string' ? parseFloat(channelPrice) : channelPrice;
  
  // 4-Tier fee calculation based on buyer's VIP & repeat buyer status
  const calculateEscrowFee = (price: number, tier: typeof buyerTier = 'standard') => {
    if (price <= 50) return 2; // All tiers: Min $2
    if (tier === 'vip_repeat') {
      return price <= 100 ? price * 0.035 : price * 0.025;
    } else if (tier === 'vip') {
      return price <= 100 ? price * 0.04 : price * 0.03;
    } else if (tier === 'repeat') {
      return price <= 100 ? price * 0.045 : price * 0.035;
    } else {
      return price <= 100 ? price * 0.05 : price * 0.04;
    }
  };
  const escrowFee = calculateEscrowFee(numericPrice, buyerTier);

  // Tier display info
  const tierInfo: Record<typeof buyerTier, { label: string; color: string; icon?: string }> = {
    standard: { label: 'Standard Rate', color: 'text-gray-400' },
    repeat: { label: 'Repeat Buyer Discount', color: 'text-blue-400', icon: '🔁' },
    vip: { label: 'VIP Member Discount', color: 'text-yellow-400', icon: '👑' },
    vip_repeat: { label: 'VIP + Repeat Buyer — Best Rate!', color: 'text-emerald-400', icon: '⭐' }
  };
  const activeTier = tierInfo[buyerTier];

  const handlePaymentMethodToggle = (methodId: string) => {
    setSelectedPaymentMethods(prev => 
      prev.includes(methodId) 
        ? prev.filter(id => id !== methodId)
        : [...prev, methodId]
    );
  };

  const handleFeeSelection = () => {
    setStep('payment-selection');
  };

  const handleCreateDeal = () => {
    if (selectedPaymentMethods.length === 0) {
      toast({
        title: 'Payment Method Required',
        description: 'Please select at least one payment method to continue.',
        variant: 'destructive'
      });
      return;
    }
    setStep('email-confirmation');
  };

  const handleEmailConfirmation = () => {
    if (!buyerEmail.trim()) {
      toast({
        title: 'Email Address Required',
        description: 'Please enter your email address to continue.',
        variant: 'destructive'
      });
      return;
    }
    setStep('terms-conditions');
  };

  const handleFinalSubmit = async () => {
    if (!isLoggedIn || !user) {
      toast({
        title: 'Login Required',
        description: 'Please log in to create a deal.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsCreatingDeal(true);
      
      // Prepare deal data for API
      const dealData = {
        seller_id: sellerId,
        channel_id: channelTitle.toLowerCase().replace(/\s+/g, '-'), // Create a channel ID from title
        channel_title: channelTitle,
        channel_price: numericPrice,
        escrow_fee: escrowFee, // Use escrow_fee key instead of service_fee
        transaction_type: selectedTransactionType,
        buyer_email: buyerEmail.trim(),
        payment_methods: selectedPaymentMethods.map(id => {
          const method = paymentMethods.find(p => p.id === id);
          return {
            id: method?.id,
            name: method?.name,
            category: method?.category
          };
        }).filter(m => m.id) // Remove any undefined methods
      };

      // Call the PHP API to create the deal
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/deals?action=create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(dealData)
      });

      const result = await response.json();
      
      if (response.ok) {
        const officialTxnId = result.transaction_id || (result.deal_id ? String(result.deal_id).padStart(6, '0') : '000001');
        
        // Show custom success popup modal
        setSuccessData({
          txnId: officialTxnId,
          channelTitle,
          amount: numericPrice,
          serviceFee: escrowFee,
          buyerEmail: buyerEmail.trim()
        });

      } else {
        throw new Error(result.message || 'Failed to create deal');
      }
      
    } catch (error: any) {
      console.error('Error creating deal:', error);
      toast({
        title: 'Deal Creation Failed',
        description: error.message || 'Failed to create deal. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsCreatingDeal(false);
    }
  };

  const getModalWidthClass = () => {
    switch (step) {
      case 'fee-selection':
        return 'max-w-md'; // 1st popup: reduced compact width
      case 'payment-selection':
        return 'max-w-2xl'; // 2nd popup: wider for payment grid & tabs
      case 'email-confirmation':
        return 'max-w-md'; // 3rd popup: reduced compact width
      case 'terms-conditions':
        return 'max-w-lg'; // 4th popup: compact width for terms
      default:
        return 'max-w-md';
    }
  };

  if (!isOpen && !successData) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-3">
      <div
        className={`rounded-xl ${getModalWidthClass()} w-full flex flex-col transition-all duration-300 shadow-2xl border`}
        style={{
          maxHeight: '95vh',
          background: 'var(--xsm-dark-gray)',
          borderColor: 'var(--xsm-border)',
          color: 'var(--xsm-text)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0" style={{ borderColor: 'var(--xsm-border)' }}>
          <h2 className="text-base font-bold" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>Create a Deal</h2>
          <button
            onClick={() => {
              resetModal();
              onClose();
            }}
            className="p-1 rounded-md transition-colors hover:opacity-80"
            style={{ color: 'var(--xsm-light-gray)' }}
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 overflow-y-auto flex-1 custom-scrollbar">
          {step === 'fee-selection' && (
            <>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>Escrow Service Fee</h2>
                <button
                  type="button"
                  onClick={() => setShowInfo(true)}
                  className="p-1 px-2 transition-colors flex items-center gap-1 text-xs font-medium border rounded-lg hover:border-xsm-yellow"
                  style={{
                    borderColor: 'var(--xsm-border)',
                    background: 'var(--xsm-medium-gray)',
                    color: 'var(--xsm-text)'
                  }}
                  title="View Discount Fee Programs"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-xsm-yellow" />
                  <span>Discount Tiers</span>
                </button>
              </div>
              
              <div className="rounded-lg p-3 mb-2 border" style={{ background: 'var(--xsm-medium-gray)', borderColor: 'var(--xsm-border)' }}>
                <h3 className="text-xs font-semibold mb-1.5" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>Standard Fee Structure</h3>
                <table className="w-full text-left text-xs border-collapse" style={{ color: 'var(--xsm-text)' }}>
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--xsm-border)' }}>
                      <th className="py-1 font-semibold" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>Deal Amount</th>
                      <th className="py-1 font-semibold" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b" style={{ borderColor: 'var(--xsm-border)' }}>
                      <td className="py-1 font-medium">$1 – $50</td>
                      <td className="py-1 text-xsm-yellow font-bold">Minimum $2</td>
                    </tr>
                    <tr className="border-b" style={{ borderColor: 'var(--xsm-border)' }}>
                      <td className="py-1 font-medium">$50 – $100</td>
                      <td className="py-1 text-xsm-yellow font-bold">5%</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-medium">Above $100</td>
                      <td className="py-1 text-xsm-yellow font-bold">4%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Calculated Fee Summary */}
              <div className="border rounded-lg p-3 mb-3 text-center" style={{ background: 'var(--xsm-medium-gray)', borderColor: 'var(--xsm-border)' }}>
                <p className="text-[10px] mb-0.5 uppercase tracking-wider font-semibold" style={{ color: 'var(--xsm-light-gray)' }}>Your Calculated Service Fee</p>
                <p className="text-2xl font-extrabold text-xsm-yellow mb-0.5">${escrowFee.toFixed(2)}</p>
                <p className="text-xs" style={{ color: 'var(--xsm-text)' }}>
                  Based on the channel price of <span className="font-semibold text-xsm-yellow">${numericPrice.toFixed(2)}</span>
                </p>
                <div className={`mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${activeTier.color} border`} style={{ borderColor: 'var(--xsm-border)' }}>
                  {activeTier.icon && <span>{activeTier.icon}</span>}
                  <span>{activeTier.label}</span>
                </div>
                <div className="mt-2 pt-2 border-t flex justify-between items-center text-sm px-2" style={{ borderColor: 'var(--xsm-border)' }}>
                  <span className="font-medium text-xs" style={{ color: 'var(--xsm-light-gray)' }}>Total with Fee:</span>
                  <span className="font-bold" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>${(numericPrice + escrowFee).toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleFeeSelection}
                className="w-full bg-xsm-yellow text-black font-bold py-2.5 rounded-lg hover:bg-yellow-400 transition-colors text-sm shadow-md cursor-pointer"
              >
                Continue to Payment Methods
              </button>
            </>
          )}

          {step === 'payment-selection' && (
            <>
              {/* Transfer Mode — YouTube only (safest uses 7-day manager hold; fastest skips it) */}
              {activePlatform === 'youtube' && (
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'var(--xsm-light-gray)' }}>Transfer Mode</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelectedTransactionType('safest')}
                      className={`relative flex flex-col items-start gap-1 px-3 py-2.5 rounded-lg border-2 text-left transition-all cursor-pointer ${
                        selectedTransactionType === 'safest'
                          ? 'border-xsm-yellow bg-xsm-yellow/10'
                          : 'hover:border-xsm-yellow/40'
                      }`}
                      style={selectedTransactionType !== 'safest' ? {
                        borderColor: 'var(--xsm-border)',
                        background: 'var(--xsm-medium-gray)'
                      } : {}}
                    >
                      {selectedTransactionType === 'safest' && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-xsm-yellow text-black flex items-center justify-center text-[9px] font-black">✓</span>
                      )}
                      <span className="text-base">🛡️</span>
                      <span className="text-xs font-bold" style={{ color: selectedTransactionType === 'safest' ? 'var(--xsm-yellow, #f59e0b)' : 'var(--xsm-heading, var(--xsm-text))' }}>Verified Transfer</span>
                      <span className="text-[10px] leading-snug" style={{ color: 'var(--xsm-light-gray)' }}>7-day manager hold before ownership transfer — maximum protection.</span>
                    </button>
                    <button
                      onClick={() => setSelectedTransactionType('fastest')}
                      className={`relative flex flex-col items-start gap-1 px-3 py-2.5 rounded-lg border-2 text-left transition-all cursor-pointer ${
                        selectedTransactionType === 'fastest'
                          ? 'border-xsm-yellow bg-xsm-yellow/10'
                          : 'hover:border-xsm-yellow/40'
                      }`}
                      style={selectedTransactionType !== 'fastest' ? {
                        borderColor: 'var(--xsm-border)',
                        background: 'var(--xsm-medium-gray)'
                      } : {}}
                    >
                      {selectedTransactionType === 'fastest' && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-xsm-yellow text-black flex items-center justify-center text-[9px] font-black">✓</span>
                      )}
                      <span className="text-base">⚡</span>
                      <span className="text-xs font-bold" style={{ color: selectedTransactionType === 'fastest' ? 'var(--xsm-yellow, #f59e0b)' : 'var(--xsm-heading, var(--xsm-text))' }}>Express Transfer</span>
                      <span className="text-[10px] leading-snug" style={{ color: 'var(--xsm-light-gray)' }}>Immediate ownership handoff once funds are confirmed.</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Payment Methods Selection */}
              <div className="mb-2">
                <p className="text-xs mb-2" style={{ color: 'var(--xsm-light-gray)' }}>
                  Select payment methods you can use to pay the seller. More options = better chance of matching the seller.
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-2">
                  {paymentMethods.map((method) => {
                    const isSelected = selectedPaymentMethods.includes(method.id);
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => handlePaymentMethodToggle(method.id)}
                        className={`p-2 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-1 relative cursor-pointer ${
                          isSelected
                            ? 'border-xsm-yellow bg-xsm-yellow/15 shadow-sm'
                            : 'hover:border-xsm-yellow/60'
                        }`}
                        style={{
                          background: isSelected ? undefined : 'var(--xsm-medium-gray)',
                          borderColor: isSelected ? undefined : 'var(--xsm-border)',
                          color: isSelected ? 'var(--xsm-primary)' : 'var(--xsm-text)'
                        }}
                      >
                        {isSelected && (
                          <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-xsm-yellow text-black flex items-center justify-center text-[8px] font-black">
                            ✓
                          </span>
                        )}
                        <span className="text-lg">{method.icon}</span>
                        <span className="text-[10px] font-semibold text-center leading-tight truncate w-full px-0.5">
                          {method.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Transaction Instructions — platform-specific, no tabs */}
              <div className="mb-2 border rounded-lg overflow-hidden" style={{ borderColor: 'var(--xsm-border)' }}>
                {/* Platform header badge */}
                <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ background: 'var(--xsm-medium-gray)', borderColor: 'var(--xsm-border)' }}>
                  <span className="text-sm">{platformMeta[activePlatform].emoji}</span>
                  <span className="text-xs font-bold" style={{ color: platformMeta[activePlatform].color }}>
                    {platformMeta[activePlatform].label}
                  </span>
                  <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--xsm-yellow, #f59e0b)' }}>
                    Transfer Guide
                  </span>
                </div>
                <div className="p-3" style={{ background: 'var(--xsm-medium-gray)' }}>
                  {activePlatform === 'youtube' && (
                    <ol className="space-y-1.5 list-decimal list-inside text-xs leading-relaxed" style={{ color: 'var(--xsm-text)' }}>
                      <li>The buyer pays the service fee (<span className="font-semibold text-xsm-yellow">${escrowFee.toFixed(2)}</span>) to initiate the escrow process.</li>
                      <li>The seller designates the website agent's email as a <strong style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>Manager</strong> of the YouTube channel.</li>
                      <li>The website agent must remain a Manager for <strong style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>7 days</strong> before primary ownership can be transferred.</li>
                      <li>After 7 days, the seller transfers <strong style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>Primary Ownership</strong> to the website agent.</li>
                      <li>The agent verifies the channel, removes seller's access, and notifies the buyer to pay the seller.</li>
                      <li>After seller confirms payment, the agent assigns Primary Ownership to the buyer.</li>
                    </ol>
                  )}
                  {activePlatform === 'tiktok' && (
                    <ol className="space-y-1.5 list-decimal list-inside text-xs leading-relaxed" style={{ color: 'var(--xsm-text)' }}>
                      <li>The buyer pays the service fee (<span className="font-semibold text-xsm-yellow">${escrowFee.toFixed(2)}</span>) to initiate escrow.</li>
                      <li>The seller shares login credentials with the agent via secure chat.</li>
                      <li>The agent updates recovery email, links new phone, and logs out of all sessions.</li>
                      <li>The agent verifies details and notifies the buyer to pay the seller.</li>
                      <li>After seller confirms payment, agent transfers credentials to buyer.</li>
                    </ol>
                  )}
                  {activePlatform === 'facebook' && (
                    <ol className="space-y-1.5 list-decimal list-inside text-xs leading-relaxed" style={{ color: 'var(--xsm-text)' }}>
                      <li>The buyer pays the service fee (<span className="font-semibold text-xsm-yellow">${escrowFee.toFixed(2)}</span>) to initiate escrow.</li>
                      <li>The seller invites the website agent as an <strong style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>Admin</strong> of the Facebook Page.</li>
                      <li>The agent accepts, checks for other owners, and removes seller's admin access.</li>
                      <li>The agent verifies all roles and notifies buyer to pay seller.</li>
                      <li>After seller confirms payment, agent invites buyer as Admin and removes themselves.</li>
                    </ol>
                  )}
                  {activePlatform === 'instagram' && (
                    <ol className="space-y-1.5 list-decimal list-inside text-xs leading-relaxed" style={{ color: 'var(--xsm-text)' }}>
                      <li>The buyer pays the service fee (<span className="font-semibold text-xsm-yellow">${escrowFee.toFixed(2)}</span>) to initiate escrow.</li>
                      <li>The seller updates Instagram account email to the agent's secure transfer email.</li>
                      <li>The agent resets the password and updates 2FA settings.</li>
                      <li>The agent verifies the account is secured and notifies buyer to pay seller.</li>
                      <li>After seller confirms payment, agent changes email to buyer's and hands over credentials.</li>
                    </ol>
                  )}
                  {activePlatform === 'twitter' && (
                    <ol className="space-y-1.5 list-decimal list-inside text-xs leading-relaxed" style={{ color: 'var(--xsm-text)' }}>
                      <li>The buyer pays the service fee (<span className="font-semibold text-xsm-yellow">${escrowFee.toFixed(2)}</span>) to initiate escrow.</li>
                      <li>The seller updates the Twitter (X) account email to the website agent's secure email.</li>
                      <li>The agent resets the password, configures 2FA, and disconnects all active sessions.</li>
                      <li>The agent verifies full account security and instructs the buyer to pay the seller.</li>
                      <li>After seller confirms payment, the agent updates credentials to the buyer's email and transfers access.</li>
                    </ol>
                  )}
                  {activePlatform === 'telegram' && (
                    <ol className="space-y-1.5 list-decimal list-inside text-xs leading-relaxed" style={{ color: 'var(--xsm-text)' }}>
                      <li>The buyer pays the service fee (<span className="font-semibold text-xsm-yellow">${escrowFee.toFixed(2)}</span>) to initiate escrow.</li>
                      <li>The seller adds the website agent as Administrator with full rights to the Telegram channel/group.</li>
                      <li>The seller transfers <strong style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>Primary Ownership</strong> of the channel/group to the website agent.</li>
                      <li>The agent confirms ownership transfer, removes previous admins, and notifies buyer to pay seller.</li>
                      <li>After seller confirms payment, the agent transfers Primary Ownership directly to the buyer.</li>
                    </ol>
                  )}
                </div>
              </div>

              {/* Security Notice */}
              <div className="mb-3">
                <div className="p-2.5 rounded-lg border flex items-center gap-2" style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                  <span className="text-amber-500 text-xs">⚠️</span>
                  <p className="text-[11px] leading-tight" style={{ color: 'var(--xsm-text)' }}>
                    All messages must be sent through the website chat system. Communication outside the platform may void transaction protection.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 px-4 text-sm rounded-lg border transition-colors hover:opacity-80 font-medium cursor-pointer"
                  style={{
                    background: 'var(--xsm-medium-gray)',
                    borderColor: 'var(--xsm-border)',
                    color: 'var(--xsm-text)'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateDeal}
                  disabled={selectedPaymentMethods.length === 0}
                  className="flex-1 py-2 px-4 text-sm bg-xsm-yellow text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {step === 'email-confirmation' && (
            <>
              {/* Deal Summary */}
              <div className="mb-3">
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>Deal Summary</h3>
                <div className="rounded-lg p-3 space-y-1.5 border" style={{ background: 'var(--xsm-medium-gray)', borderColor: 'var(--xsm-border)' }}>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--xsm-light-gray)' }}>Channel:</span>
                    <span className="text-xsm-yellow font-semibold truncate max-w-[200px]">{channelTitle}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--xsm-light-gray)' }}>Price:</span>
                    <span className="text-xsm-yellow font-semibold">${numericPrice}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--xsm-light-gray)' }}>Service Fee:</span>
                    <span className="text-xsm-yellow font-semibold">${escrowFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--xsm-light-gray)' }}>Transaction Type:</span>
                    <span className="font-semibold capitalize" style={{ color: 'var(--xsm-text)' }}>{selectedTransactionType}</span>
                  </div>
                  <div className="text-xs pt-1 border-t" style={{ borderColor: 'var(--xsm-border)' }}>
                    <span className="block mb-1" style={{ color: 'var(--xsm-light-gray)' }}>Payment Methods:</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedPaymentMethods.map(methodId => {
                        const method = paymentMethods.find(p => p.id === methodId);
                        return (
                          <span key={methodId} className="bg-xsm-yellow text-black px-2 py-0.5 rounded-full text-[10px] font-semibold">
                            {method?.icon} {method?.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Email Input */}
              <div className="mb-3">
                <h3 className="text-xs font-semibold mb-1" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>
                  Email address associated with the account to be designated as the owner
                </h3>
                <p className="mb-2 text-[11px]" style={{ color: 'var(--xsm-light-gray)' }}>
                  No emails or passwords are traded on this website. The account will be transferred to the email address you provide below.
                </p>
                <input
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full p-2.5 text-sm rounded-lg border focus:border-xsm-yellow focus:outline-none transition-colors"
                  style={{
                    background: 'var(--xsm-bg)',
                    borderColor: 'var(--xsm-border)',
                    color: 'var(--xsm-text)'
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setStep('payment-selection')}
                  className="flex-1 py-2 px-4 text-sm rounded-lg border transition-colors hover:opacity-80 font-medium cursor-pointer"
                  style={{
                    background: 'var(--xsm-medium-gray)',
                    borderColor: 'var(--xsm-border)',
                    color: 'var(--xsm-text)'
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleEmailConfirmation}
                  disabled={!buyerEmail.trim()}
                  className="flex-1 py-2 px-4 text-sm bg-xsm-yellow text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {step === 'terms-conditions' && (
            <>
              {/* Terms & Conditions */}
              <div className="mb-3">
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>Terms & Conditions Agreement</h3>
                <div className="rounded-lg p-3 max-h-44 overflow-y-auto custom-scrollbar border" style={{ background: 'var(--xsm-medium-gray)', borderColor: 'var(--xsm-border)' }}>
                  <div className="space-y-2 text-xs">
                    <div>
                      <h4 className="font-semibold text-xsm-yellow text-xs mb-0.5">1. Website Agent Service Agreement</h4>
                      <p className="text-[11px]" style={{ color: 'var(--xsm-text)' }}>By proceeding, you agree to use our secure website agent service. All transactions must follow the established process for buyer and seller protection.</p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-xsm-yellow text-xs mb-0.5">2. Communication Policy</h4>
                      <p className="text-[11px]" style={{ color: 'var(--xsm-text)' }}>⚠️ <strong style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>IMPORTANT:</strong> All communication MUST occur through our platform's chat system. Communication outside the website is FORBIDDEN for safety.</p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-xsm-yellow text-xs mb-0.5">3. Transaction Process</h4>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] ml-2" style={{ color: 'var(--xsm-text)' }}>
                        <li>Buyer pays service fee (${escrowFee.toFixed(2)})</li>
                        <li>Seller designates website agent as account manager</li>
                        <li>After 7 days, seller transfers primary ownership to website agent</li>
                        <li>Website agent verifies account and notifies buyer</li>
                        <li>Buyer pays seller through agreed payment method</li>
                        <li>After seller confirmation, account is transferred to buyer</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-xsm-yellow text-xs mb-0.5">4. Refund Policy</h4>
                      <p className="text-[11px]" style={{ color: 'var(--xsm-text)' }}>7-day money-back guarantee applies if seller fails to deliver. Service fee is non-refundable unless transaction is cancelled by seller.</p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-xsm-yellow text-xs mb-0.5">5. Account Transfer</h4>
                      <p className="text-[11px]" style={{ color: 'var(--xsm-text)' }}>Account will be transferred to: <strong className="text-xsm-yellow">{buyerEmail}</strong>.</p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-xsm-yellow text-xs mb-0.5">6. Dispute Resolution</h4>
                      <p className="text-[11px]" style={{ color: 'var(--xsm-text)' }}>Disputes will be resolved through our arbitration service via chat log review.</p>
                    </div>
                    
                    <div className="p-2 mt-2 rounded border" style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                      <p className="text-[10px] font-medium" style={{ color: 'var(--xsm-text)' }}>
                        🔒 <strong className="text-xsm-yellow">Security Notice:</strong> Never share credentials outside our platform. Our website agents handle all transfers securely.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* By Continuing Agreement Notice (Checkbox removed as requested) */}
              <div className="mb-3 p-2.5 rounded-lg border text-center sm:text-left" style={{ background: 'var(--xsm-medium-gray)', borderColor: 'var(--xsm-border)' }}>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--xsm-text)' }}>
                  By continuing, you agree to the <strong className="text-xsm-yellow">Terms & Conditions</strong> above and acknowledge that all communication must happen through the platform chat for transaction security.
                </p>
              </div>

              {/* Transaction Summary */}
              <div className="mb-3">
                <div className="rounded-lg p-2.5 border" style={{ background: 'var(--xsm-medium-gray)', borderColor: 'var(--xsm-border)' }}>
                  <h4 className="text-xsm-yellow font-semibold text-xs mb-1.5">Transaction Summary</h4>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] block" style={{ color: 'var(--xsm-light-gray)' }}>Channel:</span>
                      <p className="font-medium text-xs truncate" style={{ color: 'var(--xsm-text)' }}>{channelTitle}</p>
                    </div>
                    <div>
                      <span className="text-[10px] block" style={{ color: 'var(--xsm-light-gray)' }}>Price:</span>
                      <p className="font-medium text-xs" style={{ color: 'var(--xsm-text)' }}>${numericPrice}</p>
                    </div>
                    <div>
                      <span className="text-[10px] block" style={{ color: 'var(--xsm-light-gray)' }}>Service Fee:</span>
                      <p className="font-medium text-xs text-xsm-yellow">${escrowFee.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] block" style={{ color: 'var(--xsm-light-gray)' }}>Transfer Email:</span>
                      <p className="font-medium text-xs truncate" style={{ color: 'var(--xsm-text)' }} title={buyerEmail}>{buyerEmail}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setStep('email-confirmation')}
                  className="flex-1 py-2 px-4 text-sm rounded-lg border transition-colors hover:opacity-80 font-medium cursor-pointer"
                  style={{
                    background: 'var(--xsm-medium-gray)',
                    borderColor: 'var(--xsm-border)',
                    color: 'var(--xsm-text)'
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={isCreatingDeal}
                  className="flex-1 py-2.5 px-4 text-sm bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold rounded-lg transition-all shadow-md flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {isCreatingDeal ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>I Agree - Create Deal</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Discount Programs Information Modal Overlay */}
      {showInfo && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
          <div
            className="rounded-xl p-5 sm:p-6 max-w-xl w-full max-h-[85vh] overflow-y-auto relative shadow-2xl border"
            style={{
              background: 'var(--xsm-dark-gray)',
              borderColor: 'var(--xsm-border)',
              color: 'var(--xsm-text)'
            }}
          >
            <button
              onClick={() => setShowInfo(false)}
              className="absolute right-4 top-4 p-1 rounded-md transition-colors hover:opacity-80"
              style={{ color: 'var(--xsm-light-gray)' }}
              title="Close Panel"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-xsm-yellow mb-1 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-xsm-yellow" />
              Fee Discount Tiers
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--xsm-light-gray)' }}>Your active tier is highlighted below.</p>

            <div className="space-y-3">
              {/* Standard */}
              <div
                className={`border rounded-lg p-3.5 transition-all ${
                  buyerTier === 'standard' ? 'ring-1 ring-xsm-yellow/60 border-xsm-yellow' : ''
                }`}
                style={{
                  background: 'var(--xsm-medium-gray)',
                  borderColor: buyerTier === 'standard' ? undefined : 'var(--xsm-border)'
                }}
              >
                <h4 className="font-semibold mb-2 text-sm flex items-center justify-between" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>
                  <span>Standard Rate</span>
                  {buyerTier === 'standard' && <span className="text-[10px] bg-xsm-yellow text-black font-bold px-2 py-0.5 rounded-full">YOUR TIER</span>}
                </h4>
                <table className="w-full text-left text-xs" style={{ color: 'var(--xsm-text)' }}>
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--xsm-border)' }}>
                      <th className="py-1 font-semibold" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>Deal Amount</th>
                      <th className="py-1 font-semibold" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b" style={{ borderColor: 'var(--xsm-border)' }}><td className="py-1">$1 – $50</td><td className="py-1 font-bold text-xsm-yellow">Min $2</td></tr>
                    <tr className="border-b" style={{ borderColor: 'var(--xsm-border)' }}><td className="py-1">$50 – $100</td><td className="py-1 font-bold text-xsm-yellow">5%</td></tr>
                    <tr><td className="py-1">Above $100</td><td className="py-1 font-bold text-xsm-yellow">4%</td></tr>
                  </tbody>
                </table>
              </div>

              {/* Repeat Buyer */}
              <div
                className={`border rounded-lg p-3.5 transition-all ${
                  buyerTier === 'repeat' ? 'ring-1 ring-blue-500 border-blue-500' : ''
                }`}
                style={{
                  background: 'var(--xsm-medium-gray)',
                  borderColor: buyerTier === 'repeat' ? undefined : 'var(--xsm-border)'
                }}
              >
                <h4 className="font-semibold text-blue-400 mb-2 text-sm flex items-center justify-between">
                  <span>🔁 Repeat Buyer Discount</span>
                  <span className="text-[10px] text-blue-400 font-normal">Min 3 completed deals</span>
                  {buyerTier === 'repeat' && <span className="text-[10px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full ml-1">YOUR TIER</span>}
                </h4>
                <table className="w-full text-left text-xs" style={{ color: 'var(--xsm-text)' }}>
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--xsm-border)' }}>
                      <th className="py-1 font-semibold" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>Deal Amount</th>
                      <th className="py-1 font-semibold" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b" style={{ borderColor: 'var(--xsm-border)' }}><td className="py-1">$1 – $50</td><td className="py-1 font-bold text-xsm-yellow">Min $2</td></tr>
                    <tr className="border-b" style={{ borderColor: 'var(--xsm-border)' }}><td className="py-1">$50 – $100</td><td className="py-1 font-bold text-xsm-yellow">4.5%</td></tr>
                    <tr><td className="py-1">Above $100</td><td className="py-1 font-bold text-xsm-yellow">3.5%</td></tr>
                  </tbody>
                </table>
              </div>

              {/* VIP Member */}
              <div
                className={`border rounded-lg p-3.5 transition-all ${
                  buyerTier === 'vip' ? 'ring-1 ring-amber-500 border-amber-500' : ''
                }`}
                style={{
                  background: 'var(--xsm-medium-gray)',
                  borderColor: buyerTier === 'vip' ? undefined : 'var(--xsm-border)'
                }}
              >
                <h4 className="font-semibold text-amber-400 mb-2 text-sm flex items-center justify-between">
                  <span>👑 VIP Member Discount</span>
                  {buyerTier === 'vip' && <span className="text-[10px] bg-amber-500 text-black font-bold px-2 py-0.5 rounded-full">YOUR TIER</span>}
                </h4>
                <table className="w-full text-left text-xs" style={{ color: 'var(--xsm-text)' }}>
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--xsm-border)' }}>
                      <th className="py-1 font-semibold" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>Deal Amount</th>
                      <th className="py-1 font-semibold" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b" style={{ borderColor: 'var(--xsm-border)' }}><td className="py-1">$1 – $50</td><td className="py-1 font-bold text-xsm-yellow">Min $2</td></tr>
                    <tr className="border-b" style={{ borderColor: 'var(--xsm-border)' }}><td className="py-1">$50 – $100</td><td className="py-1 font-bold text-xsm-yellow">4%</td></tr>
                    <tr><td className="py-1">Above $100</td><td className="py-1 font-bold text-xsm-yellow">3%</td></tr>
                  </tbody>
                </table>
              </div>

              {/* VIP + Repeat Buyer */}
              <div
                className={`border rounded-lg p-3.5 transition-all ${
                  buyerTier === 'vip_repeat' ? 'ring-1 ring-emerald-500 border-emerald-500' : ''
                }`}
                style={{
                  background: 'var(--xsm-medium-gray)',
                  borderColor: buyerTier === 'vip_repeat' ? undefined : 'var(--xsm-border)'
                }}
              >
                <h4 className="font-semibold text-emerald-400 mb-2 text-sm flex items-center justify-between">
                  <span>⭐ VIP + Repeat Buyer</span>
                  <span className="text-[10px] text-emerald-400 font-normal">Best Rate!</span>
                  {buyerTier === 'vip_repeat' && <span className="text-[10px] bg-emerald-500 text-black font-bold px-2 py-0.5 rounded-full ml-1">YOUR TIER</span>}
                </h4>
                <table className="w-full text-left text-xs" style={{ color: 'var(--xsm-text)' }}>
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--xsm-border)' }}>
                      <th className="py-1 font-semibold" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>Deal Amount</th>
                      <th className="py-1 font-semibold" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b" style={{ borderColor: 'var(--xsm-border)' }}><td className="py-1">$1 – $50</td><td className="py-1 font-bold text-xsm-yellow">Min $2</td></tr>
                    <tr className="border-b" style={{ borderColor: 'var(--xsm-border)' }}><td className="py-1">$50 – $100</td><td className="py-1 font-bold text-xsm-yellow">3.5%</td></tr>
                    <tr><td className="py-1">Above $100</td><td className="py-1 font-bold text-xsm-yellow">2.5%</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <button
              onClick={() => setShowInfo(false)}
              className="mt-5 w-full py-2.5 bg-xsm-yellow text-black font-bold rounded-lg hover:bg-yellow-500 transition-colors text-sm cursor-pointer shadow-md"
            >
              Back to Checkout
            </button>
          </div>
        </div>
      )}

      {/* Custom Deal Created Success Popup Modal */}
      {successData && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[70] p-4">
          <div
            className="border border-emerald-500/40 rounded-2xl max-w-md w-full p-6 text-center shadow-[0_0_50px_rgba(16,185,129,0.2)] relative animate-in fade-in zoom-in-95 duration-200"
            style={{
              background: 'var(--xsm-dark-gray)',
              borderColor: 'var(--xsm-border)',
              color: 'var(--xsm-text)'
            }}
          >
            {/* Top success icon badge */}
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/50 flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h3 className="text-xl font-extrabold mb-1" style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}>Deal Created Successfully!</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--xsm-light-gray)' }}>Your deal has been saved and the seller has been notified.</p>

            {/* Deal Detail Summary Box */}
            <div className="border rounded-xl p-3.5 text-left space-y-2 mb-4 text-xs" style={{ background: 'var(--xsm-medium-gray)', borderColor: 'var(--xsm-border)' }}>
              <div className="flex justify-between items-center pb-1.5 border-b" style={{ borderColor: 'var(--xsm-border)' }}>
                <span style={{ color: 'var(--xsm-light-gray)' }}>Transaction ID:</span>
                <span className="text-emerald-400 font-mono font-bold">{successData.txnId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--xsm-light-gray)' }}>Channel:</span>
                <span className="font-semibold truncate max-w-[200px]" style={{ color: 'var(--xsm-text)' }}>{successData.channelTitle}</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--xsm-light-gray)' }}>Amount:</span>
                <span className="text-xsm-yellow font-bold">${successData.amount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--xsm-light-gray)' }}>Service Fee:</span>
                <span className="text-xsm-yellow font-bold">${successData.serviceFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t" style={{ borderColor: 'var(--xsm-border)' }}>
                <span style={{ color: 'var(--xsm-light-gray)' }}>Transfer Email:</span>
                <span className="font-medium truncate max-w-[180px]" style={{ color: 'var(--xsm-text)' }} title={successData.buyerEmail}>{successData.buyerEmail}</span>
              </div>
            </div>

            {/* Status Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-semibold mb-5">
              <Clock className="w-3.5 h-3.5 animate-pulse" />
              <span>Status: Waiting for seller review</span>
            </div>

            {/* Auto-redirect countdown notice */}
            <div className="w-full mb-3 py-2 px-3 rounded-lg border flex items-center justify-center gap-2 text-xs font-semibold" style={{ background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)', color: '#60a5fa' }}>
              <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>Redirecting to chat in <strong className="text-white text-sm font-bold">{countdown}s</strong>...</span>
            </div>

            {/* Instant Go to Chat Button */}
            <button
              onClick={redirectToChat}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-black font-extrabold text-sm rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Go to Chat Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealCreationModal;
