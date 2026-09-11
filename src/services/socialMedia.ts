import { API_URL } from './auth';

// Normalize user input URL (handles handles like @user or short domains like tiktok.com/@user)
export const normalizeSocialUrl = (input: string): string => {
  let url = (input || '').trim();
  if (!url) return '';

  // Remove surrounding quotes or spaces
  url = url.replace(/^["']|["']$/g, '').trim();

  // If user enters "@handle", default to TikTok URL format
  if (url.startsWith('@')) {
    return `https://www.tiktok.com/${url}`;
  }

  // Prepend https:// if protocol is missing
  if (!/^https?:\/\//i.test(url)) {
    return `https://${url.replace(/^\/+/, '')}`;
  }

  return url;
};

// Supported social platforms configuration for UI display
export interface SocialPlatformConfig {
  id: 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'twitter' | 'telegram';
  name: string;
  badgeColor: string;
  iconBg: string;
  placeholder: string;
}

export const SUPPORTED_PLATFORMS: SocialPlatformConfig[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    badgeColor: 'text-red-500 border-red-500/30 bg-red-500/10',
    iconBg: 'bg-red-600',
    placeholder: 'youtube.com/@channel or channel URL',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    badgeColor: 'text-pink-400 border-pink-500/30 bg-pink-500/10',
    iconBg: 'bg-black text-pink-500',
    placeholder: 'tiktok.com/@username or @username',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    badgeColor: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    iconBg: 'bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600',
    placeholder: 'instagram.com/username or username',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    badgeColor: 'text-blue-500 border-blue-500/30 bg-blue-500/10',
    iconBg: 'bg-blue-600',
    placeholder: 'facebook.com/page or fb.com/profile',
  },
  {
    id: 'twitter',
    name: 'Twitter / X',
    badgeColor: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
    iconBg: 'bg-black text-white',
    placeholder: 'x.com/username or twitter.com/username',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    badgeColor: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    iconBg: 'bg-sky-500',
    placeholder: 't.me/channelname or @channelname',
  },
];

// Platform-Specific Ways of Earning Presets
export const PLATFORM_EARNING_METHODS: Record<string, string[]> = {
  youtube: [
    'YouTube Partner Program (AdSense)',
    'Channel Memberships & Badges',
    'Super Chat, Super Thanks & Stickers',
    'Brand Sponsorships & Integrations',
    'YouTube Shopping / Merch',
  ],
  tiktok: [
    'Creator Rewards Program',
    'LIVE Gifting & Diamonds',
    'TikTok Shop & Affiliate',
    'Creator Marketplace & Brand Deals',
    'Series & Subscriptions',
  ],
  instagram: [
    'Brand Partnerships & Sponsored Posts',
    'Instagram Subscriptions',
    'Affiliate Marketing & Shop',
    'Badges in Live Streams',
  ],
  facebook: [
    'In-Stream Ads for On-Demand & Live',
    'Performance Bonus Program',
    'Stars & Fan Subscriptions',
    'Branded Content & Partnerships',
  ],
  twitter: [
    'Creator Ads Revenue Sharing',
    'Creator Subscriptions',
    'Tips & Ticketed Spaces',
    'Brand Deals & Sponsored Posts',
  ],
  telegram: [
    'Telegram Channel Ad Revenue Sharing',
    'Paid Channel Subscriptions',
    'Sponsored Posts & Direct Ads',
    'Affiliate Marketing & Donations',
  ],
  default: [
    'Ad Revenue Sharing',
    'Brand Sponsorships',
    'Affiliate Marketing',
    'Digital Products & Merch',
    'Community Memberships',
  ],
};

// Extract social media profile data from URL
export const extractProfileData = async (url: string, verificationCode?: string) => {
  try {
    const normalizedUrl = normalizeSocialUrl(url);
    const response = await fetch(`${API_URL}/social-media/extract-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: normalizedUrl, verificationCode })
    });

    const responseText = await response.text();
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      const cleanMsg = responseText.replace(/<[^>]*>?/gm, '').trim();
      throw new Error(cleanMsg || `Server returned response code ${response.status}`);
    }

    if (!response.ok) {
      throw new Error(data?.message || data?.error || 'Failed to extract profile data');
    }

    return data;
  } catch (error) {
    console.error('Extract profile data error:', error);
    throw error;
  }
};

// Get suggested categories for a platform
export const getPlatformCategories = async (platform: string) => {
  try {
    const response = await fetch(`${API_URL}/social-media/categories/${platform}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch platform categories');
    }

    return await response.json();
  } catch (error) {
    console.error('Get platform categories error:', error);
    throw error;
  }
};

// Detect platform from URL or handle
export const detectPlatform = (url: string): string | null => {
  if (!url) return null;
  const lower = url.toLowerCase().trim();

  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return 'youtube';
  } else if (lower.includes('tiktok.com') || lower.includes('vm.tiktok') || lower.includes('vt.tiktok') || lower.startsWith('@')) {
    return 'tiktok';
  } else if (lower.includes('instagram.com') || lower.includes('instagr.am')) {
    return 'instagram';
  } else if (lower.includes('twitter.com') || lower.includes('x.com')) {
    return 'twitter';
  } else if (lower.includes('facebook.com') || lower.includes('fb.com') || lower.includes('fb.watch')) {
    return 'facebook';
  } else if (lower.includes('t.me') || lower.includes('telegram.me') || lower.includes('telegram.dog')) {
    return 'telegram';
  }
  return null;
};

// Format follower/subscriber numbers
export const formatFollowerCount = (count: number): string => {
  if (!count && count !== 0) return '0';
  if (count >= 1000000000) {
    return `${(count / 1000000000).toFixed(1)}B`;
  } else if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toLocaleString();
};
