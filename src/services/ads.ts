import { API_URL } from './auth';

// Get all ads (public)
export const getAllAds = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        queryParams.append(key, filters[key]);
      }
    });

    const response = await fetch(`${API_URL}/ads?${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ads: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get all ads error:', error);
    throw error;
  }
};

// Get single ad by ID
export const getAdById = async (id) => {
  try {
    const response = await fetch(`${API_URL}/ads/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ad: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get ad by ID error:', error);
    throw error;
  }
};

// Create new ad (protected)
export const createAd = async (adData) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_URL}/ads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(adData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to create ad: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Create ad error:', error);
    throw error;
  }
};

// Get user's ads (protected)
export const getUserAds = async (filters: any = {}) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const queryParams = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        queryParams.append(key, filters[key]);
      }
    });

    const response = await fetch(`${API_URL}/ads/my-ads?${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    // Check if response is actually JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // If not JSON, get the text to see what error occurred
      const text = await response.text();
      console.error('Non-JSON response from /ads/my-ads:', text);
      throw new Error('Server returned invalid response format');
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to fetch user ads: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get user ads error:', error);
    throw error;
  }
};

// Update ad (protected)
export const updateAd = async (id, adData) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_URL}/ads/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(adData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to update ad: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Update ad error:', error);
    throw error;
  }
};

// Delete ad (protected)
export const deleteAd = async (id) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_URL}/ads/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to delete ad: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Delete ad error:', error);
    throw error;
  }
};

// Get platform statistics
export const getPlatformStats = async () => {
  try {
    const response = await fetch(`${API_URL}/ads/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch platform stats: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get platform stats error:', error);
    throw error;
  }
};

// Alternative method to get user's ads using a different endpoint
export const getUserAdsAlternative = async (filters: any = {}) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required');
    }

    // Try to get user data from localStorage first
    const userDataString = localStorage.getItem('userData');
    let userId = null;
    
    console.log('📊 getUserAdsAlternative: localStorage userData:', userDataString);
    
    if (userDataString) {
      try {
        const userData = JSON.parse(userDataString);
        userId = userData.id;
        console.log('📊 getUserAdsAlternative: Parsed user data:', userData);
        console.log('📊 getUserAdsAlternative: User ID from localStorage:', userId);
      } catch (e) {
        console.log('Failed to parse user data from localStorage');
      }
    }

    // If no user ID from localStorage, try to get from profile endpoint
    if (!userId) {
      const userResponse = await fetch(`${API_URL}/user/profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!userResponse.ok) {
        throw new Error('Failed to get user profile');
      }

      const userData = await userResponse.json();
      userId = userData.user?.id || userData.id;
    }

    if (!userId) {
      throw new Error('Could not determine user ID');
    }

    console.log('📊 getUserAdsAlternative: User ID determined:', userId);

    // Get all ads and filter by user ID on the client side temporarily
    const allAdsResponse = await fetch(`${API_URL}/ads`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!allAdsResponse.ok) {
      throw new Error('Failed to fetch ads');
    }

    const allAdsData = await allAdsResponse.json();
    console.log('📊 All ads received:', allAdsData);
    console.log('📊 All ads count:', allAdsData.ads?.length || 0);
    
    // Filter ads by user ID (check seller.id which contains the userId)
    const userAds = allAdsData.ads.filter((ad: any) => {
      const match = ad.seller?.id == userId;
      console.log(`📊 Ad ${ad.id}: seller.id=${ad.seller?.id}, expected userId=${userId}, match=${match}`);
      return match;
    });
    
    console.log('📊 Filtered user ads:', userAds);
    console.log('📊 User ads count:', userAds.length);
    
    // Apply additional filters if provided
    let filteredAds = userAds;
    if (filters.status) {
      filteredAds = userAds.filter((ad: any) => ad.status === filters.status);
    }

    return {
      ads: filteredAds,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: filteredAds.length,
        itemsPerPage: filteredAds.length
      }
    };

  } catch (error) {
    console.error('Get user ads alternative error:', error);
    throw error;
  }
};

// Pin/Unpin ad functionality
export const togglePinAd = async (adId: number) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_URL}/ads/${adId}/pin`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to toggle pin status: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Toggle pin ad error:', error);
    throw error;
  }
};

// Pull up ad functionality
export const pullUpAd = async (adId: number) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_URL}/ads/${adId}/pull-up`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to pull up ad: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Pull up ad error:', error);
    throw error;
  }
};
