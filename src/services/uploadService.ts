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

export const uploadScreenshots = async (
  files: File[],
  onProgress?: (current: number, total: number) => void
): Promise<UploadResponse> => {
  const batchSize = 5;
  const allScreenshots: any[] = [];
  
  console.log(`Starting batched upload of ${files.length} screenshots (batch size: ${batchSize})...`);
  
  if (onProgress) {
    onProgress(0, files.length);
  }

  for (let i = 0; i < files.length; i += batchSize) {
    const chunk = files.slice(i, i + batchSize);
    const formData = new FormData();
    chunk.forEach((file) => {
      formData.append('screenshots[]', file);
    });

    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log(`Uploading chunk ${Math.floor(i / batchSize) + 1} with ${chunk.length} files...`);

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
    if (!response.ok) {
      console.error('Screenshot chunk upload failed:', response.status, responseText);
      throw new Error(`Screenshot upload failed at chunk ${Math.floor(i / batchSize) + 1}: ${response.status} ${response.statusText}`);
    }

    let result: any = {};
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error('Upload endpoint did not return valid JSON');
    }

    const payload = result.data || result;
    const screenshots = payload.screenshots || [];
    allScreenshots.push(...screenshots);

    if (onProgress) {
      onProgress(Math.min(i + batchSize, files.length), files.length);
    }
  }

  console.log('Total screenshots uploaded successfully:', allScreenshots.length);

  return {
    screenshots: allScreenshots,
    count: allScreenshots.length,
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
