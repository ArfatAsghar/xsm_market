// API URL - use the proxy in development  
export const API_URL = import.meta.env.DEV ? '/api' : 'https://xsmmarket.com/api';

console.log('🌐 API_URL configured as:', API_URL);

// Token management constants
const TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refreshToken';
const TOKEN_EXPIRY_KEY = 'tokenExpiry';
const USER_KEY = 'userData';

// Import User interface
interface User {
  id: string;
  username: string;
  fullName?: string;
  email: string;
  profilePicture?: string;
  description?: string;
  authProvider?: string;
  isEmailVerified?: boolean;
  isAdmin?: boolean;
}

// Token management interface
interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number; // seconds from now
  tokenType?: string;
}

// Auth response interface
export interface AuthResponse {
  token?: string;
  refreshToken?: string;
  expiresIn?: number;
  user?: {
    id: string;
    username: string;
    fullName?: string;
    email: string;
    profilePicture?: string;
    authProvider?: string;
    isEmailVerified?: boolean;
    isAdmin?: boolean;
  };
  message?: string;
  requiresVerification?: boolean;
  email?: string;
  authProvider?: string;
}

// Token expiry check
const isTokenExpired = (): boolean => {
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiry) return true;
  
  const expiryTime = parseInt(expiry);
  const currentTime = Date.now();
  
  // Consider token expired if it expires in less than 5 minutes
  const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
  return currentTime >= (expiryTime - bufferTime);
};

// Set token with expiry
const setTokenData = (tokenData: TokenData) => {
  localStorage.setItem(TOKEN_KEY, tokenData.accessToken);
  
  if (tokenData.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokenData.refreshToken);
  }
  
  // Calculate expiry time (default to 24 hours if not provided)
  const expiresInMs = (tokenData.expiresIn || 24 * 60 * 60) * 1000;
  const expiryTime = Date.now() + expiresInMs;
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
};

// Clear all token data
const clearTokenData = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(USER_KEY);
};

