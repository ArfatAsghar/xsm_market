import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Youtube, 
  Instagram, 
  Facebook, 
  Twitter, 
  Send, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  SlidersHorizontal,
  Power,
  ShieldCheck,
  Info
} from 'lucide-react';
import { getExtractorSettings, updateExtractorSettings } from '@/services/admin';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/useAuth';

interface PlatformMeta {
  key: string;
  name: string;
  icon: any;
  color: string;
  bgGradient: string;
  borderColor: string;
  description: string;
}

const PLATFORMS: PlatformMeta[] = [
  {
    key: 'youtube',
    name: 'YouTube',
    icon: Youtube,
    color: '#FF0000',
    bgGradient: 'from-red-950/40 via-red-900/10 to-transparent',
    borderColor: 'border-red-500/30',
    description: 'Auto-extracts subscriber count, profile picture, channel title & verifies bio code for YouTube channels & handles.'
  },
  {
    key: 'tiktok',
    name: 'TikTok',
    icon: Zap,
    color: '#00F2FE',
    bgGradient: 'from-cyan-950/40 via-pink-900/10 to-transparent',
    borderColor: 'border-cyan-500/30',
    description: 'Auto-extracts followers, avatar & checks bio code via RapidAPI / web scraper for public TikTok profiles.'
  },
  {
    key: 'instagram',
    name: 'Instagram',
    icon: Instagram,
    color: '#E1306C',
    bgGradient: 'from-purple-950/40 via-pink-900/10 to-transparent',
    borderColor: 'border-pink-500/30',
    description: 'Extracts Instagram follower metrics, biography text & verification token via API proxy.'
  },
  {
    key: 'facebook',
    name: 'Facebook',
    icon: Facebook,
    color: '#1877F2',
    bgGradient: 'from-blue-950/40 via-blue-900/10 to-transparent',
    borderColor: 'border-blue-500/30',
    description: 'Crawls Facebook public pages & profiles for follower metrics and bio verification match.'
  },
  {
    key: 'twitter',
    name: 'Twitter / X',
    icon: Twitter,
    color: '#1DA1F2',
    bgGradient: 'from-slate-900 via-slate-800/40 to-transparent',
    borderColor: 'border-slate-500/30',
    description: 'Scrapes Twitter/X user metrics, profile bio & verification code via syndication APIs.'
  },
  {
    key: 'telegram',
    name: 'Telegram',
    icon: Send,
    color: '#229ED9',
    bgGradient: 'from-sky-950/40 via-sky-900/10 to-transparent',
    borderColor: 'border-sky-500/30',
    description: 'Extracts public Telegram channel subscriber count, title, avatar & description.'
  }
];

interface AdminExtractorControlsProps {
  onClose?: () => void;
  isCompactModal?: boolean;
}

