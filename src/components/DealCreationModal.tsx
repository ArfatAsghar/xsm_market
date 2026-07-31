import React, { useState, useEffect } from 'react';
import { X, Shield, DollarSign, CreditCard, Smartphone, Check, HelpCircle, Crown } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { getBuyerStats } from '@/services/auth';


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

  // Fetch buyer stats (VIP + repeat buyer tier) when modal opens
  useEffect(() => {
    if (!isOpen || !isLoggedIn) return;
    getBuyerStats().then(stats => {
      setBuyerTier(stats.tier);
      setBuyerIsVip(stats.isVip);
    }).catch(() => {});
  }, [isOpen, isLoggedIn]);

  // Payment methods data
  const paymentMethods: PaymentMethod[] = [
    { id: 'bank-transfer', name: 'Bank Transfer', icon: '🏦', category: 'bank' },
    { id: 'paypal', name: 'PayPal', icon: '💳', category: 'digital' },
    { id: 'bitcoin', name: 'Bitcoin', icon: '₿', category: 'crypto' },
    { id: 'venmo', name: 'Venmo', icon: '💸', category: 'digital' },
    { id: 'zelle', name: 'Zelle', icon: '⚡', category: 'digital' },
    { id: 'cashapp', name: 'Cash App', icon: '💰', category: 'digital' },
    { id: 'transferwise', name: 'TransferWise', icon: '🌍', category: 'bank' },
    { id: 'google-pay', name: 'Google Pay', icon: '📱', category: 'digital' },
    { id: 'payoneer', name: 'Payoneer', icon: '💼', category: 'digital' },
    { id: 'western-union', name: 'Western Union', icon: '🌐', category: 'bank' },
    { id: 'moneygram', name: 'MoneyGram', icon: '💱', category: 'bank' },
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
      alert('Please select at least one payment method');
      return;
    }
    setStep('email-confirmation');
  };

  const handleEmailConfirmation = () => {
    if (!buyerEmail.trim()) {
      alert('Please enter your email address');
      return;
    }
    setStep('terms-conditions');
  };

  const handleFinalSubmit = async () => {
    if (!agreedToTerms) {
      alert('Please agree to the terms and conditions');
      return;
    }

    if (!isLoggedIn || !user) {
      alert('Please log in to create a deal');
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
        // Success! Show deal created message
        const feeDisplay = `$${escrowFee.toFixed(2)}`;
        alert(`✅ Deal Created Successfully!

Transaction ID: ${officialTxnId}
Channel: ${channelTitle}
Amount: $${numericPrice}
Service Fee: ${feeDisplay}
Email: ${buyerEmail}

Your deal has been saved to the database and the seller has been notified. 
They will review your selected payment methods and respond accordingly.

Deal Status: Waiting for seller review`);

        // Reset and close modal
        resetModal();
        onClose();
      } else {
        throw new Error(result.message || 'Failed to create deal');
      }
      
    } catch (error) {
      console.error('Error creating deal:', error);
      alert('Failed to create deal. Please try again.');
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-xsm-dark-gray rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-xsm-gray">
          <h2 className="text-xl font-bold text-white">Create a Deal</h2>
          <button
            onClick={() => {
              resetModal();
              onClose();
            }}
            className="text-white hover:text-xsm-yellow transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5">
          {step === 'fee-selection' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Escrow Service Fee</h2>
                <button
                  type="button"
                  onClick={() => setShowInfo(true)}
                  className="text-gray-400 hover:text-xsm-yellow p-1 transition-colors flex items-center gap-1 text-xs font-medium border border-gray-700 rounded-lg bg-gray-800/40"
                  title="View Discount Fee Programs"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>Discount Tiers</span>
                </button>
              </div>
              
              <div className="bg-xsm-gray rounded-lg p-4 mb-4">
                <h3 className="text-sm font-semibold text-white mb-2">Standard Fee Structure</h3>
                <table className="w-full text-left text-xs text-xsm-light-gray border-collapse">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="py-1.5 text-white font-semibold">Deal Amount</th>
                      <th className="py-1.5 text-white font-semibold">Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-800">
                      <td className="py-1.5 font-medium text-white">$1 – $50</td>
                      <td className="py-1.5 text-xsm-yellow font-bold">Minimum $2</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-1.5 font-medium text-white">$50 – $100</td>
                      <td className="py-1.5 text-xsm-yellow font-bold">5%</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 font-medium text-white">Above $100</td>
                      <td className="py-1.5 text-xsm-yellow font-bold">4%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Calculated Fee Summary */}
              <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-4 mb-4 text-center">
                <p className="text-gray-400 text-[11px] mb-0.5 uppercase tracking-wider font-semibold">Your Calculated Service Fee</p>
                <p className="text-3xl font-extrabold text-xsm-yellow mb-1">${escrowFee.toFixed(2)}</p>
                <p className="text-xsm-light-gray text-xs leading-relaxed">
                  Based on the channel price of <span className="text-white font-semibold">${numericPrice.toFixed(2)}</span>
                </p>
                {/* Active tier badge */}
                <div className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${activeTier.color} bg-white/5 border border-white/10`}>
                  {activeTier.icon && <span>{activeTier.icon}</span>}
                  <span>{activeTier.label}</span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-gray-700 flex justify-between items-center text-sm px-2">
                  <span className="text-xsm-light-gray font-medium">Total with Fee:</span>
                  <span className="text-white font-bold text-base">${(numericPrice + escrowFee).toFixed(2)}</span>
                </div>
              </div>

              {/* Continue Button */}
              <button
                onClick={handleFeeSelection}
                className="w-full bg-xsm-yellow text-black font-bold py-2.5 rounded-lg hover:bg-yellow-400 transition-colors text-sm"
              >
                Continue to Payment Methods
              </button>
            </>
          )}

          {step === 'payment-selection' && (
            <>
              {/* Transaction Type Selection */}
              <div className="mb-8">
                <div className="flex justify-center space-x-4 mb-6">
                  <button
                    onClick={() => setSelectedTransactionType('safest')}
                    className={`px-6 py-3 rounded-full font-semibold transition-all ${
                      selectedTransactionType === 'safest'
                        ? 'bg-white text-black'
                        : 'bg-transparent border border-white text-white hover:bg-white hover:text-black'
                    }`}
                  >
                    Safest transaction
                  </button>
                  <button
                    onClick={() => setSelectedTransactionType('fastest')}
                    className={`px-6 py-3 rounded-full font-semibold transition-all ${
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
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-white mb-4">
                  Select payment methods you can use to pay the seller. The more options you choose, the greater the chance that one of them will suit the seller and he will agree to the deal.
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                  {paymentMethods.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => handlePaymentMethodToggle(method.id)}
                      className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center space-y-2 ${
                        selectedPaymentMethods.includes(method.id)
                          ? 'border-xsm-yellow bg-xsm-yellow/10 text-xsm-yellow'
                          : 'border-gray-600 text-white hover:border-xsm-yellow hover:text-xsm-yellow'
                      }`}
                    >
                      <span className="text-2xl">{method.icon}</span>
                      <span className="text-sm font-medium text-center">{method.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Transaction Steps by Platform */}
              <div className="mb-8 border border-gray-700 bg-gray-800/20 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Transaction Instructions by Platform:</h3>
                
                {/* Tab Header Buttons */}
                <div className="flex border-b border-gray-700 mb-6 overflow-x-auto gap-2">
                  {(['youtube', 'tiktok', 'facebook', 'instagram'] as const).map((platform) => (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => setActiveInstructionTab(platform)}
                      className={`px-4 py-2 font-semibold capitalize border-b-2 transition-all whitespace-nowrap ${
                        activeInstructionTab === platform
                          ? 'border-xsm-yellow text-xsm-yellow bg-xsm-yellow/5'
                          : 'border-transparent text-gray-400 hover:text-white'
                      }`}
                    >
                      {platform}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="min-h-[160px]">
                  {activeInstructionTab === 'youtube' && (
                    <ol className="space-y-3 text-white list-decimal list-inside text-sm leading-relaxed">
                      <li>The buyer pays the service fee (${escrowFee.toFixed(2)}) to initiate the escrow process.</li>
                      <li>The seller designates the website agent's email address as a <strong>Manager</strong> of the YouTube channel.</li>
                      <li>Under Google's platform security rules, the website agent must remain a Manager for <strong>7 days</strong> before primary ownership can be transferred.</li>
                      <li>After 7 days, the seller transfers <strong>Primary Ownership</strong> rights to the website agent.</li>
                      <li>The agent verifies that the channel is secured, removes the seller's access, and notifies the buyer to pay the seller.</li>
                      <li>The buyer pays the seller. Once the seller confirms payment, the website agent assigns the Primary Ownership rights to the buyer.</li>
                    </ol>
                  )}
                  
                  {activeInstructionTab === 'tiktok' && (
                    <ol className="space-y-3 text-white list-decimal list-inside text-sm leading-relaxed">
                      <li>The buyer pays the service fee (${escrowFee.toFixed(2)}) to initiate the escrow process.</li>
                      <li>The seller shares the login credentials and verification code with the website agent in the secure chat.</li>
                      <li>The agent logs into the TikTok account, updates the recovery email, links a new phone number, and logs out of all other active sessions to fully secure the account.</li>
                      <li>The agent verifies that the page details are correct and notifies the buyer to pay the seller.</li>
                      <li>The buyer pays the seller. Once the seller confirms payment, the website agent transfers the login credentials and links the account to the buyer's secure email/phone.</li>
                    </ol>
                  )}

                  {activeInstructionTab === 'facebook' && (
                    <ol className="space-y-3 text-white list-decimal list-inside text-sm leading-relaxed">
                      <li>The buyer pays the service fee (${escrowFee.toFixed(2)}) to initiate the escrow process.</li>
                      <li>The seller invites the website agent's profile or Business Manager account as an <strong>Admin</strong> of the Facebook Page.</li>
                      <li>The agent accepts the invitation, checks for any other page owners or pending invitations, and removes the seller's admin access.</li>
                      <li>The agent verifies all roles and notifies the buyer to pay the seller.</li>
                      <li>The buyer pays the seller. Once the seller confirms payment, the agent invites the buyer as Admin and removes themselves.</li>
                    </ol>
                  )}

                  {activeInstructionTab === 'instagram' && (
                    <ol className="space-y-3 text-white list-decimal list-inside text-sm leading-relaxed">
                      <li>The buyer pays the service fee (${escrowFee.toFixed(2)}) to initiate the escrow process.</li>
                      <li>The seller updates the Instagram account email address to the website agent's secure transfer email.</li>
                      <li>The agent confirms the verification email, resets the account password, and updates the two-factor authentication (2FA) settings.</li>
                      <li>The agent verifies that the account is fully secured and notifies the buyer to pay the seller.</li>
                      <li>The buyer pays the seller. Once the seller confirms payment, the agent changes the email to the buyer's email and hands over the credentials.</li>
                    </ol>
                  )}
                </div>
              </div>

              {/* Security Notice */}
              <div className="mb-8">
                <div className="bg-orange-500/10 border border-orange-500 rounded-lg p-4">
                  <p className="text-orange-300 text-sm">
                    In order to guarantee maximum security during the transaction, all messages must be sent through the website using the chat system where the transaction is completed, so that in case of any issues, the website agents can verify everything.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 px-6 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDeal}
                  disabled={selectedPaymentMethods.length === 0}
                  className="flex-1 py-3 px-6 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {step === 'email-confirmation' && (
            <>
              {/* Deal Summary */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-white mb-4">Deal Summary</h3>
                <div className="bg-xsm-gray rounded-lg p-6 space-y-4">
                  <div className="flex justify-between">
                    <span className="text-white">Channel:</span>
                    <span className="text-xsm-yellow font-semibold">{channelTitle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white">Price:</span>
                    <span className="text-xsm-yellow font-semibold">${numericPrice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white">Service Fee:</span>
                    <span className="text-xsm-yellow font-semibold">
                      ${escrowFee.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white">Transaction Type:</span>
                    <span className="text-xsm-yellow font-semibold capitalize">{selectedTransactionType} transaction</span>
                  </div>
                  <div>
                    <span className="text-white">Selected Payment Methods:</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedPaymentMethods.map(methodId => {
                        const method = paymentMethods.find(p => p.id === methodId);
                        return (
                          <span key={methodId} className="bg-xsm-yellow text-black px-3 py-1 rounded-full text-sm font-medium">
                            {method?.icon} {method?.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Email Input */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-white mb-4">
                  Email address associated with the account which should be designated as the owner
                </h3>
                <p className="text-gray-300 mb-4 text-sm">
                  On this website no emails or passwords are traded. The account will be transferred to the email address you provide below. This ensures secure account ownership transfer.
                </p>
                <input
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full p-4 bg-white border border-gray-600 rounded-lg text-black placeholder-gray-500 focus:border-xsm-yellow focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <button
                  onClick={() => setStep('payment-selection')}
                  className="flex-1 py-3 px-6 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleEmailConfirmation}
                  disabled={!buyerEmail.trim()}
                  className="flex-1 py-3 px-6 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {step === 'terms-conditions' && (
            <>
              {/* Terms & Conditions */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-white mb-4">Terms & Conditions Agreement</h3>
                <div className="bg-xsm-gray rounded-lg p-6 max-h-96 overflow-y-auto">
                  <div className="space-y-4 text-white text-sm">
                    <div>
                      <h4 className="font-semibold text-xsm-yellow mb-2">1. Website Agent Service Agreement</h4>
                      <p>By proceeding with this transaction, you agree to use our secure website agent service. All transactions must follow the established process for buyer and seller protection.</p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-xsm-yellow mb-2">2. Communication Policy</h4>
                      <p>⚠️ <strong>IMPORTANT:</strong> All communication regarding this transaction MUST occur through our platform's chat system. Communication outside the website and conducting deals without website agent is FORBIDDEN for your own safety. Any external communication may void transaction protection.</p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-xsm-yellow mb-2">3. Transaction Process</h4>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li>Buyer pays the service fee (${escrowFee.toFixed(2)})</li>
                        <li>Seller designates website agent as account manager</li>
                        <li>After 7 days, seller transfers primary ownership to website agent</li>
                        <li>Website agent verifies account and notifies buyer</li>
                        <li>Buyer pays seller through agreed payment method</li>
                        <li>After seller confirmation, account is transferred to buyer</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-xsm-yellow mb-2">4. Refund Policy</h4>
                      <p>7-day money-back guarantee applies if seller fails to deliver as described. Service fee is non-refundable unless transaction is cancelled by seller.</p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-xsm-yellow mb-2">5. Account Transfer</h4>
                      <p>The account will be transferred to the email address: <strong className="text-xsm-yellow">{buyerEmail}</strong>. Ensure this email is accessible and secure.</p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-xsm-yellow mb-2">6. Dispute Resolution</h4>
                      <p>Any disputes will be resolved through our arbitration service. All chat communications will be reviewed for fair resolution.</p>
                    </div>
                    
                    <div className="bg-orange-500/10 border border-orange-500 rounded-lg p-4 mt-6">
                      <p className="text-orange-300 font-medium">
                        🔒 <strong>Security Notice:</strong> Never share your account credentials outside our platform. Our website agents handle all transfers securely.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Agreement Checkbox */}
              <div className="mb-8">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1 w-5 h-5 text-xsm-yellow bg-xsm-gray border-gray-600 rounded focus:ring-xsm-yellow focus:ring-2"
                  />
                  <span className="text-white text-sm">
                    I have read and agree to the terms and conditions above. I understand that all communication must happen through the platform chat for transaction security.
                  </span>
                </label>
              </div>

              {/* Transaction Summary */}
              <div className="mb-8">
                <div className="bg-xsm-black/50 rounded-lg p-4">
                  <h4 className="text-xsm-yellow font-semibold mb-3">Transaction Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Channel:</span>
                      <p className="text-white font-medium">{channelTitle}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Price:</span>
                      <p className="text-white font-medium">${numericPrice}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Service Fee:</span>
                      <p className="text-white font-medium">${escrowFee.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Transfer Email:</span>
                      <p className="text-white font-medium break-all">{buyerEmail}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <button
                  onClick={() => setStep('email-confirmation')}
                  className="flex-1 py-3 px-6 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleFinalSubmit}
                  disabled={!agreedToTerms || isCreatingDeal}
                  className="flex-1 py-3 px-6 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center space-x-2"
                >
                  {isCreatingDeal ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
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
    </div>
  );
};

export default DealCreationModal;
