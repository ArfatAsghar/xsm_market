// API Configuration
// Get API URL from environment variables with fallback
const getApiUrl = () => {
  // In development, use the proxy setup
  if (import.meta.env.DEV) {
    return '/api';
  }
  // In production, use the current domain dynamically
  // This works for any domain: yourdomain.com, localhost, staging.yourdomain.com, etc.
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port ? ':' + window.location.port : '';
  return `${protocol}//${hostname}${port}/api`;
};

const getBaseUrl = () => {
  // In development, use the proxy setup
  if (import.meta.env.DEV) {
    return '/'; // Use relative path for development proxy
  }
  // In production, use the current domain dynamically
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port ? ':' + window.location.port : '';
  return `${protocol}//${hostname}${port}`;
};

export const API_CONFIG = {
  // Backend API URL for REST calls
  BASE_URL: getBaseUrl(),
  
  // WebSocket URL for real-time features
  WS_URL: import.meta.env.DEV ? 'http://localhost:3001' : getBaseUrl().replace('http:', 'ws:').replace('https:', 'wss:'),
  
  // Chat upload endpoint
  CHAT_UPLOAD_URL: `${getApiUrl()}/chat`,
  
  // File server URL for serving uploaded files
  FILE_SERVER_URL: import.meta.env.DEV ? 'http://localhost:5000' : getBaseUrl(),
};

// Helper function to get full file URL
export const getFileUrl = (relativePath: string): string => {
  if (relativePath.startsWith('http')) {
    return relativePath; // Already a full URL
  }
  return `${API_CONFIG.FILE_SERVER_URL}${relativePath}`;
};

// Helper function to get image URL with fallback
export const getImageUrl = (
  imagePath: string | { url?: string; data?: string; thumbnail?: string; path?: string } | null | undefined
): string | null => {
  if (!imagePath) return null;

  const normalizedPath =
    typeof imagePath === 'string'
      ? imagePath
      : imagePath.url || imagePath.data || imagePath.thumbnail || imagePath.path || '';

  if (!normalizedPath || normalizedPath === '0' || normalizedPath === 'NULL') {
    return null;
  }

  if (
    normalizedPath.startsWith('blob:') ||
    normalizedPath.startsWith('data:')
  ) {
    return normalizedPath;
  }

  if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
    const apiUploadsIndex = normalizedPath.indexOf('/api/uploads/');
    if (apiUploadsIndex !== -1) {
      return normalizedPath.substring(apiUploadsIndex + 4); // /uploads/...
    }

    const uploadsIndex = normalizedPath.indexOf('/uploads/');
    if (uploadsIndex !== -1) {
      return normalizedPath.substring(uploadsIndex); // /uploads/...
    }

    return normalizedPath;
  }

  if (normalizedPath.startsWith('/api/uploads/')) {
    return normalizedPath.replace('/api/uploads/', '/uploads/');
  }

  if (normalizedPath.startsWith('/uploads/')) {
    return normalizedPath;
  }

  if (normalizedPath.startsWith('uploads/')) {
    return `/${normalizedPath}`;
  }

  return normalizedPath;
};