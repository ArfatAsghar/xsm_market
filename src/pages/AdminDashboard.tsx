import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Users, ShoppingBag, Settings, MessageSquare, FileText, Bell, DollarSign, TrendingUp, Crown, CreditCard, ShieldCheck, PieChart } from 'lucide-react';
import ManageUsers from '@/components/admin/ManageUsers';
import ReviewListings from '@/components/admin/ReviewListings';
import ReviewChats from '@/components/admin/ReviewChats';
import ReviewDeals from '@/components/admin/ReviewDeals';
import { getDashboardStats, getFinancialStats } from '@/services/admin';
import { useAuth } from '@/context/useAuth';

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
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const currentUserRole = (currentUser as any)?.role || 'user';
  const isCurrentUserAdmin = currentUserRole === 'admin' || (currentUser as any)?.isAdmin === true;
  const isCurrentUserManager = currentUserRole === 'manager';
  const isCurrentUserViewer = currentUserRole === 'viewer';

  const dashboardTitle = isCurrentUserAdmin
    ? 'Admin Dashboard'
    : isCurrentUserManager
    ? 'Manager Dashboard'
    : isCurrentUserViewer
    ? 'Viewer Dashboard'
    : 'Staff Dashboard';

  const [activeView, setActiveView] = useState<string>('dashboard');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const navigateToChat = (chatId: string) => {
    if (chatId) {
      navigate(`/chat?chatId=${chatId}`);
    } else {
      navigate('/chat');
    }
  };
  const [stats, setStats] = useState([
    { title: 'Total Users', value: '-', icon: Users },
    { title: 'Active Listings', value: '-', icon: ShoppingBag },
    { title: 'Total Chats', value: '-', icon: Activity },
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supportRequestCount, setSupportRequestCount] = useState(0);

  // Financial statistics (Admin only)
  const [financials, setFinancials] = useState<FinancialData | null>(null);
  const [financialsLoading, setFinancialsLoading] = useState(false);
  const [financialsError, setFinancialsError] = useState<string | null>(null);

  const fetchSupportRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://xsmmarket.com/api');
      const resp = await fetch(`${apiUrl}/admin/support-requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setSupportRequestCount(data.count ?? (data.data?.length ?? 0));
      }
    } catch (e) {
      // Silently fail — support requests are non-critical
    }
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    getDashboardStats()
      .then((data) => {
        setStats([
          { title: 'Total Users', value: data.totalUsers, icon: Users },
          { title: 'Active Listings', value: data.totalListings, icon: ShoppingBag },
          { title: 'Total Chats', value: data.totalChats, icon: Activity },
        ]);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch dashboard stats');
        setLoading(false);
      });

    // Fetch financial stats strictly for Admin
    if (isCurrentUserAdmin) {
      setFinancialsLoading(true);
      getFinancialStats()
        .then((res) => {
          if (res.financials) {
            setFinancials(res.financials);
          }
          setFinancialsLoading(false);
        })
        .catch((err) => {
          setFinancialsError(err.message || 'Failed to load financial statistics');
          setFinancialsLoading(false);
        });
    }

    fetchSupportRequests();
  }, [isCurrentUserAdmin]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const renderContent = () => {
    switch (activeView) {
      case 'manage-users':
        return <ManageUsers />;
      case 'review-listings':
        return <ReviewListings onNavigateToChat={navigateToChat} />;
      case 'review-chats':
        return <ReviewChats initialChatId={selectedChatId} />;
      case 'review-deals':
        return <ReviewDeals />;
      default:
        return (
          <>
            {/* Overview Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {loading ? (
                <div className="col-span-3 text-center text-xsm-light-gray py-8">Loading statistics...</div>
              ) : error ? (
                <div className="col-span-3 text-center text-red-400 py-8">{error}</div>
              ) : (
                stats.map((stat, index) => (
                  <div key={index} className="bg-xsm-dark-gray p-6 rounded-xl border border-xsm-medium-gray">
                    <div className="flex items-center justify-between mb-4">
                      <stat.icon className="h-8 w-8 text-xsm-yellow" />
                    </div>
                    <h3 className="text-lg text-xsm-light-gray mb-2">{stat.title}</h3>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                ))
              )}
            </div>

            {/* 💰 Financial & Revenue Statistics (ADMIN ONLY) */}
            {isCurrentUserAdmin && (
              <div className="mb-8 bg-xsm-dark-gray/60 border border-xsm-yellow/30 rounded-2xl p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-xsm-medium-gray/60">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-xsm-yellow/10 rounded-xl border border-xsm-yellow/20">
                      <TrendingUp className="h-6 w-6 text-xsm-yellow" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        Revenue & Business Statistics
                        <span className="bg-xsm-yellow text-black text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Admin Restricted</span>
                      </h2>
                      <p className="text-xs text-xsm-light-gray">Real-time marketplace revenue, volume, commission, and VIP metrics</p>
                    </div>
                  </div>
                </div>

                {financialsLoading ? (
                  <div className="text-center text-xsm-light-gray py-8">Loading financial metrics...</div>
                ) : financialsError ? (
                  <div className="text-center text-red-400 py-8">{financialsError}</div>
                ) : financials ? (
                  <div className="space-y-6">
                    {/* Primary Financial Metric Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      {/* Completed Deals */}
                      <div className="bg-xsm-black/50 p-4 rounded-xl border border-xsm-medium-gray/50 hover:border-xsm-yellow/40 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-xsm-light-gray">Completed Deals</span>
                          <ShieldCheck className="w-5 h-5 text-green-400" />
                        </div>
                        <p className="text-2xl font-extrabold text-white">{financials.completedDeals}</p>
                        <p className="text-[11px] text-green-400 mt-1">Successfully fulfilled</p>
                      </div>

                      {/* Business Volume */}
                      <div className="bg-xsm-black/50 p-4 rounded-xl border border-xsm-medium-gray/50 hover:border-xsm-yellow/40 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-xsm-light-gray">Total Business Volume</span>
                          <DollarSign className="w-5 h-5 text-xsm-yellow" />
                        </div>
                        <p className="text-2xl font-extrabold text-xsm-yellow">{formatCurrency(financials.totalBusinessVolume)}</p>
                        <p className="text-[11px] text-xsm-light-gray mt-1">Gross completed volume</p>
                      </div>

                      {/* Website Commission Earned */}
                      <div className="bg-xsm-black/50 p-4 rounded-xl border border-xsm-medium-gray/50 hover:border-xsm-yellow/40 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-xsm-light-gray">Website Commission</span>
                          <TrendingUp className="w-5 h-5 text-emerald-400" />
                        </div>
                        <p className="text-2xl font-extrabold text-emerald-400">{formatCurrency(financials.totalCommissionEarned)}</p>
                        <p className="text-[11px] text-emerald-300 mt-1">Escrow fees earned</p>
                      </div>

                      {/* VIP Memberships Purchased */}
                      <div className="bg-xsm-black/50 p-4 rounded-xl border border-xsm-medium-gray/50 hover:border-xsm-yellow/40 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-xsm-light-gray">VIP Purchases</span>
                          <Crown className="w-5 h-5 text-yellow-400" />
                        </div>
                        <p className="text-2xl font-extrabold text-white">{financials.totalVipPurchases}</p>
                        <p className="text-[11px] text-yellow-300 mt-1">{financials.activeVipMembers} active VIP members</p>
                      </div>

                      {/* VIP Revenue */}
                      <div className="bg-xsm-black/50 p-4 rounded-xl border border-xsm-medium-gray/50 hover:border-xsm-yellow/40 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-xsm-light-gray">VIP Revenue</span>
                          <CreditCard className="w-5 h-5 text-purple-400" />
                        </div>
                        <p className="text-2xl font-extrabold text-purple-300">{formatCurrency(financials.totalVipRevenue)}</p>
                        <p className="text-[11px] text-purple-400 mt-1">Subscriptions revenue</p>
                      </div>
                    </div>

                    {/* Detailed Payment Statistics Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
                      {/* Pipeline Volume & Avg Size */}
                      <div className="bg-xsm-black/40 p-4 rounded-xl border border-xsm-medium-gray/40">
                        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                          <PieChart className="w-4 h-4 text-xsm-yellow" /> Overall Deals Performance
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center text-sm border-b border-xsm-medium-gray/30 pb-2">
                            <span className="text-xsm-light-gray">Total Marketplace Deals:</span>
                            <span className="font-semibold text-white">{financials.overallPaymentStats.totalAllDealsCount} deals</span>
                          </div>
                          <div className="flex justify-between items-center text-sm border-b border-xsm-medium-gray/30 pb-2">
                            <span className="text-xsm-light-gray">Total Pipeline Volume:</span>
                            <span className="font-semibold text-xsm-yellow">{formatCurrency(financials.overallPaymentStats.overallDealsVolume)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-xsm-light-gray">Avg Completed Deal Value:</span>
                            <span className="font-semibold text-green-400">{formatCurrency(financials.overallPaymentStats.avgCompletedDealSize)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Crypto Transaction Analytics */}
                      <div className="bg-xsm-black/40 p-4 rounded-xl border border-xsm-medium-gray/40">
                        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-blue-400" /> Crypto Payments Volume
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center text-sm border-b border-xsm-medium-gray/30 pb-2">
                            <span className="text-xsm-light-gray">Total Crypto Payments:</span>
                            <span className="font-semibold text-white">{financials.overallPaymentStats.cryptoTransactionsCount} payments</span>
                          </div>
                          <div className="flex justify-between items-center text-sm border-b border-xsm-medium-gray/30 pb-2">
                            <span className="text-xsm-light-gray">Confirmed Crypto Volume:</span>
                            <span className="font-semibold text-blue-400">{formatCurrency(financials.overallPaymentStats.cryptoConfirmedVolume)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-xsm-light-gray">Payment Gateway:</span>
                            <span className="font-semibold text-xsm-yellow">NOWPayments API</span>
                          </div>
                        </div>
                      </div>

                      {/* Payment Methods Breakdown */}
                      <div className="bg-xsm-black/40 p-4 rounded-xl border border-xsm-medium-gray/40">
                        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Fee Collection Breakdown
                        </h4>
                        <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                          {financials.overallPaymentStats.paymentMethodsBreakdown.length === 0 ? (
                            <p className="text-xs text-xsm-light-gray py-2">No payment method logs yet</p>
                          ) : (
                            financials.overallPaymentStats.paymentMethodsBreakdown.map((pm, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs border-b border-xsm-medium-gray/20 pb-1.5">
                                <span className="text-white capitalize">{pm.method}</span>
                                <span className="text-emerald-400 font-bold">{formatCurrency(pm.feeCollected)} ({pm.count} deals)</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { name: 'Manage Users', view: 'manage-users' },
                { name: 'Review Listings', view: 'review-listings' },
                { name: 'Review Chats', view: 'review-chats', icon: MessageSquare, badge: supportRequestCount },
                { name: 'Review Deals', view: 'review-deals', icon: FileText }
              ].map((action, index) => (
                <button
                  key={index}
                  onClick={() => setActiveView(action.view)}
                  className="p-4 bg-xsm-dark-gray border border-xsm-medium-gray rounded-lg hover:bg-xsm-medium-gray transition-colors text-left flex items-center gap-2 relative"
                >
                  {action.icon && <action.icon className="h-5 w-5 text-xsm-yellow" />}
                  <span>{action.name}</span>
                  {action.badge ? (
                    <span className="ml-auto flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      <Bell className="w-3 h-3" />
                      {action.badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-xsm-black text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-xsm-yellow">
          {activeView === 'dashboard'
            ? dashboardTitle
            : dashboardTitle + ' / ' + activeView.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
        </h1>
        <div className="flex items-center space-x-4">
          {activeView !== 'dashboard' && (
            <button
              onClick={() => setActiveView('dashboard')}
              className="px-4 py-2 bg-xsm-medium-gray hover:bg-xsm-medium-gray/80 rounded-lg transition-colors"
            >
              Back to Dashboard
            </button>
          )}
        </div>
      </div>

      {renderContent()}
    </div>
  );
};

export default AdminDashboard;
