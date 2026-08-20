import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Send, Shield, MessageCircle, Image as ImageIcon, Video, X, BarChart3, HeadphonesIcon } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { API_URL } from '@/services/auth';
import { getImageUrl } from '@/config/api';
import { toast } from '@/components/ui/use-toast';
import { io, Socket } from 'socket.io-client';
import DealCardMessage from '@/components/DealCardMessage';

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
    isAdmin?: boolean;
  };
}

interface ChatData {
  id: number;
  type: string;
  name?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  otherParticipants?: Array<{
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
    deals?: Array<{
      channel: string;
      price: number;
      role?: string;
      status?: string;
    }>;
  };
  support_requested?: boolean;
  unreadCount?: number;
  unread_count?: number;
  buyerUserId?: number | null;
  sellerUserId?: number | null;
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
  const [announcements, setAnnouncements] = useState<Array<{id:number;title:string;description:string;created_at:string}>>([]);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [announcementsExpanded, setAnnouncementsExpanded] = useState(false);
  const [isAnnouncementsSelected, setIsAnnouncementsSelected] = useState(false);
  const [announcementsUnread, setAnnouncementsUnread] = useState(false);
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
  const [isSendingAgentRequest, setIsSendingAgentRequest] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [remoteTypingUser, setRemoteTypingUser] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSeenAnnouncementIdRef = useRef<number>(parseInt(localStorage.getItem('xsm_lastSeenAnnouncementId') || '0', 10));
  // Deal card refs: dealId -> DOM element for scroll-to-highlight
  const dealCardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [highlightedDealId, setHighlightedDealId] = useState<number | null>(null);

