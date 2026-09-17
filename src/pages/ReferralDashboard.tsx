import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaGift, FaCrown, FaCopy, FaShareAlt, FaCheck, FaCoins,
  FaShieldAlt, FaTrophy, FaWhatsapp, FaTelegramPlane, FaTwitter,
  FaFacebook, FaEnvelope, FaExternalLinkAlt, FaInfoCircle, FaCheckCircle,
  FaClock, FaUserPlus, FaArrowRight, FaPercent, FaThumbtack, FaRocket
} from 'react-icons/fa';
import { useAuth } from '@/context/useAuth';
import { useToast } from "@/components/ui/use-toast";
import { API_URL, getAuthToken } from '@/services/auth';
import AuthWidget from '@/components/AuthWidget';

interface ReferralRecord {
  id: number;
  referred_username: string;
  referred_avatar?: string;
  status: string;
  created_at: string;
  qualified_at?: string;
  kyc_status: string;
  vip_status: boolean;
  vip_reward_earned: boolean;
  free_pin_earned: boolean;
}

interface CreditTransaction {
  id: number;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

interface LeaderboardUser {
  username: string;
  profile_picture?: string;
  qualified_count: number;
  rank: number;
}

interface Milestone {
  target: number;
  label: string;
  reward_description: string;
  reached: boolean;
  claimed: boolean;
}

interface DashboardData {
  user: {
    id: number;
    username: string;
    referral_code: string;
    referral_credit_balance: number;
    kyc_status: string;
    free_pins_available: number;
    free_bumps_available: number;
    reduced_escrow_deals_remaining: number;
    vip_coupons_available?: number;
  };
  stats: {
    total_referrals: number;
    qualified_referrals: number;
    vip_conversions: number;
    pending_kyc: number;
    total_credits_earned: number;
  };
  referrals: ReferralRecord[];
  transactions: CreditTransaction[];
  leaderboard: LeaderboardUser[];
  milestones: Milestone[];
  referral_link: string;
}

const ReferralDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'referrals' | 'credits' | 'leaderboard'>('overview');
  const [showAuthWidget, setShowAuthWidget] = useState(false);
  const [claimingMilestone, setClaimingMilestone] = useState<number | null>(null);

  // Fallback referral code if user not logged in
  const referralCode = data?.user?.referral_code || user?.username || 'xsm';
  const referralDomain = window.location.origin;
  const referralUrl = `${referralDomain}/ref/${referralCode}`;

