import React, { useState, useEffect } from 'react';
import {
  FaGift, FaCrown, FaShieldAlt, FaUsers, FaCheck, FaTimes,
  FaCoins, FaSlidersH, FaExclamationTriangle, FaSearch, FaHistory
} from 'react-icons/fa';
import { useToast } from "@/components/ui/use-toast";
import { API_URL, getAuthToken } from '@/services/auth';

interface ReferralAdminItem {
  id: number;
  referrer_id: number;
  referrer_username: string;
  referred_user_id: number;
  referred_username: string;
  status: string;
  kyc_status: string;
  vip_status: boolean;
  is_flagged: boolean;
  flag_reason?: string;
  created_at: string;
  qualified_at?: string;
}

interface PendingKycItem {
  id: number;
  user_id: number;
  username: string;
  document_type: string;
  document_url: string;
  status: string;
  created_at: string;
}

interface ReferralSettings {
  free_pin_count: number;
  free_pin_duration_hours: number;
  vip_credit_amount: number;
  vip_coupon_amount: number;
  vip_free_bumps: number;
  reduced_escrow_deals_count: number;
  reduced_escrow_percent: number;
}

const AdminReferralManagement: React.FC = () => {
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<'referrals' | 'kyc' | 'settings'>('referrals');
  const [loading, setLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState({
    total_referrals: 0,
    qualified_referrals: 0,
    vip_conversions: 0,
    total_credits_issued: 0,
    flagged_referrals: 0,
    pending_kyc_count: 0
  });

  // Referrals
  const [referrals, setReferrals] = useState<ReferralAdminItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Pending KYC
  const [pendingKyc, setPendingKyc] = useState<PendingKycItem[]>([]);
  const [reviewingKycId, setReviewingKycId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [targetKycId, setTargetKycId] = useState<number | null>(null);

  // Settings
  const [settings, setSettings] = useState<ReferralSettings>({
    free_pin_count: 1,
    free_pin_duration_hours: 72,
    vip_credit_amount: 1.00,
    vip_coupon_amount: 2.00,
    vip_free_bumps: 5,
    reduced_escrow_deals_count: 3,
    reduced_escrow_percent: 20
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Credit adjustment modal
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditUserId, setCreditUserId] = useState<number | null>(null);
  const [creditUsername, setCreditUsername] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');

  // Safe Date Formatter
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const clean = dateStr.includes(' ') && !dateStr.includes('T') ? dateStr.replace(' ', 'T') : dateStr;
      const d = new Date(clean);
      return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  const loadAllData = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      if (!token) return;

      const headers = { 'Authorization': `Bearer ${token}` };

      // Load Stats
      const statsRes = await fetch(`${API_URL}/admin/referrals/stats`, { headers });
      const statsJson = await statsRes.json();
      if (statsJson.success && statsJson.data) {
        const d = statsJson.data;
        setStats({
          total_referrals: d.total_referrals ?? d.totalReferrals ?? 0,
          qualified_referrals: d.qualified_referrals ?? d.qualified ?? 0,
          vip_conversions: d.vip_conversions ?? d.vipConversions ?? 0,
          total_credits_issued: Number(d.total_credits_issued ?? d.creditsIssued ?? 0),
          flagged_referrals: d.flagged_referrals ?? d.suspiciousCount ?? 0,
          pending_kyc_count: d.pending_kyc_count ?? d.pendingKycCount ?? d.kycPending ?? 0
        });
      }

      // Load Referrals list
      const listRes = await fetch(`${API_URL}/admin/referrals/list`, { headers });
      const listJson = await listRes.json();
      if (listJson.success && Array.isArray(listJson.data)) {
        const normalized: ReferralAdminItem[] = listJson.data.map((r: any) => ({
          id: r.id,
          referrer_id: r.referrer_id ?? r.referrerId ?? 0,
          referrer_username: r.referrer_username ?? r.referrerUsername ?? (r.referrer_id ? `User #${r.referrer_id}` : 'Unknown'),
          referred_user_id: r.referred_user_id ?? r.referredUserId ?? 0,
          referred_username: r.referred_username ?? r.referredUsername ?? (r.referred_user_id ? `User #${r.referred_user_id}` : 'Unknown'),
          status: r.status || 'registered',
          kyc_status: r.kyc_status ?? r.kycStatus ?? 'none',
          vip_status: Boolean(r.vip_status ?? r.isVip),
          is_flagged: Boolean(r.is_flagged ?? r.isSuspicious),
          flag_reason: r.flag_reason ?? r.suspiciousReason ?? '',
          created_at: r.created_at ?? r.createdAt ?? '',
          qualified_at: r.qualified_at ?? r.qualifiedAt ?? ''
        }));
        setReferrals(normalized);
      }

      // Load Pending KYC
      const kycRes = await fetch(`${API_URL}/admin/kyc/pending`, { headers });
      const kycJson = await kycRes.json();
      if (kycJson.success && Array.isArray(kycJson.data)) {
        const normalizedKyc: PendingKycItem[] = kycJson.data.map((k: any) => ({
          id: k.id,
          user_id: k.user_id ?? k.userId ?? 0,
          username: k.username || (k.user_id ? `User #${k.user_id}` : 'Unknown'),
          document_type: k.document_type ?? k.documentType ?? 'ID Card',
          document_url: k.document_url ?? k.documentUrl ?? '',
          status: k.status || 'pending',
          created_at: k.created_at ?? k.submitted_at ?? k.submittedAt ?? ''
        }));
        setPendingKyc(normalizedKyc);
      }

      // Load Settings
      const settingsRes = await fetch(`${API_URL}/admin/referrals/settings`, { headers });
      const settingsJson = await settingsRes.json();
      if (settingsJson.success && settingsJson.data) {
        setSettings(settingsJson.data);
      }

    } catch (e) {
      console.error('Error loading admin referral data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleToggleFlag = async (id: number) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_URL}/admin/referrals/toggle-flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id, referralId: id, reason: 'Suspicious activity flagged by admin' })
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Status Updated", description: "Flag status toggled successfully." });
        loadAllData();
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to toggle flag." });
    }
  };

  const handleAdjustCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditUserId || !creditAmount) return;

    try {
      const token = getAuthToken();
      const res = await fetch(`${API_URL}/admin/referrals/adjust-credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          user_id: creditUserId,
          userId: creditUserId,
          amount: parseFloat(creditAmount),
          reason: creditReason || 'Manual admin credit adjustment'
        })
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Credit Adjusted", description: `Adjusted balance for ${creditUsername}.` });
        setShowCreditModal(false);
        setCreditAmount('');
        setCreditReason('');
        loadAllData();
      } else {
        toast({ variant: "destructive", title: "Error", description: json.error || "Adjustment failed." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to adjust credit." });
    }
  };

  const handleReviewKyc = async (kycId: number, status: 'approved' | 'rejected', notes?: string) => {
    try {
      setReviewingKycId(kycId);
      const token = getAuthToken();
      const res = await fetch(`${API_URL}/admin/kyc/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          kyc_id: kycId,
          kycId,
          status,
          action: status === 'approved' ? 'approve' : 'reject',
          notes: notes || '',
          reason: notes || ''
        })
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: status === 'approved' ? "KYC Approved! 🎉" : "KYC Application Rejected",
          description: status === 'approved' 
            ? "Identity approved! Free Pin rewards have been automatically granted to the user and their referrer." 
            : "Rejection note sent to user.",
        });
        setShowRejectModal(false);
        setRejectReason('');
        loadAllData();
      } else {
        toast({ variant: "destructive", title: "Error", description: json.error || "Action failed." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to review KYC." });
    } finally {
      setReviewingKycId(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      const token = getAuthToken();
      const res = await fetch(`${API_URL}/admin/referrals/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(settings)
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Settings Saved", description: "Referral system reward settings updated." });
      } else {
        toast({ variant: "destructive", title: "Error", description: json.error || "Save failed." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save settings." });
    } finally {
      setSavingSettings(false);
    }
  };

  const filteredReferrals = referrals.filter(r =>
    (r.referrer_username ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.referred_username ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm dark:shadow-none hover:shadow-md transition-all">
          <span className="text-[11px] font-semibold text-neutral-500 dark:text-gray-400 block uppercase tracking-wider">Total Referrals</span>
          <span className="text-2xl font-black text-neutral-900 dark:text-white mt-1 block">{stats.total_referrals ?? 0}</span>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm dark:shadow-none hover:shadow-md transition-all">
          <span className="text-[11px] font-semibold text-neutral-500 dark:text-gray-400 block uppercase tracking-wider">KYC Qualified</span>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{stats.qualified_referrals ?? 0}</span>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm dark:shadow-none hover:shadow-md transition-all">
          <span className="text-[11px] font-semibold text-neutral-500 dark:text-gray-400 block uppercase tracking-wider">VIP Conversions</span>
          <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block">{stats.vip_conversions ?? 0}</span>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm dark:shadow-none hover:shadow-md transition-all">
          <span className="text-[11px] font-semibold text-neutral-500 dark:text-gray-400 block uppercase tracking-wider">Credits Issued</span>
          <span className="text-2xl font-black text-amber-600 dark:text-xsm-yellow mt-1 block">${Number(stats.total_credits_issued || 0).toFixed(2)}</span>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm dark:shadow-none hover:shadow-md transition-all">
          <span className="text-[11px] font-semibold text-neutral-500 dark:text-gray-400 block uppercase tracking-wider">Flagged / Suspicious</span>
          <span className="text-2xl font-black text-rose-600 dark:text-red-400 mt-1 block">{stats.flagged_referrals ?? 0}</span>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm dark:shadow-none hover:shadow-md transition-all">
          <span className="text-[11px] font-semibold text-neutral-500 dark:text-gray-400 block uppercase tracking-wider">Pending KYC Queue</span>
          <span className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1 block">{stats.pending_kyc_count ?? pendingKyc.length ?? 0}</span>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 space-x-6 text-sm font-bold">
        <button
          onClick={() => setActiveSubTab('referrals')}
          className={`pb-3 transition-colors border-b-2 ${
            activeSubTab === 'referrals'
              ? 'text-amber-600 dark:text-xsm-yellow border-amber-600 dark:border-xsm-yellow'
              : 'text-neutral-500 dark:text-gray-400 border-transparent hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          Referral Records ({referrals.length})
        </button>

        <button
          onClick={() => setActiveSubTab('kyc')}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            activeSubTab === 'kyc'
              ? 'text-amber-600 dark:text-xsm-yellow border-amber-600 dark:border-xsm-yellow'
              : 'text-neutral-500 dark:text-gray-400 border-transparent hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <span>KYC Approval Queue</span>
          {pendingKyc.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-sky-500 text-white font-extrabold shadow-sm">
              {pendingKyc.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('settings')}
          className={`pb-3 transition-colors border-b-2 ${
            activeSubTab === 'settings'
              ? 'text-amber-600 dark:text-xsm-yellow border-amber-600 dark:border-xsm-yellow'
              : 'text-neutral-500 dark:text-gray-400 border-transparent hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          Reward Program Settings
        </button>
      </div>

      {/* SUBTAB 1: REFERRALS TABLE */}
      {activeSubTab === 'referrals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-gray-500 text-xs" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by referrer or referred username..."
                className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl pl-9 pr-3 py-2 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-500 dark:focus:border-yellow-500 shadow-sm"
              />
            </div>
            <button
              onClick={loadAllData}
              className="px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-gray-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors shadow-sm"
            >
              Refresh Data
            </button>
          </div>

          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-100 dark:bg-black/40 text-neutral-600 dark:text-gray-400 uppercase text-[10px] border-b border-neutral-200 dark:border-neutral-800 font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5">ID</th>
                    <th className="px-4 py-3.5">Referrer</th>
                    <th className="px-4 py-3.5">Referred User</th>
                    <th className="px-4 py-3.5">Created</th>
                    <th className="px-4 py-3.5">KYC</th>
                    <th className="px-4 py-3.5">VIP</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {filteredReferrals.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-neutral-500 dark:text-gray-500">
                        No referral records match your query.
                      </td>
                    </tr>
                  ) : (
                    filteredReferrals.map(item => (
                      <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3.5 font-mono text-neutral-400 dark:text-gray-500">#{item.id}</td>
                        <td className="px-4 py-3.5 font-bold text-neutral-900 dark:text-white">
                          {item.referrer_username || (item.referrer_id ? `User #${item.referrer_id}` : 'Unknown')}
                        </td>
                        <td className="px-4 py-3.5 text-amber-700 dark:text-yellow-300 font-semibold">
                          {item.referred_username || (item.referred_user_id ? `User #${item.referred_user_id}` : 'Unknown')}
                        </td>
                        <td className="px-4 py-3.5 text-neutral-500 dark:text-gray-400">
                          {formatDate(item.created_at)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            item.kyc_status === 'approved'
                              ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30'
                              : item.kyc_status === 'pending'
                              ? 'bg-amber-50 dark:bg-yellow-500/20 text-amber-700 dark:text-yellow-400 border border-amber-300 dark:border-yellow-500/30'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-gray-400'
                          }`}>
                            {item.kyc_status || 'None'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {item.vip_status ? (
                            <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                              <FaCrown className="text-[10px]" /> VIP
                            </span>
                          ) : (
                            <span className="text-neutral-400 dark:text-gray-500">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {item.is_flagged ? (
                            <span className="text-rose-700 dark:text-red-400 font-bold text-[10px] uppercase bg-rose-50 dark:bg-red-950/60 px-2 py-0.5 rounded border border-rose-300 dark:border-red-500/30">
                              Flagged
                            </span>
                          ) : (
                            <span className="text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold">Active</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => {
                                setCreditUserId(item.referrer_id);
                                setCreditUsername(item.referrer_username);
                                setShowCreditModal(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-yellow-300 hover:bg-amber-500/25 border border-amber-500/30 text-[10px] font-bold transition-colors"
                              title="Adjust Referrer Credit"
                            >
                              ± Credit
                            </button>
                            <button
                              onClick={() => handleToggleFlag(item.id)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                                item.is_flagged
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 border-emerald-300 dark:border-emerald-500/40'
                                  : 'bg-rose-50 dark:bg-red-950/60 text-rose-700 dark:text-red-300 hover:bg-rose-100 dark:hover:bg-red-900 border-rose-300 dark:border-red-500/40'
                              }`}
                            >
                              {item.is_flagged ? 'Unflag' : 'Flag'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: KYC QUEUE */}
      {activeSubTab === 'kyc' && (
        <div className="space-y-4">
          <p className="text-xs text-neutral-600 dark:text-gray-400">
            When you approve a user's KYC verification, <strong>1 Free 72-Hour Pin</strong> is automatically granted to both the user and their referrer.
          </p>

          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-100 dark:bg-black/40 text-neutral-600 dark:text-gray-400 uppercase text-[10px] border-b border-neutral-200 dark:border-neutral-800 font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5">ID</th>
                    <th className="px-4 py-3.5">Applicant Username</th>
                    <th className="px-4 py-3.5">Document Type</th>
                    <th className="px-4 py-3.5">Document File</th>
                    <th className="px-4 py-3.5">Submitted</th>
                    <th className="px-4 py-3.5 text-right">Review Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {pendingKyc.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-neutral-500 dark:text-gray-500">
                        No pending KYC verification requests in the queue.
                      </td>
                    </tr>
                  ) : (
                    pendingKyc.map(kyc => (
                      <tr key={kyc.id} className="hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3.5 font-mono text-neutral-400 dark:text-gray-500">#{kyc.id}</td>
                        <td className="px-4 py-3.5 font-bold text-neutral-900 dark:text-white">{kyc.username}</td>
                        <td className="px-4 py-3.5 font-medium uppercase text-neutral-600 dark:text-gray-300 text-[10px]">
                          {kyc.document_type || 'ID Card'}
                        </td>
                        <td className="px-4 py-3.5">
                          {kyc.document_url ? (
                            <a
                              href={kyc.document_url.startsWith('http') ? kyc.document_url : `${API_URL}/${kyc.document_url.replace(/^\//, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-amber-600 dark:text-xsm-yellow hover:underline flex items-center gap-1 font-semibold"
                            >
                              <span>View Document</span>
                            </a>
                          ) : (
                            <span className="text-neutral-400 dark:text-gray-500">Identity Submission</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-neutral-500 dark:text-gray-400">
                          {formatDate(kyc.created_at)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleReviewKyc(kyc.id, 'approved')}
                              disabled={reviewingKycId === kyc.id}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-[11px] flex items-center gap-1 shadow-sm transition-all"
                            >
                              <FaCheck />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => {
                                setTargetKycId(kyc.id);
                                setShowRejectModal(true);
                              }}
                              disabled={reviewingKycId === kyc.id}
                              className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-red-950 hover:bg-rose-100 dark:hover:bg-red-900 border border-rose-300 dark:border-red-500/40 text-rose-700 dark:text-red-300 font-bold text-[11px] flex items-center gap-1 transition-all"
                            >
                              <FaTimes />
                              <span>Reject</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: REWARD PROGRAM SETTINGS */}
      {activeSubTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="max-w-2xl space-y-5 bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 p-6 rounded-2xl shadow-sm">
          <h4 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2 mb-2">
            <FaSlidersH className="text-amber-600 dark:text-yellow-400" />
            <span>Configurable Reward Parameters</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-gray-300 mb-1">
                Free Pin Count (upon KYC approval)
              </label>
              <input
                type="number"
                min={1}
                value={settings.free_pin_count}
                onChange={e => setSettings({ ...settings, free_pin_count: parseInt(e.target.value) || 1 })}
                className="w-full bg-neutral-50 dark:bg-black/60 border border-neutral-300 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-gray-300 mb-1">
                Free Pin Duration (Hours)
              </label>
              <input
                type="number"
                min={1}
                value={settings.free_pin_duration_hours}
                onChange={e => setSettings({ ...settings, free_pin_duration_hours: parseInt(e.target.value) || 72 })}
                className="w-full bg-neutral-50 dark:bg-black/60 border border-neutral-300 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-gray-300 mb-1">
                VIP Referral Credit ($)
              </label>
              <input
                type="number"
                step="0.10"
                min={0}
                value={settings.vip_credit_amount}
                onChange={e => setSettings({ ...settings, vip_credit_amount: parseFloat(e.target.value) || 1.00 })}
                className="w-full bg-neutral-50 dark:bg-black/60 border border-neutral-300 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-gray-300 mb-1">
                VIP Coupon Amount ($)
              </label>
              <input
                type="number"
                step="0.10"
                min={0}
                value={settings.vip_coupon_amount}
                onChange={e => setSettings({ ...settings, vip_coupon_amount: parseFloat(e.target.value) || 2.00 })}
                className="w-full bg-neutral-50 dark:bg-black/60 border border-neutral-300 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-gray-300 mb-1">
                VIP Free Bumps Count
              </label>
              <input
                type="number"
                min={0}
                value={settings.vip_free_bumps}
                onChange={e => setSettings({ ...settings, vip_free_bumps: parseInt(e.target.value) || 5 })}
                className="w-full bg-neutral-50 dark:bg-black/60 border border-neutral-300 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-gray-300 mb-1">
                Reduced Escrow Deals Count
              </label>
              <input
                type="number"
                min={0}
                value={settings.reduced_escrow_deals_count}
                onChange={e => setSettings({ ...settings, reduced_escrow_deals_count: parseInt(e.target.value) || 3 })}
                className="w-full bg-neutral-50 dark:bg-black/60 border border-neutral-300 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-2.5 rounded-xl font-bold text-xs text-black bg-xsm-yellow hover:bg-yellow-400 active:scale-95 transition-all shadow-md"
            >
              {savingSettings ? 'Saving Settings...' : 'Save Referral Configuration'}
            </button>
          </div>
        </form>
      )}

      {/* Adjust Credit Modal */}
      {showCreditModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 transition-all">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <FaCoins className="text-amber-600 dark:text-yellow-400" />
              <span>Adjust Referral Credit: {creditUsername}</span>
            </h3>

            <form onSubmit={handleAdjustCredit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-gray-300 mb-1">
                  Adjustment Amount (Use negative for deduction, e.g. -5.00)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={creditAmount}
                  onChange={e => setCreditAmount(e.target.value)}
                  placeholder="e.g. 5.00 or -2.50"
                  className="w-full bg-neutral-50 dark:bg-black border border-neutral-300 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-gray-300 mb-1">
                  Reason for Adjustment
                </label>
                <input
                  type="text"
                  required
                  value={creditReason}
                  onChange={e => setCreditReason(e.target.value)}
                  placeholder="e.g. Manual promotion credit or fraud deduction"
                  className="w-full bg-neutral-50 dark:bg-black border border-neutral-300 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreditModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-gray-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-black bg-xsm-yellow hover:bg-yellow-400 shadow-sm"
                >
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject KYC Modal */}
      {showRejectModal && targetKycId && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 transition-all">
            <h3 className="text-base font-bold text-rose-600 dark:text-red-400 flex items-center gap-2">
              <FaExclamationTriangle />
              <span>Reject KYC Verification Application</span>
            </h3>

            <div className="space-y-3">
              <label className="block text-xs text-neutral-700 dark:text-gray-300">
                Reason for Rejection (shown to user):
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g. Document image is blurry or expired. Please upload a clear photo of valid ID."
                className="w-full bg-neutral-50 dark:bg-black border border-neutral-300 dark:border-neutral-700 rounded-xl p-3 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-gray-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleReviewKyc(targetKycId, 'rejected', rejectReason)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 shadow-sm"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReferralManagement;
