// Simple base64 encoding/decoding for IDs to make URLs look better
// This doesn't provide security, just makes URLs look cleaner

const SECRET_KEY = 'xsm-market-2024'; // Simple key for obfuscation

export const encodeId = (id: number | string): string => {
  const idStr = id.toString();
  // Add some padding and mix with secret key
  const mixed = `${SECRET_KEY}-${idStr}-${Date.now().toString(36)}`;
  // Base64 encode for clean URL
  return btoa(mixed).replace(/[+/=]/g, (match) => {
    switch (match) {
      case '+': return '-';
      case '/': return '_';
      case '=': return '';
      default: return match;
    }
  });
};

export const decodeId = (encodedId: string): number | null => {
  try {
    // Reverse the URL-safe base64
    const base64 = encodedId.replace(/[-_]/g, (match) => {
      return match === '-' ? '+' : '/';
    });
    
    // Add padding if needed
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(base64 + padding);
    
    // Extract the original ID
    const parts = decoded.split('-');
    // The secret key is "xsm-market-2024" which becomes parts[0]-parts[1]-parts[2]
    if (parts.length >= 4 && `${parts[0]}-${parts[1]}-${parts[2]}` === SECRET_KEY) {
      const id = parseInt(parts[3]);
      if (!isNaN(id)) {
        return id;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error decoding ID:', error);
    return null;
  }
};

// Alternative: Simple hash-based approach for even cleaner URLs
export const generateAdSlug = (id: number, title: string): string => {
  const cleanTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim()
    .substring(0, 50); // Limit length
  
  const encodedId = encodeId(id);
  return `${cleanTitle}-${encodedId}`;
};

export const extractIdFromSlug = (slug: string): number | null => {
  const parts = slug.split('-');
  if (parts.length === 0) return null;
  
  // The encoded ID is the last part
  const encodedId = parts[parts.length - 1];
  return decodeId(encodedId);
};