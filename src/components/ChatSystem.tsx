import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageSquare, Send, X, Users, Phone, Video, MoreVertical, Paperclip, Image, Camera, FileVideo } from 'lucide-react';
import { getImageUrl } from '@/config/api';

interface User {
  id: string;
  username: string;
  fullName?: string;
  email: string;
}

interface Message {
  id: number;
  content: string;
  senderId: string;
  chatId: number;
  messageType: 'text' | 'image' | 'video' | 'file';
  isRead: boolean;
  createdAt: string;
  sender: User;
  replyTo?: Message;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  thumbnail?: string;
}

interface Chat {
  id: number;
  type: string;
  name?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  otherParticipants: User[];
  ad?: {
    id: number;
    title: string;
    price: number;
  };
}

interface ChatSystemProps {
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
}

const ChatSystem: React.FC<ChatSystemProps> = ({ currentUser, isOpen, onClose }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isUserAtBottom, setIsUserAtBottom] = useState(true); // Track if user is at bottom
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when chat is open
      document.body.style.overflow = 'hidden';
      initializeSocket();
      fetchChats();
    } else {
      // Restore body scroll when chat is closed
      document.body.style.overflow = 'unset';
    }

    return () => {
      // Cleanup: restore scroll and disconnect socket
      document.body.style.overflow = 'unset';
      if (socket) {
        socket.disconnect();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    // Only auto-scroll if user is at the bottom of the chat
    if (isUserAtBottom) {
      scrollToBottom();
    }
  }, [messages, isUserAtBottom]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showAttachmentMenu && !(event.target as Element).closest('.attachment-menu')) {
        setShowAttachmentMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAttachmentMenu]);

  const initializeSocket = () => {
    const newSocket = io(import.meta.env.VITE_API_URL || 'https://xsmmarket.com/api');
    
    newSocket.on('connect', () => {
      newSocket.emit('user_connected', { userId: currentUser.id });
    });

    newSocket.on('new_message', (message: Message) => {
      setMessages(prev => [...prev, message]);
      updateChatLastMessage(message);
    });

    newSocket.on('user_typing', (data: { userId: string; username: string; chatId: number }) => {
      if (selectedChat && data.chatId === selectedChat.id) {
        setTypingUsers(prev => [...prev.filter(u => u !== data.username), data.username]);
      }
    });

    newSocket.on('user_stop_typing', (data: { userId: string; chatId: number }) => {
      if (selectedChat && data.chatId === selectedChat.id) {
        setTypingUsers(prev => prev.filter((_, index) => index !== prev.length - 1));
      }
    });

    newSocket.on('messages_read', (data: { chatId: number; userId: string }) => {
      if (selectedChat && data.chatId === selectedChat.id) {
        setMessages(prev => prev.map(msg => 
          msg.senderId === currentUser.id ? { ...msg, isRead: true } : msg
        ));
      }
    });

    setSocket(newSocket);
  };

  const fetchChats = async () => {
    try {
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
    }
  };

  const fetchMessages = async (chatId: number) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/chat/chats/${chatId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setMessages(data);
      
      // When loading a chat, assume user wants to see latest messages
      setIsUserAtBottom(true);
      
      // Use setTimeout to ensure DOM is updated before scrolling
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 100);
      
      // Mark messages as read
      await fetch(`/api/chat/chats/${chatId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !socket) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/chat/chats/${selectedChat.id}/messages`, {
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

      const message = await response.json();
      
      // Add to local messages
      setMessages(prev => [...prev, message]);
      
      // Emit to socket for real-time delivery
      socket.emit('send_message', {
        ...message,
        chatId: selectedChat.id
      });

      // Update chat list
      updateChatLastMessage(message);
      
      setNewMessage('');
      stopTyping();
      
      // Always scroll to bottom when user sends a message
      setIsUserAtBottom(true);
      setTimeout(() => scrollToBottom(true), 100); // Small delay to ensure message is rendered
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleChatSelect = (chat: Chat) => {
    if (selectedChat?.id !== chat.id) {
      setSelectedChat(chat);
      fetchMessages(chat.id);
      
      if (socket) {
        if (selectedChat) {
          socket.emit('leave_chat', selectedChat.id);
        }
        socket.emit('join_chat', chat.id);
      }
    }
  };

  const handleTyping = () => {
    if (!isTyping && socket && selectedChat) {
      setIsTyping(true);
      socket.emit('typing', {
        chatId: selectedChat.id,
        username: currentUser.username
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  };

  const stopTyping = () => {
    if (isTyping && socket && selectedChat) {
      setIsTyping(false);
      socket.emit('stop_typing', {
        chatId: selectedChat.id
      });
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const updateChatLastMessage = (message: Message) => {
    setChats(prev => prev.map(chat => 
      chat.id === message.chatId 
        ? { ...chat, lastMessage: message.content, lastMessageTime: message.createdAt }
        : chat
    ).sort((a, b) => new Date(b.lastMessageTime || 0).getTime() - new Date(a.lastMessageTime || 0).getTime()));
  };

  const handleFileUpload = async (file: File, messageType: 'image' | 'video' | 'file') => {
    if (!selectedChat) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('messageType', messageType);

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/chat/chats/${selectedChat.id}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      const message = await response.json();
      
      // Add to local messages
      setMessages(prev => [...prev, message]);
      
      // Emit to socket for real-time delivery
      if (socket) {
        socket.emit('send_message', {
          ...message,
          chatId: selectedChat.id
        });
      }

      // Update chat list
      updateChatLastMessage(message);
      
    } catch (error) {
      console.error('Error uploading file:', error);
      // TODO: Show error toast
    } finally {
      setIsUploading(false);
      setShowAttachmentMenu(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert('Image size must be less than 10MB');
        return;
      }
      handleFileUpload(file, 'image');
    }
    e.target.value = '';
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        alert('Video size must be less than 50MB');
        return;
      }
      handleFileUpload(file, 'video');
    }
    e.target.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) { // 25MB limit
        alert('File size must be less than 25MB');
        return;
      }
      handleFileUpload(file, 'file');
    }
    e.target.value = '';
  };

  const renderMessage = (message: Message) => {
    const isOwn = message.senderId === currentUser.id;
    
    return (
      <div
        key={message.id}
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
      >
        <div
          className={`max-w-xs lg:max-w-md ${
            isOwn
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-800'
          } rounded-lg overflow-hidden`}
        >
          {!isOwn && (
            <div className="px-4 pt-2">
              <p className="text-xs font-medium opacity-75">
                {message.sender?.fullName || message.sender?.username}
              </p>
            </div>
          )}
          
          {message.messageType === 'image' && message.mediaUrl && (
            <div className="relative">
              <img
                src={getImageUrl(message.mediaUrl) || ''}
                alt="Shared image"
                className="w-full h-auto max-h-64 object-cover cursor-pointer rounded-lg border border-yellow-400"
                onClick={() => window.open(getImageUrl(message.mediaUrl) || '', '_blank')}
                onError={(e) => {
                  console.error('Image failed to load:', message.mediaUrl);
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
              {message.content && (
                <div className="px-4 py-2">
                  <p className="text-sm">{message.content}</p>
                </div>
              )}
            </div>
          )}
          
          {message.messageType === 'video' && message.mediaUrl && (
            <div className="relative">
              <video
                src={message.mediaUrl}
                controls
                className="w-full h-auto max-h-64"
                preload="metadata"
              />
              {message.content && (
                <div className="px-4 py-2">
                  <p className="text-sm">{message.content}</p>
                </div>
              )}
            </div>
          )}
          
          {message.messageType === 'file' && (
            <div className="px-4 py-2">
              <div className="flex items-center space-x-2">
                <Paperclip className="w-4 h-4" />
                <div className="flex-1">
                  <p className="text-sm font-medium truncate">
                    {message.fileName || 'Unknown file'}
                  </p>
                  {message.fileSize && (
                    <p className="text-xs opacity-75">
                      {(message.fileSize / 1024 / 1024).toFixed(1)} MB
                    </p>
                  )}
                </div>
              </div>
              {message.mediaUrl && (
                <a
                  href={message.mediaUrl}
                  download={message.fileName}
                  className={`text-sm underline mt-1 block ${
                    isOwn ? 'text-blue-100' : 'text-blue-600'
                  }`}
                >
                  Download
                </a>
              )}
            </div>
          )}
          
          {message.messageType === 'text' && (
            <div className="px-4 py-2">
              <p className="text-sm">{message.content}</p>
            </div>
          )}
          
          <div className="px-4 pb-2">
            <p
              className={`text-xs ${
                isOwn ? 'text-blue-100' : 'text-gray-500'
              }`}
            >
              {formatTime(message.createdAt)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const scrollToBottom = (smooth = false) => {
    if (messagesContainerRef.current) {
      // Scroll the messages container to bottom, not the entire page
      if (smooth) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      } else {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }
  };

  // Check if user is near the bottom of the chat
  const checkIfUserAtBottom = (element: HTMLElement) => {
    const threshold = 100; // pixels from bottom
    const isAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
    setIsUserAtBottom(isAtBottom);
  };

  // Handle scroll events in messages container
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    checkIfUserAtBottom(element);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getChatDisplayName = (chat: Chat) => {
    if (chat.type === 'ad_inquiry' && chat.ad) {
      return chat.ad.title;
    }
    if (chat.otherParticipants.length > 0) {
      return chat.otherParticipants[0].fullName || chat.otherParticipants[0].username;
    }
    return 'Unknown';
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={(e) => {
        // Only close if clicking the backdrop, not the modal content
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[600px] flex"
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from bubbling
        style={{ position: 'relative' }}
      >
        {/* Chat List */}
        <div className="w-1/3 border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center">
              <MessageSquare className="w-5 h-5 mr-2" />
              Messages
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {chats.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No conversations yet
              </div>
            ) : (
              chats.map(chat => (
                <div
                  key={chat.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleChatSelect(chat);
                  }}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                    selectedChat?.id === chat.id ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-sm truncate">
                        {getChatDisplayName(chat)}
                      </h3>
                      {chat.ad && (
                        <p className="text-xs text-blue-600 truncate">
                          ${chat.ad.price}
                        </p>
                      )}
                      <p className="text-sm text-gray-600 truncate mt-1">
                        {chat.lastMessage || 'No messages yet'}
                      </p>
                    </div>
                    {chat.lastMessageTime && (
                      <span className="text-xs text-gray-400">
                        {formatTime(chat.lastMessageTime)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col relative">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-sm mr-3">
                    {getChatDisplayName(selectedChat).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-medium">{getChatDisplayName(selectedChat)}</h3>
                    {selectedChat.ad && (
                      <p className="text-sm text-gray-600">Ad Inquiry</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100">
                    <Phone className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100">
                    <Video className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div 
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
                {loading ? (
                  <div className="text-center text-gray-500">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-gray-500">No messages yet. Start the conversation!</div>
                ) : (
                  messages.map(message => renderMessage(message))
                )}
                
                {typingUsers.length > 0 && (
                  <div className="flex justify-start">
                    <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">
                      <p className="text-sm italic">
                        {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                      </p>
                    </div>
                  </div>
                )}
                
                {isUploading && (
                  <div className="flex justify-end">
                    <div className="bg-blue-500 text-white px-4 py-2 rounded-lg">
                      <p className="text-sm">Uploading file...</p>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Scroll to bottom button - shows when user is not at bottom */}
              {!isUserAtBottom && (
                <div className="absolute bottom-20 right-6 z-10">
                  <button
                    onClick={() => {
                      setIsUserAtBottom(true);
                      scrollToBottom(true); // Use smooth scrolling
                    }}
                    className="bg-blue-500 text-white p-3 rounded-full shadow-lg hover:bg-blue-600 transition-colors"
                    title="Scroll to bottom"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Message Input */}
              <form onSubmit={sendMessage} className="p-4 border-t border-gray-200">
                <div className="flex space-x-2 items-end">
                  {/* Image Button */}
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="p-2 text-gray-500 hover:text-yellow-400 rounded-full hover:bg-gray-900 border border-yellow-400"
                    disabled={isUploading}
                    title="Send Image"
                  >
                    <Image className="w-5 h-5" />
                  </button>
                  {/* Video Button */}
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="p-2 text-gray-500 hover:text-yellow-400 rounded-full hover:bg-gray-900 border border-yellow-400"
                    disabled={isUploading}
                    title="Send Video"
                  >
                    <FileVideo className="w-5 h-5" />
                  </button>
                  {/* Message Input */}
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    placeholder={isUploading ? "Uploading..." : "Type a message..."}
                    disabled={isUploading}
                    className="flex-1 px-4 py-2 border border-yellow-400 bg-black text-yellow-300 rounded-full focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-50"
                  />
                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || isUploading}
                    className="px-4 py-2 bg-yellow-400 text-black rounded-full hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                {/* Hidden file inputs */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoSelect}
                  className="hidden"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="*/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Select a conversation to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatSystem;
