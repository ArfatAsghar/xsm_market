import React, { useState, useEffect, useRef } from 'react';
import { Send, Flag, User, Shield, MessageCircle, Image, FileVideo } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { io, Socket } from 'socket.io-client';
import { getImageUrl } from '@/config/api';

interface Message {
  id: number;
  content: string;
  senderId: string;
  chatId: number;
  messageType: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  thumbnail?: string;
  isRead: boolean;
  createdAt: string;
  sender: {
    id: string;
    username: string;
    fullName?: string;
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
    fullName?: string;
    email: string;
  }>;
  ad?: {
    id: number;
    title: string;
    price: number;
  };
}

const Chat: React.FC = () => {
  const { user, isLoggedIn } = useAuth();
  const [selectedChat, setSelectedChat] = useState<ChatData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chats, setChats] = useState<ChatData[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Initialize Socket.IO connection

  // Fetch chats when component mounts
  useEffect(() => {
    if (isLoggedIn && user) {
      fetchChats();
    }
  }, [isLoggedIn, user]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    // Use setTimeout to ensure DOM is updated before scrolling
    setTimeout(scrollToBottom, 100);
  }, [messages]);

  // Cleanup image preview URL when component unmounts or image changes
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // Join chat room when chat is selected
  useEffect(() => {
    if (socket && selectedChat) {
      socket.emit('join_chat', selectedChat.id);
      fetchMessages(selectedChat.id);
    }
  }, [socket, selectedChat]);

  const fetchChats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chat/chats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setChats(data);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (chatId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/chat/chats/${chatId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setMessages(data);
      
      // Mark messages as read
      await fetch(`/api/chat/chats/${chatId}/read`, {
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
    console.log('=== handleSendMessage START ===');
    console.log('newMessage:', newMessage);
    console.log('selectedImage:', selectedImage);
    console.log('selectedChat:', selectedChat);
    console.log('user:', user);
    
    // Check if we have either a message or an image
    const hasMessage = newMessage.trim().length > 0;
    const hasImage = selectedImage !== null;
    
    console.log('hasMessage:', hasMessage);
    console.log('hasImage:', hasImage);
    
    if ((!hasMessage && !hasImage) || !selectedChat || !user) {
      console.log('Early return - conditions not met');
      console.log('hasMessage || hasImage:', hasMessage || hasImage);
      console.log('selectedChat:', !!selectedChat);
      console.log('user:', !!user);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      console.log('Token available:', !!token);
      
      // If there's an image, upload it first
      if (hasImage && selectedImage) {
        console.log('=== TAKING IMAGE UPLOAD PATH ===');
        const formData = new FormData();
        formData.append('file', selectedImage);
        formData.append('messageType', 'image');
        if (hasMessage) {
          console.log('Adding text content to image message');
          formData.append('content', newMessage.trim());
        }

        const uploadUrl = `/api/chat/chats/${selectedChat.id}/upload`;
        console.log('Uploading image to:', uploadUrl);
        console.log('FormData entries:');
        for (const [key, value] of formData.entries()) {
          console.log(`  ${key}:`, value instanceof File ? `File(${value.name}, ${value.size}bytes)` : value);
        }

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        console.log('Upload response status:', response.status);
        console.log('Upload response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Upload error response:', errorText);
          throw new Error(`Upload failed: ${response.status} - ${errorText}`);
        }

        const message = await response.json();
        console.log('Upload success, message:', message);
        
        // Add to local messages
        setMessages(prev => [...prev, message]);
        
        // Emit to socket for real-time delivery (if socket is available)
        if (socket) {
          socket.emit('send_message', {
            ...message,
            chatId: selectedChat.id
          });
        }

        // Update chat list
        updateChatLastMessage(message);
        
        // Clear form
        setNewMessage('');
        setSelectedImage(null);
        setImagePreview(null);
        if (imageInputRef.current) {
          imageInputRef.current.value = '';
        }
      } else if (hasMessage) {
        console.log('=== TAKING TEXT MESSAGE PATH ===');
        // Send text message
        const messageUrl = `/api/chat/chats/${selectedChat.id}/messages`;
        console.log('Sending text message to:', messageUrl);
        const response = await fetch(messageUrl, {
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

        console.log('Message response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Message error response:', errorText);
          throw new Error(`Message failed: ${response.status} - ${errorText}`);
        }

        const message = await response.json();
        
        // Add to local messages
        setMessages(prev => [...prev, message]);
        
        // Emit to socket for real-time delivery (if socket is available)
        if (socket) {
          socket.emit('send_message', {
            ...message,
            chatId: selectedChat.id
          });
        }

        // Update chat list
        updateChatLastMessage(message);
        
        setNewMessage('');
      }
    } catch (error) {
      console.error('=== ERROR IN handleSendMessage ===');
      console.error('Error sending message:', error);
      alert('Failed to send message: ' + error.message);
    }
    console.log('=== handleSendMessage END ===');
  };

  const updateChatLastMessage = (message: Message) => {
    setChats(prev => prev.map(chat => 
      chat.id === message.chatId 
        ? { ...chat, lastMessage: message.content, lastMessageTime: message.createdAt }
        : chat
    ).sort((a, b) => new Date(b.lastMessageTime || 0).getTime() - new Date(a.lastMessageTime || 0).getTime()));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log('Image selection event:', file);
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      console.log('Image selected:', file.name, file.size);
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      console.log('Image preview URL created:', previewUrl);
    } else {
      console.log('Invalid file selected or no file selected');
    }
  };

  const clearImageSelection = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setSelectedImage(null);
    setImagePreview(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleReport = () => {
    if (reportReason.trim()) {
      alert(`User reported successfully. Reason: ${reportReason}\n\nOur admin team will review this report within 24 hours.`);
      setReportModalOpen(false);
      setReportReason('');
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatLastSeen = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const getChatDisplayName = (chat: ChatData) => {
    if (chat.type === 'ad_inquiry' && chat.ad) {
      return chat.ad.title;
    }
    if (chat.otherParticipants.length > 0) {
      return chat.otherParticipants[0].fullName || chat.otherParticipants[0].username;
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
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

              <div className="overflow-y-auto" style={{ height: 'calc(100% - 73px)' }}>
                {loading ? (
                  <div className="p-4 text-center text-white">Loading chats...</div>
                ) : chats.length === 0 ? (
                  <div className="p-4 text-center text-gray-400">
                    <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No conversations yet</p>
                    <p className="text-sm">Start chatting by contacting a seller!</p>
                  </div>
                ) : (
                  chats.map(chat => (
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
                                ${chat.ad.price}
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
                  ))
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
                        <h4 className="text-white font-medium">{getChatDisplayName(selectedChat)}</h4>
                        {selectedChat.ad && (
                          <p className="text-sm text-xsm-yellow">Ad Inquiry - ${selectedChat.ad.price}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setReportModalOpen(true)}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                      title="Report User"
                    >
                      <Flag className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-400 py-8">
                        <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No messages yet. Start the conversation!</p>
                      </div>
                    ) : (
                      messages.map(message => (
                        <div
                          key={message.id}
                          className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                              message.senderId === user?.id
                                ? 'bg-xsm-yellow text-xsm-black'
                                : 'bg-xsm-medium-gray text-white'
                            }`}
                          >
                            {message.senderId !== user?.id && (
                              <p className="text-xs font-medium mb-1 opacity-75">
                                {message.sender?.fullName || message.sender?.username}
                              </p>
                            )}
                            
                            {/* Render image if it's an image message */}
                            {message.messageType === 'image' && message.mediaUrl && (
                              <div className="mb-2">
                                <img 
                                  src={getImageUrl(message.mediaUrl) || ''}
                                  alt="Shared image"
                                  className="max-w-full h-auto rounded-lg cursor-pointer border border-xsm-yellow"
                                  onClick={() => window.open(getImageUrl(message.mediaUrl) || '', '_blank')}
                                  style={{ maxHeight: '200px' }}
                                  onError={(e) => {
                                    console.error('Image failed to load:', message.mediaUrl);
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            
                            {/* Render text content if present */}
                            {message.content && (
                              <p className="text-sm">{message.content}</p>
                            )}
                            
                            <p
                              className={`text-xs mt-1 ${
                                message.senderId === user?.id ? 'text-xsm-dark-gray' : 'text-gray-400'
                              }`}
                            >
                              {formatTime(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t border-xsm-medium-gray bg-xsm-black">
                    {/* Image Preview */}
                    {imagePreview && (
                      <div className="mb-3 p-3 bg-xsm-dark-gray rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-white">Image selected:</span>
                          <button
                            onClick={clearImageSelection}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="max-w-full h-auto rounded max-h-20"
                        />
                      </div>
                    )}
                    
                    <div className="flex space-x-2">
                      {/* Image Button */}
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="p-2 text-gray-400 hover:text-xsm-yellow rounded-lg border border-xsm-yellow bg-xsm-dark-gray"
                        title="Attach Image"
                      >
                        <Image className="w-5 h-5" />
                      </button>
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder="Type your message..."
                        className="flex-1 px-4 py-2 bg-xsm-dark-gray text-white rounded-lg border border-xsm-medium-gray focus:outline-none focus:border-xsm-yellow"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() && !selectedImage}
                        className="px-4 py-2 bg-xsm-yellow text-xsm-black rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                      {/* Hidden file inputs */}
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleImageSelect}
                      />
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

      {/* Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-xsm-dark-gray rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-xsm-yellow mb-4">Report User</h3>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Please describe the reason for reporting this user..."
              className="w-full h-24 px-4 py-2 bg-xsm-black text-white rounded-lg border border-xsm-medium-gray focus:outline-none focus:border-xsm-yellow resize-none"
            />
            <div className="flex space-x-3 mt-4">
              <button
                onClick={() => setReportModalOpen(false)}
                className="flex-1 px-4 py-2 border border-xsm-medium-gray text-white rounded-lg hover:bg-xsm-medium-gray transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReport}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;