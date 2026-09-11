import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, Crown, Star, Tag, Percent, CheckCircle, Loader2, Zap, 
  Copy, Check, ExternalLink, ArrowLeft, ShieldCheck, MessageCircle, RefreshCw
} from 'lucide-react';
import { buyVip, createVipCryptoPayment, getVipPaymentStatus, VipCryptoPaymentResponse } from '@/services/auth';
import { useAuth } from '@/context/useAuth';
import { useToast } from '@/hooks/use-toast';

interface VipSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (vipUntil: string) => void;
}

const VIP_PLANS = [
  {
    months: 1 as const,
    price: 10,
    label: '1 Month',
    popular: false,
    savings: null as number | null,
    desc: 'Try it out for a month'
  },
  {
    months: 2 as const,
    price: 18,
    label: '2 Months',
    popular: true,
    savings: 2 as number | null,
    desc: 'Save $2 vs. monthly'
  },
  {
    months: 3 as const,
    price: 25,
    label: '3 Months',
    popular: false,
    savings: 5 as number | null,
    desc: 'Best value — save $5'
  }
];

const VIP_PERKS = [
  { icon: Crown, label: 'VIP Badge on your profile', color: 'text-amber-500' },
  { icon: Tag, label: 'VIP tag on every listing you sell', color: 'text-amber-500' },
  { icon: Percent, label: 'Reduced escrow service fees (down to 2.5%)', color: 'text-emerald-500' },
  { icon: Star, label: 'Stand out from other sellers & buyers', color: 'text-purple-500' },
  { icon: Zap, label: 'Stacks with Repeat Buyer tier for maximum savings', color: 'text-blue-500' }
];

const FEE_TIERS = [
  {
    tier: 'Standard',
    color: 'text-gray-500 dark:text-gray-400',
    range1: 'Min $2', range2: '5.0%', range3: '4.0%',
    isVip: false
  },
  {
    tier: 'Repeat Buyer (≥3 Deals)',
    color: 'text-blue-600 dark:text-blue-400 font-medium',
    range1: 'Min $2', range2: '4.5%', range3: '3.5%',
    isVip: false
  },
  {
    tier: 'VIP Member',
    color: 'text-amber-600 dark:text-amber-400 font-bold',
    range1: 'Min $2', range2: '4.0%', range3: '3.0%',
    isVip: true
  },
  {
    tier: 'VIP + Repeat Buyer',
    color: 'text-emerald-600 dark:text-emerald-400 font-bold',
    range1: 'Min $2', range2: '3.5%', range3: '2.5%',
    isVip: true
  }
];

const CRYPTO_CURRENCIES = [
  { code: 'usdttrc20', name: 'USDT (TRC-20)', badge: 'Recommended' },
  { code: 'btc', name: 'Bitcoin (BTC)', badge: null },
  { code: 'eth', name: 'Ethereum (ETH)', badge: null },
  { code: 'ltc', name: 'Litecoin (LTC)', badge: 'Low Fee' },
  { code: 'sol', name: 'Solana (SOL)', badge: 'Fast' },
  { code: 'bnbbsc', name: 'BNB (BEP-20)', badge: null }
];

// Fallback official platform USDT wallet address for direct transfer
const OFFICIAL_USDT_TRC20 = 'TXsmMarketOfficialEscrowUsdtTRC20DepositAddress';