  const handleRequestAgent = async () => {
    if (!selectedChat || !user) return;
    setIsSendingAgentRequest(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/chat/chats/${selectedChat.id}/request-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        toast({
          title: '✅ Request Sent',
          description: 'An admin has been notified to assist in this conversation.',
        });
        // Immediately disable the button for both users by updating local state
        setSelectedChat(prev => prev ? { ...prev, support_requested: true } : null);
        setChats(prev => prev.map(c => c.id === selectedChat.id ? { ...c, support_requested: true } : c));
      } else {
        const data = await response.json().catch(() => ({}));
        toast({
          variant: 'destructive',
          title: 'Failed to send request',
          description: data.message || 'Please try again.',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Network Error',
        description: 'Could not reach the server. Please try again.',
      });
    } finally {
      setIsSendingAgentRequest(false);
    }
  };

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!isLoggedIn || !user) return;

    // Connect to socket server (port 3001 in dev or window.location.origin)
    const socketUrl = import.meta.env.VITE_SOCKET_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin);
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('⚡ Real-time Socket connected:', newSocket.id);
      newSocket.emit('user_connected', { userId: user.id, username: user.username });
    });

    newSocket.on('new_message', (msg: Message) => {
      console.log('💬 Instant socket message received:', msg);
      if (selectedChat && msg.chatId === selectedChat.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setLastMessageId(msg.id);
        setTimeout(scrollToBottom, 50);
        // Automatically emit delivered receipt back to sender
        newSocket.emit('message_delivered', { messageId: msg.id, chatId: msg.chatId });
      }
      updateChatLastMessage(msg);
    });

    newSocket.on('user_typing', (data: { chatId: number; username: string }) => {
      if (selectedChat && data.chatId === selectedChat.id) {
        setRemoteTypingUser(data.username);
      }
    });

    newSocket.on('user_stop_typing', (data: { chatId: number }) => {
      if (selectedChat && data.chatId === selectedChat.id) {
        setRemoteTypingUser(null);
      }
    });

    newSocket.on('message_status_update', (data: { messageId: number; status: string; chatId: number }) => {
      if (selectedChat && data.chatId === selectedChat.id) {
        setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, status: data.status, isRead: data.status === 'read' } : m));
      }
    });

    newSocket.on('messages_read', (data: { chatId: number }) => {
      if (selectedChat && data.chatId === selectedChat.id) {
        setMessages(prev => prev.map(m => ({ ...m, isRead: true, status: 'read' })));
      }
    });

    newSocket.on('presence_update', (data: { onlineUserIds: string[] }) => {
      setOnlineUserIds(new Set(data.onlineUserIds));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isLoggedIn, user, selectedChat]);

  // Join chat room whenever selectedChat changes
  useEffect(() => {
    if (socket && selectedChat) {
      socket.emit('join_chat', selectedChat.id);
      setRemoteTypingUser(null);
      return () => {
        socket.emit('leave_chat', selectedChat.id);
      };
    }
  }, [socket, selectedChat]);

  // Combined fallback polling for new messages every 2 seconds
  useEffect(() => {
    if (isLoggedIn && user && selectedChat) {
      const interval = setInterval(() => {
        checkForNewMessages();
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [isLoggedIn, user, selectedChat, lastMessageId]);

  // Check for new messages & sync live status ticks (sent, delivered, read)
  const checkForNewMessages = async () => {
    if (!selectedChat || !user) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/chat/chats/${selectedChat.id}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const fetchedMessages = await response.json();
        if (Array.isArray(fetchedMessages) && fetchedMessages.length > 0) {
          let hasNewMessage = false;

          setMessages(prev => {
            const prevMap = new Map(prev.map(m => [m.id, m]));
            let stateChanged = false;

            const merged = fetchedMessages.map((m: Message) => {
              const existing = prevMap.get(m.id);
              if (existing) {
                // If status or read state changed (e.g. sent -> delivered -> read), update live!
                if (existing.status !== m.status || existing.isRead !== m.isRead) {
                  stateChanged = true;
                  return { ...existing, status: m.status, isRead: m.isRead };
                }
                return existing;
              }
              stateChanged = true;
              hasNewMessage = true;
              return m;
            });

            if (stateChanged || merged.length !== prev.length) {
              return merged;
            }
            return prev;
          });

          const latestMessage = fetchedMessages[fetchedMessages.length - 1];
          if (latestMessage.id !== lastMessageId) {
            setLastMessageId(latestMessage.id);
            updateChatLastMessage(latestMessage);
            if (hasNewMessage) {
              setTimeout(scrollToBottom, 100);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking for new messages:', error);
    }
  };

  // Fetch announcements/website updates for Announcements channel with real-time sync
  useEffect(() => {
    const fetchAnnouncements = () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      fetch(`${API_URL}/updates`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          let list: Array<{id:number;title:string;description:string;created_at:string}> = [];
          if (Array.isArray(data.updates)) list = data.updates;
          else if (Array.isArray(data)) list = data;
          setAnnouncements(list);
          // Check if there are announcements newer than last seen
          if (list.length > 0) {
            const latestId = Math.max(...list.map(a => a.id));
            const lastSeen = lastSeenAnnouncementIdRef.current;
            setAnnouncementsUnread(latestId > lastSeen);
          }
        })
        .catch(() => {});
    };

    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 6000);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('xsm_updates');
      bc.onmessage = () => fetchAnnouncements();
    } catch {}

    const handleCustomEvent = () => fetchAnnouncements();
    window.addEventListener('xsm_updates_changed', handleCustomEvent);

    return () => {
      clearInterval(interval);
      if (bc) bc.close();
      window.removeEventListener('xsm_updates_changed', handleCustomEvent);
    };
  }, []);

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

  // Mark announcements as read when user opens them
  useEffect(() => {
    if (isAnnouncementsSelected && announcements.length > 0) {
      const latestId = Math.max(...announcements.map(a => a.id));
      lastSeenAnnouncementIdRef.current = latestId;
      localStorage.setItem('xsm_lastSeenAnnouncementId', String(latestId));
      setAnnouncementsUnread(false);
    }
  }, [isAnnouncementsSelected, announcements]);

  // Filter and SORT chats — unread ones float to the top
  useEffect(() => {
    const sortByUnreadFirst = (list: ChatData[]) => [...list].sort((a, b) => {
      const aUnread = (a as any).unreadCount || (a as any).unread_count || 0;
      const bUnread = (b as any).unreadCount || (b as any).unread_count || 0;
      // Sort unread above read, then by lastMessageTime descending
      if (bUnread > 0 && aUnread === 0) return 1;
      if (aUnread > 0 && bUnread === 0) return -1;
      const aTime = new Date(a.lastMessageTime || 0).getTime();
      const bTime = new Date(b.lastMessageTime || 0).getTime();
      return bTime - aTime;
    });

    if (!searchQuery.trim()) {
      setFilteredChats(sortByUnreadFirst(chats));
    } else {
      const filtered = chats.filter(chat => {
        const chatName = getChatDisplayName(chat).toLowerCase();
        const lastMessage = chat.lastMessage?.toLowerCase() || '';
        const query = searchQuery.toLowerCase();
        return chatName.includes(query) || lastMessage.includes(query);
      });
      setFilteredChats(sortByUnreadFirst(filtered));
    }
  }, [chats, searchQuery]);

  // Load messages when chat is selected
  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
      setLastMessageId(null); // Reset for new chat
    }
  }, [selectedChat]);

  // Refresh chat list periodically to show new chats silently
  useEffect(() => {
    if (isLoggedIn && user) {
      const interval = setInterval(() => {
        fetchChats(true); // silent update — no loading flicker
      }, 10000); // Refresh every 10 seconds
      
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, user]);

  const fetchChats = async (isSilent = false) => {
    try {
      if (!isSilent && chats.length === 0) {
        setLoading(true);
      }
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/chat/chats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok || !Array.isArray(data)) {
        console.error('Invalid chats response:', data);
        if (!isSilent) {
          setChats([]);
        }
        return;
      }

      const normalizedChats = data.map((chat: ChatData) => {
        const isCurrentlySelected = selectedChat && chat.id === selectedChat.id;
        return {
          ...chat,
          unread_count: isCurrentlySelected ? 0 : ((chat as any).unread_count || 0),
          unreadCount: isCurrentlySelected ? 0 : ((chat as any).unreadCount || 0),
          otherParticipants: Array.isArray(chat.otherParticipants) ? chat.otherParticipants : []
        };
      });

      setChats(normalizedChats);
      // Note: filteredChats is updated by the useEffect that sorts unread chats to top
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
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
        setSearchParams(new URLSearchParams(), { replace: true });
      }
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
      if (response.ok && Array.isArray(data)) {
        setMessages(data);
        if (data.length > 0) {
          const latestMessage = data[data.length - 1];
          setLastMessageId(latestMessage.id);
        }
      } else {
        console.warn('Failed to load chat messages:', data);
        setMessages([]);
      }
      
      // Mark messages as read and clear the unread badge immediately in local state
      await fetch(`${API_URL}/chat/chats/${chatId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Clear local unread count immediately so badge disappears right away
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, unread_count: 0, unreadCount: 0 } : c));
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
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

        if (socket) {
          socket.emit('send_message', message);
          socket.emit('stop_typing', { chatId: selectedChat.id });
        }

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
    if (!dateString || typeof dateString !== 'string') return '';
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
    if (!dateString || typeof dateString !== 'string') return '';
    
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

  const cleanProfileUsername = (value?: string | null) => {
    if (!value) return null;

    const cleaned = value
      .replace(/^@/, '')
      .replace(/^Chat with\s+/i, '')
      .trim();

    if (
      !cleaned ||
      cleaned === 'Unknown' ||
      cleaned === 'Website Agent' ||
      cleaned.startsWith('Inquiry:')
    ) {
      return null;
    }

    return cleaned;
  };

  const getChatDisplayName = (chat?: ChatData | null) => {
    if (!chat) {
      return 'Unknown';
    }

    if (chat.name === 'Website Agent') {
      return 'Website Agent';
    }

    const otherParticipants = Array.isArray(chat.otherParticipants)
      ? chat.otherParticipants
      : [];

    // For ad inquiries, show seller name instead of ad title
    if (chat.type === 'ad_inquiry') {
      if (otherParticipants.length > 0) {
        return otherParticipants[0].username;
      }

      if (chat.name) {
        return chat.name.replace(/^Chat with\s+/i, '').trim();
      }

      // Fallback to ad title if no participants
      if (chat.ad) {
        return `Inquiry: ${chat.ad.title}`;
      }
    }

    // For direct chats, show the other participant's name
    if (otherParticipants.length > 0) {
      return otherParticipants[0].username;
    }

    // Use chat name if available
    if (chat.name) {
      return chat.name.replace(/^Chat with\s+/i, '').trim();
    }

    return 'Unknown';
  };

  const getProfileUsernameFromChat = (chat?: ChatData | null) => {
    if (!chat || chat.name === 'Website Agent') return null;

    const otherParticipants = Array.isArray(chat.otherParticipants)
      ? chat.otherParticipants
      : [];

    const otherUser = otherParticipants[0];
    const usernameFromParticipant = cleanProfileUsername(otherUser?.username);

    if (usernameFromParticipant) {
      return usernameFromParticipant;
    }

    const usernameFromChatName = cleanProfileUsername(chat.name);
    if (usernameFromChatName) {
      return usernameFromChatName;
    }

    const usernameFromDisplayName = cleanProfileUsername(getChatDisplayName(chat));
    if (usernameFromDisplayName) {
      return usernameFromDisplayName;
    }

    return null;
  };

  const handleOpenParticipantProfile = (chat?: ChatData | null) => {
    const username = getProfileUsernameFromChat(chat);

    if (!username) {
      console.warn('Could not open profile because no username was found for chat:', chat);
      return;
    }

    navigate(`/u/${encodeURIComponent(username)}`);
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
                {/* Restricted Account Alert Banner for Temporarily Banned Users - Revision 12 */}
        {Boolean((user as any)?.isBanned) && (() => {
          const banExpires = (user as any)?.banExpires;
          const banReason = (user as any)?.banReason;
          const isPermanent = !banExpires;
          let remainingText = 'Permanent Ban';
          if (!isPermanent) {
            const ms = new Date(banExpires).getTime() - Date.now();
            if (ms > 0) {
              const days = Math.floor(ms / 86400000);
              const hours = Math.floor((ms % 86400000) / 3600000);
              const mins = Math.floor((ms % 3600000) / 60000);
              if (days > 0) remainingText = `${days}d ${hours}h remaining`;
              else if (hours > 0) remainingText = `${hours}h ${mins}m remaining`;
              else remainingText = `${mins}m remaining`;
            } else {
              remainingText = 'Ban expiring soon...';
            }
          }
          return (
            <div className="mb-6 bg-gradient-to-r from-red-950/90 to-slate-900 border border-red-500/50 rounded-xl p-4 text-white shadow-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 flex-shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-red-300 text-sm">
                    {isPermanent ? 'Permanently Banned' : 'Account Temporarily Restricted'}
                  </h4>
                  <p className="text-xs text-gray-300">
                    {banReason && <span className="text-gray-400">Reason: {banReason}. </span>}
                    {isPermanent
                      ? 'Direct messaging has been permanently disabled for this account.'
                      : `Your ban expires in ${remainingText}. Direct messaging is temporarily restricted.`
                    }
                  </p>
                </div>
              </div>
              <button
                onClick={handleOpenWebsiteAgent}
                className="px-4 py-2 bg-xsm-yellow text-black text-xs font-bold rounded-lg hover:bg-yellow-400 transition-colors flex-shrink-0"
              >
                Contact Support
              </button>
            </div>
          );
        })()}
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
                {/* ── Pinned Announcements Channel (ALWAYS VISIBLE AT TOP) ── */}
                <div
                  className={`border-b cursor-pointer transition-all ${isAnnouncementsSelected ? 'bg-amber-950/40 border-l-4 border-xsm-yellow' : announcementsExpanded ? 'bg-amber-950/30' : announcementsUnread ? 'bg-amber-950/20 border-l-4 border-amber-400 hover:bg-amber-950/30' : 'bg-xsm-dark-gray/60 hover:bg-xsm-dark-gray border-xsm-yellow/20'}`}
                  onClick={() => {
                    setIsAnnouncementsSelected(true);
                    setSelectedChat(null);
                  }}
                >
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 shadow-md" style={{ background: 'linear-gradient(135deg,#ffd000,#ff9000)' }}>
                      📢
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xsm-yellow font-bold text-sm">Announcements Channel</h4>
                        {announcementsUnread ? (
                          <span className="text-[10px] bg-amber-500 text-black font-black px-2 py-0.5 rounded-full shadow animate-pulse">NEW</span>
                        ) : null}
                      </div>
                      <p className="text-xs text-gray-400 truncate">Official XSM Market updates &amp; news</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAnnouncementsExpanded(p => !p);
                      }}
                      className="text-xsm-yellow font-bold text-xs p-1 hover:bg-white/10 rounded"
                    >
                      {announcementsExpanded ? '▲' : '▼'}
                    </button>
                  </div>
                  {announcementsExpanded && (
                    <div className="border-t max-h-80 overflow-y-auto bg-black/40" style={{ borderColor: 'rgba(255,208,0,0.15)' }}>
                      {(announcements.length > 0 ? announcements : [
                        { id: 1, title: '🚀 Welcome to XSM Market', description: 'Experience secure social media account trading with 100% verified escrow protection.', created_at: new Date().toISOString() },
                        { id: 2, title: '⚡ Real-Time Notification System Active', description: 'Receive instant deal stage updates, in-app audio alerts, and direct message notifications.', created_at: new Date().toISOString() }
                      ]).map((a) => (
                        <div
                          key={a.id}
                          className="px-4 py-3 border-b hover:bg-white/[0.06] transition-colors cursor-pointer"
                          style={{ borderColor: 'rgba(255,255,255,0.05)' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsAnnouncementsSelected(true);
                            setSelectedChat(null);
                          }}
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="text-xsm-yellow text-sm mt-0.5">📌</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-xs font-bold">{a.title}</p>
                              <p className="text-gray-300 text-xs mt-1 leading-relaxed">{a.description}</p>
                              <p className="text-gray-500 text-[10px] mt-1.5">{new Date(a.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {loading && chats.length === 0 ? (
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
                    {filteredChats.map(chat => {
                      const unreadCount = (chat as any).unreadCount || (chat as any).unread_count || 0;
                      const hasUnread = unreadCount > 0;

                      return (
                        <div
                          key={chat.id}
                          onClick={() => {
                            setSelectedChat(chat);
                            setIsAnnouncementsSelected(false);
                          }}
                          className={`p-4 border-b border-xsm-medium-gray cursor-pointer transition-all relative ${
                            selectedChat?.id === chat.id && !isAnnouncementsSelected
                              ? 'bg-xsm-medium-gray/80 border-l-4 border-xsm-yellow'
                              : hasUnread
                              ? 'bg-amber-950/20 border-l-4 border-amber-500 hover:bg-xsm-dark-gray'
                              : 'hover:bg-xsm-dark-gray'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center flex-1 min-w-0">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xsm-black font-bold text-sm mr-3 shrink-0 relative ${hasUnread ? 'bg-xsm-yellow ring-2 ring-amber-400' : 'bg-xsm-yellow'}`}>
                                {getChatDisplayName(chat).charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <h4 className={`text-sm truncate ${hasUnread ? 'text-white font-black' : 'text-white font-medium'}`}>
                                    {getChatDisplayName(chat)}
                                  </h4>
                                  {hasUnread && (
                                    <span className="w-2.5 h-2.5 bg-xsm-yellow rounded-full animate-pulse shrink-0 shadow-[0_0_8px_#ffd000]" title="Unread messages" />
                                  )}
                                </div>
                                {chat.ad && (
                                  <p className="text-xs text-xsm-yellow truncate">
                                    {chat.ad.title} - ${chat.ad.price}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end shrink-0 ml-2">
                              {chat.lastMessageTime && (
                                <span className={`text-xs ${hasUnread ? 'text-xsm-yellow font-bold' : 'text-gray-400'}`}>
                                  {formatLastSeen(chat.lastMessageTime)}
                                </span>
                              )}
                              {hasUnread && (
                                <span className="mt-1 bg-xsm-yellow text-black text-[11px] font-black px-2 py-0.5 rounded-full shadow-md">
                                  {unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className={`text-sm truncate ${hasUnread ? 'text-white font-semibold' : 'text-gray-400'}`}>
                            {chat.lastMessage || 'No messages yet'}
                          </p>
                        </div>
                      );
                    })}
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
              {isAnnouncementsSelected ? (
                <React.Fragment>
                  {/* Announcements Chat Header */}
                  <div className="p-4 border-b border-xsm-medium-gray bg-gradient-to-r from-amber-950/40 via-xsm-black to-xsm-black flex items-center justify-between shadow-md">
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0 shadow-md" style={{ background: 'linear-gradient(135deg,#ffd000,#ff9000)' }}>
                        📢
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-bold text-base">Announcements Channel</h3>
                          <span className="bg-xsm-yellow text-black font-black text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full shadow">Official</span>
                        </div>
                        <p className="text-xs text-gray-400">Official platform update broadcasts from XSM Market Team</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs bg-xsm-yellow/10 text-xsm-yellow border border-xsm-yellow/30 px-3 py-1.5 rounded-full font-semibold">
                      <span>🔒 Read-Only Channel</span>
                    </div>
                  </div>

                  {/* Announcements Chat Messages Feed */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar messages-scrollbar bg-xsm-black/50">
                    <div className="text-center py-2">
                      <span className="text-[11px] text-gray-500 bg-xsm-dark-gray px-3.5 py-1.5 rounded-full border border-xsm-medium-gray/30 shadow-sm">
                        📢 Welcome to the official XSM Market Announcements Channel
                      </span>
                    </div>

                    {(announcements.length > 0 ? announcements : [
                      { id: 1, title: '🚀 Welcome to XSM Market', description: 'Experience secure social media account trading with 100% verified escrow protection.', created_at: new Date().toISOString() },
                      { id: 2, title: '⚡ Real-Time Notification System Active', description: 'Receive instant deal stage updates, in-app audio alerts, and direct message notifications.', created_at: new Date().toISOString() }
                    ]).map((item) => (
                      <div key={item.id} className="max-w-2xl mx-auto bg-gradient-to-r from-amber-950/30 via-xsm-dark-gray to-xsm-dark-gray border border-xsm-yellow/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                        <div className="flex items-center justify-between mb-3 border-b border-xsm-medium-gray/30 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-xsm-yellow text-black flex items-center justify-center text-xs font-bold shadow">📢</span>
                            <span className="text-xs font-bold text-xsm-yellow uppercase tracking-wider">XSM Official Broadcast</span>
                          </div>
                          <span className="text-xs text-gray-500 font-mono">
                            {new Date(item.created_at).toLocaleString()}
                          </span>
                        </div>
                        <h4 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                          <span>📌</span> {item.title}
                        </h4>
                        <p className="text-sm text-gray-300 leading-relaxed bg-black/40 p-4 rounded-xl border border-white/5 shadow-inner">
                          {item.description}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Read-Only Bottom Footer */}
                  <div className="p-4 border-t border-xsm-medium-gray bg-xsm-black text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-xsm-yellow animate-pulse" />
                    <span>This is a read-only announcement channel. Only XSM Market Admins can publish updates here.</span>
                  </div>
                </React.Fragment>
              ) : selectedChat ? (
                <React.Fragment>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-xsm-medium-gray bg-xsm-black flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="w-10 h-10 bg-xsm-yellow rounded-full flex items-center justify-center text-xsm-black font-bold">
                          {getChatDisplayName(selectedChat).charAt(0).toUpperCase()}
                        </div>
                        {selectedChat.otherParticipants?.[0]?.id && onlineUserIds.has(String(selectedChat.otherParticipants[0].id)) && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-black rounded-full shadow-[0_0_8px_#10b981]" title="Online now" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenParticipantProfile(selectedChat)}
                            className={`text-white font-medium transition-colors text-left ${
                              getProfileUsernameFromChat(selectedChat)
                                ? 'hover:text-xsm-yellow cursor-pointer'
                                : 'cursor-default'
                            }`}
                            title={
                              getProfileUsernameFromChat(selectedChat)
                                ? 'Open seller profile'
                                : 'Profile unavailable'
                            }
                          >
                            {getChatDisplayName(selectedChat)}
                          </button>
                        </div>
                        {remoteTypingUser ? (
                          <p className="text-xs text-amber-400 font-bold animate-pulse flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                            <span>{remoteTypingUser} is typing...</span>
                          </p>
                        ) : selectedChat.ad ? (
                          <p className="text-sm text-xsm-yellow">{selectedChat.ad.title} - ${selectedChat.ad.price}</p>
                        ) : null}
                      </div>
                    </div>
                    {selectedChat.name !== 'Website Agent' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowDealSummary(true)}
                          className="flex items-center gap-2 text-sm border border-xsm-yellow/40 text-xsm-yellow px-3 py-2 rounded-lg hover:bg-xsm-yellow hover:text-black transition-colors"
                        >
                          <BarChart3 className="w-4 h-4" />
                          Deals ({selectedChat.dealSummary?.totalDeals || 0})
                        </button>
                        {selectedChat.support_requested ? (
                          <div className="flex items-center gap-2 text-sm border border-orange-500/40 bg-orange-950/20 text-orange-400 px-3 py-2 rounded-lg cursor-default select-none font-medium">
                            <HeadphonesIcon className="w-4 h-4" />
                            Agent Requested
                          </div>
                        ) : (
                          <button
                            onClick={handleRequestAgent}
                            disabled={isSendingAgentRequest}
                            className="flex items-center gap-2 text-sm border border-blue-500/50 text-blue-400 px-3 py-2 rounded-lg hover:bg-blue-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Ask a website admin to assist in this conversation"
                          >
                            <HeadphonesIcon className="w-4 h-4" />
                            {isSendingAgentRequest ? 'Sending...' : 'Ask Agent'}
                          </button>
                        )}
                      </div>
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
                        const isSystem = message.messageType === 'system';

                        // ── DEAL CARD MESSAGES: show an inline deal card when a deal is started ──
                        if (message.messageType === 'deal_card') {
                          let dealData: any = null;
                          try {
                            dealData = typeof message.content === 'string' ? JSON.parse(message.content) : message.content;
                          } catch {
                            dealData = null;
                          }
                          if (dealData && dealData.deal_id) {
                            const dealId = Number(dealData.deal_id);
                            return (
                              <div
                                key={message.id}
                                ref={(el) => {
                                  if (el) dealCardRefs.current.set(dealId, el);
                                  else dealCardRefs.current.delete(dealId);
                                }}
                              >
                                <DealCardMessage
                                  dealData={dealData}
                                  isHighlighted={highlightedDealId === dealId}
                                />
                              </div>
                            );
                          }
                        }

                        // System messages render as centered notification pills
                        if (isSystem) {
                          return (
                            <div key={message.id} className="flex justify-center w-full my-2">
                              <div className="flex items-center gap-2 bg-yellow-950/20 border border-xsm-yellow/30 text-xsm-yellow px-4 py-2 rounded-full text-xs font-medium max-w-md text-center shadow-md select-none">
                                <HeadphonesIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>{message.content}</span>
                              </div>
                            </div>
                          );
                        }

                        const isSenderAdmin = Boolean((message as any)?.isStaffMessage || (message as any)?.staffDisplayName);
                        const senderRole = (message.sender as any)?.role ?? '';

                        // --- Display name logic (never show raw username for staff) ---
                        const getAgentLabel = () => {
                          if (senderRole === 'agent') return 'Support Agent';
                          if (senderRole === 'manager') return 'Manager';
                          return 'Admin';
                        };

                        // Agent/Admin messages: same teal style for both sender and receiver
                        if (isSenderAdmin) {
                          return (
                            <div key={message.id} className="flex justify-start w-full my-1 px-1">
                              {/* Agent avatar */}
                              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-teal-600 to-emerald-700 flex items-center justify-center shadow-md mt-1 mr-2 border border-teal-400/30">
                                <Shield className="w-3.5 h-3.5 text-white" />
                              </div>
                              <div className="max-w-xs lg:max-w-md">
                                {/* Agent name header */}
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-[11px] font-bold text-teal-300 select-none">
                                    {getAgentLabel()}
                                  </span>
                                </div>
                                {/* Agent bubble */}
                                <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm bg-gradient-to-br from-gray-900 to-gray-800 border border-teal-500/30 shadow-[0_0_12px_rgba(20,184,166,0.15)] text-white">
                                  {message.messageType === 'image' && (message.mediaUrl || message.content) ? (
                                    <div className="relative">
                                      <img
                                        src={getImageUrl(message.mediaUrl || message.content) || message.mediaUrl || message.content}
                                        alt="Sent image"
                                        className="rounded-lg max-w-[200px] max-h-[200px] mb-2 border border-teal-400/40 cursor-pointer"
                                        style={{ objectFit: 'cover' }}
                                        onClick={() => window.open(getImageUrl(message.mediaUrl || message.content) || message.mediaUrl || message.content, '_blank')}
                                        onError={(e) => { const t = e.target as HTMLImageElement; t.style.display = 'none'; const f = t.nextElementSibling as HTMLElement; if (f) f.style.display = 'flex'; }}
                                      />
                                      <div className="absolute inset-0 bg-gray-700 rounded-lg items-center justify-center text-white text-sm" style={{ display: 'none' }}>
                                        <div className="text-center p-4">
                                          <div className="text-2xl mb-2">🖼️</div><div>Image unavailable</div>
                                          <button onClick={() => window.open(getImageUrl(message.content) || message.content, '_blank')} className="mt-2 px-3 py-1 rounded text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700">Try Opening</button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : message.messageType === 'video' && (message.mediaUrl || message.content) ? (
                                    <div className="relative rounded-lg overflow-hidden max-w-[250px] max-h-[200px] mb-2 border bg-black border-teal-400/40">
                                      <video className="w-full h-full object-cover" controls preload="metadata" style={{ maxHeight: '200px' }}
                                        onError={(e) => { const t = e.target as HTMLVideoElement; t.style.display = 'none'; const f = t.nextElementSibling as HTMLElement; if (f) f.style.display = 'flex'; }}>
                                        <source src={getImageUrl(message.mediaUrl || message.content) || message.mediaUrl || message.content} type="video/mp4" />
                                        <source src={getImageUrl(message.mediaUrl || message.content) || message.mediaUrl || message.content} type="video/quicktime" />
                                        <source src={getImageUrl(message.mediaUrl || message.content) || message.mediaUrl || message.content} type="video/webm" />
                                        Your browser does not support the video tag.
                                      </video>
                                      <div className="absolute inset-0 bg-gray-700 flex items-center justify-center text-white text-sm" style={{ display: 'none' }}>
                                        <div className="text-center p-4"><div className="text-2xl mb-2">🎥</div><div>Video file</div><div className="text-xs mt-1 break-all px-2 max-w-[200px]">{message.content.split('/').pop()}</div>
                                          <button onClick={() => { const url = getImageUrl(message.content) || message.content; window.open(url, '_blank'); }} className="mt-2 px-3 py-1 rounded text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700">Open Video</button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-sm leading-relaxed">{message.content}</p>
                                  )}
                                  <p className="text-[10px] mt-1.5 text-teal-400/60 text-right">{formatTime(message.createdAt)}</p>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Regular messages: my messages (right/yellow) vs other user messages (left/dark)
                        // For admin/manager/viewer: add buyer (blue ring) vs seller (green ring) distinction
                        const isAdminViewer = !!(user as any)?.isAdmin || ['admin', 'manager', 'viewer'].includes((user as any)?.role ?? '');
                        const msgSenderId = Number(message.senderId);
                        const isBuyer = isAdminViewer && selectedChat.buyerUserId != null && msgSenderId === Number(selectedChat.buyerUserId);
                        const isSeller = isAdminViewer && selectedChat.sellerUserId != null && msgSenderId === Number(selectedChat.sellerUserId);

                        return (
                          <div
                            key={message.id}
                            className={`flex items-end gap-2 my-1 ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                          >
                            {/* Other user avatar (left side only) */}
                            {!isMyMessage && (
                              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-xsm-medium-gray flex items-center justify-center text-xs font-bold text-white border border-xsm-medium-gray/60 mb-0.5">
                                {(message.sender?.username ?? '?').charAt(0).toUpperCase()}
                              </div>
                            )}

                            <div className={`max-w-xs lg:max-w-md ${isMyMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                              {/* Sender name for other user */}
                              {!isMyMessage && (
                                <p className="text-[11px] font-semibold text-gray-400 mb-1 ml-1 select-none">
                                  {message.sender?.username ?? 'User'}
                                </p>
                              )}

                              {/* Message bubble — buyer gets blue ring, seller gets green ring */}
                              <div
                                style={isBuyer ? { outline: '2px solid #3b82f6', outlineOffset: '0px' } : isSeller ? { outline: '2px solid #22c55e', outlineOffset: '0px' } : {}}
                                className={`px-4 py-2.5 shadow-sm ${
                                  isMyMessage
                                    ? 'bg-xsm-yellow text-black rounded-2xl rounded-br-sm'
                                    : 'bg-[#2a2a2a] text-white rounded-2xl rounded-bl-sm'
                                }`}
                              >
                                {message.messageType === 'image' && (message.mediaUrl || message.content) ? (
                                  <div className="relative">
                                    <img
                                      src={getImageUrl(message.mediaUrl || message.content) || message.mediaUrl || message.content}
                                      alt="Sent image"
                                      className={`rounded-lg max-w-[200px] max-h-[200px] mb-2 border cursor-pointer ${isMyMessage ? 'border-yellow-400/60' : 'border-white/10'}`}
                                      style={{ objectFit: 'cover' }}
                                      onClick={() => window.open(getImageUrl(message.mediaUrl || message.content) || message.mediaUrl || message.content, '_blank')}
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        const fallback = target.nextElementSibling as HTMLElement;
                                        if (fallback) fallback.style.display = 'flex';
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-gray-700 rounded-lg flex items-center justify-center text-white text-sm" style={{ display: 'none' }}>
                                      <div className="text-center p-4">
                                        <div className="text-2xl mb-2">🖼️</div>
                                        <div>Image unavailable</div>
                                        <button onClick={() => { const url = getImageUrl(message.content) || message.content; window.open(url, '_blank'); }} className={`mt-2 px-3 py-1 rounded text-xs font-semibold ${isMyMessage ? 'bg-black text-yellow-400 hover:bg-gray-900' : 'bg-xsm-yellow text-black hover:bg-yellow-500'}`}>Try Opening</button>
                                      </div>
                                    </div>
                                  </div>
                                ) : message.messageType === 'video' && (message.mediaUrl || message.content) ? (
                                  <div className={`relative rounded-lg overflow-hidden max-w-[250px] max-h-[200px] mb-2 border bg-black ${isMyMessage ? 'border-yellow-400/60' : 'border-white/10'}`}>
                                    <video className="w-full h-full object-cover" controls preload="metadata" style={{ maxHeight: '200px' }}
                                      onError={(e) => { const t = e.target as HTMLVideoElement; t.style.display = 'none'; const f = t.nextElementSibling as HTMLElement; if (f) f.style.display = 'flex'; }}
                                      onLoadStart={() => { const videoUrl = getImageUrl(message.mediaUrl || message.content) || message.mediaUrl || message.content; console.log('Video load started:', videoUrl); }}
                                    >
                                      <source src={getImageUrl(message.mediaUrl || message.content) || message.mediaUrl || message.content} type="video/mp4" />
                                      <source src={getImageUrl(message.mediaUrl || message.content) || message.mediaUrl || message.content} type="video/quicktime" />
                                      <source src={getImageUrl(message.mediaUrl || message.content) || message.mediaUrl || message.content} type="video/webm" />
                                      Your browser does not support the video tag.
                                    </video>
                                    <div className="absolute inset-0 bg-gray-700 flex items-center justify-center text-white text-sm" style={{ display: 'none' }}>
                                      <div className="text-center p-4">
                                        <div className="text-2xl mb-2">🎥</div>
                                        <div>Video file</div>
                                        <div className="text-xs mt-1 break-all px-2 max-w-[200px]">{message.content.split('/').pop()}</div>
                                        <button onClick={() => { const url = getImageUrl(message.content) || message.content; window.open(url, '_blank'); }} className={`mt-2 px-3 py-1 rounded text-xs font-semibold ${isMyMessage ? 'bg-black text-yellow-400 hover:bg-gray-900' : 'bg-xsm-yellow text-black hover:bg-yellow-500'}`}>Open Video</button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm leading-relaxed">{message.content}</p>
                                )}
                                <p className={`text-[10px] mt-1 flex items-center justify-end gap-0.5 ${isMyMessage ? 'text-black/70' : 'text-gray-400'}`}>
                                  <span>{formatTime(message.createdAt)}</span>
                                  {isMyMessage && (() => {
                                    const st = message.status || (message.isRead ? 'read' : 'sent');
                                    if (st === 'agent_viewed' || (message as any)?.agent_viewed) {
                                      return (
                                        <span 
                                          className="ml-1 font-extrabold inline-flex items-center gap-0.5 text-amber-500 bg-amber-950/60 px-1 py-0.5 rounded border border-amber-500/50 text-[10px] shadow-sm" 
                                          title="Viewed by Website Agent 🌟"
                                        >
                                          <Shield className="w-2.5 h-2.5 text-amber-400 fill-amber-400/30" />
                                          <span>✓✓</span>
                                        </span>
                                      );
                                    }
                                    if (st === 'read' || message.isRead) {
                                      return <span className="ml-1 font-extrabold text-emerald-600 text-xs" title="Read (2 Green Ticks)">✓✓</span>;
                                    }
                                    if (st === 'delivered') {
                                      return <span className="ml-1 font-bold text-gray-500 text-xs" title="Delivered (2 Grey Ticks)">✓✓</span>;
                                    }
                                    return <span className="ml-1 font-bold text-gray-400 text-xs" title="Sent (1 Grey Tick)">✓</span>;
                                  })()}
                                </p>
                              </div>
                            </div>

                            {/* My avatar (right side only) */}
                            {isMyMessage && (
                              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-xsm-yellow flex items-center justify-center text-xs font-bold text-black border border-yellow-400/60 mb-0.5">
                                {(user?.username ?? 'M').charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input or Restriction Notice */}
                    {Boolean((user as any)?.isBanned) && !(
                    selectedChat?.type === 'support' ||
                    selectedChat?.name === 'Website Agent' ||
                    (selectedChat as any)?.title === 'Website Agent' ||
                    getChatDisplayName(selectedChat) === 'Website Agent' ||
                    selectedChat?.otherParticipants?.some(p => (p as any)?.isAdmin || (p as any)?.isStaff || ['admin', 'manager', 'agent'].includes((p as any)?.role || '')) ||
                    selectedChat?.participants?.some(p => (p.user as any)?.isAdmin || ['admin', 'manager', 'agent'].includes((p.user as any)?.role || ''))
                  ) ? (
                      (() => {
                        const banExpires = (user as any)?.banExpires;
                        const isPermanent = !banExpires;
                        let remainingText = 'indefinitely';
                        if (!isPermanent) {
                          const ms = new Date(banExpires).getTime() - Date.now();
                          if (ms > 0) {
                            const days = Math.floor(ms / 86400000);
                            const hours = Math.floor((ms % 86400000) / 3600000);
                            const mins = Math.floor((ms % 3600000) / 60000);
                            if (days > 0) remainingText = `${days} day${days > 1 ? 's' : ''}`;
                            else if (hours > 0) remainingText = `${hours} hour${hours > 1 ? 's' : ''}`;
                            else remainingText = `${mins} minute${mins > 1 ? 's' : ''}`;
                          } else {
                            remainingText = 'a few moments';
                          }
                        }
                        return (
                          <div className="p-4 bg-red-950/50 border-t border-red-500/40 text-center">
                            <div className="flex items-center justify-center gap-2 text-xs text-red-300 flex-wrap">
                              <Shield className="w-4 h-4 text-red-400 flex-shrink-0" />
                              <span>
                                {isPermanent
                                  ? 'Your account has been permanently banned. Messaging is disabled.'
                                  : `You cannot send messages while your temporary ban is active. Your ban will expire in ${remainingText}, after which you will be able to send messages again.`
                                }
                              </span>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="p-4 border-t border-xsm-medium-gray flex items-center space-x-2">
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
                          onChange={(e) => {
                            setNewMessage(e.target.value);
                            if (socket && selectedChat) {
                              socket.emit('typing', { chatId: selectedChat.id, username: user?.username });
                              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                              typingTimeoutRef.current = setTimeout(() => {
                                socket.emit('stop_typing', { chatId: selectedChat.id });
                              }, 2000);
                            }
                          }}
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
                    )}
                  </React.Fragment>
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
            {(() => {
              const dealList = (
                selectedChat.dealSummary?.deals && selectedChat.dealSummary.deals.length > 0
                  ? selectedChat.dealSummary.deals
                  : (selectedChat.dealSummary?.channels || []).map((channel, index) => ({
                      channel,
                      price: selectedChat.dealSummary?.prices?.[index] || 0,
                      role: '',
                      status: '',
                      deal_id: undefined as number | undefined,
                    }))
              ) as Array<{ channel: string; price: number; role?: string; status?: string; deal_id?: number }>;

              if (dealList.length === 0) {
                return (
                  <p className="text-sm text-xsm-light-gray pt-3 border-t border-xsm-medium-gray">
                    No completed deals with this user yet.
                  </p>
                );
              }

              return (
                <div className="pt-3 border-t border-xsm-medium-gray">
                  <p className="text-sm text-xsm-light-gray mb-2">All deals with this seller — click to jump to deal card</p>
                  {dealList.map((deal, index) => {
                    const dealId = deal.deal_id != null ? Number(deal.deal_id) : null;
                    const hasDealCard = dealId !== null && dealCardRefs.current.has(dealId);
                    return (
                      <div
                        key={`${deal.channel}-${index}`}
                        onClick={() => {
                          if (!hasDealCard || dealId === null) return;
                          setShowDealSummary(false);
                          setTimeout(() => {
                            const el = dealCardRefs.current.get(dealId);
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              setHighlightedDealId(dealId);
                              setTimeout(() => setHighlightedDealId(null), 2500);
                            }
                          }, 150);
                        }}
                        className={`flex items-center justify-between gap-3 text-sm py-2.5 px-2 rounded-lg border-b border-xsm-medium-gray/30 last:border-b-0 transition-all duration-150 ${
                          hasDealCard
                            ? 'cursor-pointer hover:bg-xsm-yellow/10 group'
                            : 'cursor-default'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className={`text-white truncate font-medium ${hasDealCard ? 'group-hover:text-xsm-yellow transition-colors' : ''}`}>
                            {deal.channel || 'Deal'}
                          </p>
                          {(deal.role || deal.status) && (
                            <p className="text-xs text-xsm-light-gray capitalize">
                              {[deal.role, deal.status].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xsm-yellow font-semibold whitespace-nowrap">
                            ${Number(deal.price || 0).toLocaleString()}
                          </span>
                          {hasDealCard && (
                            <span className="text-xs text-gray-500 group-hover:text-xsm-yellow transition-colors" title="Click to view in chat">↗</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
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