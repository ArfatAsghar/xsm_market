import React, { useState } from 'react';
import { X, Crown, Star, Tag, Percent, CheckCircle, Loader2, Zap } from 'lucide-react';
import { buyVip } from '@/services/auth';
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
  { icon: Crown, label: 'VIP Badge on your profile', color: 'text-yellow-400' },
  { icon: Tag, label: 'VIP tag on every listing you sell', color: 'text-yellow-400' },
  { icon: Percent, label: 'Reduced escrow service fees (down to 2.5%)', color: 'text-green-400' },
  { icon: Star, label: 'Stand out from the competition', color: 'text-purple-400' },
  { icon: Zap, label: 'Stack with Repeat Buyer for maximum savings', color: 'text-blue-400' }
];

const FEE_TIERS = [
  {
    tier: 'Standard',
    color: 'text-gray-300',
    bg: 'bg-gray-800/40',
    range1: 'Min $2', range2: '5.0%', range3: '4.0%'
  },
  {
    tier: 'Repeat Buyer (≥3 Deals)',
    color: 'text-blue-300',
    bg: 'bg-blue-950/40',
    range1: 'Min $2', range2: '4.5%', range3: '3.5%'
  },
  {
    tier: 'VIP Member',
    color: 'text-yellow-400',
    bg: 'bg-yellow-950/40',
    range1: 'Min $2', range2: '4.0%', range3: '3.0%'
  },
  {
    tier: 'VIP + Repeat Buyer',
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/40 border-t border-emerald-800/40',
    range1: 'Min $2', range2: '3.5%', range3: '2.5%'
  }
];

const VipSubscriptionModal: React.FC<VipSubscriptionModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [selectedPlan, setSelectedPlan] = useState<1 | 2 | 3>(2);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const { toast } = useToast();

  if (!isOpen) return null;

  const handlePurchase = async () => {
    setIsPurchasing(true);
    try {
      const result = await buyVip(selectedPlan);
      toast({
        title: '👑 VIP Activated!',
        description: result.message || `VIP badge active until ${new Date(result.vipUntil).toLocaleDateString()}`,
      });
      onSuccess?.(result.vipUntil);
      onClose();
    } catch (err) {
      toast({
        title: '❌ Purchase Failed',
        description: err instanceof Error ? err.message : 'Failed to activate VIP',
        variant: 'destructive'
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  const plan = VIP_PLANS.find(p => p.months === selectedPlan)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-yellow-500/20 shadow-2xl shadow-yellow-900/20"
        style={{ background: 'linear-gradient(135deg, #0f0f14 0%, #1a1410 50%, #0f0f14 100%)' }}
      >
        {/* Glow accent top border */}
        <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-80" />

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-yellow-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-lg shadow-yellow-900/50">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">VIP Membership</h2>
              <p className="text-xs text-yellow-400/70">Unlock exclusive seller perks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Perks */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">VIP Perks</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {VIP_PERKS.map(({ icon: Icon, label, color }) => (
                <div key={label} className="flex items-center gap-2.5 bg-white/[0.03] rounded-lg px-3 py-2.5 border border-white/5">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
                  <span className="text-sm text-gray-200">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fee Discount Comparison */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Service Fee Tiers</h3>
            <div className="rounded-xl overflow-hidden border border-white/5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/5 text-gray-400">
                    <th className="text-left px-3 py-2 font-semibold">Tier</th>
                    <th className="text-center px-2 py-2 font-semibold">$1–$50</th>
                    <th className="text-center px-2 py-2 font-semibold">$50–$100</th>
                    <th className="text-center px-2 py-2 font-semibold">&gt;$100</th>
                  </tr>
                </thead>
                <tbody>
                  {FEE_TIERS.map((row, i) => (
                    <tr key={row.tier} className={`${row.bg} ${i > 0 ? 'border-t border-white/5' : ''}`}>
                      <td className={`px-3 py-2.5 font-semibold ${row.color} text-xs`}>{row.tier}</td>
                      <td className="text-center px-2 py-2.5 text-gray-300">{row.range1}</td>
                      <td className="text-center px-2 py-2.5 text-gray-300">{row.range2}</td>
                      <td className="text-center px-2 py-2.5 text-gray-300">{row.range3}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Plan Selection */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Choose Your Plan</h3>
            <div className="grid grid-cols-3 gap-3">
              {VIP_PLANS.map((p) => (
                <button
                  key={p.months}
                  onClick={() => setSelectedPlan(p.months)}
                  className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200 text-center ${
                    selectedPlan === p.months
                      ? 'border-yellow-500 bg-yellow-950/40 shadow-lg shadow-yellow-900/30'
                      : 'border-white/10 bg-white/[0.03] hover:border-yellow-500/40 hover:bg-yellow-950/20'
                  }`}
                >
                  {p.popular && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                      MOST POPULAR
                    </span>
                  )}
                  <span className={`text-lg font-bold ${selectedPlan === p.months ? 'text-yellow-400' : 'text-white'}`}>
                    ${p.price}
                  </span>
                  <span className="text-xs text-gray-400 mt-0.5">{p.label}</span>
                  {p.savings ? (
                    <span className="text-[10px] text-emerald-400 font-semibold mt-1">Save ${p.savings}</span>
                  ) : (
                    <span className="text-[10px] text-transparent mt-1">—</span>
                  )}
                  {selectedPlan === p.months && (
                    <CheckCircle className="absolute top-2 right-2 w-3.5 h-3.5 text-yellow-400" />
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 text-center mt-2">{plan.desc}</p>
          </div>

          {/* Purchase CTA */}
          <button
            onClick={handlePurchase}
            disabled={isPurchasing}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-black text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99]"
            style={{
              background: isPurchasing
                ? '#a16207'
                : 'linear-gradient(135deg, #eab308, #f59e0b, #d97706)',
              boxShadow: isPurchasing ? 'none' : '0 4px 24px rgba(234,179,8,0.3)'
            }}
          >
            {isPurchasing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
            ) : (
              <><Crown className="w-4 h-4" /> Activate VIP — ${plan.price} for {plan.months} Month{plan.months > 1 ? 's' : ''}</>
            )}
          </button>

          <p className="text-[10px] text-gray-600 text-center leading-relaxed">
            VIP extends your active period if already subscribed. Payment via Crypto / NOWPayments.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VipSubscriptionModal;