const VipSubscriptionModal: React.FC<VipSubscriptionModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [selectedPlan, setSelectedPlan] = useState<1 | 2 | 3>(2);
  const [paymentMethod, setPaymentMethod] = useState<'crypto' | 'direct' | 'admin'>('crypto');
  const [selectedCrypto, setSelectedCrypto] = useState('usdttrc20');
  
  // Crypto checkout state
  const [step, setStep] = useState<'plan' | 'checkout'>('plan');
  const [isInitializing, setIsInitializing] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [paymentData, setPaymentData] = useState<VipCryptoPaymentResponse['payment'] | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string>('waiting');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isAdminActivating, setIsAdminActivating] = useState(false);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isAdmin = Boolean(user?.isAdmin || (user as any)?.role === 'admin');
  const plan = VIP_PLANS.find(p => p.months === selectedPlan)!;

  // Clean up timer on unmount or when modal closes
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  // Poll payment status while in checkout
  useEffect(() => {
    if (step === 'checkout' && paymentData?.payment_id && ['waiting', 'confirming', 'sending'].includes(paymentStatus)) {
      pollTimerRef.current = setInterval(async () => {
        try {
          const res = await getVipPaymentStatus(paymentData.payment_id);
          if (res.status) setPaymentStatus(res.status);
          if (res.isVip && res.vipUntil) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            toast({
              title: '👑 VIP Status Activated!',
              description: `Your VIP membership is now active until ${new Date(res.vipUntil).toLocaleDateString()}`
            });
            onSuccess?.(res.vipUntil);
            setTimeout(() => {
              onClose();
            }, 2500);
          }
        } catch {
          // ignore polling errors
        }
      }, 6000);

      return () => {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      };
    }
  }, [step, paymentData?.payment_id, paymentStatus]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Handle Crypto Checkout initialization
  const handleStartCryptoPayment = async () => {
    setIsInitializing(true);
    try {
      const res = await createVipCryptoPayment(selectedPlan, selectedCrypto);
      if (res.success && res.payment) {
        setPaymentData(res.payment);
        setPaymentStatus(res.payment.status || 'waiting');
        setStep('checkout');
      } else {
        throw new Error('Could not generate crypto invoice');
      }
    } catch (err) {
      toast({
        title: 'Payment Initialization Failed',
        description: err instanceof Error ? err.message : 'Failed to connect with NOWPayments',
        variant: 'destructive'
      });
    } finally {
      setIsInitializing(false);
    }
  };

  // Manual Check Payment button
  const handleManualCheckStatus = async () => {
    if (!paymentData?.payment_id) return;
    setIsCheckingStatus(true);
    try {
      const res = await getVipPaymentStatus(paymentData.payment_id);
      if (res.status) setPaymentStatus(res.status);
      if (res.isVip && res.vipUntil) {
        toast({
          title: '👑 Payment Confirmed!',
          description: `VIP active until ${new Date(res.vipUntil).toLocaleDateString()}`
        });
        onSuccess?.(res.vipUntil);
        onClose();
      } else {
        toast({
          title: 'Payment Status',
          description: `Current status: ${res.status || 'Waiting for deposit confirmation'}`
        });
      }
    } catch (err) {
      toast({
        title: 'Check Status Failed',
        description: err instanceof Error ? err.message : 'Unable to check status right now',
        variant: 'destructive'
      });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Admin Instant Activation (Test mode for admins)
  const handleAdminInstantActivate = async () => {
    setIsAdminActivating(true);
    try {
      const result = await buyVip(selectedPlan);
      toast({
        title: '👑 Admin VIP Activated!',
        description: result.message || `VIP active until ${new Date(result.vipUntil).toLocaleDateString()}`
      });
      onSuccess?.(result.vipUntil);
      onClose();
    } catch (err) {
      toast({
        title: 'Activation Failed',
        description: err instanceof Error ? err.message : 'Failed to activate VIP',
        variant: 'destructive'
      });
    } finally {
      setIsAdminActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border shadow-2xl transition-all duration-200"
        style={{
          backgroundColor: 'var(--xsm-dark-gray)',
          borderColor: 'var(--xsm-medium-gray)',
          color: 'var(--xsm-text)'
        }}
      >
        {/* Top Gold Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 opacity-90" />

        {/* Modal Header */}
        <div 
          className="flex items-center justify-between p-5 sm:p-6 border-b"
          style={{ borderColor: 'var(--xsm-medium-gray)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-md shadow-amber-500/20 flex-shrink-0">
              <Crown className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--xsm-heading)' }}>
                VIP Membership
              </h2>
              <p className="text-xs font-medium" style={{ color: 'var(--xsm-light-gray)' }}>
                {step === 'plan' ? 'Choose your plan & payment method' : 'Complete your crypto payment'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            style={{ color: 'var(--xsm-light-gray)' }}
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6">

          {/* STEP 1: PLAN SELECTION & PERKS */}
          {step === 'plan' && (
            <>
              {/* Perks List */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: 'var(--xsm-light-gray)' }}>
                  VIP Seller & Buyer Perks
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {VIP_PERKS.map(({ icon: Icon, label, color }) => (
                    <div 
                      key={label} 
                      className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 border transition-all"
                      style={{ 
                        backgroundColor: 'var(--xsm-bg)', 
                        borderColor: 'var(--xsm-medium-gray)' 
                      }}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
                      <span className="text-xs font-semibold" style={{ color: 'var(--xsm-text)' }}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Service Fee Tiers Comparison */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: 'var(--xsm-light-gray)' }}>
                  Discounted Service Fee Tiers
                </h3>
                <div 
                  className="rounded-xl overflow-hidden border"
                  style={{ borderColor: 'var(--xsm-medium-gray)' }}
                >
                  <table className="w-full text-xs">
                    <thead>
                      <tr 
                        className="border-b"
                        style={{ 
                          backgroundColor: 'var(--xsm-bg)', 
                          borderColor: 'var(--xsm-medium-gray)',
                          color: 'var(--xsm-light-gray)'
                        }}
                      >
                        <th className="text-left px-3.5 py-2 font-bold">Tier</th>
                        <th className="text-center px-2 py-2 font-bold">$1–$50</th>
                        <th className="text-center px-2 py-2 font-bold">$50–$100</th>
                        <th className="text-center px-2 py-2 font-bold">&gt;$100</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--xsm-medium-gray)' }}>
                      {FEE_TIERS.map((row) => (
                        <tr 
                          key={row.tier}
                          className={row.isVip ? 'bg-amber-500/10' : ''}
                        >
                          <td className={`px-3.5 py-2.5 text-xs ${row.color}`}>
                            {row.tier}
                          </td>
                          <td className="text-center px-2 py-2.5 font-medium" style={{ color: 'var(--xsm-text)' }}>
                            {row.range1}
                          </td>
                          <td className="text-center px-2 py-2.5 font-medium" style={{ color: 'var(--xsm-text)' }}>
                            {row.range2}
                          </td>
                          <td className="text-center px-2 py-2.5 font-medium" style={{ color: 'var(--xsm-text)' }}>
                            {row.range3}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Choose Your Plan */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: 'var(--xsm-light-gray)' }}>
                  Choose Your Plan
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {VIP_PLANS.map((p) => {
                    const isSelected = selectedPlan === p.months;
                    return (
                      <button
                        key={p.months}
                        type="button"
                        onClick={() => setSelectedPlan(p.months)}
                        className={`relative flex flex-col items-center p-3.5 sm:p-4 rounded-xl border-2 transition-all duration-200 text-center ${
                          isSelected
                            ? 'border-yellow-500 bg-yellow-500/10 shadow-md shadow-yellow-500/10'
                            : 'hover:border-yellow-500/40'
                        }`}
                        style={{
                          backgroundColor: isSelected ? undefined : 'var(--xsm-bg)',
                          borderColor: isSelected ? '#f59e0b' : 'var(--xsm-medium-gray)'
                        }}
                      >
                        {p.popular && (
                          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow whitespace-nowrap">
                            MOST POPULAR
                          </span>
                        )}
                        <span 
                          className={`text-xl font-extrabold ${isSelected ? 'text-amber-500 dark:text-yellow-400' : ''}`}
                          style={{ color: isSelected ? undefined : 'var(--xsm-heading)' }}
                        >
                          ${p.price}
                        </span>
                        <span className="text-xs font-semibold mt-0.5" style={{ color: 'var(--xsm-text)' }}>
                          {p.label}
                        </span>
                        {p.savings ? (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                            Save ${p.savings}
                          </span>
                        ) : (
                          <span className="text-[10px] opacity-0 mt-1">—</span>
                        )}
                        {isSelected && (
                          <CheckCircle className="absolute top-2 right-2 w-4 h-4 text-amber-500 dark:text-yellow-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: 'var(--xsm-light-gray)' }}>
                  Select Payment Method
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div
                    onClick={() => setPaymentMethod('crypto')}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                      paymentMethod === 'crypto'
                        ? 'border-yellow-500 bg-yellow-500/10'
                        : 'hover:border-yellow-500/30'
                    }`}
                    style={{
                      backgroundColor: paymentMethod === 'crypto' ? undefined : 'var(--xsm-bg)',
                      borderColor: paymentMethod === 'crypto' ? '#f59e0b' : 'var(--xsm-medium-gray)'
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5">
                      ₮
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold" style={{ color: 'var(--xsm-heading)' }}>
                          Crypto (NOWPayments)
                        </span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded">
                          Instant / Auto
                        </span>
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--xsm-light-gray)' }}>
                        USDT, BTC, ETH, LTC, SOL. Automatic activation upon confirmation.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setPaymentMethod('direct')}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                      paymentMethod === 'direct'
                        ? 'border-yellow-500 bg-yellow-500/10'
                        : 'hover:border-yellow-500/30'
                    }`}
                    style={{
                      backgroundColor: paymentMethod === 'direct' ? undefined : 'var(--xsm-bg)',
                      borderColor: paymentMethod === 'direct' ? '#f59e0b' : 'var(--xsm-medium-gray)'
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-500 flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold" style={{ color: 'var(--xsm-heading)' }}>
                          Direct USDT / Agent
                        </span>
                        <span className="text-[10px] bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold px-1.5 py-0.5 rounded">
                          Escrow Chat
                        </span>
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--xsm-light-gray)' }}>
                        Direct TRC-20 transfer or pay via Live Escrow Support Agent.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Currency Selection when Crypto is selected */}
                {paymentMethod === 'crypto' && (
                  <div className="mt-3 p-3 rounded-xl border" style={{ backgroundColor: 'var(--xsm-bg)', borderColor: 'var(--xsm-medium-gray)' }}>
                    <label className="text-[11px] font-bold block mb-2" style={{ color: 'var(--xsm-light-gray)' }}>
                      Choose Cryptocurrency:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {CRYPTO_CURRENCIES.map(c => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => setSelectedCrypto(c.code)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all text-left flex items-center justify-between ${
                            selectedCrypto === c.code
                              ? 'bg-amber-500/20 border-amber-500 text-amber-600 dark:text-yellow-400'
                              : 'hover:border-amber-500/40'
                          }`}
                          style={{
                            borderColor: selectedCrypto === c.code ? undefined : 'var(--xsm-medium-gray)',
                            color: selectedCrypto === c.code ? undefined : 'var(--xsm-text)'
                          }}
                        >
                          <span className="truncate">{c.name}</span>
                          {c.badge && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-600 dark:text-yellow-400 px-1 rounded ml-1 font-semibold flex-shrink-0">
                              {c.badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Direct transfer info when direct is selected */}
                {paymentMethod === 'direct' && (
                  <div className="mt-3 p-3 rounded-xl border space-y-2" style={{ backgroundColor: 'var(--xsm-bg)', borderColor: 'var(--xsm-medium-gray)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color: 'var(--xsm-heading)' }}>
                        Official Platform USDT (TRC-20) Address:
                      </span>
                      <button
                        onClick={() => copyToClipboard(OFFICIAL_USDT_TRC20, 'direct_usdt')}
                        className="text-xs text-amber-500 font-bold flex items-center gap-1 hover:underline"
                      >
                        {copiedField === 'direct_usdt' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedField === 'direct_usdt' ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                    <code className="block p-2 rounded bg-black/10 dark:bg-black/40 text-[11px] font-mono break-all" style={{ color: 'var(--xsm-text)' }}>
                      {OFFICIAL_USDT_TRC20}
                    </code>
                    <p className="text-[11px]" style={{ color: 'var(--xsm-light-gray)' }}>
                      Amount to send: <strong className="text-amber-500 font-bold">${plan.price} USDT</strong>. After transfer, click below to send your TXID to Support in live chat.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2">
                {paymentMethod === 'crypto' && (
                  <button
                    onClick={handleStartCryptoPayment}
                    disabled={isInitializing}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-black text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-95 shadow-lg shadow-amber-500/20"
                    style={{
                      background: 'linear-gradient(135deg, #eab308, #f59e0b, #d97706)'
                    }}
                  >
                    {isInitializing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generating Crypto Invoice…</span>
                      </>
                    ) : (
                      <>
                        <Crown className="w-4 h-4 text-black" />
                        <span>Pay ${plan.price} with Crypto — {plan.months} Month{plan.months > 1 ? 's' : ''} VIP</span>
                      </>
                    )}
                  </button>
                )}

                {paymentMethod === 'direct' && (
                  <button
                    onClick={() => {
                      onClose();
                      navigate('/chat');
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white text-sm transition-all duration-200 bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Open Live Chat to Verify & Activate VIP</span>
                  </button>
                )}

                {/* Admin Quick Activate Button (Only visible to admin accounts for easy testing) */}
                {isAdmin && (
                  <div className="pt-2 border-t" style={{ borderColor: 'var(--xsm-medium-gray)' }}>
                    <button
                      onClick={handleAdminInstantActivate}
                      disabled={isAdminActivating}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold border transition-colors hover:bg-amber-500/10 text-amber-600 dark:text-yellow-400"
                      style={{ borderColor: '#f59e0b' }}
                      title="Admin bypass: instant activation without cryptocurrency transfer"
                    >
                      {isAdminActivating ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Activating as Admin…</>
                      ) : (
                        <><Zap className="w-3.5 h-3.5" /> ⚡ Admin Quick-Activate (Testing Mode — Free)</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* STEP 2: CRYPTO PAYMENT CHECKOUT & QR CODE */}
          {step === 'checkout' && paymentData && (
            <div className="space-y-5">
              <button
                onClick={() => setStep('plan')}
                className="text-xs font-bold flex items-center gap-1.5 transition-colors hover:underline"
                style={{ color: 'var(--xsm-light-gray)' }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Plans</span>
              </button>

              {/* Status Header */}
              <div 
                className="p-4 rounded-xl border text-center space-y-1.5"
                style={{
                  backgroundColor: ['finished', 'confirmed'].includes(paymentStatus)
                    ? 'rgba(16, 185, 129, 0.1)'
                    : 'var(--xsm-bg)',
                  borderColor: ['finished', 'confirmed'].includes(paymentStatus)
                    ? '#10b981'
                    : 'var(--xsm-medium-gray)'
                }}
              >
                <div className="flex items-center justify-center gap-2">
                  {['finished', 'confirmed'].includes(paymentStatus) ? (
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                  )}
                  <span className="text-sm font-bold capitalize" style={{ color: 'var(--xsm-heading)' }}>
                    {['finished', 'confirmed'].includes(paymentStatus)
                      ? 'Payment Received & VIP Activated!'
                      : `Awaiting Crypto Deposit (${paymentStatus})`}
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--xsm-light-gray)' }}>
                  {['finished', 'confirmed'].includes(paymentStatus)
                    ? 'Congratulations! Your account has been upgraded to VIP.'
                    : 'Send the exact amount to the deposit address below. Verification happens automatically.'}
                </p>
              </div>

              {/* QR Code and Payment Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* QR Code */}
                <div 
                  className="p-4 rounded-xl border flex flex-col items-center justify-center text-center"
                  style={{ backgroundColor: 'var(--xsm-bg)', borderColor: 'var(--xsm-medium-gray)' }}
                >
                  <img
                    src={
                      paymentData.qr_code_url || 
                      `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(paymentData.pay_address || paymentData.payment_url || '')}`
                    }
                    alt="Crypto Payment QR Code"
                    className="w-44 h-44 rounded-lg bg-white p-2 shadow-md mx-auto"
                  />
                  <span className="text-[11px] font-bold mt-2.5" style={{ color: 'var(--xsm-light-gray)' }}>
                    Scan with any crypto wallet
                  </span>
                </div>

                {/* Amounts & Address */}
                <div className="space-y-3">
                  {/* Amount to Send */}
                  <div 
                    className="p-3 rounded-xl border space-y-1"
                    style={{ backgroundColor: 'var(--xsm-bg)', borderColor: 'var(--xsm-medium-gray)' }}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--xsm-light-gray)' }}>
                      Amount to Send:
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-extrabold text-amber-500">
                        {paymentData.pay_amount || paymentData.price_amount} {paymentData.pay_currency?.toUpperCase()}
                      </span>
                      <button
                        onClick={() => copyToClipboard(String(paymentData.pay_amount || paymentData.price_amount), 'amount')}
                        className="text-xs font-bold text-amber-500 flex items-center gap-1 hover:underline"
                      >
                        {copiedField === 'amount' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedField === 'amount' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Deposit Address */}
                  {paymentData.pay_address && (
                    <div 
                      className="p-3 rounded-xl border space-y-1"
                      style={{ backgroundColor: 'var(--xsm-bg)', borderColor: 'var(--xsm-medium-gray)' }}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--xsm-light-gray)' }}>
                        Deposit Address ({paymentData.pay_currency?.toUpperCase()}):
                      </span>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-xs font-mono break-all font-semibold" style={{ color: 'var(--xsm-text)' }}>
                          {paymentData.pay_address}
                        </code>
                        <button
                          onClick={() => copyToClipboard(paymentData.pay_address!, 'address')}
                          className="text-xs font-bold text-amber-500 flex items-center gap-1 hover:underline flex-shrink-0"
                        >
                          {copiedField === 'address' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedField === 'address' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Hosted Page Link if available */}
                  {paymentData.payment_url && (
                    <a
                      href={paymentData.payment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold border transition-colors hover:bg-amber-500/10 text-amber-600 dark:text-yellow-400"
                      style={{ borderColor: 'var(--xsm-medium-gray)' }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open NOWPayments Checkout Page</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Status and Action Controls */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  onClick={handleManualCheckStatus}
                  disabled={isCheckingStatus}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ borderColor: 'var(--xsm-medium-gray)', color: 'var(--xsm-text)' }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                  <span>{isCheckingStatus ? 'Checking Blockchain…' : 'I Have Sent Payment (Check Status)'}</span>
                </button>

                <button
                  onClick={onClose}
                  className="py-3 px-5 rounded-xl font-bold text-xs transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: 'var(--xsm-light-gray)' }}
                >
                  Close & Pay Later
                </button>
              </div>

              <p className="text-[11px] text-center" style={{ color: 'var(--xsm-light-gray)' }}>
                Order ID: <span className="font-mono">{paymentData.order_id}</span>. Verification typically takes 2–10 minutes depending on blockchain traffic.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default VipSubscriptionModal;
