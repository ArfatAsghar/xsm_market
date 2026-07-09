import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Send, Shield, MessageCircle, Image as ImageIcon, Video, X, BarChart3 } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { API_URL } from '@/services/auth';
import { getImageUrl } from '@/config/api';

// Custom scrollbar styles
const scrollbarStyles = `
  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #ffd000 #1A1A1A;
  }
  
  .custom-scrollbar::-webkit-scrollbar {
    width: 10px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #1A1A1A;
    border-radius: 6px;
    border: 1px solid #333333;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #ffd000 0%, #ffaa00 100%);
    border-radius: 6px;
    border: 2px solid #1A1A1A;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #ffdd33 0%, #ffbb33 100%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:active {
    background: linear-gradient(180deg, #e6b800 0%, #cc9900 100%);
  }
  
  .conversation-scrollbar::-webkit-scrollbar {
    width: 12px;
  }
  
  .conversation-scrollbar::-webkit-scrollbar-track {
    background: #000000;
    border-radius: 6px;
    border: 1px solid #333333;
  }
  
  .conversation-scrollbar::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #ffd000 0%, #ffaa00 100%);
    border-radius: 6px;
    border: 2px solid #000000;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  
  .conversation-scrollbar::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #ffdd33 0%, #ffbb33 100%);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3);
    transform: scale(1.05);
  }
  
  .conversation-scrollbar::-webkit-scrollbar-thumb:active {
    background: linear-gradient(180deg, #e6b800 0%, #cc9900 100%);
  }
  
  .messages-scrollbar::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #333333 0%, #555555 100%);
    border: 2px solid #1A1A1A;
  }
  
  .messages-scrollbar::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #666666 0%, #777777 100%);
  }
`;

interface Message {
  id: number;
  content: string;
  senderId: string;
  chatId: number;
  messageType: string;
  isRead: boolean;
  createdAt: string;
  mediaUrl?: string;
  sender: {
    id: string;
    username: string;
  };
}

interface ChatData {
  id: number;
  type: string;
  name?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  otherParticipants: Array<{
    id: string;
    username: string;
    email: string;
  }>;
  ad?: {
    id: number;
    title: string;
    price: number;
  };
  dealSummary?: {
    totalDeals: number;
    channels: string[];
    prices: number[];
    channelsBought: number;
    channelsSold: number;
  };
}

