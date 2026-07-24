import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon, Edit, LogOut, Save, X, Camera, Pin, Crown, Settings, Eye, EyeOff } from 'lucide-react';
import VerificationSection from '@/components/VerificationSection';
import UserAdList from '@/components/UserAdList';
import DualEmailVerificationModal from '@/components/DualEmailVerificationModal';
import PasswordVerificationModal from '@/components/PasswordVerificationModal';
import EmailChangeCooldownTimer from '@/components/EmailChangeCooldownTimer';
import PasswordChangeCooldownTimer from '@/components/PasswordChangeCooldownTimer';
import { useAuth } from '@/context/useAuth';
import { useNotifications } from '@/context/NotificationContext';
import { User } from '@/context/AuthContext';
import { updateProfile, getProfile, changePassword, logout, requestEmailChange, requestPasswordChange } from '@/services/auth';
import { compressImage } from '@/utils/imageCompressor';

// Get API URL from environment variables
const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://xsmmarket.com/api');
};

const getBaseUrl = () => {
  const apiUrl = getApiUrl();
  return apiUrl.replace('/api', '');
};

const API_URL = getBaseUrl();

interface ProfileProps {
  // No longer need setCurrentPage
}

interface UpdateData {
  username?: string;
  profilePicture?: string;
  description?: string;
}

interface ExtendedUser extends User {
  joinDate?: string;
  authProvider?: 'google' | 'email';
}

import VipSubscriptionModal from '@/components/VipSubscriptionModal';

