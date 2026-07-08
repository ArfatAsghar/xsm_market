import { API_URL } from './auth';

export interface UploadResponse {
  screenshots?: Array<{
    url?: string;
    data?: string;
    thumbnail?: string;
    originalName: string;
    size: number;
    type: string;
  }>;
  thumbnail?: string;
  smallThumbnail?: string;
  originalName?: string;
  size?: number;
  count?: number;
}

// Helper function to get auth token
const getAuthToken = () => {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
};

export const uploadScreenshots = async (files: File[]): Promise<UploadResponse> => {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append('screenshots[]', file);
  });

  const token = getAuthToken();
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log('Uploading screenshots...', {
    fileCount: files.length,
    hasToken: !!token,
    files: files.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
    })),
  });

  let response = await fetch('/api/ads/upload/screenshots', {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok && response.status === 404) {
    response = await fetch(`${API_URL}/ads/upload/screenshots`, {
      method: 'POST',
      headers,
      body: formData,
    });
  }

  const responseText = await response.text();
console.log("===== UPLOAD RESPONSE =====");
console.log(responseText);
console.log("===========================");
  if (!response.ok) {
    console.error('Screenshot upload failed:', response.status, responseText);
    throw new Error(`Screenshot upload failed: ${response.status} ${response.statusText}`);
  }

  let result: any = {};
  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error('Upload endpoint did not return valid JSON');
  }

  const payload = result.data || result;
  const screenshots = payload.screenshots || [];

  console.log('Screenshot upload successful:', screenshots);

  return {
    ...payload,
    screenshots,
    count: payload.count || screenshots.length,
  };
};

export const uploadThumbnail = async (file: File): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('thumbnail', file);

  const token = getAuthToken();
  const headers: Record<string, string> = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    // Try the proxy route first
    let response = await fetch(`/api/ads/upload/thumbnail`, {
      method: 'POST',
      headers,
      body: formData,
    });

    // If proxy fails, try direct backend
    if (!response.ok && response.status === 404) {
      console.log('📡 Proxy failed, trying direct backend...');
      response = await fetch(`${API_URL}/ads/upload/thumbnail`, {
        method: 'POST',
        headers,
        body: formData,
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload thumbnail: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('❌ Thumbnail upload error:', error);
    throw error;
  }
};