const Chat: React.FC = () => {
  const { user, isLoggedIn } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedChat, setSelectedChat] = useState<ChatData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chats, setChats] = useState<ChatData[]>([]);
  const [filteredChats, setFilteredChats] = useState<ChatData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [lastMessageId, setLastMessageId] = useState<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [showDealSummary, setShowDealSummary] = useState(false);

  // Remove Socket.IO and replace with polling-based real-time updates
  useEffect(() => {
    if (isLoggedIn && user && selectedChat) {
      // Start polling for new messages every 2 seconds
      const interval = setInterval(() => {
        checkForNewMessages();
      }, 2000);

      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [isLoggedIn, user, selectedChat, lastMessageId]);

  // Check for new messages
  const checkForNewMessages = async () => {
    if (!selectedChat || !user) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/chat/chats/${selectedChat.id}/messages?since=${lastMessageId || 0}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const newMessages = await response.json();
        if (newMessages.length > 0) {
          let shouldAutoScroll = false;
          
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const uniqueNewMessages = newMessages.filter((m: Message) => !existingIds.has(m.id));
            
            // Only auto-scroll if there are actually new messages
            if (uniqueNewMessages.length > 0) {
              shouldAutoScroll = true;
            }
            
            return [...prev, ...uniqueNewMessages];
          });
          
          // Update last message ID
          const latestMessage = newMessages[newMessages.length - 1];
          setLastMessageId(latestMessage.id);
          
          // Update chat list with latest message
          updateChatLastMessage(latestMessage);
          
          // Only scroll if there were actually new messages
          if (shouldAutoScroll) {
            setTimeout(scrollToBottom, 100);
          }
        }
      }
    } catch (error) {
      console.error('Error checking for new messages:', error);
    }
  };

  // Fetch chats when component mounts
  useEffect(() => {
    if (isLoggedIn && user) {
      fetchChats();
    }
  }, [isLoggedIn, user]);

  // Auto-scroll to bottom only when chat is first selected or manually sending messages
  useEffect(() => {
    if (selectedChat) {
      // Scroll to bottom when a chat is first selected
      setTimeout(scrollToBottom, 100);
    }
  }, [selectedChat]);

  // Filter chats based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredChats(chats);
    } else {
      const filtered = chats.filter(chat => {
        const chatName = getChatDisplayName(chat).toLowerCase();
        const lastMessage = chat.lastMessage?.toLowerCase() || '';
        const query = searchQuery.toLowerCase();
        
        return chatName.includes(query) || lastMessage.includes(query);
      });
      setFilteredChats(filtered);
    }
  }, [chats, searchQuery]);

  // Load messages when chat is selected
  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
      setLastMessageId(null); // Reset for new chat
    }
  }, [selectedChat]);

  // Refresh chat list periodically to show new chats
  useEffect(() => {
    if (isLoggedIn && user) {
      const interval = setInterval(() => {
        fetchChats();
      }, 10000); // Refresh every 10 seconds
      
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, user]);

  const fetchChats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/chat/chats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setChats(data);
      setFilteredChats(data);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle URL parameters to auto-select chat
useEffect(() => {
  const chatId = searchParams.get('chatId');

  if (chatId && chats.length > 0) {
    const targetChat = chats.find(chat => chat.id.toString() === chatId);

    if (targetChat) {
      setSelectedChat(targetChat);
      fetchMessages(targetChat.id);

      // Clear the URL parameter without adding another chat page to browser history
            setSearchParams(new URLSearchParams(), { replace: true });    }
  }
}, [chats, searchParams, setSearchParams]);

  const fetchMessages = async (chatId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/chat/chats/${chatId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setMessages(data);
      
      // Set the last message ID for polling
      if (data.length > 0) {
        const latestMessage = data[data.length - 1];
        setLastMessageId(latestMessage.id);
      }
      
      // Mark messages as read
      await fetch(`${API_URL}/chat/chats/${chatId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !user) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/chat/chats/${selectedChat.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: newMessage.trim(),
          messageType: 'text'
        })
      });

      if (response.ok) {
        const message = await response.json();
        
        // Add to local messages immediately
        setMessages(prev => [...prev, message]);
        setLastMessageId(message.id);

        // Update chat list
        updateChatLastMessage(message);
        
        setNewMessage('');
        
        // Scroll to bottom after sending a message
        setTimeout(scrollToBottom, 100);
        
        // Force check for any other new messages
        setTimeout(() => checkForNewMessages(), 500);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleSendImage = async (file: File) => {
    if (!selectedChat || !user || !file) return;
    
    // Check file size (limit to 10MB for images)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image file size must be less than 10MB');
      return;
    }
    
    setImageUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file); // Changed from 'image' to 'file'
      formData.append('messageType', 'image');
      
      console.log('Uploading image:', file.name, 'Size:', file.size);
      
      // Use the correct upload endpoint
      const response = await fetch(`${API_URL}/chat/chats/${selectedChat.id}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (response.ok) {
        const message = await response.json();
        console.log('Image upload successful:', message);
        setMessages(prev => [...prev, message]);
        setLastMessageId(message.id);
        updateChatLastMessage(message);
        // Scroll to bottom after sending an image
        setTimeout(scrollToBottom, 100);
        setTimeout(() => checkForNewMessages(), 500);
      } else {
        const errorData = await response.json();
        console.error('Image upload failed:', errorData);
        throw new Error(errorData.message || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Error sending image:', error);
      alert(`Failed to send image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setImageUploading(false);
    }
  };

  const handleSendVideo = async (file: File) => {
    if (!selectedChat || !user || !file) return;
    
    // Check file size (limit to 50MB for videos)
    if (file.size > 50 * 1024 * 1024) {
      alert('Video file size must be less than 50MB');
      return;
    }
    
    setVideoUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file); // Changed from 'video' to 'file'
      formData.append('messageType', 'video');
      
      console.log('Uploading video:', file.name, 'Size:', file.size);
      
      // Use the correct upload endpoint
      const response = await fetch(`${API_URL}/chat/chats/${selectedChat.id}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (response.ok) {
        const message = await response.json();
        console.log('Video upload successful:', message);
        setMessages(prev => [...prev, message]);
        setLastMessageId(message.id);
        updateChatLastMessage(message);
        // Scroll to bottom after sending a video
        setTimeout(scrollToBottom, 100);
        setTimeout(() => checkForNewMessages(), 500);
      } else {
        const errorData = await response.json();
        console.error('Video upload failed:', errorData);
        throw new Error(errorData.message || 'Failed to upload video');
      }
    } catch (error) {
      console.error('Error sending video:', error);
      alert(`Failed to send video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setVideoUploading(false);
    }
  };

  const updateChatLastMessage = (message: Message) => {
    let displayMessage = message.content;
    
    // Show appropriate text for media messages
    if (message.messageType === 'image') {
      displayMessage = '📷 Sent an image';
    } else if (message.messageType === 'video') {
      displayMessage = '🎥 Sent a video';
    }
    
    setChats(prev => prev.map(chat => 
      chat.id === message.chatId 
        ? { ...chat, lastMessage: displayMessage, lastMessageTime: message.createdAt }
        : chat
    ).sort((a, b) => new Date(b.lastMessageTime || 0).getTime() - new Date(a.lastMessageTime || 0).getTime()));
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      // Scroll the messages container to bottom, not the entire page
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // const handleReport = () => {
  //   if (reportReason.trim()) {
  //     alert(`User reported successfully. Reason: ${reportReason}\n\nOur admin team will review this report within 24 hours.`);
  //     setReportModalOpen(false);
  //     setReportReason('');
  //   }
  // };

  const formatTime = (dateString: string) => {
    // Parse the date string. If it doesn't have timezone info, treat as UTC
    let date: Date;
    if (dateString.includes('T') || dateString.includes('Z')) {
      // Already has timezone info
      date = new Date(dateString);
    } else {
      // No timezone info, assume it's UTC from server
      date = new Date(dateString.replace(' ', 'T') + 'Z');
    }
    
    const now = new Date();
    
    // Check if it's today in user's local timezone
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      // Show time for today's messages in user's local timezone
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } else {
      // Show date and time for older messages in user's local timezone
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday ${date.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        })}`;
      } else {
        return date.toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }
    }
  };

  const formatLastSeen = (dateString: string) => {
    if (!dateString) return '';
    
    // Parse the date string properly with timezone handling
    let date: Date;
    if (dateString.includes('T') || dateString.includes('Z')) {
      // Already has timezone info
      date = new Date(dateString);
    } else {
      // No timezone info, assume it's UTC from server
      date = new Date(dateString.replace(' ', 'T') + 'Z');
    }
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    // For very recent messages (less than 1 minute), show "now"
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    // For older messages, show the date
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric'
    });
  };

  const handleCloseChat = () => {
  const historyState = window.history.state as { idx?: number } | null;

  if (historyState?.idx && historyState.idx > 0) {
    navigate(-1);
    return;
  }

  navigate('/', { replace: true });
};

  const handleOpenWebsiteAgent = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/chat/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Unable to open Website Agent chat');
      }

      const agentChat = await response.json();
      setSelectedChat(agentChat);
      setSearchParams({ chatId: String(agentChat.id) });
      await fetchChats();
    } catch (error) {
      console.error('Error opening Website Agent chat:', error);
      alert('Website Agent is not configured yet. Please ask an admin to create an admin support account.');
    }
  };

  const handleOpenParticipantProfile = (chat: ChatData) => {
    const otherUser = chat.otherParticipants?.[0];
    if (!otherUser || chat.name === 'Website Agent') return;
    navigate(`/u/${otherUser.username}`);
  };

  const getChatDisplayName = (chat: ChatData) => {
    if (chat.name === 'Website Agent') {
  return 'Website Agent';
}
    // For ad inquiries, show seller name instead of ad title
    if (chat.type === 'ad_inquiry') {
      if (chat.otherParticipants.length > 0) {
        const otherUser = chat.otherParticipants[0];
        return otherUser.username;
      }
      // Fallback to ad title if no participants
      if (chat.ad) {
        return `Inquiry: ${chat.ad.title}`;
      }
    }
    
    // For direct chats, show the other participant's name
    if (chat.otherParticipants.length > 0) {
      return chat.otherParticipants[0].username;
    }
    
    // Use chat name if available
    if (chat.name) {
      return chat.name;
    }
    
    return 'Unknown';
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-xsm-black to-xsm-dark-gray flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-xsm-yellow mb-4">Please Login</h1>
          <p className="text-xl text-white">You need to login to access the chat system.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-xsm-black to-xsm-dark-gray">
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="relative text-center mb-8">
          <button
            type="button"
            onClick={handleCloseChat}
            className="absolute right-0 top-0 text-gray-400 hover:text-white hover:border-xsm-yellow hover:bg-xsm-yellow/10 transition-colors border border-xsm-medium-gray rounded-lg p-2"
            title="Close chat"
            aria-label="Close chat"
          >
            <X className="w-5 h-5" />
          </button>
          <h1 className="text-4xl font-bold text-xsm-yellow mb-4">Secure Chat</h1>
          <p className="text-xl text-white">
            Communicate safely with buyers and sellers through our secure messaging system
          </p>
        </div>

        <div className="bg-xsm-dark-gray rounded-lg overflow-hidden" style={{ height: '600px' }}>
          <div className="flex h-full">
            {/* Chat List */}
            <div className="w-80 bg-xsm-black border-r border-xsm-medium-gray">
              <div className="p-4 border-b border-xsm-medium-gray">
                <h3 className="text-lg font-semibold text-xsm-yellow flex items-center">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Conversations
                </h3>
              </div>

              <div className="p-4 border-b border-xsm-medium-gray">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full px-4 py-2 bg-xsm-dark-gray text-white rounded-lg border border-xsm-medium-gray focus:outline-none focus:border-xsm-yellow"
                />
              </div>

              <div 
                className="overflow-y-auto custom-scrollbar conversation-scrollbar" 
                style={{ height: 'calc(100% - 113px)' }}
              >
                {loading ? (
                  <div className="p-4 text-center text-white">Loading chats...</div>
                ) : filteredChats.length === 0 ? (
                  <div className="p-4 text-center text-gray-400">
                    <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No conversations yet</p>
                    <p className="text-sm mb-4">Start chatting by contacting a seller or ask for help.</p>
                    <button
                      onClick={handleOpenWebsiteAgent}
                      className="w-full bg-xsm-yellow text-black px-4 py-2 rounded-lg hover:bg-yellow-500 transition-colors text-sm font-medium"
                    >
                      Website Agent
                    </button>
                  </div>
                ) : (
                  <>
                    {filteredChats.map(chat => (
                      <div
                        key={chat.id}
                        onClick={() => setSelectedChat(chat)}
                        className={`p-4 border-b border-xsm-medium-gray cursor-pointer hover:bg-xsm-dark-gray transition-colors ${
                          selectedChat?.id === chat.id ? 'bg-xsm-medium-gray' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-xsm-yellow rounded-full flex items-center justify-center text-xsm-black font-bold text-sm mr-3">
                              {getChatDisplayName(chat).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="text-white font-medium text-sm">
                                {getChatDisplayName(chat)}
                              </h4>
                              {chat.ad && (
                                <p className="text-xs text-xsm-yellow">
                                  {chat.ad.title} - ${chat.ad.price}
                                </p>
                              )}
                            </div>
                          </div>
                          {chat.lastMessageTime && (
                            <span className="text-xs text-gray-400">
                              {formatLastSeen(chat.lastMessageTime)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-300 truncate">
                          {chat.lastMessage || 'No messages yet'}
                        </p>
                      </div>
                    ))}
                    <button
                      onClick={handleOpenWebsiteAgent}
                      className="m-4 w-[calc(100%-2rem)] bg-xsm-dark-gray border border-xsm-yellow/40 text-xsm-yellow px-4 py-2 rounded-lg hover:bg-xsm-yellow hover:text-black transition-colors text-sm font-medium"
                    >
                      Website Agent
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
              {selectedChat ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-xsm-medium-gray bg-xsm-black flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-xsm-yellow rounded-full flex items-center justify-center text-xsm-black font-bold">
                        {getChatDisplayName(selectedChat).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <button
                          onClick={() => handleOpenParticipantProfile(selectedChat)}
                          className="text-white font-medium hover:text-xsm-yellow transition-colors text-left"
                          title="Open seller profile"
                        >
                          {getChatDisplayName(selectedChat)}
                        </button>
                        {selectedChat.ad && (
                          <p className="text-sm text-xsm-yellow">{selectedChat.ad.title} - ${selectedChat.ad.price}</p>
                        )}
                      </div>
                    </div>
                    {selectedChat.name !== 'Website Agent' && (
                      <button
                        onClick={() => setShowDealSummary(true)}
                        className="flex items-center gap-2 text-sm border border-xsm-yellow/40 text-xsm-yellow px-3 py-2 rounded-lg hover:bg-xsm-yellow hover:text-black transition-colors"
                      >
                        <BarChart3 className="w-4 h-4" />
                        Deals
                      </button>
                    )}
                  </div>

                  {/* Messages */}
                  <div 
                    ref={messagesContainerRef}
                    className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar messages-scrollbar"
                  >
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-400 py-8">
                        <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No messages yet. Start the conversation!</p>
                      </div>
                    ) : (
                      messages.map(message => {
                        const isMyMessage = message.senderId === user?.id || String(message.senderId) === String(user?.id);
                        console.log('Message:', message.id, 'SenderId:', message.senderId, 'UserId:', user?.id, 'IsMyMessage:', isMyMessage);
                        
                        return (
                          <div
                            key={message.id}
                            className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                isMyMessage
                                  ? 'bg-xsm-yellow text-xsm-black'
                                  : 'bg-xsm-medium-gray text-white'
                              }`}
                            >
                              {!isMyMessage && (
                                <p className="text-xs font-medium mb-1 opacity-75">
                                  {message.sender?.username}
                                </p>
                              )}
                              {message.messageType === 'image' && (message.mediaUrl || message.content) ? (
                                <div className="relative">
                                  <img
                                    src={getImageUrl(message.mediaUrl || message.content) || message.mediaUrl || message.content}
                                    alt="Sent image"
                                    className="rounded-lg max-w-[200px] max-h-[200px] mb-2 border border-xsm-yellow cursor-pointer"
                                    style={{ objectFit: 'cover' }}
                                    onClick={() => window.open(getImageUrl(message.mediaUrl || message.content) || message.mediaUrl || message.content, '_blank')}
                                    onError={(e) => {
                                      console.error('Image failed to load:', {
                                        originalContent: message.content,
                                        mediaUrl: message.mediaUrl,
                                        resolvedUrl: getImageUrl(message.mediaUrl || message.content) || message.mediaUrl || message.content
                                      });
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      // Show fallback
                                      const fallback = target.nextElementSibling as HTMLElement;
                                      if (fallback) fallback.style.display = 'flex';
                                    }}
                                  />
                                  {/* Fallback for broken images */}
                                  <div 
                                    className="absolute inset-0 bg-gray-700 rounded-lg flex items-center justify-center text-white text-sm"
                                    style={{ display: 'none' }}
                                  >
                                    <div className="text-center p-4">
                                      <div className="text-2xl mb-2">🖼️</div>
                                      <div>Image unavailable</div>
                                      <button 
                                        onClick={() => {
                                          const url = getImageUrl(message.content) || message.content;
                                          window.open(url, '_blank');
                                        }}
                                        className="mt-2 px-3 py-1 bg-xsm-yellow text-black rounded text-xs hover:bg-yellow-500"
                                      >
                                        Try Opening
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : message.messageType === 'video' && (message.mediaUrl || message.content) ? (
                                <div className="relative rounded-lg overflow-hidden max-w-[250px] max-h-[200px] mb-2 border border-xsm-yellow bg-black">
                                  <video
                                    className="w-full h-full object-cover"
                                    controls
                                    preload="metadata"
                                    style={{ maxHeight: '200px' }}
                                    onError={(e) => {
                                      console.error('Video failed to load:', {
                                        originalContent: message.content,
                                        mediaUrl: message.mediaUrl,
                                        resolvedUrl: getImageUrl(message.mediaUrl || message.content) || message.mediaUrl || message.content,
                                        error: e
                                      });
                                      const target = e.target as HTMLVideoElement;
                                      target.style.display = 'none';
                                      // Show fallback
                                      const fallback = target.nextElementSibling as HTMLElement;
                                      if (fallback) fallback.style.display = 'flex';
                                    }}
                                    onLoadStart={() => {
                                      const videoUrl = getImageUrl(message.mediaUrl || message.content) || message.mediaUrl || message.content;
                                      console.log('Video load started:', videoUrl);
                                      console.log('Video message data:', message);
                                    }}
                                    onCanPlay={() => {
                                      console.log('Video can play');
                                    }}
                                    onLoadedData={() => {
                                      console.log('Video data loaded');
                                    }}
                                  >
                                    <source 
                                      src={getImageUrl(message.mediaUrl || message.content) || message.mediaUrl || message.content} 
                                      type="video/mp4" 
                                    />
                                    <source 
                                      src={getImageUrl(message.mediaUrl || message.content) || message.mediaUrl || message.content} 
                                      type="video/quicktime" 
                                    />
                                    <source 
                                      src={getImageUrl(message.mediaUrl || message.content) || message.mediaUrl || message.content} 
                                      type="video/webm" 
                                    />
                                    Your browser does not support the video tag.
                                  </video>
                                  {/* Fallback display for broken videos */}
                                  <div 
                                    className="absolute inset-0 bg-gray-700 flex items-center justify-center text-white text-sm"
                                    style={{ display: 'none' }}
                                  >
                                    <div className="text-center p-4">
                                      <div className="text-2xl mb-2">🎥</div>
                                      <div>Video file</div>
                                      <div className="text-xs mt-1 break-all px-2 max-w-[200px]">
                                        {message.content.split('/').pop()}
                                      </div>
                                      <button 
                                        onClick={() => {
                                          const url = getImageUrl(message.content) || message.content;
                                          console.log('Attempting to open video:', url);
                                          window.open(url, '_blank');
                                        }}
                                        className="mt-2 px-3 py-1 bg-xsm-yellow text-black rounded text-xs hover:bg-yellow-500"
                                      >
                                        Open Video
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm">{message.content}</p>
                              )}
                              <p
                                className={`text-xs mt-1 ${
                                  isMyMessage ? 'text-xsm-dark-gray' : 'text-gray-400'
                                }`}
                              >
                                {formatTime(message.createdAt)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t border-xsm-medium-gray bg-xsm-black">
                    <div className="flex space-x-2">
                      {/* Image Button */}
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className={`p-2 text-gray-400 hover:text-xsm-yellow rounded-lg border border-xsm-yellow bg-xsm-dark-gray ${
                          imageUploading ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        title="Attach Image"
                        disabled={imageUploading || videoUploading}
                      >
                        {imageUploading ? (
                          <div className="w-5 h-5 border-2 border-xsm-yellow border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <ImageIcon className="w-5 h-5" />
                        )}
                      </button>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => {
                          if (e.target.files && e.target.files[0]) {
                            handleSendImage(e.target.files[0]);
                            e.target.value = '';
                          }
                        }}
                      />
                      {/* Video Button */}
                      <button
                        type="button"
                        onClick={() => videoInputRef.current?.click()}
                        className={`p-2 text-gray-400 hover:text-xsm-yellow rounded-lg border border-xsm-yellow bg-xsm-dark-gray ${
                          videoUploading ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        title="Attach Video"
                        disabled={videoUploading || imageUploading}
                      >
                        {videoUploading ? (
                          <div className="w-5 h-5 border-2 border-xsm-yellow border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Video className="w-5 h-5" />
                        )}
                      </button>
                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/*"
                        style={{ display: 'none' }}
                        onChange={e => {
                          if (e.target.files && e.target.files[0]) {
                            handleSendVideo(e.target.files[0]);
                            e.target.value = '';
                          }
                        }}
                      />
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Type your message..."
                        className="flex-1 px-4 py-2 bg-xsm-dark-gray text-white rounded-lg border border-xsm-medium-gray focus:outline-none focus:border-xsm-yellow"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim()}
                        className="px-4 py-2 bg-xsm-yellow text-xsm-black rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Select a conversation to start messaging</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {showDealSummary && selectedChat && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-xsm-dark-gray border border-xsm-medium-gray rounded-xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-xsm-yellow">Deal Summary</h3>
                <button onClick={() => setShowDealSummary(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 text-white">
                <div className="flex justify-between">
                  <span className="text-xsm-light-gray">Total deals</span>
                  <span className="font-semibold">{selectedChat.dealSummary?.totalDeals || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xsm-light-gray">Channels bought</span>
                  <span>{selectedChat.dealSummary?.channelsBought || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xsm-light-gray">Channels sold</span>
                  <span>{selectedChat.dealSummary?.channelsSold || 0}</span>
                </div>
                {(selectedChat.dealSummary?.channels || []).length > 0 ? (
                  <div className="pt-3 border-t border-xsm-medium-gray">
                    <p className="text-sm text-xsm-light-gray mb-2">Deal channels and prices</p>
                    {(selectedChat.dealSummary?.channels || []).map((channel, index) => (
                      <div key={`${channel}-${index}`} className="flex justify-between text-sm py-1">
                        <span className="truncate pr-3">{channel}</span>
                        <span>${selectedChat.dealSummary?.prices?.[index] || 0}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-xsm-light-gray pt-3 border-t border-xsm-medium-gray">No completed deals with this user yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Security Notice */}
        <div className="mt-6 bg-xsm-black/50 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-xsm-yellow mb-2">
            <Shield className="w-5 h-5" />
            <span className="font-semibold">Security Notice</span>
          </div>
          <p className="text-white text-sm">
            All conversations are monitored for security. Never share personal financial information, 
            passwords, or complete transactions outside our secure payment system.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Chat;