const Profile: React.FC<ProfileProps> = () => {
  const navigate = useNavigate();
  const { user, isLoggedIn, setUser, setIsLoggedIn } = useAuth();
  const [showVipModal, setShowVipModal] = useState(false);
  const { showSuccess, showError, showInfo, showWarning } = useNotifications();
  const typedUser = user as ExtendedUser;

  // Function to format joining date
  const formatJoinDate = (dateString: string) => {
    if (!dateString) return 'Recently joined';
    
    const joinDate = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - joinDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffDays < 1) return 'Joined today';
    if (diffDays === 1) return 'Joined 1 day ago';
    if (diffDays < 7) return `Joined ${diffDays} days ago`;
    if (diffWeeks === 1) return 'Joined 1 week ago';
    if (diffWeeks < 4) return `Joined ${diffWeeks} weeks ago`;
    if (diffMonths === 1) return 'Joined 1 month ago';
    if (diffMonths < 12) return `Joined ${diffMonths} months ago`;
    if (diffYears === 1) return 'Joined 1 year ago';
    return `Joined ${diffYears} years ago`;
  };

  // Debug logging
  console.log('🔍 Profile component state:', { 
    user: typedUser, 
    isLoggedIn, 
    token: localStorage.getItem('token') ? 'exists' : 'missing',
    userData: localStorage.getItem('userData')
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('email');
  const [settingsForm, setSettingsForm] = useState({
    username: '',
    email: '',
  });
  const [settingsPasswordForm, setSettingsPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  // Email verification modal state
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [emailVerificationToken, setEmailVerificationToken] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [emailCooldownActive, setEmailCooldownActive] = useState(false);
  
  // Password verification modal state
  const [showPasswordVerification, setShowPasswordVerification] = useState(false);
  const [passwordVerificationToken, setPasswordVerificationToken] = useState('');
  const [pendingPasswordEmail, setPendingPasswordEmail] = useState('');
  const [isGoogleUserPassword, setIsGoogleUserPassword] = useState(false);
  const [passwordCooldownActive, setPasswordCooldownActive] = useState(false);
  
  // Password visibility toggle state
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    profilePicture: '',
    description: ''
  });
  
  const [listedChannels] = useState([
    {
      id: '1',
      name: 'TechReview Pro',
      category: 'Tech',
      subscribers: 150000,
      price: 15000,
      status: 'Active',
      views: 245,
      inquiries: 8,
    },
    {
      id: '2',
      name: 'Gaming World HD',
      category: 'Gaming',
      subscribers: 89000,
      price: 8500,
      status: 'Pending Review',
      views: 123,
      inquiries: 3,
    },
  ]);
  
  // Initialize profile with user data or defaults
  const [profile, setProfile] = useState({
    username: user?.username || 'ChannelTrader2024',
    email: user?.email || 'user@example.com',
    joinDate: (user as any)?.createdAt || (user as ExtendedUser)?.joinDate || new Date().toISOString(),
    profilePicture: user?.profilePicture || '',
    description: user?.description || ''
  });

  // Scroll to top when Profile component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Update profile when user data changes
  useEffect(() => {
    if (user) {
      console.log('🔍 User data in Profile component:', {
        user,
        authProvider: (user as any)?.authProvider,
        keys: Object.keys(user),
        description: user.description
      });
      
      setProfile(prev => ({
        ...prev,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture || '',
        description: user.description || '',
        joinDate: (user as any)?.createdAt || (user as any)?.joinDate || prev.joinDate
      }));
      
      console.log('🔄 Updated profile state with description:', user.description);
    }
  }, [user]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login');
    }
  }, [isLoggedIn, navigate]);

  // Fetch fresh profile data when component mounts
  useEffect(() => {
    const fetchProfileData = async () => {
      if (isLoggedIn && user) {
        try {
          console.log('🔄 Fetching fresh profile data...');
          const freshProfile = await getProfile();
          console.log('✅ Fresh profile data:', freshProfile);
          
          // Update the user context with fresh data
          setUser({
            ...freshProfile,
            id: String(freshProfile.id),
          });
          
          // Directly set profile with fresh data including description
          setProfile({
            username: freshProfile.username,
            email: freshProfile.email,
            profilePicture: freshProfile.profilePicture || '',
            description: freshProfile.description || '',
            joinDate: (freshProfile as any)?.joinDate || '2025-01-15',
          });
          
          console.log('🔄 Profile state updated with fresh data:', {
            description: freshProfile.description,
            username: freshProfile.username
          });
        } catch (error) {
          console.error('❌ Failed to fetch fresh profile data:', error);
        }
      }
    };

    fetchProfileData();
  }, [isLoggedIn]); // Only run when login status changes

  const handleLogout = () => {
    logout();
    setUser(null);
    setIsLoggedIn(false);
    navigate('/');
  };

  // Show loading if no user data yet but we are logged in
  if (isLoggedIn && !user) {
    // If we have a token but no user data, create a default user
    const token = localStorage.getItem('token');
    if (token) {
      console.log('🔧 Creating default user data since token exists but no user data found');
      const defaultUser = {
        id: 'temp-user-id',
        username: 'User',
        email: 'user@example.com',
        profilePicture: ''
      };
      
      // Store and use default user data
      localStorage.setItem('userData', JSON.stringify(defaultUser));
      
      // Force re-render by setting a temporary loading state
      return (
        <div className="min-h-screen bg-gradient-to-b from-xsm-black to-xsm-dark-gray py-8">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <div className="flex justify-center items-center mb-4">
                <h1 className="text-4xl font-bold text-xsm-yellow">My Profile</h1>
              </div>
              <p className="text-xl text-white">
                Profile loaded with default data (please refresh to see your actual data)
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              {/* Profile Overview */}
              <div className="lg:col-span-1">
                <div className="xsm-card text-center mb-6">
                  <div className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden">
                    <div className="w-full h-full bg-xsm-yellow rounded-full flex items-center justify-center">
                      <UserIcon className="w-12 h-12 text-xsm-black" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">{defaultUser.username}</h2>
                  <p className="text-xsm-light-gray mb-1">@{defaultUser.username}</p>
                  <p className="text-xsm-light-gray mb-4">{defaultUser.email}</p>
                  <div className="text-xs text-yellow-400 bg-yellow-500/10 rounded-full px-3 py-1 inline-block">
                    ⚠️ Default profile data - please login again for actual data
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="lg:col-span-2 space-y-8">
                <div className="xsm-card">
                  <h3 className="text-xl font-bold text-xsm-yellow mb-6">Profile Status</h3>
                  <div className="bg-blue-500/10 rounded-lg p-4">
                    <p className="text-white mb-4">
                      You are logged in, but we couldn't load your profile data. This might happen if:
                    </p>
                    <ul className="text-xsm-light-gray list-disc pl-6 space-y-2">
                      <li>You refreshed the page after logging in</li>
                      <li>Your session data was cleared</li>
                      <li>There was a temporary connection issue</li>
                    </ul>
                    <div className="mt-4 space-x-4">
                      <button
                        onClick={() => navigate('/login')}
                        className="bg-xsm-yellow hover:bg-yellow-500 text-black px-4 py-2 rounded-lg font-semibold transition-colors"
                      >
                        Login Again
                      </button>
                      <button
                        onClick={() => window.location.reload()}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                      >
                        Refresh Page
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-xsm-black to-xsm-dark-gray py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-xsm-yellow border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-xl">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Show login message if not authenticated
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-xsm-black to-xsm-dark-gray py-8 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Please Log In</h2>
          <p className="text-xsm-light-gray mb-6">You need to be logged in to view your profile.</p>
          <button
            onClick={() => navigate('/login')}
            className="bg-xsm-yellow hover:bg-yellow-500 text-black px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Handle profile picture upload - immediately save to backend

  const handleProfilePictureChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showError('File too large', 'File size must be less than 5MB');
        return;
      }
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        showError('Invalid file type', 'Please select an image file');
        return;
      }
      
      // Compress and resize image before uploading
      const compressedFile = await compressImage(file, 512, 512, 0.8); // Max 512x512, 80% quality
      
      // Convert compressed image to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64String = e.target?.result as string;
        
        try {
          // Immediately update the backend with new profile picture
          console.log('🔄 Updating profile picture...');
          const updatedUser = await updateProfile({ profilePicture: base64String });
          
          console.log('✅ Profile picture updated successfully:', updatedUser);
          
          // Update the user context with the new data
          setUser({
            ...updatedUser,
            id: String(updatedUser.id),
          });
          
          // Update local profile state
          setProfile(prev => ({
            ...prev,
            profilePicture: updatedUser.profilePicture || ''
          }));
          
          // Update the edit form to match the saved data
          setEditForm(prev => ({
            ...prev,
            profilePicture: updatedUser.profilePicture || ''
          }));
          
          showSuccess('Profile picture updated', 'Your profile picture has been updated successfully!');
          
        } catch (error) {
          console.error('❌ Failed to update profile picture:', error);
          showError('Update failed', 'Failed to update profile picture. Please try again.');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setIsUpdating(true);
    try {
      // Prepare the data to send to the API
      const updateData: UpdateData = {};
      
      // Only include username if it has changed
      if (editForm.username !== user.username) {
        updateData.username = editForm.username;
      }

      // Only include description if it has changed
      if (editForm.description !== profile.description) {
        updateData.description = editForm.description;
      }
      
      // Only make API call if there are changes
      if (Object.keys(updateData).length > 0) {
        console.log('🔄 Updating profile with data:', updateData);
        
        // Call the API to update the profile
        const updatedUser = await updateProfile(updateData);
        
        console.log('✅ Profile updated successfully:', updatedUser);
        
        // Update the user context with the new data
        setUser({
          ...updatedUser,
          id: String(updatedUser.id),
        });
        
        // Update local profile state with saved data
        setProfile(prev => ({
          ...prev,
          username: updatedUser.username,
          description: updatedUser.description || '',
        }));
        
        // Update the edit form to match the saved data
        setEditForm(prev => ({
          ...prev,
          username: updatedUser.username,
          description: updatedUser.description || '',
        }));
        
        showSuccess('Profile updated', 'Your profile has been updated successfully!');
      } else {
        showInfo('No changes', 'No changes were made to save.');
      }
      
      setIsEditing(false);
    } catch (error) {
      console.error('❌ Failed to update profile:', error);
      
      // Handle specific error messages
      let errorMessage = 'Failed to update profile. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('Username is already taken')) {
          errorMessage = 'Username is already taken. Please choose a different one.';
        } else if (error.message.includes('Username must be between')) {
          errorMessage = 'Username must be between 3 and 50 characters.';
        } else if (error.message.includes('Username can only contain')) {
          errorMessage = 'Username can only contain letters, numbers, and underscores.';
        } else {
          errorMessage = error.message;
        }
      }
      
      showError('Update failed', errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePasswordChange = async () => {
    // Debug logging for Google user detection
    console.log('🔍 Password change attempt:', {
      user,
      authProvider: (user as any)?.authProvider,
      isGoogleUser: (user as any)?.authProvider === 'google',
      currentPassword: settingsPasswordForm.currentPassword,
      newPassword: settingsPasswordForm.newPassword ? '***' : ''
    });

    if (settingsPasswordForm.newPassword !== settingsPasswordForm.confirmPassword) {
      showError('Password mismatch', 'New passwords do not match!');
      return;
    }
    
    if (!settingsPasswordForm.newPassword) {
      showError('Missing password', 'Please enter a new password!');
      return;
    }
    
    if (settingsPasswordForm.newPassword.length < 6) {
      showError('Password too short', 'New password must be at least 6 characters long!');
      return;
    }

    setIsChangingPassword(true);
    
    try {
      // First, fetch the latest user profile from backend to get authProvider
      const token = localStorage.getItem('token');
      const profileResponse = await fetch(`${API_URL}/user/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        const backendUser = profileData.user;
        console.log('🔍 Backend user data:', backendUser);
        
        const isGoogleUser = backendUser?.authProvider === 'google';
        console.log('🔍 User type - Google:', isGoogleUser);
        
        // For Google users, they don't need to enter current password (first time setting password)
        // For email users, they need current password
        if (!isGoogleUser && !settingsPasswordForm.currentPassword) {
          showError('Current password required', 'Please enter your current password!');
          setIsChangingPassword(false);
          return;
        }
        
        // For Google users, send empty current password; for email users, send the current password
        await changePassword(
          isGoogleUser ? '' : settingsPasswordForm.currentPassword, 
          settingsPasswordForm.newPassword
        );
        
        if (isGoogleUser) {
          showSuccess('Password set successfully!', 'You can now login with email/password in addition to Google.');
        } else {
          showSuccess('Password changed successfully!', 'Your password has been updated.');
        }
        
        setSettingsPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      } else {
        throw new Error('Failed to fetch user profile');
      }
      
    } catch (error) {
      console.error('❌ Failed to change password:', error);
      
      let errorMessage = 'Failed to change password. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('Current password is incorrect')) {
          errorMessage = 'Current password is incorrect.';
        } else if (error.message.includes('must be at least 6 characters')) {
          errorMessage = 'New password must be at least 6 characters long.';
        } else if (error.message.includes('Google OAuth. Please use "Sign in with Google"')) {
          errorMessage = 'This account was created with Google OAuth. Please use "Sign in with Google" instead. To set a password for email login, leave the current password field empty.';
        } else if (error.message.includes('Google account users don\'t have a current password')) {
          errorMessage = 'For Google accounts, leave current password empty to set a new password.';
        } else {
          errorMessage = error.message;
        }
      }
      
      showError('Password change failed', errorMessage);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleVerificationSubmit = async (documentType: string, file: File) => {
    // TODO: Implement actual verification submission logic
    console.log('Submitting verification:', { documentType, file });
    // Mock API call
    setProfile(prev => ({ ...prev, verificationStatus: 'pending' }));
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getRelativeTimeString = (dateString: string) => {
    const joinDate = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - joinDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 1) return 'Joined today';
    if (diffDays === 1) return 'Joined yesterday';
    if (diffDays < 30) return `Joined ${diffDays} days ago`;
    
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return 'Joined 1 month ago';
    if (diffMonths < 12) return `Joined ${diffMonths} months ago`;
    
    const diffYears = Math.floor(diffDays / 365);
    if (diffYears === 1) return 'Joined 1 year ago';
    return `Joined ${diffYears} years ago`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-xsm-black to-xsm-dark-gray py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Profile Overview */}
          <div className="lg:col-span-1">
            <div className="xsm-card text-center mb-6">
              <div className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center relative">
                {/* Green ring for active status */}
                <div className="absolute inset-0 rounded-full border-2 border-green-400 animate-pulse"></div>
                <div className="w-[90px] h-[90px] rounded-full overflow-hidden relative">
                  {(isEditing ? editForm.profilePicture : profile.profilePicture) ? (
                    <img 
                      src={isEditing ? editForm.profilePicture : profile.profilePicture} 
                      alt={profile.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-xsm-yellow rounded-full flex items-center justify-center">
                      <UserIcon className="w-12 h-12 text-xsm-black" />
                    </div>
                  )}
                </div>
                {/* Always visible edit icon for profile picture */}
                <div className="absolute bottom-0 right-0 bg-xsm-yellow hover:bg-yellow-500 rounded-full p-1.5 cursor-pointer transition-colors group">
                  <Camera className="w-4 h-4 text-xsm-black" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePictureChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    title="Change profile picture"
                  />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-1.5">
                {profile.username}
                {(user as any)?.isVip && (
                  <Crown className="w-5 h-5 text-yellow-400 fill-yellow-400/20 animate-pulse" title="VIP Member" />
                )}
              </h2>
              <p className="text-gray-300 font-medium mb-2">{profile.email}</p>
              
              {/* Joining Date */}
              <p className="text-sm text-gray-300 font-medium mb-4">
                {formatJoinDate(profile.joinDate)}
              </p>
              
              <div className="text-xs text-green-400 flex items-center justify-center gap-1 mb-4">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Active now</span>
              </div>

              {/* VIP Membership status & CTA */}
              <div className="pt-2 border-t border-xsm-medium-gray/30 mt-2">
                {(user as any)?.isVip ? (
                  <div className="space-y-2">
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-yellow-400 font-semibold flex items-center justify-center gap-1">
                        <Crown className="w-3.5 h-3.5 fill-yellow-400/20" /> VIP Active
                      </p>
                      {user.vipUntil && (
                        <p className="text-[10px] text-gray-400 mt-1">
                          Expires: {new Date(user.vipUntil).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setShowVipModal(true)}
                      className="w-full bg-xsm-yellow hover:bg-yellow-500 text-black py-2 rounded-lg font-bold text-xs transition-colors"
                    >
                      Extend VIP Badge
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 text-center mb-1">Get special discounts & visibility perk</p>
                    <button
                      onClick={() => setShowVipModal(true)}
                      className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white py-2 rounded-lg font-bold text-xs transition-all shadow-md shadow-yellow-900/30 flex items-center justify-center gap-1"
                    >
                      <Crown className="w-3.5 h-3.5" /> Buy VIP Badge
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Profile Settings */}
            <div className="xsm-card">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-xsm-yellow">Profile Information</h3>
                
                {/* Quick Actions - moved here */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      showInfo('Feature coming soon', 'Pin Your Listing feature will be available soon!');
                    }}
                    className="xsm-button-secondary flex items-center space-x-1 text-xs px-3 py-2"
                    title="Pin Your Listing"
                  >
                    <Pin className="w-3 h-3" />
                    <span>Pin</span>
                  </button>
                  <button
                    onClick={() => {
                      showInfo('Feature coming soon', 'Get Membership feature will be available soon!');
                    }}
                    className="xsm-button-secondary flex items-center space-x-1 text-xs px-3 py-2"
                    title="Get Membership"
                  >
                    <Crown className="w-3 h-3" />
                    <span>Premium</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowSettings(true);
                      setActiveSettingsTab('username');
                      setSettingsForm({
                        username: profile.username,
                        email: '',
                      });
                      setSettingsPasswordForm({
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: '',
                      });
                    }}
                    className="xsm-button-secondary flex items-center space-x-1 text-xs px-3 py-2"
                    title="Settings"
                  >
                    <Settings className="w-3 h-3" />
                    <span>Settings</span>
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-6">
                  <div className="relative">
                    <textarea
                      value={isEditing ? editForm.description : profile.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      disabled={!isEditing}
                      className={`xsm-input w-full min-h-[120px] resize-y pr-12 ${!isEditing ? 'opacity-60' : ''}`}
                      placeholder="Tell others about yourself..."
                      maxLength={500}
                    />
                    
                    {/* Edit button inside textarea - top right corner */}
                    {!isEditing ? (
                      <button
                        onClick={() => {
                          setIsEditing(true);
                          setEditForm({ 
                            username: profile.username,
                            email: profile.email,
                            profilePicture: profile.profilePicture,
                            description: profile.description
                          });
                        }}
                        className="absolute top-3 right-3 text-gray-400 hover:text-xsm-yellow transition-colors p-1"
                        title="Edit Profile"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="absolute top-3 right-3 flex space-x-1">
                        <button
                          onClick={handleSaveProfile}
                          disabled={isUpdating}
                          className={`text-gray-400 hover:text-green-400 transition-colors p-1 ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Save Changes"
                        >
                          {isUpdating ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setIsEditing(false);
                            setEditForm({ 
                              username: profile.username,
                              email: profile.email,
                              profilePicture: profile.profilePicture,
                              description: profile.description
                            });
                          }}
                          disabled={isUpdating}
                          className="text-gray-400 hover:text-red-400 transition-colors p-1"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {isEditing && (
                    <p className="text-gray-400 text-sm mt-2">
                      {editForm.description?.length || 0}/500 characters
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* My Ads */}
            <div className="xsm-card">
              <UserAdList />
            </div>


          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-xsm-dark-gray rounded-lg border border-xsm-yellow/20 p-4 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-xsm-yellow">Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex space-x-1 mb-4 bg-xsm-black/50 rounded-lg p-1">
              <button
                onClick={() => {
                  setActiveSettingsTab('username');
                  setSettingsForm({ ...settingsForm, username: profile.username });
                }}
                className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors ${
                  activeSettingsTab === 'username'
                    ? 'bg-xsm-yellow text-xsm-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Username
              </button>
              <button
                onClick={() => {
                 setActiveSettingsTab('email');
                setSettingsForm({ ...settingsForm, email: '' });
                  }}
                className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors ${
                  activeSettingsTab === 'email'
                    ? 'bg-xsm-yellow text-xsm-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Email
              </button>
              <button
                onClick={() => {
                  setActiveSettingsTab('password');
                  setSettingsPasswordForm({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                  });
                }}
                className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors ${
                  activeSettingsTab === 'password'
                    ? 'bg-xsm-yellow text-xsm-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Password
              </button>
            </div>

            {/* Tab Content */}
            <div className="min-h-[180px]">
              {/* Username Tab */}
              {activeSettingsTab === 'username' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-white font-medium mb-1 text-sm">Username</label>
                    <input
                      type="text"
                      value={profile.username}
                      disabled
                      className="xsm-input w-full opacity-60 text-sm"
                    />
                  </div>
                  <div className="text-sm text-yellow-400 bg-yellow-400/10 p-3 rounded-lg border border-yellow-400/20">
                    <div className="flex items-center space-x-2">
                      <span className="text-yellow-400">⚠️</span>
                      <span>Username cannot be changed</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Email Tab */}
              {activeSettingsTab === 'email' && (
                <div className="space-y-3">
                  {/* Email Change Cooldown Timer */}
                  <EmailChangeCooldownTimer
                    onCooldownEnd={() => setEmailCooldownActive(false)}
                    onCooldownStatusChange={setEmailCooldownActive}
                    className="mb-2"
                  />
                  
                  <div>
                    <label className="block text-white font-medium mb-1 text-sm">Current Email</label>
                    <input
                      type="email"
                      value={profile.email}
                      disabled
                      className="xsm-input w-full opacity-60 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-white font-medium mb-1 text-sm">New Email</label>
                    <input
                      type="email"
                      value={settingsForm.email}
                      onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })}
                      disabled={emailCooldownActive}
                      className={`xsm-input w-full text-sm ${emailCooldownActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                      placeholder={emailCooldownActive ? "Email change is on cooldown" : "Enter new email address"}
                    />
                  </div>
                  <div className="text-sm text-gray-400">
                    {emailCooldownActive 
                      ? "You must wait 15 days between email changes for security reasons."
                      : "You will need to verify your new email address before the change takes effect."
                    }
                  </div>
                </div>
              )}

              {/* Password Tab */}
              {activeSettingsTab === 'password' && (
                <div className="space-y-3">
                  {/* Password Change Cooldown Timer */}
                  <PasswordChangeCooldownTimer
                    onCooldownEnd={() => setPasswordCooldownActive(false)}
                    onCooldownStatusChange={setPasswordCooldownActive}
                    className="mb-2"
                  />
                  
                  {(user as any)?.authProvider === 'google' && (
                    <div className="bg-blue-500/10 rounded-lg p-3 mb-3">
                      <h4 className="text-blue-400 font-semibold mb-1 text-sm">Google Account</h4>
                      <p className="text-white text-xs mb-1">
                        You signed in with Google. You can set a password to enable email/password login as an alternative to Google sign-in.
                      </p>
                      <p className="text-xsm-light-gray text-xs">
                        Setting a password won't affect your Google sign-in - you'll be able to use both methods.
                      </p>
                    </div>
                  )}
                  
                  {(user as any)?.authProvider !== 'google' && (
                    <div>
                      <label className="block text-white font-medium mb-1 text-sm">Current Password</label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? "text" : "password"}
                          value={settingsPasswordForm.currentPassword}
                          onChange={(e) => setSettingsPasswordForm({ ...settingsPasswordForm, currentPassword: e.target.value })}
                          disabled={passwordCooldownActive}
                          className={`xsm-input w-full text-sm pr-12 ${passwordCooldownActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                          placeholder={passwordCooldownActive ? "Password change is on cooldown" : "Enter current password"}
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          disabled={passwordCooldownActive}
                          className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors ${passwordCooldownActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-white font-medium mb-2">
                      {(user as any)?.authProvider === 'google' ? 'New Password' : 'New Password'}
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={settingsPasswordForm.newPassword}
                        onChange={(e) => setSettingsPasswordForm({ ...settingsPasswordForm, newPassword: e.target.value })}
                        disabled={passwordCooldownActive}
                        className={`xsm-input w-full pr-12 ${passwordCooldownActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                        placeholder={passwordCooldownActive ? "Password change is on cooldown" : ((user as any)?.authProvider === 'google' ? 'Enter a password (min 6 characters)' : 'Enter new password')}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        disabled={passwordCooldownActive}
                        className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors ${passwordCooldownActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-white font-medium mb-2">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={settingsPasswordForm.confirmPassword}
                        onChange={(e) => setSettingsPasswordForm({ ...settingsPasswordForm, confirmPassword: e.target.value })}
                        disabled={passwordCooldownActive}
                        className={`xsm-input w-full pr-12 ${passwordCooldownActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                        placeholder={passwordCooldownActive ? "Password change is on cooldown" : "Confirm new password"}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        disabled={passwordCooldownActive}
                        className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors ${passwordCooldownActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-400">
                    {passwordCooldownActive 
                      ? "You must wait 48 hours between password changes for security reasons."
                      : "Password must be at least 6 characters long."
                    }
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 mt-6">
              <button
                onClick={async () => {
                  try {
                    setIsUpdating(true);
                    
                    if (activeSettingsTab === 'username') {
                      // Username cannot be changed - this tab is read-only
                      showInfo('Username locked', 'Username cannot be changed for security reasons.');
                      return;
                      
                    } else if (activeSettingsTab === 'email') {
                      // Check if email change is on cooldown
                      if (emailCooldownActive) {
                        showWarning('Email change on cooldown', 'Please wait for the cooldown period to end before changing your email again.');
                        return;
                      }
                      
                      if (!settingsForm.email.trim()) {
                        showError('Missing email', 'Please enter a new email address.');
                        return;
                      }

                      if (settingsForm.email === profile.email) {
                        showInfo('No changes', 'Email is the same as current. No changes to save.');
                        return;
                      }
                      
                      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settingsForm.email)) {
                        showError('Invalid email', 'Please enter a valid email address.');
                        return;
                      }
                      
                      // Request email change with verification
                      const result = await requestEmailChange(settingsForm.email);
                      
                      // Store verification data for the dual verification modal
                      setPendingEmail(result.pendingEmail);
                      setEmailVerificationToken(result.verificationToken || 'temp-token');
                      setShowEmailVerification(true);
                      setShowSettings(false);
                      
                      // Show success notification for step 1
                      showSuccess('Verification email sent', 'Please check your current email address for the verification code.');
                      
                      
                      
                    } else if (activeSettingsTab === 'password') {
                      // Check if password change is on cooldown
                      if (passwordCooldownActive) {
                        showWarning('Password change on cooldown', 'Please wait for the cooldown period to end before changing your password again.');
                        return;
                      }
                      
                      // Password validation
                      if (settingsPasswordForm.newPassword !== settingsPasswordForm.confirmPassword) {
                        showError('Password mismatch', 'New passwords do not match!');
                        return;
                      }
                      
                      if (!settingsPasswordForm.newPassword) {
                        showError('Missing password', 'Please enter a new password!');
                        return;
                      }
                      
                      if (settingsPasswordForm.newPassword.length < 6) {
                        showError('Password too short', 'New password must be at least 6 characters long!');
                        return;
                      }

                      // Get the latest user profile from backend to check authProvider
                      const token = localStorage.getItem('token');
                      const profileResponse = await fetch(`${getApiUrl()}/user/profile`, {
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json'
                        }
                      });
                      
                      if (!profileResponse.ok) {
                        throw new Error('Failed to fetch user profile');
                      }
                      
                      const profileData = await profileResponse.json();
                      const backendUser = profileData.user;
                      const isGoogleUser = backendUser?.authProvider === 'google';
                      
                      // For Google users, they don't need current password
                      // For email users, they need current password
                      if (!isGoogleUser && !settingsPasswordForm.currentPassword) {
                        showError('Current password required', 'Please enter your current password!');
                        return;
                      }
                      
                      // Request secure password change with verification
                      const result = await requestPasswordChange(
                        isGoogleUser ? '' : settingsPasswordForm.currentPassword, 
                        settingsPasswordForm.newPassword
                      );
                      
                      // Store verification data for the modal
                      setPendingPasswordEmail(result.email);
                      setPasswordVerificationToken(result.verificationToken);
                      setIsGoogleUserPassword(result.isGoogleUser);
                      setShowPasswordVerification(true);
                      setShowSettings(false);
                      
                      // Show success notification
                      if (import.meta.env.DEV) {
                        showInfo('Verification email sent', 'Check your email for the verification code. In development, also check browser console or backend logs.');
                      } else {
                        showSuccess('Verification email sent', 'Please check your email for the verification code.');
                      }
                    }
                    
                    setShowSettings(false);
                  } catch (error: any) {
                    console.error('❌ Failed to update settings:', error);
                    
                    let errorMessage = 'Failed to update settings. Please try again.';
                    
                    if (activeSettingsTab === 'password' && error instanceof Error) {
                      if (error.message.includes('Current password is incorrect')) {
                        errorMessage = 'Current password is incorrect.';
                      } else if (error.message.includes('must be at least 6 characters')) {
                        errorMessage = 'New password must be at least 6 characters long.';
                      } else if (error.message.includes('Google OAuth. Please use "Sign in with Google"')) {
                        errorMessage = 'This account was created with Google OAuth. Please use "Sign in with Google" instead. To set a password for email login, leave the current password field empty.';
                      } else if (error.message.includes('Google account users don\'t have a current password')) {
                        errorMessage = 'For Google accounts, leave current password empty to set a new password.';
                      } else {
                        errorMessage = error.message;
                      }
                    } else if (error instanceof Error) {
                      errorMessage = error.message;
                    }
                    
                    showError('Update failed', errorMessage);
                  } finally {
                    setIsUpdating(false);
                  }
                }}
                disabled={isUpdating || (activeSettingsTab === 'email' && emailCooldownActive) || (activeSettingsTab === 'password' && passwordCooldownActive) || activeSettingsTab === 'username'}
                className={`xsm-button flex items-center space-x-2 ${isUpdating || (activeSettingsTab === 'email' && emailCooldownActive) || (activeSettingsTab === 'password' && passwordCooldownActive) || activeSettingsTab === 'username' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isUpdating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    <span>
                      {activeSettingsTab === 'password' 
                        ? ((user as any)?.authProvider === 'google' ? 'Setting Password...' : 'Changing Password...')
                        : 'Saving...'
                      }
                    </span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>
                      {activeSettingsTab === 'password' 
                        ? ((user as any)?.authProvider === 'google' ? 'Set Password' : 'Change Password')
                        : 'Save Changes'
                      }
                    </span>
                  </>
                )}
              </button>
              <button
                onClick={() => setShowSettings(false)}
                disabled={isUpdating}
                className="xsm-button-secondary flex items-center space-x-2"
              >
                <X className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dual Email Verification Modal */}
      <DualEmailVerificationModal
        isOpen={showEmailVerification}
        onClose={() => setShowEmailVerification(false)}
        onSuccess={(newEmail) => {
          // Update profile and user context with new email
          setProfile(prev => ({ ...prev, email: newEmail }));
          setUser(prev => prev ? { ...prev, email: newEmail } : prev);
          // Success notification is already handled by DualEmailVerificationModal
          
          // Reset form
          setSettingsForm(prev => ({ ...prev, email: '' }));
          setPendingEmail('');
          setEmailVerificationToken('');
        }}
        currentEmail={user?.email || ''}
        newEmail={pendingEmail}
        verificationToken={emailVerificationToken}
      />

      {/* Password Verification Modal */}
      <PasswordVerificationModal
        isOpen={showPasswordVerification}
        onClose={() => setShowPasswordVerification(false)}
        onSuccess={() => {
          // Reset form
          setSettingsPasswordForm({
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
          });
          
          // Success notification is already handled by PasswordVerificationModal
          // No need for additional alerts here
          
          // Clear verification data
          setPendingPasswordEmail('');
          setPasswordVerificationToken('');
        }}
        email={pendingPasswordEmail}
        verificationToken={passwordVerificationToken}
      />

      <VipSubscriptionModal
        isOpen={showVipModal}
        onClose={() => setShowVipModal(false)}
        onSuccess={(vipUntil) => {
          if (user) {
            const updatedUser = { ...user, isVip: true, vipUntil };
            localStorage.setItem('userData', JSON.stringify(updatedUser));
            setUser(updatedUser as any);
          }
        }}
      />
    </div>
  );
};

export default Profile;
