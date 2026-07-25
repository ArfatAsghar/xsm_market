import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Users, ShoppingBag, Settings, MessageSquare, FileText, Bell, DollarSign, TrendingUp, Crown, CreditCard, ShieldCheck, PieChart } from 'lucide-react';
import ManageUsers from '@/components/admin/ManageUsers';
import ReviewListings from '@/components/admin/ReviewListings';
import ReviewChats from '@/components/admin/ReviewChats';
import ReviewDeals from '@/components/admin/ReviewDeals';
import FinancialRecords from '@/components/admin/FinancialRecords';
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
      case 'financial-records':
        return <FinancialRecords />;
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

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { name: 'Manage Users', view: 'manage-users' },
                { name: 'Review Listings', view: 'review-listings' },
                { name: 'Review Chats', view: 'review-chats', icon: MessageSquare, badge: supportRequestCount },
                { name: 'Review Deals', view: 'review-deals', icon: FileText },
                ...(isCurrentUserAdmin ? [{ name: 'Financial Records', view: 'financial-records', icon: DollarSign, isSpecial: true }] : [])
              ].map((action: any, index) => (
                <button
                  key={index}
                  onClick={() => setActiveView(action.view)}
                  className={`p-4 rounded-lg transition-colors text-left flex items-center gap-2 relative border ${
                    action.isSpecial
                      ? 'bg-gradient-to-r from-xsm-dark-gray to-xsm-medium-gray/60 border-xsm-yellow/50 hover:border-xsm-yellow text-xsm-yellow font-bold shadow-lg'
                      : 'bg-xsm-dark-gray border-xsm-medium-gray hover:bg-xsm-medium-gray text-white'
                  }`}
                >
                  {action.icon && <action.icon className={`h-5 w-5 ${action.isSpecial ? 'text-xsm-yellow font-bold' : 'text-xsm-yellow'}`} />}
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