// Refresh token function
const refreshAccessToken = async (): Promise<boolean> => {
  try {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      console.log('No refresh token available');
      return false;
    }

    const response = await fetch(`${API_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      console.log('Failed to refresh token');
      return false;
    }

    const data = await response.json();
    
    setTokenData({
      accessToken: data.token || data.accessToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn || 24 * 60 * 60,
    });

    console.log('Token refreshed successfully');
    return true;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return false;
  }
};

// Helper function to handle fetch errors
const handleFetchError = async (response: Response) => {
  let data;
  try {
    data = await response.json();
  } catch (e) {
    console.error('Error parsing response:', e);
    throw new Error(`Server error. Please try again later.`);
  }

  if (!response.ok) {
    console.error('Server error response:', data);
    
    // Use the server's error message if it's user-friendly, otherwise provide a generic one
    let errorMessage = data.message || `Server error. Please try again later.`;
    
    // Ensure the error message is user-friendly
    if (errorMessage.includes('SQLSTATE') || errorMessage.includes('PDO') || errorMessage.includes('mysql')) {
      errorMessage = 'Service temporarily unavailable. Please try again in a few moments.';
    }
    
    throw new Error(errorMessage);
  }
  
  return data;
};

// Enhanced fetch with automatic token refresh
const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  // Check if token is expired and try to refresh
  if (isTokenExpired()) {
    console.log('Token expired, attempting refresh...');
    const refreshed = await refreshAccessToken();
    
    if (!refreshed) {
      console.log('Could not refresh token, user needs to login again');
      // Clear all auth data and redirect to login
      clearTokenData();
      // Dispatch custom event to notify components
      window.dispatchEvent(new CustomEvent('auth:logout'));
      throw new Error('Session expired. Please login again.');
    }
  }

  // Get current token
  const token = localStorage.getItem(TOKEN_KEY);
  
  // Add authorization header
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // If we get 401, try to refresh token once
  if (response.status === 401 && token) {
    console.log('Received 401, attempting token refresh...');
    const refreshed = await refreshAccessToken();
    
    if (refreshed) {
      // Retry the original request with new token
      const newToken = localStorage.getItem(TOKEN_KEY);
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          Authorization: `Bearer ${newToken}`,
        },
      });
      
      if (retryResponse.status === 401) {
        // Still unauthorized after refresh, logout
        clearTokenData();
        window.dispatchEvent(new CustomEvent('auth:logout'));
        throw new Error('Session expired. Please login again.');
      }
      
      return retryResponse;
    } else {
      // Could not refresh, logout
      clearTokenData();
      window.dispatchEvent(new CustomEvent('auth:logout'));
      throw new Error('Session expired. Please login again.');
    }
  }

  return response;
};

export const login = async (email: string, password: string, recaptchaToken?: string): Promise<AuthResponse> => {
  try {
    console.log('🔄 Starting login process for:', email);
    
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, recaptchaToken }),
      credentials: 'include'
    });

    const data = await response.json();
    console.log('📡 Login response received:', { 
      ok: response.ok, 
      status: response.status,
      data: { ...data, token: data.token ? 'exists' : 'missing' }
    });

    if (!response.ok) {
      // Handle specific error cases that need special treatment
      if (data.requiresVerification) {
        // User needs email verification - return special response
        return {
          requiresVerification: true,
          email: data.email,
          message: data.message
        };
      }
      
      if (data.authProvider === 'google') {
        // User trying to login with password but account is Google OAuth
        return {
          authProvider: 'google',
          message: data.message
        };
      }
      
      // For all other errors, throw the error
      throw new Error(data.message || 'Failed to login');
    }

    // Store tokens with proper expiry management
    if (data.token) {
      console.log('💾 Storing token data...');
      setTokenData({
        accessToken: data.token,
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn || 24 * 60 * 60, // Default 24 hours
      });
    }
    
    // Store user data
    if (data.user) {
      console.log('👤 Storing user data:', data.user);
      setCurrentUser(data.user);
    }
    
    console.log('✅ Login process completed successfully');
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('An unexpected error occurred during login');
    }
  }
};

export const register = async (username: string, email: string, password: string, recaptchaToken?: string, fullName?: string): Promise<AuthResponse> => {
  try {
    console.log('Attempting to register with:', { 
      username, 
      email,
      fullName,
      password: password ? '[FILTERED]' : undefined 
    });
    
    // Comment out the mock response to use the real backend
    // We'll keep it in the code but disabled to ensure connection goes to real backend
    /*
    if (!navigator.onLine || window.location.hostname === 'localhost') {
      console.log('Using mock registration response for development');
      const mockResponse: AuthResponse = {
        token: 'mock-jwt-token-' + Math.random().toString(36).substring(2, 15),
        user: {
          id: 'user-' + Math.random().toString(36).substring(2, 10),
          username: username,
          email: email,
          profilePicture: undefined
        }
      };
      
      localStorage.setItem('token', mockResponse.token);
      await new Promise(resolve => setTimeout(resolve, 800));
      return mockResponse;
    }
    */
    
    // Actual API call to backend server
    console.log(`Sending POST request to ${API_URL}/auth/register`);
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ 
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
        recaptchaToken,
        fullName: fullName?.trim() || ''
      }),
      mode: 'cors',
      credentials: 'include'
    }).catch(err => {
      console.error('Network error during registration fetch:', err);
      throw new Error(`Network error: Unable to connect to server at ${API_URL}. Please check your backend server is running.`);
    });

    console.log('Registration response status:', response.status); // Debug log
    
    const data = await handleFetchError(response);
    console.log('%c Registration response data:', 'background: #4CAF50; color: white; padding: 4px; border-radius: 2px;', data);

    // Handle different response types
    if (data.requiresVerification) {
      // Registration successful, but email verification required
      return {
        requiresVerification: true,
        email: data.email,
        message: data.message
      };
    }

    // Store the token in localStorage (for direct login)
    if (data.token) {
      localStorage.setItem('token', data.token);
    }
    
    // Store user data (for direct login)
    if (data.user) {
      setCurrentUser(data.user);
    }
    
    return data;
  } catch (error) {
    console.error('Registration error:', error); // Debug log
    
    if (error instanceof Error) {
      // Clean up the error message for better user experience
      let cleanMessage = error.message;
      
      // Remove technical prefixes and make more user-friendly
      if (cleanMessage.startsWith('HTTP error!')) {
        cleanMessage = 'Server error. Please try again later.';
      }
      
      // Handle network-specific errors
      if (cleanMessage.includes('NetworkError') || cleanMessage.includes('fetch')) {
        cleanMessage = 'Unable to connect to the server. Please check your internet connection.';
      }
      
      // Pass through the cleaned message
      throw new Error(cleanMessage);
    } else {
      throw new Error('An unexpected error occurred during registration. Please try again.');
    }
  }
};

export const logout = (): void => {
  clearTokenData();
  console.log('User logged out successfully');
};

export const isAuthenticated = (): boolean => {
  const token = localStorage.getItem(TOKEN_KEY);
  console.log('🔍 Checking authentication:', { 
    hasToken: !!token, 
    tokenLength: token?.length,
    isExpired: token ? isTokenExpired() : 'no token'
  });
  
  if (!token) return false;
  
  // Check if token is expired
  if (isTokenExpired()) {
    console.log('❌ Token is expired');
    return false;
  }
  
  console.log('✅ User is authenticated');
  return true;
};

export const getToken = (): string | null => {
  if (!isAuthenticated()) return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const getCurrentUser = (): User | null => {
  const userDataString = localStorage.getItem(USER_KEY);
  console.log('👤 Getting current user:', { 
    hasUserData: !!userDataString,
    dataLength: userDataString?.length 
  });
  
  if (userDataString) {
    try {
      const user = JSON.parse(userDataString);
      console.log('👤 Parsed user data:', user);
      return user;
    } catch (error) {
      console.error('❌ Error parsing user data:', error);
      localStorage.removeItem(USER_KEY);
      return null;
    }
  }
  console.log('❌ No user data found');
  return null;
};

export const setCurrentUser = (user: User): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const googleSignIn = async (tokenId: string): Promise<AuthResponse> => {
  try {
    console.log('🚀 Starting Google sign-in process...');
    console.log('📡 API URL:', API_URL);
    console.log('🔑 Token length:', tokenId.length);
    
    const response = await fetch(`${API_URL}/auth/google-signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: tokenId }),
      credentials: 'include'
    }).catch(networkError => {
      console.error('❌ Network error during Google sign-in fetch:', networkError);
      console.error('🔍 Error details:', {
        name: networkError.name,
        message: networkError.message,
        stack: networkError.stack
      });
      
      // Provide a more helpful error message
      if (networkError.name === 'TypeError' && networkError.message.includes('fetch')) {
        throw new Error('Failed to connect to the authentication server. Please check if the backend is running on ' + API_URL);
      }
      
      throw networkError;
    });

    console.log('📡 Response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    const data = await response.json().catch(parseError => {
      console.error('❌ Failed to parse response as JSON:', parseError);
      throw new Error('Server returned invalid response format');
    });

    console.log('📋 Response data:', data);

    if (!response.ok) {
      const errorMessage = data.message || `HTTP ${response.status}: ${response.statusText}`;
      console.error('❌ Backend rejected Google sign-in:', errorMessage);
      throw new Error(errorMessage);
    }

    console.log('🔍 Google sign-in response:', data);

    // Store tokens with proper expiry management
    if (data.token) {
      console.log('💾 Storing authentication tokens...');
      setTokenData({
        accessToken: data.token,
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn || 24 * 60 * 60,
      });
    }
    
    // Store user data
    if (data.user) {
      console.log('� Storing Google user data:', data.user);
      setCurrentUser(data.user);
    }
    
    console.log('✅ Google sign-in completed successfully');
    return data;
  } catch (error) {
    console.error('💥 Google sign-in failed:', error);
    
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('An unexpected error occurred during Google sign-in');
    }
  }
};

