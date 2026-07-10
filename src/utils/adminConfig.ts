// Admin configuration
let adminData: { adminEmail: string | null; adminUsername: string | null } | null = null;

// Get API URL from environment variables
const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://xsmmarket.com/api');
};

// Fetch admin data from backend
const fetchAdminData = async (): Promise<{ adminEmail: string | null; adminUsername: string | null }> => {
  if (adminData !== null) {
    return adminData; // Return cached value
  }
  
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return { adminEmail: null, adminUsername: null };
    }

    // Use the backend URL from environment variables
    const response = await fetch(`${getApiUrl()}/admin/email`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      adminData = {
        adminEmail: data.adminEmail || null,
        adminUsername: data.adminUsername || null
      };
      return adminData;
    }
  } catch (error) {
    console.error('❌ Failed to fetch admin data:', error);
  }
  
  return { adminEmail: null, adminUsername: null };
};

export const ADMIN_CONFIG = {
  // This is now fetched from backend .env file
  ADMIN_EMAIL: 'hamzasheikh1228@gmail.com', // Fallback, actual value comes from backend
} as const;

/**
 * Check if a user is an admin based on their isAdmin flag from the database
 * @param userEmail The user's email address
 * @param username The user's username (optional)
 * @returns Promise<boolean> true if the user is an admin, false otherwise
 */
export const isCurrentUserAdmin = async (userEmail: string | undefined, username?: string | undefined): Promise<boolean> => {
  try {
    // First check if user has isAdmin flag set to true in localStorage
    const userData = localStorage.getItem('userData');
    if (userData) {
      const user = JSON.parse(userData);
      if (user.isAdmin === true) {
        console.log('✅ User is admin (isAdmin flag set to true)');
        return true;
      }
    }
    
    // Fallback: check against backend admin configuration
    const { adminEmail, adminUsername } = await fetchAdminData();
    
    const isAdminByEmail = adminEmail && userEmail && 
      userEmail.toLowerCase() === adminEmail.toLowerCase();
    
    const isAdminByUsername = adminUsername && username && 
      username.toLowerCase() === adminUsername.toLowerCase();
    
    const isAdmin = isAdminByEmail || isAdminByUsername;
    
    if (isAdmin) {
      console.log('✅ User is admin (matched admin email/username)');
    } else {
      console.log('❌ User is not admin');
    }
    
    return isAdmin;
  } catch (error) {
    console.error('❌ Error checking admin status:', error);
    return false;
  }
};

/**
 * @deprecated Use isCurrentUserAdmin instead - this function checks email locally
 * Check if a user is an admin based on their email
 * @param email The user's email address
 * @returns true if the user is an admin, false otherwise
 */
export const isAdminUser = (email: string | undefined): boolean => {
  if (!email) return false;
  return email.toLowerCase() === ADMIN_CONFIG.ADMIN_EMAIL.toLowerCase();
};
