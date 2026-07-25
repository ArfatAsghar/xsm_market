import React, { useState, useEffect } from 'react';
import { getFinancialStats } from '@/services/admin';
import { DollarSign, TrendingUp, Crown, CreditCard, ShieldCheck, RefreshCw, Search, ArrowUpRight, CheckCircle2, Clock } from 'lucide-react';

interface FinancialDeal {
  id: number;
  transaction_id: string;
  channel_title: string;
  channel_price: number;
  escrow_fee: number;
  deal_status: string;
  transaction_fee_paid: number;
  transaction_fee_payment_method: string | null;
  created_at: string;
  buyer_name: string | null;
  seller_name: string | null;
}

interface VipMember {
  id: number;
  username: string;
  email: string;
  vipUntil: string | null;
  createdAt: string;
}

interface FinancialData {
  completedDeals: number;
  totalBusinessVolume: number;
  totalCommissionEarned: number;
  activeVipMembers: number;
  totalVipPurchases: number;
  totalVipRevenue: number;
  overallPaymentStats: {
    totalAllDealsCount: number;
    overallDealsVolume: number;
    avgCompletedDealSize: number;
    cryptoTransactionsCount: number;
    cryptoConfirmedVolume: number;
    paymentMethodsBreakdown: Array<{ method: string; count: number; feeCollected: number }>;
  };
  financialDeals?: FinancialDeal[];
  vipMembers?: VipMember[];
}

