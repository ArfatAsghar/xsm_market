import React, { useState, useEffect } from 'react';
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
  icon: string;
  category: 'bank' | 'digital' | 'crypto' | 'other';
}

interface DealCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelPrice: number;
  channelTitle: string;
  sellerId: string;
  onNavigateToChat?: () => void;
}

const DealCreationModal: React.FC<DealCreationModalProps> = ({
  isOpen,
  onClose,
  channelPrice,
  channelTitle,
  sellerId,
  onNavigateToChat
}) => {
  const { user, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const [selectedTransactionType, setSelectedTransactionType] = useState<'safest' | 'fastest'>('safest');
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [step, setStep] = useState<'fee-selection' | 'payment-selection' | 'email-confirmation' | 'terms-conditions'>('fee-selection');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isCreatingDeal, setIsCreatingDeal] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [activeInstructionTab, setActiveInstructionTab] = useState<'youtube' | 'tiktok' | 'facebook' | 'instagram'>('youtube');
  const [buyerTier, setBuyerTier] = useState<'standard' | 'repeat' | 'vip' | 'vip_repeat'>('standard');
  const [buyerIsVip, setBuyerIsVip] = useState(false);
  const [successData, setSuccessData] = useState<{
    txnId: string;
    channelTitle: string;
    amount: number;
    serviceFee: number;
    buyerEmail: string;
  } | null>(null);

  // Fetch buyer stats (VIP + repeat buyer tier) when modal opens
  useEffect(() => {
    if (!isOpen || !isLoggedIn) return;
    getBuyerStats().then(stats => {
      setBuyerTier(stats.tier);
      setBuyerIsVip(stats.isVip);
    }).catch(() => {});
  }, [isOpen, isLoggedIn]);

  // Payment methods data (MoneyGram and Google Pay removed)
  const paymentMethods: PaymentMethod[] = [
    { id: 'bank-transfer', name: 'Bank Transfer', icon: '🏦', category: 'bank' },
    { id: 'paypal', name: 'PayPal', icon: '💳', category: 'digital' },
    { id: 'bitcoin', name: 'Bitcoin', icon: '₿', category: 'crypto' },
    { id: 'venmo', name: 'Venmo', icon: '💸', category: 'digital' },
    { id: 'zelle', name: 'Zelle', icon: '⚡', category: 'digital' },
    { id: 'cashapp', name: 'Cash App', icon: '💰', category: 'digital' },
    { id: 'transferwise', name: 'TransferWise', icon: '🌍', category: 'bank' },
    { id: 'payoneer', name: 'Payoneer', icon: '💼', category: 'digital' },
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
    if (!agreedToTerms) {
      toast({
        title: 'Terms Agreement Required',
        description: 'Please agree to the terms and conditions.',
        variant: 'destructive'
      });
      return;
    }

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

  const resetModal = () => {
    setStep('fee-selection');
    setSelectedPaymentMethods([]);
    setBuyerEmail('');
    setSelectedTransactionType('safest');
    setAgreedToTerms(false);
    setIsCreatingDeal(false);
    setShowInfo(false);
    setActiveInstructionTab('youtube');
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
      <div className={`bg-xsm-dark-gray rounded-xl ${getModalWidthClass()} w-full flex flex-col transition-all duration-300 shadow-2xl border border-xsm-medium-gray/40`} style={{ maxHeight: '95vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-xsm-gray flex-shrink-0">
          <h2 className="text-base font-bold text-white">Create a Deal</h2>
          <button
            onClick={() => {
              resetModal();
              onClose();
            }}
            className="text-white hover:text-xsm-yellow transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 overflow-y-auto flex-1 custom-scrollbar">
          {step === 'fee-selection' && (
            <>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-white">Escrow Service Fee</h2>
                <button
                  type="button"
                  onClick={() => setShowInfo(true)}
                  className="text-gray-400 hover:text-xsm-yellow p-1 transition-colors flex items-center gap-1 text-xs font-medium border border-gray-700 rounded-lg bg-gray-800/40"
                  title="View Discount Fee Programs"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Discount Tiers</span>
                </button>
              </div>
              
              <div className="bg-xsm-gray rounded-lg p-3 mb-2">
                <h3 className="text-xs font-semibold text-white mb-1.5">Standard Fee Structure</h3>
                <table className="w-full text-left text-xs text-xsm-light-gray border-collapse">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="py-1 text-white font-semibold">Deal Amount</th>
                      <th className="py-1 text-white font-semibold">Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-800">
                      <td className="py-1 font-medium text-white">$1 – $50</td>
                      <td className="py-1 text-xsm-yellow font-bold">Minimum $2</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-1 font-medium text-white">$50 – $100</td>
                      <td className="py-1 text-xsm-yellow font-bold">5%</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-medium text-white">Above $100</td>
                      <td className="py-1 text-xsm-yellow font-bold">4%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Calculated Fee Summary */}
              <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-3 mb-3 text-center">
                <p className="text-gray-400 text-[10px] mb-0.5 uppercase tracking-wider font-semibold">Your Calculated Service Fee</p>
                <p className="text-2xl font-extrabold text-xsm-yellow mb-0.5">${escrowFee.toFixed(2)}</p>
                <p className="text-xsm-light-gray text-xs">
                  Based on the channel price of <span className="text-white font-semibold">${numericPrice.toFixed(2)}</span>
                </p>
                <div className={`mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${activeTier.color} bg-white/5 border border-white/10`}>
                  {activeTier.icon && <span>{activeTier.icon}</span>}
                  <span>{activeTier.label}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-700 flex justify-between items-center text-sm px-2">
                  <span className="text-xsm-light-gray font-medium text-xs">Total with Fee:</span>
                  <span className="text-white font-bold">${(numericPrice + escrowFee).toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleFeeSelection}
                className="w-full bg-xsm-yellow text-black font-bold py-2 rounded-lg hover:bg-yellow-400 transition-colors text-sm"
              >
                Continue to Payment Methods
              </button>
            </>
          )}

          {step === 'payment-selection' && (
            <>
              {/* Transaction Type Selection */}
              <div className="mb-2">
                <div className="flex justify-center space-x-3 mb-2">
                  <button
                    onClick={() => setSelectedTransactionType('safest')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      selectedTransactionType === 'safest'
                        ? 'bg-white text-black'
                        : 'bg-transparent border border-white text-white hover:bg-white hover:text-black'
                    }`}
                  >
                    Safest transaction
                  </button>
                  <button
                    onClick={() => setSelectedTransactionType('fastest')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      selectedTransactionType === 'fastest'
                        ? 'bg-white text-black'
                        : 'bg-transparent border border-white text-white hover:bg-white hover:text-black'
                    }`}
                  >
                    Fastest transaction
                  </button>
                </div>
              </div>

              {/* Payment Methods Selection */}
              <div className="mb-2">
                <p className="text-xs text-gray-400 mb-2">
                  Select payment methods you can use to pay the seller. More options = better chance of matching the seller.
                </p>
                <div className="grid grid-cols-5 gap-2 mb-2">
                  {paymentMethods.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => handlePaymentMethodToggle(method.id)}
                      className={`p-2 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                        selectedPaymentMethods.includes(method.id)
                          ? 'border-xsm-yellow bg-xsm-yellow/10 text-xsm-yellow'
                          : 'border-gray-600 text-white hover:border-xsm-yellow hover:text-xsm-yellow'
                      }`}
                    >
                      <span className="text-lg">{method.icon}</span>
                      <span className="text-[10px] font-medium text-center leading-tight">{method.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Transaction Steps by Platform */}
              <div className="mb-2 border border-gray-700 bg-gray-800/20 rounded-lg p-3">
                <h3 className="text-xs font-semibold text-white mb-2">Transaction Instructions by Platform:</h3>
                <div className="flex border-b border-gray-700 mb-2 gap-1">
                  {(['youtube', 'tiktok', 'facebook', 'instagram'] as const).map((platform) => (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => setActiveInstructionTab(platform)}
                      className={`px-3 py-1 text-xs font-semibold capitalize border-b-2 transition-all whitespace-nowrap ${
                        activeInstructionTab === platform
                          ? 'border-xsm-yellow text-xsm-yellow bg-xsm-yellow/5'
                          : 'border-transparent text-gray-400 hover:text-white'
                      }`}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
                <div>
                  {activeInstructionTab === 'youtube' && (
                    <ol className="space-y-1 text-white list-decimal list-inside text-xs leading-relaxed">
                      <li>The buyer pays the service fee (${escrowFee.toFixed(2)}) to initiate the escrow process.</li>
                      <li>The seller designates the website agent's email as a <strong>Manager</strong> of the YouTube channel.</li>
                      <li>The website agent must remain a Manager for <strong>7 days</strong> before primary ownership can be transferred.</li>
                      <li>After 7 days, the seller transfers <strong>Primary Ownership</strong> to the website agent.</li>
                      <li>The agent verifies the channel, removes seller's access, and notifies the buyer to pay the seller.</li>
                      <li>After seller confirms payment, the agent assigns Primary Ownership to the buyer.</li>
                    </ol>
                  )}
                  {activeInstructionTab === 'tiktok' && (
                    <ol className="space-y-1 text-white list-decimal list-inside text-xs leading-relaxed">
                      <li>The buyer pays the service fee (${escrowFee.toFixed(2)}) to initiate escrow.</li>
                      <li>The seller shares login credentials with the agent via secure chat.</li>
                      <li>The agent updates recovery email, links new phone, and logs out of all sessions.</li>
                      <li>The agent verifies details and notifies the buyer to pay the seller.</li>
                      <li>After seller confirms payment, agent transfers credentials to buyer.</li>
                    </ol>
                  )}
                  {activeInstructionTab === 'facebook' && (
                    <ol className="space-y-1 text-white list-decimal list-inside text-xs leading-relaxed">
                      <li>The buyer pays the service fee (${escrowFee.toFixed(2)}) to initiate escrow.</li>
                      <li>The seller invites the website agent as an <strong>Admin</strong> of the Facebook Page.</li>
                      <li>The agent accepts, checks for other owners, and removes seller's admin access.</li>
                      <li>The agent verifies all roles and notifies buyer to pay seller.</li>
                      <li>After seller confirms payment, agent invites buyer as Admin and removes themselves.</li>
                    </ol>
                  )}
                  {activeInstructionTab === 'instagram' && (
                    <ol className="space-y-1 text-white list-decimal list-inside text-xs leading-relaxed">
                      <li>The buyer pays the service fee (${escrowFee.toFixed(2)}) to initiate escrow.</li>
                      <li>The seller updates Instagram account email to the agent's secure transfer email.</li>
                      <li>The agent resets the password and updates 2FA settings.</li>
                      <li>The agent verifies the account is secured and notifies buyer to pay seller.</li>
                      <li>After seller confirms payment, agent changes email to buyer's and hands over credentials.</li>
                    </ol>
                  )}
                </div>
              </div>

              {/* Security Notice */}
              <div className="mb-2">
                <div className="bg-orange-500/10 border border-orange-500 rounded-lg p-2">
                  <p className="text-orange-300 text-[10px]">
                    ⚠️ All messages must be sent through the website chat system. Communication outside the platform may void transaction protection.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-2 px-4 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDeal}
                  disabled={selectedPaymentMethods.length === 0}
                  className="flex-1 py-2 px-4 text-sm bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                <h3 className="text-sm font-semibold text-white mb-2">Deal Summary</h3>
                <div className="bg-xsm-gray rounded-lg p-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-300">Channel:</span>
                    <span className="text-xsm-yellow font-semibold">{channelTitle}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-300">Price:</span>
                    <span className="text-xsm-yellow font-semibold">${numericPrice}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-300">Service Fee:</span>
                    <span className="text-xsm-yellow font-semibold">${escrowFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-300">Transaction Type:</span>
                    <span className="text-xsm-yellow font-semibold capitalize">{selectedTransactionType}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-300">Payment Methods:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedPaymentMethods.map(methodId => {
                        const method = paymentMethods.find(p => p.id === methodId);
                        return (
                          <span key={methodId} className="bg-xsm-yellow text-black px-2 py-0.5 rounded-full text-[10px] font-medium">
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
                <h3 className="text-xs font-semibold text-white mb-1">
                  Email address associated with the account to be designated as the owner
                </h3>
                <p className="text-gray-400 mb-2 text-[11px]">
                  No emails or passwords are traded on this website. The account will be transferred to the email address you provide below.
                </p>
                <input
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full p-2.5 text-sm bg-white border border-gray-600 rounded-lg text-black placeholder-gray-500 focus:border-xsm-yellow focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('payment-selection')}
                  className="flex-1 py-2 px-4 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleEmailConfirmation}
                  disabled={!buyerEmail.trim()}
                  className="flex-1 py-2 px-4 text-sm bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
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
                <h3 className="text-sm font-semibold text-white mb-2">Terms & Conditions Agreement</h3>
                <div className="bg-xsm-gray rounded-lg p-3 max-h-44 overflow-y-auto custom-scrollbar">
                  <div className="space-y-2 text-white text-xs">
                    <div>
                      <h4 className="font-semibold text-xsm-yellow text-xs mb-0.5">1. Website Agent Service Agreement</h4>
                      <p className="text-[11px] text-gray-300">By proceeding, you agree to use our secure website agent service. All transactions must follow the established process for buyer and seller protection.</p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-xsm-yellow text-xs mb-0.5">2. Communication Policy</h4>
                      <p className="text-[11px] text-gray-300">⚠️ <strong>IMPORTANT:</strong> All communication MUST occur through our platform's chat system. Communication outside the website is FORBIDDEN for safety.</p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-xsm-yellow text-xs mb-0.5">3. Transaction Process</h4>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-gray-300 ml-2">
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
                      <p className="text-[11px] text-gray-300">7-day money-back guarantee applies if seller fails to deliver. Service fee is non-refundable unless transaction is cancelled by seller.</p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-xsm-yellow text-xs mb-0.5">5. Account Transfer</h4>
                      <p className="text-[11px] text-gray-300">Account will be transferred to: <strong className="text-xsm-yellow">{buyerEmail}</strong>.</p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-xsm-yellow text-xs mb-0.5">6. Dispute Resolution</h4>
                      <p className="text-[11px] text-gray-300">Disputes will be resolved through our arbitration service via chat log review.</p>
                    </div>
                    
                    <div className="bg-orange-500/10 border border-orange-500 rounded p-2 mt-2">
                      <p className="text-orange-300 text-[10px] font-medium">
                        🔒 <strong>Security Notice:</strong> Never share credentials outside our platform. Our website agents handle all transfers securely.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Agreement Checkbox */}
              <div className="mb-3">
                <label className="flex items-start space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-xsm-yellow bg-xsm-gray border-gray-600 rounded focus:ring-xsm-yellow"
                  />
                  <span className="text-white text-xs leading-tight">
                    I have read and agree to the terms and conditions above. All communication must happen through the platform chat for transaction security.
                  </span>
                </label>
              </div>

              {/* Transaction Summary */}
              <div className="mb-3">
                <div className="bg-xsm-black/50 rounded-lg p-2.5">
                  <h4 className="text-xsm-yellow font-semibold text-xs mb-1.5">Transaction Summary</h4>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-gray-400 text-[10px] block">Channel:</span>
                      <p className="text-white font-medium text-xs truncate">{channelTitle}</p>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block">Price:</span>
                      <p className="text-white font-medium text-xs">${numericPrice}</p>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block">Service Fee:</span>
                      <p className="text-white font-medium text-xs">${escrowFee.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block">Transfer Email:</span>
                      <p className="text-white font-medium text-xs truncate" title={buyerEmail}>{buyerEmail}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('email-confirmation')}
                  className="flex-1 py-2 px-4 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleFinalSubmit}
                  disabled={!agreedToTerms || isCreatingDeal}
                  className="flex-1 py-2 px-4 text-sm bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center space-x-2"
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
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-xsm-dark-gray border border-gray-700 rounded-xl p-6 max-w-xl w-full max-h-[85vh] overflow-y-auto relative shadow-2xl">
            <button
              onClick={() => setShowInfo(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors"
              title="Close Panel"
            >
              <X className="w-6 h-6" />
            </button>

            <h3 className="text-xl font-bold text-xsm-yellow mb-1 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-xsm-yellow" />
              Fee Discount Tiers
            </h3>
            <p className="text-xs text-gray-400 mb-5">Your active tier is highlighted below.</p>

            <div className="space-y-3">
              {/* Standard */}
              <div className={`border rounded-lg p-4 transition-all ${
                buyerTier === 'standard'
                  ? 'border-gray-500 bg-gray-800/60 ring-1 ring-gray-500'
                  : 'border-gray-800 bg-xsm-black/40'
              }`}>
                <h4 className="font-semibold text-gray-300 mb-2 text-sm flex items-center justify-between">
                  <span>Standard Rate</span>
                  {buyerTier === 'standard' && <span className="text-[10px] bg-gray-600 text-white px-2 py-0.5 rounded-full">YOUR TIER</span>}
                </h4>
                <table className="w-full text-left text-xs text-xsm-light-gray">
                  <thead><tr className="border-b border-gray-800"><th className="py-1 text-white font-medium">Deal Amount</th><th className="py-1 text-white font-medium">Fee</th></tr></thead>
                  <tbody>
                    <tr className="border-b border-gray-800/40"><td className="py-1">$1 – $50</td><td className="py-1 text-white">Min $2</td></tr>
                    <tr className="border-b border-gray-800/40"><td className="py-1">$50 – $100</td><td className="py-1 text-white">5%</td></tr>
                    <tr><td className="py-1">Above $100</td><td className="py-1 text-white">4%</td></tr>
                  </tbody>
                </table>
              </div>

              {/* Repeat Buyer */}
              <div className={`border rounded-lg p-4 transition-all ${
                buyerTier === 'repeat'
                  ? 'border-blue-500 bg-blue-950/40 ring-1 ring-blue-500'
                  : 'border-gray-800 bg-xsm-black/40'
              }`}>
                <h4 className="font-semibold text-blue-300 mb-2 text-sm flex items-center justify-between">
                  <span>🔁 Repeat Buyer Discount</span>
                  <span className="text-[10px] text-blue-400 font-normal">Min 3 completed deals</span>
                  {buyerTier === 'repeat' && <span className="text-[10px] bg-blue-700 text-white px-2 py-0.5 rounded-full ml-1">YOUR TIER</span>}
                </h4>
                <table className="w-full text-left text-xs text-xsm-light-gray">
                  <thead><tr className="border-b border-gray-800"><th className="py-1 text-white font-medium">Deal Amount</th><th className="py-1 text-white font-medium">Fee</th></tr></thead>
                  <tbody>
                    <tr className="border-b border-gray-800/40"><td className="py-1">$1 – $50</td><td className="py-1 text-white">Min $2</td></tr>
                    <tr className="border-b border-gray-800/40"><td className="py-1">$50 – $100</td><td className="py-1 text-white">4.5%</td></tr>
                    <tr><td className="py-1">Above $100</td><td className="py-1 text-white">3.5%</td></tr>
                  </tbody>
                </table>
              </div>

              {/* VIP Member */}
              <div className={`border rounded-lg p-4 transition-all ${
                buyerTier === 'vip'
                  ? 'border-yellow-500 bg-yellow-950/40 ring-1 ring-yellow-500'
                  : 'border-gray-800 bg-xsm-black/40'
              }`}>
                <h4 className="font-semibold text-yellow-400 mb-2 text-sm flex items-center justify-between">
                  <span>👑 VIP Member Discount</span>
                  {buyerTier === 'vip' && <span className="text-[10px] bg-yellow-600 text-black px-2 py-0.5 rounded-full">YOUR TIER</span>}
                </h4>
                <table className="w-full text-left text-xs text-xsm-light-gray">
                  <thead><tr className="border-b border-gray-800"><th className="py-1 text-white font-medium">Deal Amount</th><th className="py-1 text-white font-medium">Fee</th></tr></thead>
                  <tbody>
                    <tr className="border-b border-gray-800/40"><td className="py-1">$1 – $50</td><td className="py-1 text-white">Min $2</td></tr>
                    <tr className="border-b border-gray-800/40"><td className="py-1">$50 – $100</td><td className="py-1 text-white">4%</td></tr>
                    <tr><td className="py-1">Above $100</td><td className="py-1 text-white">3%</td></tr>
                  </tbody>
                </table>
              </div>

              {/* VIP + Repeat Buyer */}
              <div className={`border rounded-lg p-4 transition-all ${
                buyerTier === 'vip_repeat'
                  ? 'border-emerald-500 bg-emerald-950/40 ring-1 ring-emerald-500'
                  : 'border-gray-800 bg-xsm-black/40'
              }`}>
                <h4 className="font-semibold text-emerald-400 mb-2 text-sm flex items-center justify-between">
                  <span>⭐ VIP + Repeat Buyer</span>
                  <span className="text-[10px] text-emerald-400 font-normal">Best Rate!</span>
                  {buyerTier === 'vip_repeat' && <span className="text-[10px] bg-emerald-700 text-white px-2 py-0.5 rounded-full ml-1">YOUR TIER</span>}
                </h4>
                <table className="w-full text-left text-xs text-xsm-light-gray">
                  <thead><tr className="border-b border-gray-800"><th className="py-1 text-white font-medium">Deal Amount</th><th className="py-1 text-white font-medium">Fee</th></tr></thead>
                  <tbody>
                    <tr className="border-b border-gray-800/40"><td className="py-1">$1 – $50</td><td className="py-1 text-white">Min $2</td></tr>
                    <tr className="border-b border-gray-800/40"><td className="py-1">$50 – $100</td><td className="py-1 text-white">3.5%</td></tr>
                    <tr><td className="py-1">Above $100</td><td className="py-1 text-white">2.5%</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <button
              onClick={() => setShowInfo(false)}
              className="mt-6 w-full py-3 bg-xsm-yellow text-black font-bold rounded-lg hover:bg-yellow-500 transition-colors"
            >
              Back to Checkout
            </button>
          </div>
        </div>
      )}

      {/* Custom Deal Created Success Popup Modal */}
      {successData && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[70] p-4">
          <div className="bg-gradient-to-b from-[#1c1c1e] to-[#121214] border border-emerald-500/40 rounded-2xl max-w-md w-full p-6 text-center shadow-[0_0_50px_rgba(16,185,129,0.2)] relative animate-in fade-in zoom-in-95 duration-200">
            {/* Top success icon badge */}
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/50 flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h3 className="text-xl font-extrabold text-white mb-1">Deal Created Successfully!</h3>
            <p className="text-xs text-gray-400 mb-4">Your deal has been saved and the seller has been notified.</p>

            {/* Deal Detail Summary Box */}
            <div className="bg-black/60 border border-white/10 rounded-xl p-3.5 text-left space-y-2 mb-4 text-xs">
              <div className="flex justify-between items-center pb-1.5 border-b border-white/10">
                <span className="text-gray-400">Transaction ID:</span>
                <span className="text-emerald-400 font-mono font-bold">{successData.txnId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Channel:</span>
                <span className="text-white font-semibold">{successData.channelTitle}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Amount:</span>
                <span className="text-xsm-yellow font-bold">${successData.amount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Service Fee:</span>
                <span className="text-xsm-yellow font-bold">${successData.serviceFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-white/10">
                <span className="text-gray-400">Transfer Email:</span>
                <span className="text-white font-medium truncate max-w-[180px]" title={successData.buyerEmail}>{successData.buyerEmail}</span>
              </div>
            </div>

            {/* Status Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-5">
              <Clock className="w-3.5 h-3.5 animate-pulse" />
              <span>Status: Waiting for seller review</span>
            </div>

            {/* Buttons */}
            <button
              onClick={() => {
                setSuccessData(null);
                resetModal();
                onClose();
                if (onNavigateToChat) {
                  onNavigateToChat();
                }
              }}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-black font-extrabold text-sm rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue to Chat</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealCreationModal;