const AdminExtractorControls: React.FC<AdminExtractorControlsProps> = ({ 
  onClose,
  isCompactModal = false 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = (user as any)?.role === 'admin' || (user as any)?.isAdmin === true;

  const [settings, setSettings] = useState<Record<string, boolean>>({
    youtube: true,
    tiktok: true,
    instagram: true,
    facebook: true,
    twitter: true,
    telegram: true
  });
  const [loading, setLoading] = useState(true);
  const [togglingPlatform, setTogglingPlatform] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await getExtractorSettings();
      if (data && data.settings) {
        setSettings(data.settings);
      }
    } catch (err: any) {
      console.error('Error fetching extractor settings:', err);
      toast({
        variant: 'destructive',
        title: 'Failed to load extractor settings',
        description: err.message || 'Could not connect to settings API'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleToggle = async (platformKey: string) => {
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: 'Only platform administrators can toggle API extractors.'
      });
      return;
    }

    const currentVal = settings[platformKey] !== false;
    const newVal = !currentVal;

    try {
      setTogglingPlatform(platformKey);
      const res = await updateExtractorSettings(platformKey, newVal);
      if (res && res.settings) {
        setSettings(res.settings);
      } else {
        setSettings(prev => ({ ...prev, [platformKey]: newVal }));
      }

      toast({
        title: newVal ? `✅ ${platformKey.toUpperCase()} Extractor Enabled` : `⚡ ${platformKey.toUpperCase()} Extractor Paused`,
        description: newVal 
          ? `Users can now auto-extract ${platformKey} channels automatically.` 
          : `${platformKey} listings will now smoothly route to Cloud Sync fallback for manual admin review.`
      });
    } catch (err: any) {
      console.error('Toggle error:', err);
      toast({
        variant: 'destructive',
        title: 'Failed to update extractor',
        description: err.message || 'Server error occurred'
      });
    } finally {
      setTogglingPlatform(null);
    }
  };

  const handleBulkToggle = async (enable: boolean) => {
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: 'Only platform administrators can toggle API extractors.'
      });
      return;
    }

    try {
      setBulkUpdating(true);
      const newSettings: Record<string, boolean> = {};
      PLATFORMS.forEach(p => {
        newSettings[p.key] = enable;
      });

      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://xsmmarket.com/api');
      const response = await fetch(`${apiUrl}/admin/extractor-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ settings: newSettings })
      });

      if (!response.ok) {
        throw new Error('Failed to update bulk settings');
      }

      const res = await response.json();
      if (res.settings) {
        setSettings(res.settings);
      } else {
        setSettings(newSettings);
      }

      toast({
        title: enable ? '✅ All Extractors Online' : '⚡ All Extractors Paused (Cloud Sync Active)',
        description: enable
          ? 'Automated profile extraction restored for all 6 platforms.'
          : 'All platforms will smoothly route to Cloud Sync mode and require admin approval.'
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Bulk Update Failed',
        description: err.message || 'Server error'
      });
    } finally {
      setBulkUpdating(false);
    }
  };

  const activeCount = Object.values(settings).filter(Boolean).length;
  const totalCount = PLATFORMS.length;

  return (
    <div className={`space-y-6 ${isCompactModal ? 'p-2' : 'p-4 sm:p-6'}`}>
      {/* Top Banner / Summary */}
      <div className="bg-gradient-to-r from-xsm-dark-gray to-xsm-black rounded-2xl border border-xsm-medium-gray p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                API Extractor Controls
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  activeCount === totalCount
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                    : activeCount === 0
                    ? 'bg-red-950/80 text-red-400 border-red-500/40'
                    : 'bg-amber-950/80 text-amber-400 border-amber-500/40'
                }`}>
                  {activeCount} / {totalCount} Online
                </span>
              </h2>
            </div>
            <p className="text-xs text-xsm-light-gray max-w-2xl leading-relaxed">
              Turn off API extractors whenever a social platform blocks requests, changes its structure, or RapidAPI limits are reached. 
              When a platform is disabled, sellers automatically experience the seamless <strong className="text-amber-400">"Cloud Sync"</strong> flow and their submissions route to <strong className="text-white">Admin Review</strong> for your approval.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleBulkToggle(true)}
              disabled={bulkUpdating || loading || activeCount === totalCount}
              className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
              title="Enable all extractors"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Enable All</span>
            </button>
            <button
              onClick={() => handleBulkToggle(false)}
              disabled={bulkUpdating || loading || activeCount === 0}
              className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
              title="Pause all extractors into Cloud Sync mode"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Disable All</span>
            </button>
            <button
              onClick={fetchSettings}
              disabled={loading}
              className="p-2 bg-xsm-medium-gray hover:bg-xsm-border border border-xsm-border text-xsm-light-gray rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Notice info card */}
      <div className="bg-blue-950/30 border border-blue-500/30 rounded-xl p-3.5 flex items-start gap-3 text-xs text-blue-200">
        <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold text-blue-300">How it behaves for users:</p>
          <p className="text-gray-300 text-[11px] leading-relaxed">
            When you switch an extractor <strong>OFF</strong>, users pasting that platform's URL will instantly see <span className="text-amber-300 font-semibold">"Cloud Sync Active ⚡"</span>. They can still fill in price and upload screenshots. The listing is saved as <code className="bg-black/50 px-1 py-0.5 rounded text-amber-300">status: pending</code> and appears in your <strong>Review Listings</strong> tab for one-click follower enrichment &amp; approval!
          </p>
        </div>
      </div>

      {/* Grid of Platform Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PLATFORMS.map((platform) => {
          const isEnabled = settings[platform.key] !== false;
          const isToggling = togglingPlatform === platform.key || bulkUpdating;
          const IconComponent = platform.icon;

          return (
            <div
              key={platform.key}
              className={`rounded-2xl border p-5 transition-all relative overflow-hidden bg-gradient-to-br ${platform.bgGradient} ${
                isEnabled ? 'border-emerald-500/30 shadow-lg shadow-emerald-950/20' : 'border-amber-500/30 bg-xsm-dark-gray/60'
              }`}
              style={{ background: 'var(--xsm-dark-gray)' }}
            >
              {/* Top Row: Icon, Name & Switch */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md shrink-0"
                    style={{ backgroundColor: `${platform.color}25`, border: `1px solid ${platform.color}50` }}
                  >
                    <IconComponent className="w-5 h-5" style={{ color: platform.color }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">{platform.name}</h3>
                    <span className="text-[11px] font-mono text-xsm-light-gray uppercase tracking-wider">
                      {platform.key} extractor
                    </span>
                  </div>
                </div>

                {/* Big Toggle Button */}
                <button
                  type="button"
                  onClick={() => handleToggle(platform.key)}
                  disabled={isToggling}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-xsm-black disabled:opacity-50 ${
                    isEnabled ? 'bg-emerald-600' : 'bg-zinc-700'
                  }`}
                  role="switch"
                  aria-checked={isEnabled}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                      isEnabled ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  >
                    {isToggling ? (
                      <div className="w-3 h-3 border-2 border-gray-600 border-t-amber-500 rounded-full animate-spin"></div>
                    ) : isEnabled ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Power className="w-3.5 h-3.5 text-zinc-500" />
                    )}
                  </span>
                </button>
              </div>

              {/* Status Badge */}
              <div className="mb-3">
                {isEnabled ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Live Auto-Extractor Active</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-950/80 border border-amber-500/40 text-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span>Cloud Sync Fallback Mode (Manual Review)</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-xsm-light-gray leading-relaxed mb-4 min-h-[36px]">
                {platform.description}
              </p>

              {/* Card Footer Action Note */}
              <div className="pt-3 border-t border-xsm-medium-gray/40 flex items-center justify-between text-[11px]">
                <span className="text-xsm-light-gray">
                  {isEnabled ? 'Users crawl via RapidAPI' : 'Users routed to Pending Review'}
                </span>
                <button
                  type="button"
                  onClick={() => handleToggle(platform.key)}
                  disabled={isToggling}
                  className={`font-semibold hover:underline cursor-pointer ${
                    isEnabled ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'
                  }`}
                >
                  {isEnabled ? 'Turn OFF' : 'Turn ON'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminExtractorControls;