const FinancialRecords: React.FC = () => {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'deals' | 'vip' | 'methods'>('deals');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchFinancials = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getFinancialStats();
      if (res.financials) {
        setData(res.financials);
      } else {
        throw new Error('Invalid financial data format');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load financial records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, []);

  const formatCurrency = (val: number | string) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num || 0);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-xsm-light-gray">
        <RefreshCw className="w-8 h-8 animate-spin text-xsm-yellow mb-3" />
        <p className="text-sm">Loading Financial Records...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-6 text-center">
        <p className="text-red-400 font-semibold mb-3">Error: {error}</p>
        <button
          onClick={fetchFinancials}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  const dealsList = data?.financialDeals || [];
  const vipList = data?.vipMembers || [];

  const filteredDeals = dealsList.filter(d =>
    (d.transaction_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.channel_title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.buyer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.seller_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredVip = vipList.filter(v =>
    (v.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-xsm-dark-gray p-6 rounded-xl border border-xsm-medium-gray">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-xsm-yellow" /> Financial Records & Revenue Analytics
          </h2>
          <p className="text-sm text-xsm-light-gray mt-1">
            Complete business revenue, deal fees, volume breakdown, and VIP sales logs (Admin Access Only)
          </p>
        </div>
        <button
          onClick={fetchFinancials}
          className="px-4 py-2 bg-xsm-yellow hover:bg-yellow-400 text-black font-bold rounded-lg transition-colors flex items-center gap-2 justify-center shadow-lg"
        >
          <RefreshCw className="w-4 h-4" /> Refresh Records
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Business Volume */}
        <div className="bg-xsm-dark-gray p-5 rounded-xl border border-xsm-medium-gray">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-xsm-light-gray font-medium">Total Business Volume</span>
            <DollarSign className="w-5 h-5 text-xsm-yellow" />
          </div>
          <p className="text-2xl font-extrabold text-xsm-yellow">{formatCurrency(data?.totalBusinessVolume || 0)}</p>
          <p className="text-[11px] text-xsm-light-gray mt-1">Gross completed deal volume</p>
        </div>

        {/* Website Commission Earned */}
        <div className="bg-xsm-dark-gray p-5 rounded-xl border border-xsm-medium-gray">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-xsm-light-gray font-medium">Escrow Commission Earned</span>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-400">{formatCurrency(data?.totalCommissionEarned || 0)}</p>
          <p className="text-[11px] text-emerald-300 mt-1">Direct platform fee revenue</p>
        </div>

        {/* VIP Revenue */}
        <div className="bg-xsm-dark-gray p-5 rounded-xl border border-xsm-medium-gray">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-xsm-light-gray font-medium">VIP Subscriptions Revenue</span>
            <CreditCard className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-2xl font-extrabold text-purple-300">{formatCurrency(data?.totalVipRevenue || 0)}</p>
          <p className="text-[11px] text-purple-400 mt-1">{data?.totalVipPurchases || 0} total memberships</p>
        </div>

        {/* Completed Deals Count */}
        <div className="bg-xsm-dark-gray p-5 rounded-xl border border-xsm-medium-gray">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-xsm-light-gray font-medium">Completed Deals</span>
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">{data?.completedDeals || 0}</p>
          <p className="text-[11px] text-green-400 mt-1">Out of {data?.overallPaymentStats.totalAllDealsCount || 0} total deals</p>
        </div>

        {/* Active VIP Members */}
        <div className="bg-xsm-dark-gray p-5 rounded-xl border border-xsm-medium-gray">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-xsm-light-gray font-medium">Active VIP Members</span>
            <Crown className="w-5 h-5 text-yellow-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">{data?.activeVipMembers || 0}</p>
          <p className="text-[11px] text-yellow-300 mt-1">Currently active accounts</p>
        </div>
      </div>

      {/* Tabs & Search Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-xsm-dark-gray p-4 rounded-xl border border-xsm-medium-gray">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('deals')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              activeTab === 'deals'
                ? 'bg-xsm-yellow text-black'
                : 'bg-xsm-medium-gray text-xsm-light-gray hover:text-white'
            }`}
          >
            Deal Transactions ({dealsList.length})
          </button>
          <button
            onClick={() => setActiveTab('vip')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              activeTab === 'vip'
                ? 'bg-xsm-yellow text-black'
                : 'bg-xsm-medium-gray text-xsm-light-gray hover:text-white'
            }`}
          >
            VIP Members ({vipList.length})
          </button>
          <button
            onClick={() => setActiveTab('methods')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              activeTab === 'methods'
                ? 'bg-xsm-yellow text-black'
                : 'bg-xsm-medium-gray text-xsm-light-gray hover:text-white'
            }`}
          >
            Fee Collection Analytics
          </button>
        </div>

        {/* Search */}
        {activeTab !== 'methods' && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-xsm-light-gray" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search record..."
              className="w-full bg-xsm-black border border-xsm-medium-gray rounded-lg pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-xsm-yellow text-white"
            />
          </div>
        )}
      </div>

      {/* Tab 1: Deal Financial Transactions */}
      {activeTab === 'deals' && (
        <div className="bg-xsm-dark-gray rounded-xl border border-xsm-medium-gray overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-xsm-medium-gray text-xs font-semibold text-xsm-light-gray uppercase">
                <tr>
                  <th className="px-4 py-3">Transaction ID</th>
                  <th className="px-4 py-3">Channel / Listing</th>
                  <th className="px-4 py-3">Buyer & Seller</th>
                  <th className="px-4 py-3">Gross Price</th>
                  <th className="px-4 py-3">Escrow Fee</th>
                  <th className="px-4 py-3">Payment Method</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-xsm-medium-gray text-sm">
                {filteredDeals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-xsm-light-gray">
                      No deal records found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredDeals.map((deal) => (
                    <tr key={deal.id} className="hover:bg-xsm-medium-gray/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-xsm-yellow text-xs">
                        {deal.transaction_id || `#${deal.id}`}
                      </td>
                      <td className="px-4 py-3 font-medium text-white max-w-[200px] truncate" title={deal.channel_title}>
                        {deal.channel_title}
                      </td>
                      <td className="px-4 py-3 text-xs text-xsm-light-gray">
                        <span className="text-white font-medium">{deal.buyer_name || 'Buyer'}</span> →{' '}
                        <span className="text-white font-medium">{deal.seller_name || 'Seller'}</span>
                      </td>
                      <td className="px-4 py-3 font-bold text-green-400">
                        {formatCurrency(deal.channel_price)}
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-400">
                        {formatCurrency(deal.escrow_fee)}
                      </td>
                      <td className="px-4 py-3 text-xs text-xsm-light-gray capitalize">
                        {deal.transaction_fee_payment_method || (deal.transaction_fee_paid ? 'Standard / Crypto' : 'Unpaid')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                            deal.deal_status === 'completed' || deal.deal_status === 'payment_confirmed'
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : deal.deal_status === 'rejected' || deal.deal_status === 'cancelled' || deal.deal_status === 'failed'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          }`}
                        >
                          {deal.deal_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-xsm-light-gray">
                        {formatDate(deal.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: VIP Members & Subscriptions */}
      {activeTab === 'vip' && (
        <div className="bg-xsm-dark-gray rounded-xl border border-xsm-medium-gray overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-xsm-medium-gray text-xs font-semibold text-xsm-light-gray uppercase">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Subscription Status</th>
                  <th className="px-4 py-3">Expires On</th>
                  <th className="px-4 py-3">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-xsm-medium-gray text-sm">
                {filteredVip.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-xsm-light-gray">
                      No VIP member records found.
                    </td>
                  </tr>
                ) : (
                  filteredVip.map((user) => {
                    const isActive = user.vipUntil && new Date(user.vipUntil) > new Date();
                    return (
                      <tr key={user.id} className="hover:bg-xsm-medium-gray/30 transition-colors">
                        <td className="px-4 py-3 font-semibold text-white flex items-center gap-2">
                          <Crown className="w-4 h-4 text-yellow-400 fill-yellow-400/20" />
                          <span>{user.username}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-xsm-light-gray">{user.email}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              isActive
                                ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/30'
                                : 'bg-gray-700/50 text-gray-400 border border-gray-600'
                            }`}
                          >
                            {isActive ? 'ACTIVE VIP' : 'EXPIRED'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-white font-medium">
                          {formatDate(user.vipUntil)}
                        </td>
                        <td className="px-4 py-3 text-xs text-xsm-light-gray">
                          {formatDate(user.createdAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Payment Method Analytics */}
      {activeTab === 'methods' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-xsm-dark-gray p-6 rounded-xl border border-xsm-medium-gray space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" /> Fee Revenue by Gateway Method
            </h3>
            <div className="space-y-3">
              {data?.overallPaymentStats.paymentMethodsBreakdown.length === 0 ? (
                <p className="text-sm text-xsm-light-gray">No breakdown data recorded yet.</p>
              ) : (
                data?.overallPaymentStats.paymentMethodsBreakdown.map((pm, i) => (
                  <div key={i} className="flex justify-between items-center bg-xsm-black/50 p-3.5 rounded-lg border border-xsm-medium-gray/40">
                    <div>
                      <p className="text-sm font-semibold text-white capitalize">{pm.method}</p>
                      <p className="text-xs text-xsm-light-gray">{pm.count} transactions processed</p>
                    </div>
                    <span className="text-emerald-400 font-extrabold text-lg">{formatCurrency(pm.feeCollected)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-xsm-dark-gray p-6 rounded-xl border border-xsm-medium-gray space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-400" /> Crypto Integration Metrics
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-xsm-black/50 p-3.5 rounded-lg border border-xsm-medium-gray/40">
                <div>
                  <p className="text-sm font-semibold text-white">Total NOWPayments Invoices</p>
                  <p className="text-xs text-xsm-light-gray">Cryptocurrency orders created</p>
                </div>
                <span className="text-white font-extrabold text-lg">{data?.overallPaymentStats.cryptoTransactionsCount || 0}</span>
              </div>
              <div className="flex justify-between items-center bg-xsm-black/50 p-3.5 rounded-lg border border-xsm-medium-gray/40">
                <div>
                  <p className="text-sm font-semibold text-white">Confirmed Crypto Volume</p>
                  <p className="text-xs text-xsm-light-gray">Successfully cleared crypto volume</p>
                </div>
                <span className="text-blue-400 font-extrabold text-lg">{formatCurrency(data?.overallPaymentStats.cryptoConfirmedVolume || 0)}</span>
              </div>
              <div className="flex justify-between items-center bg-xsm-black/50 p-3.5 rounded-lg border border-xsm-medium-gray/40">
                <div>
                  <p className="text-sm font-semibold text-white">Average Deal Value</p>
                  <p className="text-xs text-xsm-light-gray">Completed deal size average</p>
                </div>
                <span className="text-xsm-yellow font-extrabold text-lg">{formatCurrency(data?.overallPaymentStats.avgCompletedDealSize || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialRecords;
