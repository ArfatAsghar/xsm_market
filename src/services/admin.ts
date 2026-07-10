// Use environment variable for API URL
const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://xsmmarket.com/api');
};

const ADMIN_API_URL = getApiUrl();

// Fetch all users (admin only)
export const getAllUsers = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${ADMIN_API_URL}/admin/users`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch users: ${response.statusText}`);
  }

  return await response.json();
};

// Fetch all chats (admin only)
export const getAllChats = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${ADMIN_API_URL}/admin/chats`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch chats: ${response.statusText}`);
  }

  return await response.json();
};

// Fetch dashboard statistics (admin only)
export const getDashboardStats = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${ADMIN_API_URL}/admin/dashboard-stats`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch dashboard stats: ${response.statusText}`);
  }

  return await response.json();
};

// Fetch all deals (admin only)
export const getAllDeals = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${ADMIN_API_URL}/admin/deals`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch deals: ${response.statusText}`);
  }

  return await response.json();
};

// Fetch recent activities (admin only)
export const getRecentActivities = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${ADMIN_API_URL}/admin/recent-activities`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch recent activities: ${response.statusText}`);
  }

  return await response.json();
}; 

// Admin send message to chat
export const adminSendMessage = async (chatId: string, content: string) => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${ADMIN_API_URL}/chat/admin/chats/${chatId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ content })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to send message: ${response.statusText}`);
  }

  return await response.json();
};

// Admin delete individual message
export const adminDeleteMessage = async (messageId: string) => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${ADMIN_API_URL}/chat/admin/messages/${messageId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to delete message: ${response.statusText}`);
  }

  return await response.json();
};

// Admin delete entire chat
export const adminDeleteChat = async (chatId: string) => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${ADMIN_API_URL}/chat/admin/chats/${chatId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to delete chat: ${response.statusText}`);
  }

  return await response.json();
}; 

// Admin confirms that agent has been made primary owner (official API call)
export const markPrimaryOwnerMade = async (dealId: number) => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${ADMIN_API_URL}/admin/deals/${dealId}/confirm-primary-owner`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to mark primary owner made: ${response.statusText}`);
  }

  return await response.json();
};

// Admin send ownership confirmation message for a deal (legacy function - kept for backward compatibility)
export const adminSendOwnershipConfirmation = async (buyerUsername: string, sellerUsername: string, dealId: number, channelTitle: string) => {
  try {
    // Get all chats to find the one between buyer and seller
    const chats = await getAllChats();
    
    // Find the chat between the buyer and seller
    const dealChat = chats.find((chat: any) => {
      const participantUsernames = chat.participants.map((p: any) => p.username);
      return participantUsernames.includes(buyerUsername) && participantUsernames.includes(sellerUsername);
    });
    
    if (!dealChat) {
      throw new Error(`Could not find chat between ${buyerUsername} and ${sellerUsername}`);
    }
    
    // Create ownership confirmation message
    const message = `🎉 **AGENT OWNERSHIP CONFIRMED** 🎉

Great news! Our agent has successfully been made the Primary Owner of the channel.

**Channel**: ${channelTitle}
**Transaction ID**: #${dealId}
**Status**: Agent now has full control

📸 **Next Steps:**
1. Agent will take final screenshots of the account
2. Agent will remove all seller access and secure the account
3. Screenshots will be shared in this chat as proof
4. Buyer can then proceed with payment to seller

💰 **For the Buyer**: Once you see the screenshots confirming agent control, you can safely pay the seller via your agreed payment method and then click "I HAVE PAID THE SELLER" button in your deal interface.

🔒 **Security**: The account is now fully secured under our agent's control until final transfer to buyer.`;
    
    // Send the message using the working admin chat system
    await adminSendMessage(dealChat.id, message);
    
    return { success: true, chatId: dealChat.id };
  } catch (error) {
    console.error('Error sending ownership confirmation:', error);
    throw error;
  }
};

// Update ad status (admin only)
export const updateAdStatus = async (adId: number, status: string, rejectionReason?: string) => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${ADMIN_API_URL}/admin/ads/${adId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status, rejectionReason })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to update ad status: ${response.statusText}`);
  }

  return await response.json();
};

// Ban user (admin only)
export const banUser = async (userId: number, reason: string) => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${ADMIN_API_URL}/admin/users/${userId}/ban`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ reason })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to ban user: ${response.statusText}`);
  }

  return await response.json();
};

// Unban user (admin only)
export const unbanUser = async (userId: number) => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${ADMIN_API_URL}/admin/users/${userId}/unban`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to unban user: ${response.statusText}`);
  }

  return await response.json();
};

// Delete listing (admin only)
export const deleteListing = async (listingId: number) => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }

  // Use the admin-specific DELETE endpoint
  const response = await fetch(`/api/admin/ads/${listingId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete listing');
  }

  return result;
};

// Delete user (admin only)
export const deleteUser = async (userId: string) => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }

  // Use the admin-specific DELETE endpoint
  const response = await fetch(`/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete user');
  }

  return result;
};

// Update user status (admin only)
export const updateUserStatus = async (userId: string, status: string) => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`/api/admin/users/${userId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to update user status');
  }

  return result;
};

// Update user role (admin only)
export const updateUserRole = async (userId: string, role: string) => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`/api/admin/users/${userId}/role`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ role })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to update user role');
  }

  return result;
};