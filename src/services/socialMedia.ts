import { API_URL } from './auth';

// Extract social media profile data from URL
export const extractProfileData = async (url: string) => {
  try {
    const response = await fetch(`${API_URL}/social-media/extract-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to extract profile data');
    }

    return await response.json();
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

// Detect platform from URL
export const detectPlatform = (url: string): string | null => {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube';
  } else if (url.includes('instagram.com')) {
    return 'instagram';
  } else if (url.includes('tiktok.com')) {
    return 'tiktok';
  } else if (url.includes('twitter.com') || url.includes('x.com')) {
    return 'twitter';
  } else if (url.includes('facebook.com')) {
    return 'facebook';
  }
  return null;
};

// Format follower/subscriber numbers
export const formatFollowerCount = (count: number): string => {
  if (count >= 1000000000) {
    return `${(count / 1000000000).toFixed(1)}B`;
  } else if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};
