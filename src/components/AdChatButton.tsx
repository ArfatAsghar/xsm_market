import React, { useState } from 'react';
import { MessageSquare } from 'lucide-react';

// Get API URL from environment variables
const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://xsmmarket.com/api');
};

const API_URL = getApiUrl();

interface AdChatButtonProps {
  adId: number;
  sellerId: number | string;
  currentUserId: number | string;
  adTitle: string;
  onChatCreated?: (chatId: number) => void;
  onNavigateToChat?: () => void;
}

const AdChatButton: React.FC<AdChatButtonProps> = ({ 
  adId, 
  sellerId, 
  currentUserId, 
  adTitle,
  onChatCreated,
  onNavigateToChat
}) => {
  const [isCreating, setIsCreating] = useState(false);

  const createAdInquiry = async () => {
    try {
      setIsCreating(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/chat/ad-inquiry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          adId,
        })
      });

      const chat = await response.json();
      
      if (response.ok) {
        if (onChatCreated) {
          onChatCreated(chat.id);
        }
        // Navigate to chat page
        if (onNavigateToChat) {
          onNavigateToChat();
        }
      } else {
        alert(chat.message || 'Failed to create chat');
      }
    } catch (error) {
      console.error('Error creating ad inquiry:', error);
      alert('Failed to create chat');
    } finally {
      setIsCreating(false);
    }
  };

  const handleButtonClick = () => {
    if (currentUserId === sellerId) {
      alert("You can't start a chat with yourself");
      return;
    }
    createAdInquiry();
  };

  return (
    <button
      onClick={handleButtonClick}
      disabled={isCreating}
      className="flex items-center space-x-2 px-4 py-2 bg-xsm-yellow text-xsm-black rounded-lg hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
    >
      <MessageSquare className="w-4 h-4" />
      <span>{isCreating ? 'Connecting...' : 'Contact Seller'}</span>
    </button>
  );
};

export default AdChatButton;
    