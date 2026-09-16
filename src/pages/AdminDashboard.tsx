import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, ShoppingBag, MessageSquare, FileText,
  Bell, DollarSign, ShieldCheck, Mail, Gift,
  ArrowLeft, ChevronRight, Sparkles, Search, ExternalLink,
  SlidersHorizontal, CheckCircle, Zap
} from 'lucide-react';
import ManageUsers from '@/components/admin/ManageUsers';
import ReviewListings from '@/components/admin/ReviewListings';
import ReviewChats from '@/components/admin/ReviewChats';
import ReviewDeals from '@/components/admin/ReviewDeals';
import FinancialRecords from '@/components/admin/FinancialRecords';
import AdminWebsiteUpdates from '@/components/admin/AdminWebsiteUpdates';
import EmailPoolManager from '@/components/admin/EmailPoolManager';
import AdminReferralManagement from '@/components/admin/AdminReferralManagement';
import { useAuth } from '@/context/useAuth';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const currentUserRole = (currentUser as any)?.role || 'user';
  const isCurrentUserAdmin = currentUserRole === 'admin' || (currentUser as any)?.isAdmin === true;
  const isCurrentUserManager = currentUserRole === 'manager';
  const isCurrentUserViewer = currentUserRole === 'viewer';

  const dashboardTitle = isCurrentUserAdmin
    ? 'Admin Console'
    : isCurrentUserManager
    ? 'Manager Console'
    : isCurrentUserViewer
    ? 'Viewer Console'
    : 'Staff Console';

  const [activeView, setActiveView] = useState<string>('dashboard');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [moduleSearch, setModuleSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'marketplace' | 'users' | 'platform'>('all');
  const [supportRequestCount, setSupportRequestCount] = useState(0);

  const navigateToChat = (chatId: string) => {
    if (chatId) {
      navigate(`/chat?chatId=${chatId}`);
    } else {
      navigate('/chat');
    }
  };

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
    fetchSupportRequests();
  }, [isCurrentUserAdmin]);

  const getSubViewTitle = (viewKey: string) => {
    switch (viewKey) {
      case 'manage-users': return 'Manage Users & Permissions';
      case 'review-listings': return 'Marketplace Listing Review';
      case 'review-chats': return 'Chat & Dispute Moderation';
      case 'review-deals': return 'Escrow Deals Verification';
      case 'email-pool': return 'System Email Pool & Logs';
      case 'referral-management': return 'Referral & KYC Moderation';
      case 'financial-records': return 'Financial Analytics & Volume';
      case 'website-updates': return 'Announcements & Updates';
      default: return viewKey.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
  };

  const allModules = [
    {
      id: 'review-listings',
      name: 'Review Listings',
      desc: 'Verify channel submissions, boost listing pins, and inspect seller listings.',
      category: 'marketplace',
      categoryLabel: 'Marketplace',
      icon: ShoppingBag,
      accent: 'from-amber-500/20 to-amber-600/10 text-amber-600 dark:text-yellow-400',
      tag: 'Listings Feed'
    },
    {
      id: 'review-deals',
      name: 'Review Deals',
      desc: 'Monitor escrow trade contracts, verify payment status, and release security funds.',
      category: 'marketplace',
      categoryLabel: 'Escrow & Trade',
      icon: FileText,
      accent: 'from-emerald-500/20 to-emerald-600/10 text-emerald-600 dark:text-emerald-400',
      tag: 'Active Deals'
    },
    {
      id: 'review-chats',
      name: 'Review Chats',
      desc: 'Inspect buyer-seller communication channels and resolve flagged trade disputes.',
      category: 'marketplace',
      categoryLabel: 'Disputes & Support',
      icon: MessageSquare,
      badge: supportRequestCount,
      accent: 'from-rose-500/20 to-rose-600/10 text-rose-600 dark:text-rose-400',
      tag: supportRequestCount > 0 ? `${supportRequestCount} Tickets` : 'Moderation'
    },
    {
      id: 'manage-users',
      name: 'Manage Users',
      desc: 'Search registered members, inspect profiles, adjust roles, and manage suspensions.',
      category: 'users',
      categoryLabel: 'Identity & Access',
      icon: Users,
      accent: 'from-blue-500/20 to-blue-600/10 text-blue-600 dark:text-blue-400',
      tag: 'User Accounts'
    },
    ...(isCurrentUserAdmin || isCurrentUserManager ? [{
      id: 'referral-management',
      name: 'Referrals & KYC',
      desc: 'Review identity verification submissions, inspect VIP reward credits, and set anti-fraud rules.',
      category: 'users',
      categoryLabel: 'Growth & Rewards',
      icon: Gift,
      accent: 'from-amber-500/20 to-yellow-600/10 text-amber-600 dark:text-yellow-400',
      tag: 'Rewards & KYC',
      isHighlight: true
    }] : []),
    ...(isCurrentUserAdmin ? [{
      id: 'financial-records',
      name: 'Financial Records',
      desc: 'Platform business volume, commissions earned, crypto receipts, and VIP subscription sales.',
      category: 'platform',
      categoryLabel: 'Executive Ledger',
      icon: DollarSign,
      accent: 'from-yellow-500/25 to-amber-600/20 text-amber-600 dark:text-xsm-yellow',
      tag: 'Financial Suite',
      isSpecial: true
    }] : []),
    ...(isCurrentUserAdmin || isCurrentUserManager ? [{
      id: 'email-pool',
      name: 'Email Pool',
      desc: 'Inspect automated outbound emails, verification dispatches, and server delivery logs.',
      category: 'platform',
      categoryLabel: 'Infrastructure',
      icon: Mail,
      accent: 'from-violet-500/20 to-violet-600/10 text-violet-600 dark:text-violet-400',
      tag: 'Email System'
    }] : []),
    {
      id: 'website-updates',
      name: 'Website Updates',
      desc: 'Deploy site-wide broadcast banners, feature notices, and platform announcements.',
      category: 'platform',
      categoryLabel: 'Announcements',
      icon: Bell,
      accent: 'from-sky-500/20 to-sky-600/10 text-sky-600 dark:text-sky-400',
      tag: 'Public Notices'
    }
  ];

  const filteredModules = allModules.filter(m => {
    const matchesCategory = activeCategory === 'all' || m.category === activeCategory;
    const matchesQuery = m.name.toLowerCase().includes(moduleSearch.toLowerCase()) ||
                         m.desc.toLowerCase().includes(moduleSearch.toLowerCase()) ||
                         m.categoryLabel.toLowerCase().includes(moduleSearch.toLowerCase());
    return matchesCategory && matchesQuery;
  });

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
      case 'email-pool':
        return <EmailPoolManager />;
      case 'referral-management':
        return <AdminReferralManagement />;
      case 'financial-records':
        return <FinancialRecords />;
      case 'website-updates':
        return <AdminWebsiteUpdates />;
      default:
        return (
          <div className="space-y-8">
            {/* Executive Welcome & Control Strip */}
            <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8 shadow-sm dark:shadow-xl transition-all">
              <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 dark:bg-yellow-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
              
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 dark:bg-yellow-500/10 border border-amber-500/30 text-amber-700 dark:text-yellow-400 text-xs font-bold mb-3 uppercase tracking-wider">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Executive Command Deck</span>
                  </div>
                  <h1 className="text-2xl sm:text-4xl font-black text-neutral-900 dark:text-white tracking-tight">
                    Welcome back, <span className="text-amber-600 dark:text-xsm-yellow">@{currentUser?.username || 'Staff'}</span>
                  </h1>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                    Access platform management modules, verify listings, process KYC applications, resolve escrow disputes, and oversee marketplace finances.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-black/40 border border-neutral-200 dark:border-neutral-800 text-left">
                    <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">Access Level</span>
                    <span className="text-sm font-extrabold text-neutral-900 dark:text-white uppercase flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      {currentUserRole}
                    </span>
                  </div>

                  <div className="px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-black/40 border border-neutral-200 dark:border-neutral-800 text-left">
                    <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">System Status</span>
                    <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Operational
                    </span>
                  </div>

                  <button
                    onClick={() => navigate('/')}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 text-xs font-bold transition-all shadow-sm"
                  >
                    <span>Marketplace</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-800/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                {/* Category Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                  <button
                    onClick={() => setActiveCategory('all')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      activeCategory === 'all'
                        ? 'bg-amber-600 dark:bg-xsm-yellow text-white dark:text-black shadow-sm'
                        : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    All Modules ({allModules.length})
                  </button>
                  <button
                    onClick={() => setActiveCategory('marketplace')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      activeCategory === 'marketplace'
                        ? 'bg-amber-600 dark:bg-xsm-yellow text-white dark:text-black shadow-sm'
                        : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    Marketplace & Deals
                  </button>
                  <button
                    onClick={() => setActiveCategory('users')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      activeCategory === 'users'
                        ? 'bg-amber-600 dark:bg-xsm-yellow text-white dark:text-black shadow-sm'
                        : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    Users & KYC
                  </button>
                  <button
                    onClick={() => setActiveCategory('platform')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      activeCategory === 'platform'
                        ? 'bg-amber-600 dark:bg-xsm-yellow text-white dark:text-black shadow-sm'
                        : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    Platform & Finance
                  </button>
                </div>

                {/* Search Box */}
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 w-3.5 h-3.5" />
                  <input
                    type="text"
                    value={moduleSearch}
                    onChange={(e) => setModuleSearch(e.target.value)}
                    placeholder="Search modules..."
                    className="w-full bg-neutral-100 dark:bg-black/50 border border-neutral-300 dark:border-neutral-700 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Management Modules Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3">
              {filteredModules.map((item) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={`p-4 rounded-2xl text-left flex flex-col justify-between border transition-all duration-200 group relative overflow-hidden ${
                      item.isSpecial
                        ? 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white dark:from-yellow-500/15 dark:via-neutral-900 dark:to-black border-amber-400/60 dark:border-yellow-500/40 shadow-md hover:shadow-xl hover:border-amber-500'
                        : item.isHighlight
                        ? 'bg-white dark:bg-neutral-900 border-amber-300 dark:border-amber-500/40 shadow-sm hover:shadow-lg hover:border-amber-500'
                        : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-lg hover:border-neutral-400 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className={`w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center ${item.accent} group-hover:scale-110 transition-transform`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {item.badge ? (
                            <span className="flex items-center gap-1 bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                              <Bell className="w-2.5 h-2.5" />
                              {item.badge}
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400">
                              {item.tag}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="text-[10px] font-bold text-amber-600 dark:text-yellow-400 uppercase tracking-wider block mb-0.5">
                        {item.categoryLabel}
                      </span>
                      <h3 className={`text-sm font-black tracking-tight mb-1 ${
                        item.isSpecial ? 'text-amber-700 dark:text-yellow-400' : 'text-neutral-900 dark:text-white'
                      }`}>
                        {item.name}
                      </h3>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed line-clamp-2">
                        {item.desc}
                      </p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800/60 flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 group-hover:text-amber-600 dark:group-hover:text-yellow-400 transition-colors">
                        Launch
                      </span>
                      <div className="w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 group-hover:text-amber-600 dark:group-hover:text-yellow-400 group-hover:translate-x-1 transition-all">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[var(--xsm-bg,#080808)] text-foreground p-4 sm:p-6 lg:p-8 transition-colors duration-200">
      <div className="max-w-7xl mx-auto">
        {/* Sub-view Header with Breadcrumbs */}
        {activeView !== 'dashboard' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-neutral-200 dark:border-neutral-800">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 dark:text-gray-400 mb-1">
                <button
                  onClick={() => setActiveView('dashboard')}
                  className="hover:underline flex items-center gap-1 text-neutral-600 dark:text-gray-300"
                >
                  <span>Console</span>
                </button>
                <span>/</span>
                <span className="text-amber-600 dark:text-yellow-400 font-bold">
                  {getSubViewTitle(activeView)}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white tracking-tight flex items-center gap-3">
                <span>{getSubViewTitle(activeView)}</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-500/10 text-amber-700 dark:text-yellow-400 border border-amber-500/30 uppercase">
                  {currentUserRole}
                </span>
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveView('dashboard')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-bold shadow-sm transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Command Deck</span>
              </button>
            </div>
          </div>
        )}

        {/* Dynamic View Content */}
        {renderContent()}
      </div>
    </div>
  );
};

export default AdminDashboard;
