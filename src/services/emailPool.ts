import { getAuthToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://xsmmarket.com/api');

export interface PoolEmail {
  id: number;
  email_address: string;
  status: 'enabled' | 'disabled';
  platform: 'both' | 'youtube' | 'tiktok';
  max_active_deals: number;
  max_brand_accounts: number;
  notes?: string | null;
  active_deals_count: number;
  active_brands_count: number;
  active_tiktok_count: number;
  available_slots: number;
  available_brand_slots: number;
  calculated_status: 'available' | 'partial' | 'full' | 'disabled';
  created_at: string;
  updated_at: string;
}

export interface PoolStats {
  total_emails: number;
  available: number;
  partially_used: number;
  full: number;
  disabled: number;
  active_deals: number;
  youtube_brands: number;
  tiktok_accounts: number;
  total_available_slots: number;
}

export interface PoolAllocation {
  id: number;
  email_id: number;
  deal_id: number;
  transaction_id?: string;
  channel_title?: string;
  channel_price?: number;
  buyer_id: number;
  buyer_username?: string;
  platform: string;
  account_identifier?: string;
  allocation_type: string;
  status: 'active' | 'completed' | 'cancelled' | 'reassigned';
  assigned_at: string;
  completed_at?: string | null;
  reassigned_to_email_id?: number | null;
  reassignment_reason?: string | null;
}

export interface PoolBrandAccount {
  id: number;
  email_id: number;
  deal_id: number;
  transaction_id?: string;
  buyer_id: number;
  buyer_username?: string;
  brand_name: string;
  platform: string;
  status: 'active' | 'completed' | 'transferred' | 'removed';
  created_at: string;
}

export interface PoolHistoryItem {
  id: number;
  email_id: number;
  admin_id?: number | null;
  admin_username?: string | null;
  action: string;
  old_value?: string | null;
  new_value?: string | null;
  details?: string | null;
  created_at: string;
}

export interface PoolSettings {
  default_max_capacity: number;
  default_max_brand_accounts: number;
  allocation_method: 'least_used' | 'first_available' | 'round_robin';
  auto_assignment_enabled: boolean;
  allow_manager_access: boolean;
  low_capacity_threshold: number;
  no_available_email_alert: boolean;
}

const authHeaders = () => {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const getEmailPoolStats = async (): Promise<PoolStats> => {
  const res = await fetch(`${API_URL}/admin/email-pool/stats`, {
    headers: authHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch email pool statistics');
  }
  const data = await res.json();
  return data.stats;
};

export const getEmailPoolList = async (params?: {
  search?: string;
  status?: string;
  platform?: string;
  sort?: string;
}): Promise<PoolEmail[]> => {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.status && params.status !== 'all') query.append('status', params.status);
  if (params?.platform && params.platform !== 'all') query.append('platform', params.platform);
  if (params?.sort) query.append('sort', params.sort);

  const res = await fetch(`${API_URL}/admin/email-pool?${query.toString()}`, {
    headers: authHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch email pool list');
  }
  const data = await res.json();
  return data.emails || [];
};

export const getEmailPoolDetails = async (id: number): Promise<{
  email: PoolEmail;
  active_allocations: PoolAllocation[];
  historical_allocations: PoolAllocation[];
  brand_accounts: PoolBrandAccount[];
  history: PoolHistoryItem[];
}> => {
  const res = await fetch(`${API_URL}/admin/email-pool/${id}`, {
    headers: authHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch email details');
  }
  return res.json();
};

export const addPoolEmail = async (payload: {
  email_address: string;
  platform?: 'both' | 'youtube' | 'tiktok';
  max_active_deals?: number;
  max_brand_accounts?: number;
  status?: 'enabled' | 'disabled';
  notes?: string;
}): Promise<{ success: boolean; message: string; id: number }> => {
  const res = await fetch(`${API_URL}/admin/email-pool`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to add Gmail to pool');
  }
  return res.json();
};

export const updatePoolEmail = async (id: number, payload: {
  email_address: string;
  platform?: 'both' | 'youtube' | 'tiktok';
  status?: 'enabled' | 'disabled';
  notes?: string;
}): Promise<{ success: boolean; message: string }> => {
  const res = await fetch(`${API_URL}/admin/email-pool/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to update email');
  }
  return res.json();
};

export const updatePoolCapacity = async (id: number, payload: {
  max_active_deals?: number;
  max_brand_accounts?: number;
}): Promise<{ success: boolean; message: string }> => {
  const res = await fetch(`${API_URL}/admin/email-pool/${id}/capacity`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to update capacity');
  }
  return res.json();
};

export const togglePoolEmailStatus = async (id: number, targetStatus?: 'enabled' | 'disabled'): Promise<{ success: boolean; message: string; status: 'enabled' | 'disabled' }> => {
  const res = await fetch(`${API_URL}/admin/email-pool/${id}/status`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(targetStatus ? { status: targetStatus } : {})
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to update Gmail status');
  }
  return res.json();
};

export const deletePoolEmail = async (id: number): Promise<{ success: boolean; message: string }> => {
  const res = await fetch(`${API_URL}/admin/email-pool/${id}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to delete email');
  }
  return res.json();
};

export const reassignPoolDeal = async (payload: {
  deal_id: number;
  new_email_id: number;
  reason?: string;
  allow_override?: boolean;
}): Promise<{ success: boolean; message: string; capacity_reached?: boolean }> => {
  const res = await fetch(`${API_URL}/admin/email-pool/reassign`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Reassignment failed');
    (err as any).data = data;
    throw err;
  }
  return data;
};

export const getPoolSettings = async (): Promise<PoolSettings> => {
  const res = await fetch(`${API_URL}/admin/email-pool/settings`, {
    headers: authHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch email pool settings');
  }
  const data = await res.json();
  return data.settings;
};

export const updatePoolSettings = async (payload: Partial<PoolSettings>): Promise<{ success: boolean; message: string }> => {
  const res = await fetch(`${API_URL}/admin/email-pool/settings`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to update email pool settings');
  }
  return res.json();
};