// Verify OTP for email verification
export const verifyOTP = async (email: string, otp: string): Promise<AuthResponse> => {
  try {
    const response = await fetch(`${API_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, otp }),
      credentials: 'include'
    });

    const data = await handleFetchError(response);

    // Store tokens with proper expiry management
    if (data.token) {
      setTokenData({
        accessToken: data.token,
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn || 24 * 60 * 60,
      });
    }
    
    // Store user data
    if (data.user) {
      setCurrentUser(data.user);
    }
    
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('An unexpected error occurred during OTP verification');
    }
  }
};

// Resend OTP for email verification
export const resendOTP = async (email: string): Promise<{ message: string }> => {
  try {
    const response = await fetch(`${API_URL}/auth/resend-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
      credentials: 'include'
    });

    const data = await handleFetchError(response);
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('An unexpected error occurred while resending OTP');
    }
  }
};

// Example of using authenticatedFetch for protected API calls
export const getProfile = async (): Promise<User> => {
  try {
    const response = await authenticatedFetch(`${API_URL}/user/profile`);
    const data = await handleFetchError(response);
    return data.user;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to fetch user profile');
    }
  }
};

// Example of updating user profile
export const updateProfile = async (userData: Partial<User>): Promise<User> => {
  try {
    const response = await authenticatedFetch(`${API_URL}/user/profile`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
    const data = await handleFetchError(response);
    
    // Update the user data in localStorage
    if (data.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
    
    return data.user;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to update user profile');
    }
  }
};

// Change user password
export const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  try {
    const response = await authenticatedFetch(`${API_URL}/user/password`, {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword,
        newPassword
      }),
    });
    await handleFetchError(response);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to change password');
    }
  }
};