  const fetchDashboardData = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/referral/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (e) {
      console.error('Failed to fetch referral dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [isLoggedIn]);

  // Safe normalized arrays to guarantee no runtime .map crashes
  const milestonesList: Milestone[] = Array.isArray(data?.milestones)
    ? data.milestones
    : (Array.isArray((data?.milestones as any)?.tiers)
        ? (data.milestones as any).tiers.map((t: any) => ({
            target: t.target,
            label: `${t.target} Referrals`,
            reward_description: t.reward || t.reward_description || 'Reward',
            reached: Boolean(t.unlocked || t.reached),
            claimed: Boolean(t.claimed)
          }))
        : [
            { target: 5, label: '5 Referrals', reward_description: '+1 Extra Free Pin', reached: false, claimed: false },
            { target: 10, label: '10 Referrals', reward_description: '+1 Extra Free Pin & $5.00 Credit', reached: false, claimed: false },
            { target: 25, label: '25 Referrals', reward_description: 'VIP Coupon ($10 Value)', reached: false, claimed: false },
            { target: 50, label: '50 Referrals', reward_description: 'Elite Ambassador Badge & Free 1-Month VIP', reached: false, claimed: false },
          ]);

  const referralsList: ReferralRecord[] = Array.isArray(data?.referrals)
    ? data.referrals
    : (Array.isArray((data as any)?.history)
        ? (data as any).history.map((h: any) => ({
            id: h.id || Math.random(),
            referred_username: h.username || h.referred_username || 'User',
            referred_avatar: h.avatar || '',
            status: 'active',
            created_at: h.registeredAt || h.created_at || new Date().toISOString(),
            kyc_status: h.kycStatus || h.kyc_status || 'none',
            vip_status: h.vipStatus === 'Purchased' || Boolean(h.vip_status),
            vip_reward_earned: Boolean(h.vip_reward_earned) || (typeof h.rewardStatus === 'string' && h.rewardStatus.includes('VIP')),
            free_pin_earned: Boolean(h.free_pin_earned) || (typeof h.rewardStatus === 'string' && (h.rewardStatus.includes('KYC') || h.rewardStatus.includes('VIP')))
          }))
        : []);

  const transactionsList: CreditTransaction[] = Array.isArray(data?.transactions)
    ? data.transactions
    : (Array.isArray((data as any)?.creditHistory)
        ? (data as any).creditHistory.map((t: any) => ({
            id: t.id || Math.random(),
            amount: parseFloat(t.amount) || 0,
            type: t.type || 'credit',
            description: t.description || 'VIP Referral Reward',
            created_at: t.created_at || new Date().toISOString()
          }))
        : []);

  const leaderboardList: LeaderboardUser[] = Array.isArray(data?.leaderboard)
    ? data.leaderboard
    : [];

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    toast({
      title: "Link Copied! 📋",
      description: "Your unique referral link has been copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async (platform?: string) => {
    const text = `Join me on XSM Market — the premium digital marketplace for YouTube channels, social media assets, and verified digital deals! Use my invite link to get 1 Free 72-Hour Pin upon KYC verification:`;
    
    if (platform === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + referralUrl)}`, '_blank');
    } else if (platform === 'telegram') {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent(text)}`, '_blank');
    } else if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent(text)}`, '_blank');
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralUrl)}`, '_blank');
    } else if (platform === 'email') {
      window.open(`mailto:?subject=${encodeURIComponent('Invitation to join XSM Market')}&body=${encodeURIComponent(text + '\n\n' + referralUrl)}`, '_blank');
    } else {
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Join XSM Market',
            text: text,
            url: referralUrl,
          });
        } catch (e) {}
      } else {
        handleCopyLink();
      }
    }
  };

  const handleClaimMilestone = async (target: number) => {
    try {
      setClaimingMilestone(target);
      const token = getAuthToken();
      const res = await fetch(`${API_URL}/referral/claim-milestone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ target })
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: "Milestone Reward Claimed! 🏆",
          description: json.message || "Your reward has been added to your account.",
        });
        fetchDashboardData();
      } else {
        toast({
          variant: "destructive",
          title: "Claim Failed",
          description: json.error || "Could not claim milestone.",
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message || "Failed to claim milestone.",
      });
    } finally {
      setClaimingMilestone(null);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-[85vh] bg-[var(--xsm-bg,#0a0a0a)] text-foreground py-12 px-4 sm:px-6 lg:px-8 transition-colors">
        {showAuthWidget && (
          <AuthWidget onClose={() => setShowAuthWidget(false)} onNavigate={(p) => navigate(p)} />
        )}

        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-amber-500/15 dark:bg-yellow-500/20 border border-amber-500/30 text-amber-600 dark:text-xsm-yellow mb-6 shadow-xl">
            <FaGift className="text-4xl" />
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-neutral-900 dark:text-white tracking-tight">
            XSM Referral <span className="text-amber-600 dark:text-xsm-yellow">Rewards Program</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-neutral-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Invite fellow sellers and creators to XSM Market. Earn lifetime VIP referral credits, free listing pins, free bumps, and reduced escrow fees on every successful referral.
          </p>

          {/* Value props showcase */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-10 text-left">
            <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md relative overflow-hidden group hover:border-amber-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 dark:bg-yellow-500/15 text-amber-600 dark:text-yellow-400 flex items-center justify-center text-xl mb-4">
                <FaThumbtack />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Free 72h Listing Pin</h3>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-gray-400 leading-relaxed">
                When your referred friend completes identity verification (KYC), <strong>both of you</strong> receive 1 Free 72-Hour Pin.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md relative overflow-hidden group hover:border-amber-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl mb-4">
                <FaCrown />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Lifetime VIP Credits</h3>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-gray-400 leading-relaxed">
                Earn <strong>$1.00 Lifetime VIP Referral Credit</strong> plus <strong>$2.00 VIP Coupon</strong> every time your referral subscribes to VIP.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md relative overflow-hidden group hover:border-amber-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 dark:bg-yellow-500/15 text-amber-600 dark:text-yellow-400 flex items-center justify-center text-xl mb-4">
                <FaPercent />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Reduced Escrow Fees</h3>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-gray-400 leading-relaxed">
                Receive <strong>5 Free Bumps</strong> and reduced transaction fees across your next 3 escrow deals when your referral goes VIP.
              </p>
            </div>
          </div>

          <div className="mt-12">
            <button
              onClick={() => setShowAuthWidget(true)}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-extrabold text-black bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 shadow-[0_0_25px_rgba(255,208,0,0.35)] hover:shadow-[0_0_35px_rgba(255,208,0,0.6)] hover:scale-105 active:scale-95 transition-all"
            >
              <FaUserPlus />
              <span>Log In to Get Your Referral Link</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--xsm-bg,#0a0a0a)] text-foreground py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Top Header & Unique Referral Link Banner ── */}
        <div className="relative p-6 sm:p-8 rounded-3xl bg-white dark:bg-gradient-to-b dark:from-neutral-900/90 dark:via-neutral-900/60 dark:to-black/80 border border-amber-200/80 dark:border-yellow-500/20 shadow-lg dark:shadow-2xl overflow-hidden transition-all">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 dark:bg-yellow-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 dark:bg-yellow-500/10 border border-amber-500/30 dark:border-yellow-500/30 text-amber-700 dark:text-yellow-400 text-xs font-bold mb-3 uppercase tracking-wider">
                <FaGift className="text-xs" />
                <span>Direct Referral Program</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
                Refer a Friend & <span className="text-amber-600 dark:text-xsm-yellow">Earn Together</span>
              </h1>
              <p className="text-sm text-neutral-600 dark:text-gray-300 mt-1 max-w-xl">
                Share your personal referral link. When friends verify their KYC or buy VIP, both of you unlock free perks and credits.
              </p>
            </div>

            {/* Credit Balance Quick Display */}
            <div className="flex items-center gap-4 bg-amber-50/80 dark:bg-black/60 border border-amber-300/80 dark:border-yellow-500/30 px-5 py-3.5 rounded-2xl shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-yellow-500 to-amber-600 flex items-center justify-center text-black text-xl font-bold shadow-md">
                <FaCoins />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-neutral-500 dark:text-gray-400 uppercase tracking-wider block">Referral Credit Balance</span>
                <span className="text-2xl font-black text-amber-600 dark:text-xsm-yellow">
                  ${Number(data?.user?.referral_credit_balance || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Link Box & Sharing Buttons ── */}
          <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-800/80">
            <label className="block text-xs font-bold text-neutral-700 dark:text-gray-300 uppercase tracking-wider mb-2">
              Your Unique Referral Link
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1 flex items-center bg-neutral-100 dark:bg-black/80 border border-neutral-300 dark:border-neutral-700 rounded-xl px-4 py-3 font-mono text-sm text-amber-800 dark:text-yellow-300 font-semibold overflow-x-auto selection:bg-yellow-500/30">
                <span className="truncate">{referralUrl}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-black bg-xsm-yellow hover:bg-yellow-400 active:scale-95 transition-all shadow-md"
                >
                  {copied ? <FaCheck className="text-green-900" /> : <FaCopy />}
                  <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                </button>

                <button
                  onClick={() => handleShare()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm text-neutral-800 dark:text-white bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 active:scale-95 transition-all"
                  title="Share"
                >
                  <FaShareAlt />
                  <span className="hidden sm:inline">Share</span>
                </button>
              </div>
            </div>

            {/* Quick social share buttons */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className="text-xs text-neutral-500 dark:text-gray-400 mr-2 font-medium">Share via:</span>
              <button
                onClick={() => handleShare('whatsapp')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 transition-colors"
              >
                <FaWhatsapp /> WhatsApp
              </button>
              <button
                onClick={() => handleShare('telegram')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/80 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-500/30 transition-colors"
              >
                <FaTelegramPlane /> Telegram
              </button>
              <button
                onClick={() => handleShare('twitter')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-800 dark:text-gray-200 border border-neutral-300 dark:border-neutral-700 transition-colors"
              >
                <FaTwitter /> X / Twitter
              </button>
              <button
                onClick={() => handleShare('facebook')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30 transition-colors"
              >
                <FaFacebook /> Facebook
              </button>
              <button
                onClick={() => handleShare('email')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-800 dark:text-gray-200 border border-neutral-300 dark:border-neutral-700 transition-colors"
              >
                <FaEnvelope /> Email
              </button>
            </div>
          </div>
        </div>

        {/* ── Summary Stat Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 shadow-sm dark:shadow-none hover:shadow-md transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 dark:text-gray-400 mb-2">
              <span className="text-xs font-semibold">Total Referrals</span>
              <FaUserPlus className="text-xs text-amber-600 dark:text-yellow-400" />
            </div>
            <span className="text-2xl font-black text-neutral-900 dark:text-white">{data?.stats?.total_referrals || 0}</span>
            <span className="text-[10px] text-neutral-500 dark:text-gray-400 mt-1">Invited accounts</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 shadow-sm dark:shadow-none hover:shadow-md transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 dark:text-gray-400 mb-2">
              <span className="text-xs font-semibold">KYC Qualified</span>
              <FaShieldAlt className="text-xs text-emerald-500 dark:text-emerald-400" />
            </div>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{data?.stats?.qualified_referrals || 0}</span>
            <span className="text-[10px] text-neutral-500 dark:text-gray-400 mt-1">Free Pin unlocked</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 shadow-sm dark:shadow-none hover:shadow-md transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 dark:text-gray-400 mb-2">
              <span className="text-xs font-semibold">VIP Conversions</span>
              <FaCrown className="text-xs text-amber-500 dark:text-amber-400" />
            </div>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{data?.stats?.vip_conversions || 0}</span>
            <span className="text-[10px] text-neutral-500 dark:text-gray-400 mt-1">VIP credits rewarded</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 shadow-sm dark:shadow-none hover:shadow-md transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 dark:text-gray-400 mb-2">
              <span className="text-xs font-semibold">Free Pins</span>
              <FaThumbtack className="text-xs text-amber-600 dark:text-xsm-yellow" />
            </div>
            <span className="text-2xl font-black text-amber-600 dark:text-xsm-yellow">{data?.user?.free_pins_available || 0}</span>
            <span className="text-[10px] text-neutral-500 dark:text-gray-400 mt-1">72 hours each</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 shadow-sm dark:shadow-none hover:shadow-md transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 dark:text-gray-400 mb-2">
              <span className="text-xs font-semibold">Free Bumps</span>
              <FaRocket className="text-xs text-orange-500 dark:text-orange-400" />
            </div>
            <span className="text-2xl font-black text-orange-600 dark:text-orange-400">{data?.user?.free_bumps_available || 0}</span>
            <span className="text-[10px] text-neutral-500 dark:text-gray-400 mt-1">Top #1 Boosts</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 shadow-sm dark:shadow-none hover:shadow-md transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 dark:text-gray-400 mb-2">
              <span className="text-xs font-semibold">VIP Coupons</span>
              <FaGift className="text-xs text-purple-500 dark:text-purple-400" />
            </div>
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400">{data?.user?.vip_coupons_available || 0}</span>
            <span className="text-[10px] text-neutral-500 dark:text-gray-400 mt-1">100% Free VIP Pass</span>
          </div>
        </div>

        {/* ── Visual Referral Qualification Pipeline ── */}
        <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <FaRocket className="text-amber-600 dark:text-yellow-400 text-sm" />
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
              Referral Qualification Journey
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-7 gap-2 text-center text-xs">
            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-black/40 border border-neutral-200 dark:border-neutral-800 flex flex-col items-center justify-center">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-700 dark:text-yellow-400 flex items-center justify-center font-bold mb-1.5">1</span>
              <span className="font-bold text-neutral-900 dark:text-white">Invited</span>
              <span className="text-[10px] text-neutral-500 dark:text-gray-400 mt-0.5">Share link</span>
            </div>

            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-black/40 border border-neutral-200 dark:border-neutral-800 flex flex-col items-center justify-center">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-700 dark:text-yellow-400 flex items-center justify-center font-bold mb-1.5">2</span>
              <span className="font-bold text-neutral-900 dark:text-white">Registered</span>
              <span className="text-[10px] text-neutral-500 dark:text-gray-400 mt-0.5">Signs up</span>
            </div>

            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-black/40 border border-neutral-200 dark:border-neutral-800 flex flex-col items-center justify-center">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-700 dark:text-yellow-400 flex items-center justify-center font-bold mb-1.5">3</span>
              <span className="font-bold text-neutral-900 dark:text-white">KYC Pending</span>
              <span className="text-[10px] text-neutral-500 dark:text-gray-400 mt-0.5">Uploads ID</span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-black/40 border border-emerald-300 dark:border-emerald-500/30 flex flex-col items-center justify-center">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold mb-1.5">4</span>
              <span className="font-bold text-emerald-800 dark:text-emerald-300">KYC Approved</span>
              <span className="text-[10px] text-neutral-500 dark:text-gray-400 mt-0.5">Verified</span>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-black/40 border border-amber-300 dark:border-yellow-500/30 flex flex-col items-center justify-center">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-700 dark:text-yellow-400 flex items-center justify-center font-bold mb-1.5">5</span>
              <span className="font-bold text-amber-800 dark:text-yellow-300">Free Pin Reward</span>
              <span className="text-[10px] text-neutral-500 dark:text-gray-400 mt-0.5">72h Pin awarded</span>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-black/40 border border-amber-300 dark:border-amber-500/30 flex flex-col items-center justify-center">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold mb-1.5">6</span>
              <span className="font-bold text-amber-800 dark:text-amber-300">VIP Purchased</span>
              <span className="text-[10px] text-neutral-500 dark:text-gray-400 mt-0.5">Buys VIP</span>
            </div>

            <div className="p-3 rounded-xl bg-yellow-50/60 dark:bg-black/40 border border-yellow-300 dark:border-yellow-400/40 flex flex-col items-center justify-center">
              <span className="w-6 h-6 rounded-full bg-yellow-400/30 text-amber-800 dark:text-yellow-300 flex items-center justify-center font-bold mb-1.5">7</span>
              <span className="font-bold text-amber-900 dark:text-yellow-300">VIP Credits Added</span>
              <span className="text-[10px] text-neutral-500 dark:text-gray-400 mt-0.5">$$$ + Bumps</span>
            </div>
          </div>
        </div>

        {/* ── Rewards Structure Details (KYC vs VIP) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* KYC Rewards Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 shadow-sm dark:shadow-none relative overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg">
                <FaShieldAlt />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">KYC Verification Rewards</h3>
                <p className="text-xs text-neutral-500 dark:text-gray-400">Unlocked as soon as ID verification is approved</p>
              </div>
            </div>

            <ul className="space-y-3 text-xs sm:text-sm text-neutral-700 dark:text-gray-300">
              <li className="flex items-start gap-2.5">
                <FaCheckCircle className="text-emerald-500 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                <span><strong>Referrer (You):</strong> Receives <strong>1 Free Pin</strong> valid for 72 hours.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <FaCheckCircle className="text-emerald-500 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                <span><strong>Referred User:</strong> Also receives <strong>1 Free Pin</strong> valid for 72 hours.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <FaCheckCircle className="text-emerald-500 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                <span>Immediate listing boost to top positions on the Marketplace.</span>
              </li>
            </ul>

            <div className="mt-5 pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <span className="text-xs text-neutral-500 dark:text-gray-400">Your KYC Status:</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                data?.user?.kyc_status === 'approved'
                  ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30'
                  : data?.user?.kyc_status === 'pending'
                  ? 'bg-amber-50 dark:bg-yellow-500/20 text-amber-700 dark:text-yellow-400 border border-amber-300 dark:border-yellow-500/30'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-gray-400'
              }`}>
                {data?.user?.kyc_status === 'approved' ? 'Verified ✓' : data?.user?.kyc_status === 'pending' ? 'Pending Review' : 'Not Verified'}
              </span>
            </div>
          </div>

          {/* VIP Rewards Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 shadow-sm dark:shadow-none relative overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg">
                <FaCrown />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">VIP Referral Rewards</h3>
                <p className="text-xs text-neutral-500 dark:text-gray-400">Unlocked whenever your referral purchases VIP</p>
              </div>
            </div>

            <ul className="space-y-3 text-xs sm:text-sm text-neutral-700 dark:text-gray-300">
              <li className="flex items-start gap-2.5">
                <FaCheckCircle className="text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <span><strong>$1.00 Lifetime VIP Referral Credit</strong> added straight to your balance.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <FaCheckCircle className="text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <span><strong>1 VIP Coupon ($2.00 Credits)</strong> towards platform services.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <FaCheckCircle className="text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <span><strong>5 Free Bumps</strong> to move your listings instantly to Position #1.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <FaCheckCircle className="text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <span><strong>Reduced Escrow Fees</strong> for your next 3 deals.</span>
              </li>
            </ul>

            <div className="mt-5 pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500 dark:text-gray-400">
              <span>Reduced Escrow Deals Remaining:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{data?.user?.reduced_escrow_deals_remaining || 0} deals</span>
            </div>
          </div>
        </div>

        {/* ── Milestones Tracker ── */}
        <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FaTrophy className="text-amber-600 dark:text-yellow-400 text-base" />
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                Referral Milestones
              </h3>
            </div>
            <span className="text-xs text-neutral-500 dark:text-gray-400 font-medium">
              {data?.stats?.qualified_referrals || 0} Qualified Referrals
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {milestonesList.map((milestone) => {
              const current = data?.stats?.qualified_referrals || 0;
              const progress = Math.min(100, Math.round((current / milestone.target) * 100));

              return (
                <div
                  key={milestone.target}
                  className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                    milestone.reached
                      ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
                      : 'bg-neutral-50 dark:bg-black/40 border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold mb-1">
                      <span className={milestone.reached ? 'text-amber-700 dark:text-yellow-400' : 'text-neutral-900 dark:text-white'}>
                        {milestone.label}
                      </span>
                      <span className="text-[10px] text-neutral-500 dark:text-gray-400">
                        {current}/{milestone.target}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-600 dark:text-gray-300 font-medium mt-1">
                      {milestone.reward_description}
                    </p>

                    <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden mt-3">
                      <div
                        className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    {milestone.claimed ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <FaCheck /> Claimed
                      </span>
                    ) : milestone.reached ? (
                      <button
                        onClick={() => handleClaimMilestone(milestone.target)}
                        disabled={claimingMilestone === milestone.target}
                        className="w-full py-1.5 rounded-lg text-xs font-bold text-black bg-xsm-yellow hover:bg-yellow-400 transition-colors shadow-sm"
                      >
                        {claimingMilestone === milestone.target ? 'Claiming...' : 'Claim Reward 🎁'}
                      </button>
                    ) : (
                      <span className="text-[10px] text-neutral-400 dark:text-gray-500">
                        {milestone.target - current} more referrals needed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Tabs Navigation: Referral History / Credit History / Leaderboard ── */}
        <div>
          <div className="flex border-b border-neutral-200 dark:border-neutral-800 space-x-6 text-sm font-bold">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-3 transition-colors border-b-2 ${
                activeTab === 'overview'
                  ? 'text-amber-600 dark:text-xsm-yellow border-amber-600 dark:border-xsm-yellow'
                  : 'text-neutral-500 dark:text-gray-400 border-transparent hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Overview & Rules
            </button>
            <button
              onClick={() => setActiveTab('referrals')}
              className={`pb-3 transition-colors border-b-2 ${
                activeTab === 'referrals'
                  ? 'text-amber-600 dark:text-xsm-yellow border-amber-600 dark:border-xsm-yellow'
                  : 'text-neutral-500 dark:text-gray-400 border-transparent hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Referral History ({referralsList.length})
            </button>
            <button
              onClick={() => setActiveTab('credits')}
              className={`pb-3 transition-colors border-b-2 ${
                activeTab === 'credits'
                  ? 'text-amber-600 dark:text-xsm-yellow border-amber-600 dark:border-xsm-yellow'
                  : 'text-neutral-500 dark:text-gray-400 border-transparent hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              VIP Credit Ledger ({transactionsList.length})
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`pb-3 transition-colors border-b-2 ${
                activeTab === 'leaderboard'
                  ? 'text-amber-600 dark:text-xsm-yellow border-amber-600 dark:border-xsm-yellow'
                  : 'text-neutral-500 dark:text-gray-400 border-transparent hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Leaderboard 🏆
            </button>
          </div>

          {/* TAB 1: OVERVIEW & RULES */}
          {activeTab === 'overview' && (
            <div className="mt-6 space-y-6">
              {/* Credit Terms */}
              <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <FaCoins className="text-amber-600 dark:text-yellow-400" />
                  <span>Referral Credit Use & Restrictions</span>
                </h4>
                <p className="text-xs sm:text-sm text-neutral-700 dark:text-gray-300 leading-relaxed">
                  Referral Credits are stored securely in your platform balance and can be spent on <strong>VIP Memberships</strong>, <strong>Listing Pins</strong>, and <strong>Platform Promotions</strong>. In accordance with system policy, referral credits cannot be withdrawn as fiat or cryptocurrency cash.
                </p>
              </div>

              {/* Anti-Fraud Notice */}
              <div className="p-6 rounded-2xl bg-rose-50 dark:bg-red-950/20 border border-rose-200 dark:border-red-500/30 space-y-2">
                <div className="flex items-center gap-2 text-rose-700 dark:text-red-400 text-sm font-bold">
                  <FaShieldAlt />
                  <span>Anti-Fraud & Integrity Rules</span>
                </div>
                <ul className="space-y-1.5 text-xs text-rose-900 dark:text-red-200/90 leading-relaxed list-disc list-inside">
                  <li>Direct Referrals Only: Single-level reward model (no multi-tier or MLM structures).</li>
                  <li>Self-referrals, duplicate accounts, and disposable emails are strictly monitored and prohibited.</li>
                  <li>Referrals must be legitimate unique users who complete verified KYC.</li>
                  <li>Fraudulent activity results in immediate forfeiture of all credits, free pins, and account suspension.</li>
                </ul>
              </div>

              {/* No Refund Policy */}
              <div className="p-4 rounded-xl bg-neutral-100 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-gray-400">
                <p>
                  <strong>No Refund Policy Note:</strong> System explicitly excludes refund-policy or chargeback reversals on awarded referral perks. Once a referral is qualified and rewards are claimed, rewards are non-reversible.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: REFERRAL HISTORY */}
          {activeTab === 'referrals' && (
            <div className="mt-6 rounded-2xl bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-100 dark:bg-black/60 text-neutral-600 dark:text-gray-400 uppercase tracking-wider text-[11px] border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="px-5 py-3.5">Referred User</th>
                      <th className="px-5 py-3.5">Join Date</th>
                      <th className="px-5 py-3.5">KYC Status</th>
                      <th className="px-5 py-3.5">VIP Status</th>
                      <th className="px-5 py-3.5">Rewards Granted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {(!referralsList || referralsList.length === 0) ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-neutral-500 dark:text-gray-500">
                          No referrals yet. Share your unique referral link to start earning!
                        </td>
                      </tr>
                    ) : (
                      referralsList.map((ref) => (
                        <tr key={ref.id} className="hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-4 font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-700 dark:text-yellow-300 flex items-center justify-center font-bold text-xs">
                              {ref.referred_username.charAt(0).toUpperCase()}
                            </span>
                            <span>{ref.referred_username}</span>
                          </td>
                          <td className="px-5 py-4 text-neutral-500 dark:text-gray-400">
                            {new Date(ref.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase ${
                              ref.kyc_status === 'approved'
                                ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30'
                                : ref.kyc_status === 'pending'
                                ? 'bg-amber-50 dark:bg-yellow-500/20 text-amber-700 dark:text-yellow-400 border border-amber-300 dark:border-yellow-500/30'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-gray-400'
                            }`}>
                              {ref.kyc_status || 'None'}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {ref.vip_status ? (
                              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                                <FaCrown className="text-[10px]" /> VIP Member
                              </span>
                            ) : (
                              <span className="text-neutral-400 dark:text-gray-500">Standard</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-col gap-1">
                              {ref.free_pin_earned && (
                                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  ✓ 1 Free Pin (72h)
                                </span>
                              )}
                              {ref.vip_reward_earned && (
                                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                  ✓ $1.00 Credit + 5 Bumps
                                </span>
                              )}
                              {!ref.free_pin_earned && !ref.vip_reward_earned && (
                                <span className="text-[11px] text-neutral-400 dark:text-gray-500">Awaiting KYC</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: VIP CREDIT LEDGER */}
          {activeTab === 'credits' && (
            <div className="mt-6 rounded-2xl bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-100 dark:bg-black/60 text-neutral-600 dark:text-gray-400 uppercase tracking-wider text-[11px] border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Transaction Type</th>
                      <th className="px-5 py-3.5">Description</th>
                      <th className="px-5 py-3.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {(!transactionsList || transactionsList.length === 0) ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-neutral-500 dark:text-gray-500">
                          No credit transactions yet. Earn credits when referrals purchase VIP!
                        </td>
                      </tr>
                    ) : (
                      transactionsList.map((tx) => (
                        <tr key={tx.id} className="hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-4 text-neutral-500 dark:text-gray-400 font-mono">
                            {new Date(tx.created_at).toLocaleString()}
                          </td>
                          <td className="px-5 py-4 font-bold text-neutral-900 dark:text-white uppercase text-[10px]">
                            {tx.type}
                          </td>
                          <td className="px-5 py-4 text-neutral-700 dark:text-gray-300">
                            {tx.description}
                          </td>
                          <td className={`px-5 py-4 text-right font-black text-sm ${
                            tx.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-red-400'
                          }`}>
                            {tx.amount >= 0 ? `+$${Number(tx.amount).toFixed(2)}` : `-$${Math.abs(Number(tx.amount)).toFixed(2)}`}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: LEADERBOARD */}
          {activeTab === 'leaderboard' && (
            <div className="mt-6 rounded-2xl bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
              <div className="p-4 bg-neutral-100 dark:bg-black/40 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <FaTrophy className="text-amber-600 dark:text-yellow-400" />
                  <span>Top Referral Champions</span>
                </h4>
                <span className="text-xs text-neutral-500 dark:text-gray-400">Ranked by Qualified Referrals</span>
              </div>

              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {(!leaderboardList || leaderboardList.length === 0) ? (
                  <div className="p-8 text-center text-neutral-500 dark:text-gray-500 text-xs">
                    Leaderboard rankings will appear as referrals qualify.
                  </div>
                ) : (
                  leaderboardList.map((champ, idx) => (
                    <div key={idx} className="p-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-4">
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${
                          idx === 0
                            ? 'bg-amber-500/20 text-amber-700 dark:text-yellow-400 border border-amber-500/40'
                            : idx === 1
                            ? 'bg-neutral-200 dark:bg-gray-300/20 text-neutral-700 dark:text-gray-200 border border-neutral-300 dark:border-gray-400/40'
                            : idx === 2
                            ? 'bg-amber-700/20 text-amber-700 dark:text-amber-400 border border-amber-600/40'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-gray-400'
                        }`}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                        </span>

                        <div>
                          <p className="text-sm font-bold text-neutral-900 dark:text-white">{champ.username}</p>
                          <p className="text-[11px] text-neutral-500 dark:text-gray-400">Rank #{idx + 1}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-black text-amber-600 dark:text-xsm-yellow">
                          {champ.qualified_count}
                        </span>
                        <span className="text-[11px] text-neutral-500 dark:text-gray-400 block">Qualified</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ReferralDashboard;
