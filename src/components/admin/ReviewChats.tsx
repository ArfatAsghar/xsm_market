import React, { useState, useEffect } from 'react';
import { getAllChats, adminSendMessage, adminDeleteMessage, adminDeleteChat } from '@/services/admin';
import { Send, Trash2, MessageSquare, AlertTriangle } from 'lucide-react';

interface Participant {
  id: string;
  username: string;
}

interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: string;
}

interface Chat {
  id: string;
  participants: Participant[];
  messages: Message[];
  lastMessage: string;
  lastMessageTime: string;
}

const ReviewChats: React.FC = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllChats();
      setChats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch chats');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedChat || !newMessage.trim() || isSending) return;

    try {
      setIsSending(true);
      const message = await adminSendMessage(selectedChat.id, newMessage.trim());
      
      // Add the message to the selected chat
      setSelectedChat(prev => prev ? {
        ...prev,
        messages: [...prev.messages, message]
      } : null);
      
      // Update the chat in the list
      setChats(prev => prev.map(chat => 
        chat.id === selectedChat.id 
          ? { ...chat, messages: [...chat.messages, message], lastMessage: newMessage.trim() }
          : chat
      ));
      
      setNewMessage('');
    } catch (err: any) {
      alert('Failed to send message: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedChat || !confirm('Are you sure you want to delete this message?')) return;

    try {
      await adminDeleteMessage(messageId);
      
      // Remove the message from the selected chat
      setSelectedChat(prev => prev ? {
        ...prev,
        messages: prev.messages.filter(m => m.id !== messageId)
      } : null);
      
      // Update the chat in the list
      setChats(prev => prev.map(chat => 
        chat.id === selectedChat.id 
          ? { ...chat, messages: chat.messages.filter(m => m.id !== messageId) }
          : chat
      ));
    } catch (err: any) {
      alert('Failed to delete message: ' + err.message);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!confirm('Are you sure you want to delete this entire chat? This action cannot be undone.')) return;

    try {
      await adminDeleteChat(chatId);
      
      // Remove the chat from the list
      setChats(prev => prev.filter(chat => chat.id !== chatId));
      
      // Close modal if this chat was selected
      if (selectedChat?.id === chatId) {
        setSelectedChat(null);
      }
      
      alert('Chat deleted successfully');
    } catch (err: any) {
      alert('Failed to delete chat: ' + err.message);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-xsm-yellow"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">{error}</div>
    );
  }

  const filteredChats = chats.filter(chat => {
    const participantsMatch = chat.participants.some(p => 
      p.username.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const messagesMatch = chat.messages.some(m => 
      m.content.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return participantsMatch || messagesMatch;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Control Panel */}
      <div className="bg-xsm-dark-gray rounded-xl border border-xsm-medium-gray p-4 mb-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center space-x-4">
            <input
              type="text"
              placeholder="Search chats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-xsm-black border border-xsm-medium-gray rounded-lg px-4 py-2 focus:outline-none focus:border-xsm-yellow w-64"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-xsm-black border border-xsm-medium-gray rounded-lg px-4 py-2 focus:outline-none focus:border-xsm-yellow"
            >
              <option value="all">All Chats</option>
              <option value="active">Active</option>
              <option value="flagged">Flagged</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xsm-light-gray">Total Chats: {filteredChats.length}</span>
          </div>
        </div>
      </div>

      {/* Chat Table */}
      <div className="bg-xsm-dark-gray rounded-xl border border-xsm-medium-gray overflow-hidden flex-grow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-xsm-black">
                <th className="px-4 py-3 text-left text-sm font-medium text-xsm-yellow">Participants</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-xsm-yellow">Last Message</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-xsm-yellow">Time</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-xsm-yellow">Messages</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-xsm-yellow">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-xsm-medium-gray">
              {filteredChats.map((chat) => (
                <tr 
                  key={chat.id}
                  className={`hover:bg-xsm-medium-gray/30 transition-colors cursor-pointer ${
                    selectedChat?.id === chat.id ? 'bg-xsm-medium-gray/50' : ''
                  }`}
                  onClick={() => setSelectedChat(chat)}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      {chat.participants.map((p) => (
                        <span key={p.id} className="text-sm">{p.username}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-xsm-light-gray max-w-xs truncate">
                      {chat.lastMessage}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-xsm-light-gray">
                      {formatDate(chat.lastMessageTime)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm">{chat.messages.length}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex space-x-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedChat(chat);
                        }}
                        className="px-3 py-1 text-sm bg-xsm-yellow text-black rounded hover:bg-xsm-yellow/90 flex items-center space-x-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Review</span>
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteChat(chat.id);
                        }}
                        className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 flex items-center space-x-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chat Detail Modal */}
      {selectedChat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-xsm-dark-gray rounded-xl border border-xsm-medium-gray p-6 max-w-4xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-xsm-yellow">Chat Review & Management</h2>
                <p className="text-sm text-xsm-light-gray mt-1">
                  Between: {selectedChat.participants.map((p) => p.username).join(', ')}
                </p>
              </div>
              <button 
                onClick={() => setSelectedChat(null)}
                className="text-xsm-light-gray hover:text-white"
              >
                ✕
              </button>
            </div>
            
            {/* Messages Container */}
            <div className="flex-1 space-y-4 overflow-y-auto max-h-[50vh] pr-4 mb-4">
              {selectedChat.messages.map((message) => (
                <div
                  key={message.id}
                  className="flex flex-col space-y-1 bg-xsm-black rounded-lg p-4 group hover:bg-xsm-black/80 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${message.sender === 'Admin' ? 'text-red-400' : 'text-xsm-yellow'}`}>
                      {message.sender}
                      {message.sender === 'Admin' && <span className="ml-2 text-xs bg-red-500 px-2 py-0.5 rounded">ADMIN</span>}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-xsm-light-gray">
                        {formatDate(message.timestamp)}
                      </span>
                      <button
                        onClick={() => handleDeleteMessage(message.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500 rounded text-red-400 hover:text-white"
                        title="Delete message"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm mt-2">{message.content}</p>
                </div>
              ))}
            </div>

            {/* Admin Message Input */}
            <div className="border-t border-xsm-medium-gray pt-4 mb-4">
              <div className="flex items-center space-x-3 mb-3">
                <span className="text-red-400 font-medium text-sm">Send as Admin:</span>
              </div>
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type your admin message..."
                  className="flex-1 bg-xsm-black border border-xsm-medium-gray rounded-lg px-4 py-2 focus:outline-none focus:border-xsm-yellow"
                  disabled={isSending}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || isSending}
                  className="px-4 py-2 bg-xsm-yellow text-black rounded-lg hover:bg-xsm-yellow/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSending ? 'Sending...' : 'Send'}</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-4 border-t border-xsm-medium-gray">
              <button 
                onClick={() => handleDeleteChat(selectedChat.id)}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 flex items-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Entire Chat</span>
              </button>
              <div className="flex space-x-3">
                <button className="px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-600 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Flag Chat</span>
                </button>
                <button 
                  onClick={() => setSelectedChat(null)}
                  className="px-4 py-2 bg-xsm-medium-gray text-white rounded hover:bg-xsm-medium-gray/80"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewChats;