// Forgot password
export const forgotPassword = async (email: string): Promise<{ message: string }> => {
  try {
    const response = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    const data = await handleFetchError(response);
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to process forgot password request');
    }
  }
};

// Reset password with token
export const resetPassword = async (token: string, newPassword: string): Promise<{ message: string }> => {
  try {
    const response = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await handleFetchError(response);
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to reset password');
    }
  }
};

// Example of creating a channel listing (protected endpoint)
export const createChannelListing = async (channelData: any): Promise<any> => {
  try {
    const response = await authenticatedFetch(`${API_URL}/channels`, {
      method: 'POST',
      body: JSON.stringify(channelData),
    });
    const data = await handleFetchError(response);
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to create channel listing');
    }
  }
};

// Email change functionality - Updated for dual verification
export const requestEmailChange = async (newEmail: string): Promise<{ 
  message: string; 
  step: string;
  currentEmail: string;
  pendingEmail: string;
  verificationToken: string 
}> => {
  try {
    const response = await authenticatedFetch(`${API_URL}/user/email/change-request`, {
      method: 'POST',
      body: JSON.stringify({ newEmail }),
    });
    const data = await handleFetchError(response);
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to request email change');
    }
  }
};

// Step 1: Verify current email
export const verifyCurrentEmail = async (token: string, otp: string): Promise<{ 
  message: string; 
  step: string;
  newEmail: string;
  verificationToken: string 
}> => {
  try {
    const response = await fetch(`${API_URL}/user/email/verify-current`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, otp }),
    });
    const data = await handleFetchError(response);
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to verify current email');
    }
  }
};

// Step 2: Verify new email
export const verifyNewEmail = async (token: string, otp: string): Promise<{ 
  message: string; 
  oldEmail: string;
  newEmail: string 
}> => {
  try {
    const response = await fetch(`${API_URL}/user/email/verify-new`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, otp }),
    });
    const data = await handleFetchError(response);
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to verify new email');
    }
  }
};

// Legacy function for backward compatibility
export const verifyEmailChange = async (token: string, otp: string): Promise<{ message: string; newEmail: string }> => {
  try {
    const response = await fetch(`${API_URL}/user/email/verify-change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, otp }),
    });
    const data = await handleFetchError(response);
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to verify email change');
    }
  }
};

// Secure password change functionality
export const requestPasswordChange = async (currentPassword: string, newPassword: string): Promise<{ message: string; email: string; verificationToken: string; isGoogleUser: boolean }> => {
  try {
    const response = await authenticatedFetch(`${API_URL}/user/password/change-request`, {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await handleFetchError(response);
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to request password change');
    }
  }
};

export const verifyPasswordChange = async (token: string, otp: string): Promise<{ message: string; isGoogleUser: boolean }> => {
  try {
    const response = await fetch(`${API_URL}/user/password/verify-change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, otp }),
    });
    const data = await handleFetchError(response);
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to verify password change');
    }
  }
};

// Email Change Cooldown Status
export interface EmailChangeCooldownStatus {
  cooldownActive: boolean;
  canChangeEmail: boolean;
  daysRemaining?: number;
  timeRemaining?: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
  };
  nextAllowedDate?: string;
  lastEmailChange?: string;
}

export const getEmailChangeCooldownStatus = async (): Promise<EmailChangeCooldownStatus> => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Not authenticated');
  }

  try {
    const response = await fetch(`${API_URL}/user/email/cooldown-status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to get cooldown status');
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to get email change cooldown status');
    }
  }
};

// Password Change Cooldown Status
export interface PasswordChangeCooldownStatus {
  cooldownActive: boolean;
  canChangePassword: boolean;
  hoursRemaining?: number;
  timeRemaining?: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
  };
  nextAllowedDate?: string;
  lastPasswordChange?: string;
}

export const getPasswordChangeCooldownStatus = async (): Promise<PasswordChangeCooldownStatus> => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Not authenticated');
  }

  try {
    const response = await fetch(`${API_URL}/user/password/cooldown-status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to get cooldown status');
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to get password change cooldown status');
    }
  }
};

// Get public user profile by username
export const getPublicProfile = async (username: string) => {
  try {
    const token = getToken();
    
    const response = await fetch(`${API_URL}/user/u/${username}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Include auth token if available for potential additional data
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('User not found');
      }
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch profile');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to get public profile');
    }
  }
};
