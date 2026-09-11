import React, { useState, useEffect } from 'react';
import { 
  Mail, Plus, Settings, RefreshCw, Search, CheckCircle2, AlertTriangle, 
  XCircle, Clock, Shield, Youtube, Film, Eye, Edit2, Sliders, 
  Trash2, Power, ArrowRightLeft, User, ExternalLink, ChevronRight,
  Info, AlertCircle, Sparkles, Check, X, ShieldAlert, Layers
} from 'lucide-react';
import { 
  PoolEmail, PoolStats, PoolAllocation, PoolBrandAccount, PoolHistoryItem, PoolSettings,
  getEmailPoolStats, getEmailPoolList, getEmailPoolDetails, addPoolEmail, updatePoolEmail,
  updatePoolCapacity, togglePoolEmailStatus, deletePoolEmail, reassignPoolDeal,
  getPoolSettings, updatePoolSettings
} from '@/services/emailPool';
import { useToast } from '@/hooks/use-toast';
import DealAlertModal from '@/components/DealAlertModal';

const EmailPoolManager: React.FC = () => {
  const { toast } = useToast();

  // Primary data state
  const [stats, setStats] = useState<PoolStats | null>(null);
  const [emails, setEmails] = useState<PoolEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCapacityModal, setShowCapacityModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Custom Alert / Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info' | 'warning';
    actionText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    details?: Array<{ label: string; value: string | number }>;
    onAction?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: ''
  });

  // Selected item state
  const [selectedEmail, setSelectedEmail] = useState<PoolEmail | null>(null);
  const [detailData, setDetailData] = useState<{
    email: PoolEmail;
    active_allocations: PoolAllocation[];
    historical_allocations: PoolAllocation[];
    brand_accounts: PoolBrandAccount[];
    history: PoolHistoryItem[];
  } | null>(null);
  const [detailTab, setDetailTab] = useState<'allocations' | 'brands' | 'history'>('allocations');
  const [detailLoading, setDetailLoading] = useState(false);

  // Selected allocation for reassignment
  const [reassignDealData, setReassignDealData] = useState<PoolAllocation | null>(null);
  const [reassignTargetEmailId, setReassignTargetEmailId] = useState<number | ''>('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassignAllowOverride, setReassignAllowOverride] = useState(false);
  const [reassignSubmitting, setReassignSubmitting] = useState(false);

  // Form states
  const [emailForm, setEmailForm] = useState({
    email_address: '',
    platform: 'both' as 'both' | 'youtube' | 'tiktok',
    max_active_deals: 5,
    max_brand_accounts: 5,
    status: 'enabled' as 'enabled' | 'disabled',
    notes: ''
  });

  const [capacityForm, setCapacityForm] = useState({
    max_active_deals: 5,
    max_brand_accounts: 5
  });

  const [settingsForm, setSettingsForm] = useState<PoolSettings>({
    default_max_capacity: 5,
    default_max_brand_accounts: 5,
    allocation_method: 'least_used',
    auto_assignment_enabled: true,
    allow_manager_access: false,
    low_capacity_threshold: 1,
    no_available_email_alert: true
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Initial load
  useEffect(() => {
    loadData();
  }, [search, statusFilter, platformFilter, sortBy]);

  const loadData = async () => {
    try {
      if (!refreshing) setLoading(true);
      const [statsData, listData] = await Promise.all([
        getEmailPoolStats(),
        getEmailPoolList({ search, status: statusFilter, platform: platformFilter, sort: sortBy })
      ]);
      setStats(statsData);
      setEmails(listData);
    } catch (err: any) {
      toast({
        title: 'Failed to load Email Pool',
        description: err.message || 'Error fetching data from server',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Open Details Modal
  const handleOpenDetails = async (email: PoolEmail) => {
    setSelectedEmail(email);
    setShowDetailModal(true);
    setDetailLoading(true);
    setDetailTab('allocations');
    try {
      const data = await getEmailPoolDetails(email.id);
      setDetailData(data);
    } catch (err: any) {
      toast({
        title: 'Error loading details',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setDetailLoading(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (email: PoolEmail) => {
    setSelectedEmail(email);
    setEmailForm({
      email_address: email.email_address,
      platform: email.platform,
      max_active_deals: email.max_active_deals,
      max_brand_accounts: email.max_brand_accounts,
      status: email.status,
      notes: email.notes || ''
    });
    setShowEditModal(true);
  };

  // Open Capacity Modal
  const handleOpenCapacity = (email: PoolEmail) => {
    setSelectedEmail(email);
    setCapacityForm({
      max_active_deals: email.max_active_deals,
      max_brand_accounts: email.max_brand_accounts
    });
    setShowCapacityModal(true);
  };

  // Open Settings Modal
  const handleOpenSettings = async () => {
    setShowSettingsModal(true);
    setSettingsLoading(true);
    try {
      const settings = await getPoolSettings();
      setSettingsForm(settings);
    } catch (err: any) {
      toast({
        title: 'Error loading settings',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setSettingsLoading(false);
    }
  };

  // Custom confirmation for Enable / Disable
  const promptToggleStatus = (email: PoolEmail) => {
    const isCurrentlyEnabled = email.status === 'enabled';
    
    setConfirmModal({
      isOpen: true,
      title: isCurrentlyEnabled ? 'Disable Gmail Account?' : 'Enable Gmail Account?',
      message: isCurrentlyEnabled
        ? `Are you sure you want to disable ${email.email_address}?\n\nThis account will temporarily stop receiving new deal allocations. Any currently active deals will remain assigned until they complete.`
        : `Are you sure you want to re-enable ${email.email_address}?\n\nThis account will immediately become eligible for automated deal assignments based on its open capacity.`,
      type: isCurrentlyEnabled ? 'warning' : 'success',
      actionText: isCurrentlyEnabled ? 'Disable Gmail' : 'Enable Gmail',
      cancelText: 'Cancel',
      isDestructive: isCurrentlyEnabled,
      details: [
        { label: 'Gmail Address', value: email.email_address },
        { label: 'Current Active Deals', value: `${email.active_deals_count} / ${email.max_active_deals}` },
        { label: 'Platform', value: email.platform.toUpperCase() }
      ],
      onAction: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await togglePoolEmailStatus(email.id, isCurrentlyEnabled ? 'disabled' : 'enabled');
          toast({
            title: res.status === 'enabled' ? '🟢 Gmail Enabled' : '⚫ Gmail Disabled',
            description: res.message
          });
          loadData();
          if (showDetailModal && selectedEmail?.id === email.id) {
            setSelectedEmail({
              ...selectedEmail,
              status: res.status,
              calculated_status: res.status === 'disabled' ? 'disabled' : selectedEmail.calculated_status
            });
          }
        } catch (err: any) {
          setConfirmModal({
            isOpen: true,
            title: 'Failed to Update Status',
            message: err.message || 'Could not update status on server.',
            type: 'error',
            actionText: 'Close'
          });
        }
      }
    });
  };

  // Custom confirmation for Delete
  const promptDeleteEmail = (email: PoolEmail) => {
    if (email.active_deals_count > 0) {
      setConfirmModal({
        isOpen: true,
        title: 'Cannot Delete Account',
        message: `Gmail ${email.email_address} currently has ${email.active_deals_count} active deal(s) assigned.\n\nYou cannot delete an account with active transactions. Please complete or reassign those deals first, or disable this Gmail to stop receiving new transactions.`,
        type: 'error',
        actionText: 'Understood',
        details: [
          { label: 'Account', value: email.email_address },
          { label: 'Active Deals', value: email.active_deals_count },
          { label: 'Status', value: email.status.toUpperCase() }
        ]
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Permanently Delete Gmail?',
      message: `Are you sure you want to permanently remove ${email.email_address} from the email pool?\n\nThis will permanently delete this account record and its allocation history. This action cannot be undone.`,
      type: 'warning',
      actionText: 'Delete Permanently',
      cancelText: 'Keep Account',
      isDestructive: true,
      details: [
        { label: 'Account', value: email.email_address },
        { label: 'Platform', value: email.platform.toUpperCase() }
      ],
      onAction: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await deletePoolEmail(email.id);
          toast({
            title: 'Email Removed',
            description: res.message
          });
          loadData();
          if (showDetailModal && selectedEmail?.id === email.id) {
            setShowDetailModal(false);
          }
        } catch (err: any) {
          setConfirmModal({
            isOpen: true,
            title: 'Deletion Blocked',
            message: err.message || 'Unable to delete email account.',
            type: 'error',
            actionText: 'Close'
          });
        }
      }
    });
  };

  // Submit Add Email
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForm.email_address) return;
    setSubmitting(true);
    try {
      const res = await addPoolEmail(emailForm);
      toast({
        title: 'Gmail Added',
        description: res.message
      });
      setShowAddModal(false);
      setEmailForm({
        email_address: '',
        platform: 'both',
        max_active_deals: 5,
        max_brand_accounts: 5,
        status: 'enabled',
        notes: ''
      });
      loadData();
    } catch (err: any) {
      toast({
        title: 'Failed to add Gmail',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit Email
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmail) return;
    setSubmitting(true);
    try {
      const res = await updatePoolEmail(selectedEmail.id, {
        email_address: emailForm.email_address,
        platform: emailForm.platform,
        status: emailForm.status,
        notes: emailForm.notes
      });
      toast({
        title: 'Email Updated',
        description: res.message
      });
      setShowEditModal(false);
      loadData();
    } catch (err: any) {
      toast({
        title: 'Failed to update email',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Capacity Change
  const handleCapacitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmail) return;
    setSubmitting(true);
    try {
      const res = await updatePoolCapacity(selectedEmail.id, capacityForm);
      toast({
        title: 'Capacity Updated',
        description: res.message
      });
      setShowCapacityModal(false);
      loadData();
      if (showDetailModal && selectedEmail) {
        handleOpenDetails(selectedEmail);
      }
    } catch (err: any) {
      toast({
        title: 'Failed to update capacity',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Settings Update
  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await updatePoolSettings(settingsForm);
      toast({
        title: 'Settings Saved',
        description: res.message
      });
      setShowSettingsModal(false);
      loadData();
    } catch (err: any) {
      toast({
        title: 'Failed to save settings',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Open Reassign Modal for an active allocation
  const handleOpenReassign = (alloc: PoolAllocation) => {
    setReassignDealData(alloc);
    setReassignTargetEmailId('');
    setReassignReason('');
    setReassignAllowOverride(false);
    setShowReassignModal(true);
  };

  // Submit Reassignment
  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignDealData || !reassignTargetEmailId) return;
    setReassignSubmitting(true);
    try {
      const res = await reassignPoolDeal({
        deal_id: reassignDealData.deal_id,
        new_email_id: Number(reassignTargetEmailId),
        reason: reassignReason || 'Admin manual reassignment',
        allow_override: reassignAllowOverride
      });
      toast({
        title: 'Deal Reassigned',
        description: res.message
      });
      setShowReassignModal(false);
      loadData();
      if (selectedEmail) {
        handleOpenDetails(selectedEmail);
      }
    } catch (err: any) {
      if (err.data?.capacity_reached) {
        toast({
          title: '⚠️ Capacity Limit Reached',
          description: err.message + ' Check "Allow Capacity Override" to force assign.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Reassignment Failed',
          description: err.message,
          variant: 'destructive'
        });
      }
    } finally {
      setReassignSubmitting(false);
    }
  };

  // Helper for Status Badge
  const renderStatusBadge = (status: PoolEmail['calculated_status']) => {
    switch (status) {
      case 'available':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Available
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-yellow-400 border border-amber-500/20">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Partially Used
          </span>
        );
      case 'full':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Full
          </span>
        );
      case 'disabled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-500/10 text-gray-500 dark:text-gray-400 border border-gray-500/20">
            <span className="w-2 h-2 rounded-full bg-gray-500" />
            Disabled
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">

      {/* Low Capacity Warning Banner */}
      {stats && stats.total_available_slots <= 2 && (
        <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-600 dark:text-yellow-400">
                Low Email Pool Capacity Warning
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total available slots are down to {stats.total_available_slots}. Add more Gmail accounts or expand capacities to avoid transfer delays.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs flex-shrink-0 transition-colors"
          >
            + Add Email
          </button>
        </div>
      )}

      {/* Top Dynamic KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Emails */}
        <div className="bg-xsm-dark-gray p-4 rounded-xl border border-xsm-medium-gray flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold">Total Gmails</span>
            <Mail className="w-4 h-4 text-xsm-yellow" />
          </div>
          <p className="text-2xl font-black text-foreground">{stats?.total_emails ?? '-'}</p>
          <span className="text-[11px] text-muted-foreground mt-1">Managed accounts</span>
        </div>

        {/* Available */}
        <div className="bg-xsm-dark-gray p-4 rounded-xl border border-xsm-medium-gray flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold">Available</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-500">{stats?.available ?? '-'}</p>
          <span className="text-[11px] text-muted-foreground mt-1">0% used</span>
        </div>

        {/* Partially Used */}
        <div className="bg-xsm-dark-gray p-4 rounded-xl border border-xsm-medium-gray flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold">Partially Used</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-500">{stats?.partially_used ?? '-'}</p>
          <span className="text-[11px] text-muted-foreground mt-1">Open slots available</span>
        </div>

        {/* Full */}
        <div className="bg-xsm-dark-gray p-4 rounded-xl border border-xsm-medium-gray flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold">Full Capacity</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-500">{stats?.full ?? '-'}</p>
          <span className="text-[11px] text-muted-foreground mt-1">No slots open</span>
        </div>

        {/* Total Available Slots */}
        <div className="bg-xsm-dark-gray p-4 rounded-xl border border-amber-500/40 bg-amber-500/5 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold text-amber-600 dark:text-yellow-400">Available Slots</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-500">{stats?.total_available_slots ?? '-'}</p>
          <span className="text-[11px] text-muted-foreground mt-1">Across all enabled</span>
        </div>
      </div>

      {/* Secondary Platform & Deals Breakdown Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl border bg-xsm-dark-gray border-xsm-medium-gray flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Active Deals</span>
              <span className="text-base font-bold text-foreground">{stats?.active_deals ?? 0} currently assigned</span>
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border bg-xsm-dark-gray border-xsm-medium-gray flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center font-bold text-xs">
              <Youtube className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">YouTube Brands</span>
              <span className="text-base font-bold text-foreground">{stats?.youtube_brands ?? 0} brand accounts</span>
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border bg-xsm-dark-gray border-xsm-medium-gray flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold text-xs">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">TikTok Accounts</span>
              <span className="text-base font-bold text-foreground">{stats?.tiktok_accounts ?? 0} active transfers</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-xsm-dark-gray rounded-xl border border-xsm-medium-gray overflow-hidden">
        
        {/* Controls Bar */}
        <div className="p-4 border-b border-xsm-medium-gray flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search & Filter */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Gmail address or notes..."
                className="w-full bg-xsm-black/50 border border-xsm-medium-gray rounded-lg pl-9 pr-8 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-xsm-yellow transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-xsm-black/50 border border-xsm-medium-gray rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-xsm-yellow"
            >
              <option value="all">All Statuses</option>
              <option value="available">Available (0 used)</option>
              <option value="partial">Partially Used</option>
              <option value="full">Full Capacity</option>
              <option value="disabled">Disabled</option>
            </select>

            {/* Platform Filter */}
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="bg-xsm-black/50 border border-xsm-medium-gray rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-xsm-yellow"
            >
              <option value="all">All Platforms</option>
              <option value="youtube">YouTube Only</option>
              <option value="tiktok">TikTok Only</option>
              <option value="both">Both Platforms</option>
            </select>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-xsm-black/50 border border-xsm-medium-gray rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-xsm-yellow"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="most_available">Most Available Slots</option>
              <option value="least_used">Least Used</option>
              <option value="most_used">Most Used</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg border border-xsm-medium-gray hover:bg-xsm-medium-gray/40 text-foreground transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleOpenSettings}
              className="px-3 py-2 rounded-lg border border-xsm-medium-gray hover:bg-xsm-medium-gray/40 text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2 rounded-lg bg-xsm-yellow hover:bg-yellow-400 text-black text-xs font-bold flex items-center gap-1.5 transition-colors shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Add Email</span>
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-xsm-medium-gray bg-xsm-black/30 text-muted-foreground font-semibold">
                <th className="py-3 px-4">Gmail Address</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Platform</th>
                <th className="py-3 px-3">Active Deals / Cap</th>
                <th className="py-3 px-3 text-center">YT Brands</th>
                <th className="py-3 px-3 text-center">TikTok</th>
                <th className="py-3 px-3 text-center">Available Slots</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-xsm-medium-gray/40">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-xsm-yellow" />
                    <span>Loading managed Gmail accounts...</span>
                  </td>
                </tr>
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Mail className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm font-semibold text-foreground">No Gmail accounts found</p>
                    <p className="text-xs mt-1">Click "+ Add Email" to register your first operational Gmail.</p>
                  </td>
                </tr>
              ) : (
                emails.map((e) => {
                  const dealPercent = Math.min(100, Math.round((e.active_deals_count / e.max_active_deals) * 100));
                  return (
                    <tr key={e.id} className="hover:bg-xsm-medium-gray/20 transition-colors">
                      {/* Email & Notes */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground hover:underline cursor-pointer" onClick={() => handleOpenDetails(e)}>
                            {e.email_address}
                          </span>
                        </div>
                        {e.notes && (
                          <span className="text-[11px] text-muted-foreground block truncate max-w-xs mt-0.5">
                            {e.notes}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {renderStatusBadge(e.calculated_status)}
                      </td>

                      {/* Platform */}
                      <td className="py-3 px-3">
                        {e.platform === 'both' && (
                          <span className="text-[11px] font-medium bg-gray-500/10 text-gray-400 px-2 py-0.5 rounded">
                            Both
                          </span>
                        )}
                        {e.platform === 'youtube' && (
                          <span className="text-[11px] font-medium bg-red-500/10 text-red-400 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                            <Youtube className="w-3 h-3" /> YouTube
                          </span>
                        )}
                        {e.platform === 'tiktok' && (
                          <span className="text-[11px] font-medium bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                            <Film className="w-3 h-3" /> TikTok
                          </span>
                        )}
                      </td>

                      {/* Deals & Capacity Bar */}
                      <td className="py-3 px-3">
                        <div className="w-32">
                          <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                            <span className="text-foreground">{e.active_deals_count} / {e.max_active_deals}</span>
                            <span className="text-muted-foreground">{dealPercent}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-xsm-black/60 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                dealPercent >= 100 
                                  ? 'bg-rose-500' 
                                  : dealPercent >= 60 
                                  ? 'bg-amber-500' 
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${dealPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* YouTube Brands */}
                      <td className="py-3 px-3 text-center font-medium">
                        <span className="text-foreground">{e.active_brands_count}</span>
                        <span className="text-muted-foreground text-[10px]"> / {e.max_brand_accounts}</span>
                      </td>

                      {/* TikTok */}
                      <td className="py-3 px-3 text-center font-medium text-foreground">
                        {e.active_tiktok_count}
                      </td>

                      {/* Available Slots */}
                      <td className="py-3 px-3 text-center">
                        <span className={`font-black text-sm ${e.available_slots > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {e.available_slots}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenDetails(e)}
                            className="p-1.5 rounded hover:bg-xsm-medium-gray/40 text-muted-foreground hover:text-foreground transition-colors"
                            title="View Allocations & History"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenCapacity(e)}
                            className="p-1.5 rounded hover:bg-xsm-medium-gray/40 text-muted-foreground hover:text-amber-500 transition-colors"
                            title="Change Capacity"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenEdit(e)}
                            className="p-1.5 rounded hover:bg-xsm-medium-gray/40 text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => promptToggleStatus(e)}
                            className={`p-1.5 rounded hover:bg-xsm-medium-gray/40 transition-colors ${
                              e.status === 'enabled' ? 'text-emerald-400 hover:text-rose-400' : 'text-gray-500 hover:text-emerald-400'
                            }`}
                            title={e.status === 'enabled' ? 'Click to Disable Gmail (stops assignments)' : 'Click to Enable Gmail (resumes assignments)'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => promptDeleteEmail(e)}
                            className="p-1.5 rounded hover:bg-xsm-medium-gray/40 text-muted-foreground hover:text-rose-500 transition-colors"
                            title="Delete Gmail Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ADD EMAIL MODAL */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-xsm-dark-gray border border-xsm-medium-gray rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-xsm-medium-gray pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Mail className="w-4 h-4 text-xsm-yellow" />
                Add Operational Gmail
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Gmail Address *
                </label>
                <input
                  type="email"
                  required
                  value={emailForm.email_address}
                  onChange={(e) => setEmailForm({ ...emailForm, email_address: e.target.value })}
                  placeholder="e.g. transferagent01@gmail.com"
                  className="w-full bg-xsm-black/50 border border-xsm-medium-gray rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-xsm-yellow"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Platform Compatibility
                  </label>
                  <select
                    value={emailForm.platform}
                    onChange={(e) => setEmailForm({ ...emailForm, platform: e.target.value as any })}
                    className="w-full bg-xsm-black/50 border border-xsm-medium-gray rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-xsm-yellow"
                  >
                    <option value="both">Both (YouTube & TikTok)</option>
                    <option value="youtube">YouTube Only</option>
                    <option value="tiktok">TikTok Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Initial Status
                  </label>
                  <select
                    value={emailForm.status}
                    onChange={(e) => setEmailForm({ ...emailForm, status: e.target.value as any })}
                    className="w-full bg-xsm-black/50 border border-xsm-medium-gray rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-xsm-yellow"
                  >
                    <option value="enabled">Enabled (Active)</option>
                    <option value="disabled">Disabled (Draft)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Max Active Deals
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={emailForm.max_active_deals}
                    onChange={(e) => setEmailForm({ ...emailForm, max_active_deals: parseInt(e.target.value) || 1 })}
                    className="w-full bg-xsm-black/50 border border-xsm-medium-gray rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-xsm-yellow"
                  />
                  <span className="text-[10px] text-muted-foreground">Concurrent transactions</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Max Brand Accounts
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={emailForm.max_brand_accounts}
                    onChange={(e) => setEmailForm({ ...emailForm, max_brand_accounts: parseInt(e.target.value) || 1 })}
                    className="w-full bg-xsm-black/50 border border-xsm-medium-gray rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-xsm-yellow"
                  />
                  <span className="text-[10px] text-muted-foreground">YouTube brand accounts</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Internal Notes (Optional)
                </label>
                <textarea
                  value={emailForm.notes}
                  onChange={(e) => setEmailForm({ ...emailForm, notes: e.target.value })}
                  placeholder="e.g. Dedicated for high-value YouTube transfers"
                  rows={2}
                  className="w-full bg-xsm-black/50 border border-xsm-medium-gray rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-xsm-yellow resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-xsm-medium-gray text-muted-foreground hover:bg-xsm-medium-gray/40 font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg bg-xsm-yellow hover:bg-yellow-400 text-black font-bold text-xs transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Add to Pool'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT EMAIL MODAL */}
      {/* ========================================================================= */}
      {showEditModal && selectedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-xsm-dark-gray border border-xsm-medium-gray rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-xsm-medium-gray pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-xsm-yellow" />
                Edit Gmail Details
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Gmail Address
                </label>
                <input
                  type="email"
                  required
                  value={emailForm.email_address}
                  onChange={(e) => setEmailForm({ ...emailForm, email_address: e.target.value })}
                  className="w-full bg-xsm-black/50 border border-xsm-medium-gray rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-xsm-yellow"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Platform Compatibility
                  </label>
                  <select
                    value={emailForm.platform}
                    onChange={(e) => setEmailForm({ ...emailForm, platform: e.target.value as any })}
                    className="w-full bg-xsm-black/50 border border-xsm-medium-gray rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-xsm-yellow"
                  >
                    <option value="both">Both (YouTube & TikTok)</option>
                    <option value="youtube">YouTube Only</option>
                    <option value="tiktok">TikTok Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Account Status
                  </label>
                  <select
                    value={emailForm.status}
                    onChange={(e) => setEmailForm({ ...emailForm, status: e.target.value as any })}
                    className="w-full bg-xsm-black/50 border border-xsm-medium-gray rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-xsm-yellow font-medium"
                  >
                    <option value="enabled">🟢 Enabled (Active)</option>
                    <option value="disabled">⚫ Disabled (Paused)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Internal Notes
                </label>
                <textarea
                  value={emailForm.notes}
                  onChange={(e) => setEmailForm({ ...emailForm, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-xsm-black/50 border border-xsm-medium-gray rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-xsm-yellow resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-xsm-medium-gray text-muted-foreground hover:bg-xsm-medium-gray/40 font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg bg-xsm-yellow hover:bg-yellow-400 text-black font-bold text-xs transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CAPACITY ADJUSTMENT MODAL */}
      {/* ========================================================================= */}
      {showCapacityModal && selectedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-xsm-dark-gray border border-xsm-medium-gray rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-xsm-medium-gray pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-xsm-yellow" />
                  Adjust Capacity Limits
                </h3>
                <span className="text-xs text-muted-foreground block font-mono">{selectedEmail.email_address}</span>
              </div>
              <button onClick={() => setShowCapacityModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-xsm-black/40 p-3 rounded-lg border border-xsm-medium-gray/40 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Currently Active Deals:</span>
                <span className="font-bold text-foreground">{selectedEmail.active_deals_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Active YouTube Brands:</span>
                <span className="font-bold text-foreground">{selectedEmail.active_brands_count}</span>
              </div>
            </div>

            <form onSubmit={handleCapacitySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Maximum Active Deals
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCapacityForm(prev => ({ ...prev, max_active_deals: Math.max(1, prev.max_active_deals - 1) }))}
                    className="w-9 h-9 rounded-lg border border-xsm-medium-gray bg-xsm-black/50 text-foreground font-bold hover:bg-xsm-medium-gray/40"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={capacityForm.max_active_deals}
                    onChange={(e) => setCapacityForm({ ...capacityForm, max_active_deals: parseInt(e.target.value) || 1 })}
                    className="flex-1 text-center font-bold bg-xsm-black/50 border border-xsm-medium-gray rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-xsm-yellow"
                  />
                  <button
                    type="button"
                    onClick={() => setCapacityForm(prev => ({ ...prev, max_active_deals: prev.max_active_deals + 1 }))}
                    className="w-9 h-9 rounded-lg border border-xsm-medium-gray bg-xsm-black/50 text-foreground font-bold hover:bg-xsm-medium-gray/40"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Maximum YouTube Brand Accounts
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCapacityForm(prev => ({ ...prev, max_brand_accounts: Math.max(1, prev.max_brand_accounts - 1) }))}
                    className="w-9 h-9 rounded-lg border border-xsm-medium-gray bg-xsm-black/50 text-foreground font-bold hover:bg-xsm-medium-gray/40"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={capacityForm.max_brand_accounts}
                    onChange={(e) => setCapacityForm({ ...capacityForm, max_brand_accounts: parseInt(e.target.value) || 1 })}
                    className="flex-1 text-center font-bold bg-xsm-black/50 border border-xsm-medium-gray rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-xsm-yellow"
                  />
                  <button
                    type="button"
                    onClick={() => setCapacityForm(prev => ({ ...prev, max_brand_accounts: prev.max_brand_accounts + 1 }))}
                    className="w-9 h-9 rounded-lg border border-xsm-medium-gray bg-xsm-black/50 text-foreground font-bold hover:bg-xsm-medium-gray/40"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCapacityModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-xsm-medium-gray text-muted-foreground hover:bg-xsm-medium-gray/40 font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg bg-xsm-yellow hover:bg-yellow-400 text-black font-bold text-xs transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Save Capacity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAILS DRAWER / MODAL */}
      {/* ========================================================================= */}
      {showDetailModal && selectedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
          <div className="bg-xsm-dark-gray border border-xsm-medium-gray rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-5">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-xsm-medium-gray pb-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-foreground">
                    {selectedEmail.email_address}
                  </h3>
                  {renderStatusBadge(selectedEmail.calculated_status)}
                  <button
                    type="button"
                    onClick={() => promptToggleStatus(selectedEmail)}
                    className={`ml-1 px-2.5 py-1 rounded-lg border text-xs font-bold transition-colors flex items-center gap-1.5 ${
                      selectedEmail.status === 'enabled'
                        ? 'border-rose-500/40 text-rose-400 hover:bg-rose-500/10'
                        : 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
                    }`}
                    title={selectedEmail.status === 'enabled' ? 'Click to Disable Account' : 'Click to Enable Account'}
                  >
                    <Power className="w-3 h-3" />
                    <span>{selectedEmail.status === 'enabled' ? 'Disable' : 'Enable'}</span>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Platform compatibility: <strong className="text-foreground capitalize">{selectedEmail.platform}</strong>
                  {selectedEmail.notes && <> &bull; <span className="italic">{selectedEmail.notes}</span></>}
                </p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Capacity KPI snapshot */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 rounded-xl border bg-xsm-black/30 border-xsm-medium-gray/50">
                <span className="text-muted-foreground block">Max Deals</span>
                <span className="text-base font-bold text-foreground">{selectedEmail.max_active_deals}</span>
              </div>
              <div className="p-3 rounded-xl border bg-xsm-black/30 border-xsm-medium-gray/50">
                <span className="text-muted-foreground block">Active Deals</span>
                <span className="text-base font-bold text-foreground">{detailData?.active_allocations.length ?? selectedEmail.active_deals_count}</span>
              </div>
              <div className="p-3 rounded-xl border bg-xsm-black/30 border-xsm-medium-gray/50">
                <span className="text-muted-foreground block">Available Slots</span>
                <span className="text-base font-bold text-emerald-500">{selectedEmail.available_slots}</span>
              </div>
              <div className="p-3 rounded-xl border bg-xsm-black/30 border-xsm-medium-gray/50">
                <span className="text-muted-foreground block">YouTube Brands</span>
                <span className="text-base font-bold text-foreground">{detailData?.brand_accounts.length ?? selectedEmail.active_brands_count} / {selectedEmail.max_brand_accounts}</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-xsm-medium-gray gap-4 text-xs font-bold">
              <button
                onClick={() => setDetailTab('allocations')}
                className={`pb-2.5 transition-colors border-b-2 ${
                  detailTab === 'allocations'
                    ? 'border-xsm-yellow text-xsm-yellow'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Active Allocations ({detailData?.active_allocations.length ?? 0})
              </button>
              <button
                onClick={() => setDetailTab('brands')}
                className={`pb-2.5 transition-colors border-b-2 ${
                  detailTab === 'brands'
                    ? 'border-xsm-yellow text-xsm-yellow'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                YouTube Brands ({detailData?.brand_accounts.length ?? 0})
              </button>
              <button
                onClick={() => setDetailTab('history')}
                className={`pb-2.5 transition-colors border-b-2 ${
                  detailTab === 'history'
                    ? 'border-xsm-yellow text-xsm-yellow'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Audit History ({detailData?.history.length ?? 0})
              </button>
            </div>

            {/* Tab 1: Active Allocations */}
            {detailTab === 'allocations' && (
              <div className="space-y-3">
                {detailLoading ? (
                  <div className="py-8 text-center text-muted-foreground">Loading allocations...</div>
                ) : !detailData || detailData.active_allocations.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    No active deals currently assigned to this Gmail. Slots are fully available.
                  </div>
                ) : (
                  <div className="border border-xsm-medium-gray rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-xsm-black/40 text-muted-foreground border-b border-xsm-medium-gray font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">Deal / TXN</th>
                          <th className="py-2.5 px-3">Buyer</th>
                          <th className="py-2.5 px-3">Platform</th>
                          <th className="py-2.5 px-3">Channel / Asset</th>
                          <th className="py-2.5 px-3">Assigned Date</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-xsm-medium-gray/30">
                        {detailData.active_allocations.map((alloc) => (
                          <tr key={alloc.id} className="hover:bg-xsm-medium-gray/10">
                            <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                              {alloc.transaction_id || `Deal #${alloc.deal_id}`}
                            </td>
                            <td className="py-2.5 px-3 text-foreground">
                              @{alloc.buyer_username || `User #${alloc.buyer_id}`}
                            </td>
                            <td className="py-2.5 px-3 capitalize">
                              {alloc.platform}
                            </td>
                            <td className="py-2.5 px-3 text-foreground truncate max-w-xs">
                              {alloc.channel_title || alloc.account_identifier}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {new Date(alloc.assigned_at).toLocaleDateString()}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => handleOpenReassign(alloc)}
                                className="px-2.5 py-1 rounded bg-xsm-yellow/20 hover:bg-xsm-yellow text-xsm-yellow hover:text-black font-bold text-[11px] transition-colors"
                              >
                                Reassign
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Brand Accounts */}
            {detailTab === 'brands' && (
              <div className="space-y-3">
                {detailLoading ? (
                  <div className="py-8 text-center text-muted-foreground">Loading brand accounts...</div>
                ) : !detailData || detailData.brand_accounts.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    No YouTube Brand Accounts registered under this Gmail yet.
                  </div>
                ) : (
                  <div className="border border-xsm-medium-gray rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-xsm-black/40 text-muted-foreground border-b border-xsm-medium-gray font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">Brand Name</th>
                          <th className="py-2.5 px-3">Deal TXN</th>
                          <th className="py-2.5 px-3">Buyer</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-xsm-medium-gray/30">
                        {detailData.brand_accounts.map((brand) => (
                          <tr key={brand.id} className="hover:bg-xsm-medium-gray/10">
                            <td className="py-2.5 px-3 font-bold text-foreground">
                              {brand.brand_name}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {brand.transaction_id || `Deal #${brand.deal_id}`}
                            </td>
                            <td className="py-2.5 px-3">
                              @{brand.buyer_username || `User #${brand.buyer_id}`}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                                {brand.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {new Date(brand.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: History Audit Log */}
            {detailTab === 'history' && (
              <div className="space-y-3">
                {detailLoading ? (
                  <div className="py-8 text-center text-muted-foreground">Loading history...</div>
                ) : !detailData || detailData.history.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    No history logged for this account yet.
                  </div>
                ) : (
                  <div className="border border-xsm-medium-gray rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-xsm-black/40 text-muted-foreground border-b border-xsm-medium-gray font-semibold sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Action</th>
                          <th className="py-2.5 px-3">Admin</th>
                          <th className="py-2.5 px-3">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-xsm-medium-gray/30">
                        {detailData.history.map((hist) => (
                          <tr key={hist.id} className="hover:bg-xsm-medium-gray/10">
                            <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                              {new Date(hist.created_at).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-foreground capitalize">
                              {hist.action.replace('_', ' ')}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {hist.admin_username ? `@${hist.admin_username}` : 'System'}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {hist.details || hist.new_value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-xsm-medium-gray">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 rounded-lg bg-xsm-medium-gray/40 hover:bg-xsm-medium-gray text-foreground font-semibold text-xs"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REASSIGN MODAL */}
      {/* ========================================================================= */}
      {showReassignModal && reassignDealData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-xsm-dark-gray border border-xsm-medium-gray rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-xsm-medium-gray pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-xsm-yellow" />
                Reassign Deal to New Gmail
              </h3>
              <button onClick={() => setShowReassignModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-xsm-black/40 p-3 rounded-lg border border-xsm-medium-gray/40 text-xs space-y-1">
              <div>
                <span className="text-muted-foreground">Deal:</span>{' '}
                <strong className="text-foreground">{reassignDealData.transaction_id || `Deal #${reassignDealData.deal_id}`}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Current Gmail:</span>{' '}
                <strong className="text-amber-500">{selectedEmail?.email_address}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Asset:</span>{' '}
                <span className="text-foreground">{reassignDealData.channel_title || reassignDealData.account_identifier}</span>
              </div>
            </div>

            <form onSubmit={handleReassignSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Select Target Gmail *
                </label>
                <select
                  required
                  value={reassignTargetEmailId}
                  onChange={(e) => setReassignTargetEmailId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-xsm-black/50 border border-xsm-medium-gray rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-xsm-yellow"
                >
                  <option value="">-- Choose available Gmail from pool --</option>
                  {emails
                    .filter(e => e.id !== selectedEmail?.id && e.status === 'enabled')
                    .map(e => (
                      <option key={e.id} value={e.id}>
                        {e.email_address} ({e.available_slots} slots open, {e.active_deals_count}/{e.max_active_deals})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Reassignment Reason (Audit Record)
                </label>
                <input
                  type="text"
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="e.g. Current email undergoing maintenance"
                  className="w-full bg-xsm-black/50 border border-xsm-medium-gray rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-xsm-yellow"
                />
              </div>

              <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                <input
                  type="checkbox"
                  id="allowOverride"
                  checked={reassignAllowOverride}
                  onChange={(e) => setReassignAllowOverride(e.target.checked)}
                  className="rounded text-xsm-yellow focus:ring-xsm-yellow"
                />
                <label htmlFor="allowOverride" className="text-xs text-amber-600 dark:text-yellow-400 font-medium cursor-pointer">
                  Allow Capacity Override (Force assign even if full)
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReassignModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-xsm-medium-gray text-muted-foreground hover:bg-xsm-medium-gray/40 font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassignSubmitting || !reassignTargetEmailId}
                  className="flex-1 py-2.5 rounded-lg bg-xsm-yellow hover:bg-yellow-400 text-black font-bold text-xs transition-colors disabled:opacity-50"
                >
                  {reassignSubmitting ? 'Reassigning...' : 'Confirm Reassignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SETTINGS MODAL */}
      {/* ========================================================================= */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-xsm-dark-gray border border-xsm-medium-gray rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-xsm-medium-gray pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Settings className="w-4 h-4 text-xsm-yellow" />
                Email Pool Configuration
              </h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {settingsLoading ? (
              <div className="py-8 text-center text-muted-foreground text-xs">Loading settings...</div>
            ) : (
              <form onSubmit={handleSettingsSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Email Allocation Method
                  </label>
                  <select
                    value={settingsForm.allocation_method}
                    onChange={(e) => setSettingsForm({ ...settingsForm, allocation_method: e.target.value as any })}
                    className="w-full bg-xsm-black/50 border border-xsm-medium-gray rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-xsm-yellow"
                  >
                    <option value="least_used">Least Used (Recommended — Balances load)</option>
                    <option value="first_available">First Available (Fills sequentially)</option>
                    <option value="round_robin">Round Robin (Cycles through pool)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">
                      Default Deal Capacity
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settingsForm.default_max_capacity}
                      onChange={(e) => setSettingsForm({ ...settingsForm, default_max_capacity: parseInt(e.target.value) || 5 })}
                      className="w-full bg-xsm-black/50 border border-xsm-medium-gray rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-xsm-yellow"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">
                      Default Brand Capacity
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settingsForm.default_max_brand_accounts}
                      onChange={(e) => setSettingsForm({ ...settingsForm, default_max_brand_accounts: parseInt(e.target.value) || 5 })}
                      className="w-full bg-xsm-black/50 border border-xsm-medium-gray rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-xsm-yellow"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Low Capacity Warning Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={settingsForm.low_capacity_threshold}
                    onChange={(e) => setSettingsForm({ ...settingsForm, low_capacity_threshold: parseInt(e.target.value) || 0 })}
                    className="w-full bg-xsm-black/50 border border-xsm-medium-gray rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-xsm-yellow"
                  />
                  <span className="text-[10px] text-muted-foreground">Alert when available slots &le; threshold</span>
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsForm.auto_assignment_enabled}
                      onChange={(e) => setSettingsForm({ ...settingsForm, auto_assignment_enabled: e.target.checked })}
                      className="rounded text-xsm-yellow focus:ring-xsm-yellow"
                    />
                    <span>Automatic Gmail Assignment for paid orders</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsForm.allow_manager_access}
                      onChange={(e) => setSettingsForm({ ...settingsForm, allow_manager_access: e.target.checked })}
                      className="rounded text-xsm-yellow focus:ring-xsm-yellow"
                    />
                    <span>Allow Staff Managers access to Email Pool Manager</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsForm.no_available_email_alert}
                      onChange={(e) => setSettingsForm({ ...settingsForm, no_available_email_alert: e.target.checked })}
                      className="rounded text-xsm-yellow focus:ring-xsm-yellow"
                    />
                    <span>Send In-App Warning when all pool emails are exhausted</span>
                  </label>
                </div>

                <div className="flex gap-2 pt-3 border-t border-xsm-medium-gray">
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(false)}
                    className="flex-1 py-2.5 rounded-lg border border-xsm-medium-gray text-muted-foreground hover:bg-xsm-medium-gray/40 font-semibold text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-lg bg-xsm-yellow hover:bg-yellow-400 text-black font-bold text-xs transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* CUSTOM CONFIRMATION & ALERT MODAL */}
      {/* ========================================================================= */}
      <DealAlertModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        details={confirmModal.details}
        actionText={confirmModal.actionText}
        cancelText={confirmModal.cancelText}
        isDestructive={confirmModal.isDestructive}
        onAction={confirmModal.onAction}
      />

    </div>
  );
};

export default EmailPoolManager;
