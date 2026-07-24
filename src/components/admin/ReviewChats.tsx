import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllChats, adminSendMessage, adminDeleteMessage, adminDeleteChat, resolveSupportChat } from '@/services/admin';
import { Send, Trash2, MessageSquare, AlertTriangle, CheckCircle, Plus, Edit, Clipboard, Sparkles, Search, ExternalLink } from 'lucide-react';
import { useAuth } from '@/context/useAuth';

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
  support_requested?: boolean;
}

const DEFAULT_TEMPLATES = [
  {
    id: '1',
    title: 'ðŸ‘‹ Agent Introduction',
    content: 'Hello! I am the platform secure agent assigned to assist with your transaction. Please let me know if both parties are ready to begin the transfer process.'
  },
  {
    id: '2',
    title: 'ðŸ“¹ YouTube manager invite',
    content: 'Please add the official agent email address as a Manager to the YouTube channel in your YouTube Studio settings. Once the invitation is sent, notify me here in the chat.'
  },
  {
    id: '3',
    title: 'â³ YouTube 7-Day Transfer Cooldown',
    content: 'Under Google\'s security policies, a new Manager must remain in that role for exactly 7 days before they can be promoted to Primary Owner. We will pause and resume the transfer after this period.'
  },
  {
    id: '4',
    title: 'ðŸ’³ Verify Payment',
    content: 'The buyer has submitted the transaction fee payment. I am currently verifying the transaction. Please do not transfer any rights or credentials until I confirm that the payment has cleared.'
  },
  {
    id: '5',
    title: 'ðŸ¤ Deal Completed',
    content: 'Congratulations! The transaction has been completed successfully and ownership rights have been fully transferred to the buyer. Thank you for using XSM Market!'
  }
];

interface ReviewChatsProps {
  initialChatId?: string | null;
}

const ReviewChats: React.FC<ReviewChatsProps> = ({ initialChatId }) => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const currentUserRole = (currentUser as any)?.role || 'user';
  const isCurrentUserAdmin = currentUserRole === 'admin' || (currentUser as any)?.isAdmin === true;
  const isCurrentUserManager = currentUserRole === 'manager';
  const isCurrentUserViewer = currentUserRole === 'viewer';

  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Custom confirm modal state (replaces window.confirm/alert)
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const showConfirm = (title: string, message: string, onConfirm: () => void, confirmLabel = 'Delete') => {
    setConfirmModal({ open: true, title, message, onConfirm, confirmLabel });
  };
  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, open: false }));

  // Template states
  const [templates, setTemplates] = useState<Array<{ id: string; title: string; content: string }>>(() => {
    const saved = localStorage.getItem('admin_chat_templates');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_TEMPLATES;
  });
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<{ id?: string; title: string; content: string } | null>(null);

  // Sync templates with localStorage
  useEffect(() => {
    localStorage.setItem('admin_chat_templates', JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllChats();
      // Backend returns { chats: [...], pagination: {...} }
      const rawChats = data.chats || data || [];
      // Normalize: backend returns participants as GROUP_CONCAT string ("user1, user2")
      // and doesn't include messages in list view
      const normalizedChats = rawChats.map((chat: any) => ({
        ...chat,
        participants: typeof chat.participants === 'string'
          ? chat.participants.split(', ').map((name: string, i: number) => ({ id: String(i), username: name.trim() }))
          : (Array.isArray(chat.participants) ? chat.participants : []),
        messages: Array.isArray(chat.messages) ? chat.messages : [],
      }));
      setChats(normalizedChats);
      // Auto-select if we were navigated here from Contact Seller
      if (initialChatId) {
        const target = normalizedChats.find((c: any) => String(c.id) === String(initialChatId));
        if (target) setSelectedChat(target);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch chats');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChat = async (chat: Chat) => {
    setSelectedChat({
      ...chat,
      messages: [] // Clear initially or keep existing list
    });
    try {
      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://xsmmarket.com/api');
      const response = await fetch(`${apiUrl}/chat/chats/${chat.id}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const messages = await response.json();
        const formattedMessages = messages.map((m: any) => ({
          id: String(m.id),
          content: m.content,
          sender: m.sender?.username || 'System',
          timestamp: m.createdAt
        }));
        setSelectedChat(prev => prev && prev.id === chat.id ? {
          ...prev,
          messages: formattedMessages
        } : prev);
      }
    } catch (err: any) {
      console.error('Failed to load chat messages:', err);
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

  const handleDeleteMessage = (messageId: string) => {
    if (!selectedChat) return;
    showConfirm(
      'Delete Message',
      'Are you sure you want to delete this message? This cannot be undone.',
      async () => {
        closeConfirm();
        try {
          await adminDeleteMessage(messageId);
          setSelectedChat(prev => prev ? {
            ...prev,
            messages: prev.messages.filter(m => m.id !== messageId)
          } : null);
          setChats(prev => prev.map(chat =>
            chat.id === selectedChat!.id
              ? { ...chat, messages: chat.messages.filter(m => m.id !== messageId) }
              : chat
          ));
        } catch (err: any) {
          showConfirm('Error', 'Failed to delete message: ' + err.message, closeConfirm, 'OK');
        }
      }
    );
  };

  const handleDeleteChat = (chatId: string) => {
    showConfirm(
      'Delete Entire Chat',
      'Are you sure you want to permanently delete this chat and all its messages? This action cannot be undone.',
      async () => {
        closeConfirm();
        try {
          await adminDeleteChat(chatId);
          setChats(prev => prev.filter(chat => chat.id !== chatId));
          if (selectedChat?.id === chatId) setSelectedChat(null);
        } catch (err: any) {
          showConfirm('Error', 'Failed to delete chat: ' + err.message, closeConfirm, 'OK');
        }
      }
    );
  };

  const handleResolveSupport = async () => {
    if (!selectedChat) return;
    try {
      await resolveSupportChat(selectedChat.id);
      
      // Update selectedChat state
      setSelectedChat(prev => prev ? { ...prev, support_requested: false } : null);
      
      // Update in list
      setChats(prev => prev.map(chat => 
        chat.id === selectedChat.id 
          ? { ...chat, support_requested: false }
          : chat
      ));
      
      // Reload chat messages so they see the resolved notification
      handleSelectChat(selectedChat);
      
      alert('Support request marked as resolved successfully!');
    } catch (err: any) {
      alert('Failed to resolve support request: ' + err.message);
    }
  };

  // Template management actions
  const handleSaveTemplate = () => {
    if (!editingTemplate || !editingTemplate.title.trim() || !editingTemplate.content.trim()) {
      alert('Please fill out both Title and Content fields');
      return;
    }
    
    if (editingTemplate.id) {
      // Edit existing
      setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? { ...t, title: editingTemplate.title, content: editingTemplate.content } : t));
    } else {
      // Create new
      const newT = {
        id: String(Date.now()),
        title: editingTemplate.title,
        content: editingTemplate.content
      };
      setTemplates(prev => [...prev, newT]);
    }
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (id: string) => {
    showConfirm(
      'Delete Template',
      'Are you sure you want to delete this message template?',
      () => {
        closeConfirm();
        setTemplates(prev => prev.filter(t => t.id !== id));
        if (editingTemplate?.id === id) setEditingTemplate(null);
      }
    );
  };

  const handleUseTemplate = (content: string) => {
    setNewMessage(content);
  };

  const handleSendTemplateInstantly = async (content: string) => {
    if (!selectedChat || isSending) return;
    try {
      setIsSending(true);
      const message = await adminSendMessage(selectedChat.id, content);
      
      const formattedMsg = {
        id: String(message.id),
        content: message.content,
        sender: message.sender || 'Admin',
        timestamp: message.timestamp || new Date().toISOString()
      };

      // Add the message to the selected chat
      setSelectedChat(prev => prev ? {
        ...prev,
        messages: [...prev.messages, formattedMsg]
      } : null);
      
      // Update the chat in the list
      setChats(prev => prev.map(chat => 
        chat.id === selectedChat.id 
          ? { ...chat, messages: [...chat.messages, formattedMsg], lastMessage: content }
          : chat
      ));
    } catch (err: any) {
      alert('Failed to send template message: ' + err.message);
    } finally {
      setIsSending(false);
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
    const participantsMatch = (chat.participants || []).some((p: any) => 
      (p.username || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    const messagesMatch = (chat.messages || []).some((m: any) => 
      (m.content || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    const searchMatch = !searchTerm.trim() || participantsMatch || messagesMatch;

    if (filterStatus === 'support_requested') {
      return searchMatch && (chat.support_requested == 1 || chat.support_requested === true);
    }
    return searchMatch;
  });

  return (
    <>
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Control Panel */}
      <div className="bg-xsm-dark-gray rounded-xl border border-xsm-medium-gray p-4 mb-4 flex-shrink-0">
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
              <option value="support_requested">ðŸ†˜ Support Requested</option>
              <option value="active">Active</option>
              <option value="flagged">Flagged</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xsm-light-gray">Total Chats: {filteredChats.length}</span>
            {selectedChat && (
              <button
                onClick={() => setSelectedChat(null)}
                className="ml-4 px-3 py-1.5 text-sm bg-xsm-medium-gray hover:bg-xsm-medium-gray/80 text-white rounded-lg transition-colors"
              >
                â† Back to List
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content â€” split layout when chat selected */}
      <div className={`flex gap-4 flex-1 min-h-0 ${selectedChat ? '' : ''}`}>

        {/* Chat List Panel â€” hidden on mobile when chat selected, visible on desktop always */}
        <div className={`${selectedChat ? 'hidden lg:flex lg:w-2/5 xl:w-1/3' : 'flex w-full'} flex-col bg-xsm-dark-gray rounded-xl border border-xsm-medium-gray overflow-hidden`}>
          <div className="overflow-y-auto flex-1">
            <table className="w-full">
              <thead className="sticky top-0 bg-xsm-black z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-xsm-yellow">Participants</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-xsm-yellow hidden xl:table-cell">Last Message</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-xsm-yellow hidden xl:table-cell">Time</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-xsm-yellow">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-xsm-medium-gray">
                {filteredChats.map((chat) => (
                  <tr
                    key={chat.id}
                    className={`hover:bg-xsm-medium-gray/30 transition-colors cursor-pointer ${
                      selectedChat?.id === chat.id ? 'bg-xsm-yellow/10 border-l-2 border-xsm-yellow' : ''
                    }`}
                    onClick={() => handleSelectChat(chat)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {(chat.participants || []).map((p: any) => (
                            <span key={p.id} className="text-sm bg-xsm-black/45 px-2 py-0.5 rounded border border-xsm-medium-gray/20 font-medium">{p.username}</span>
                          ))}
                          {(chat.support_requested == 1 || chat.support_requested === true) && (
                            <span className="flex items-center gap-1 bg-red-500/20 border border-red-500/40 text-red-400 text-xs px-2 py-0.5 rounded font-bold animate-pulse">
                              ðŸ†˜ Support
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-xsm-light-gray mt-1 truncate max-w-[200px]">{chat.lastMessage}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <p className="text-sm text-xsm-light-gray max-w-xs truncate">{chat.lastMessage}</p>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-sm text-xsm-light-gray">{formatDate(chat.lastMessageTime)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSelectChat(chat); }}
                          className="px-2 py-1 text-xs bg-xsm-yellow text-black rounded hover:bg-xsm-yellow/90 flex items-center gap-1 font-semibold"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>Review</span>
                        </button>
                        {isCurrentUserAdmin && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }}
                            className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chat Detail Panel â€” inline, shown when a chat is selected */}
        {selectedChat && (
          <div className="flex-1 flex flex-col bg-xsm-dark-gray rounded-xl border border-xsm-medium-gray overflow-hidden min-h-0">
            {/* Chat Header */}
            <div className="flex justify-between items-start p-4 border-b border-xsm-medium-gray flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-xsm-yellow flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Chat Review
                </h2>
                <p className="text-sm text-xsm-light-gray mt-0.5">
                  Between: {(selectedChat.participants || []).map((p: any) => p.username).join(' & ')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/chat?chatId=${selectedChat.id}`)}
                  className="px-3 py-1.5 text-sm bg-xsm-yellow text-black hover:bg-yellow-400 rounded flex items-center gap-1.5 transition-colors font-semibold shadow-md"
                  title="Open this conversation in full screen chat"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Full Chat
                </button>
                {!isCurrentUserViewer && selectedChat.support_requested && (
                  <button
                    onClick={handleResolveSupport}
                    className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-1.5 transition-colors font-semibold"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Resolve
                  </button>
                )}
                {isCurrentUserAdmin && (
                  <button
                    onClick={() => handleDeleteChat(selectedChat.id)}
                    className="px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-1.5 font-semibold"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Chat
                  </button>
                )}
                <button
                  onClick={() => setSelectedChat(null)}
                  className="p-1.5 text-xsm-light-gray hover:text-white hover:bg-xsm-medium-gray/40 rounded-lg transition-colors"
                >
                  âœ•
                </button>
              </div>
            </div>

            {/* Split Layout: Messages + Templates */}
            <div className="flex-1 flex gap-0 overflow-hidden min-h-0">
              {/* Messages Column */}
              <div className="flex-1 flex flex-col min-h-0 p-4">
                {/* Messages */}
                <div className="flex-1 space-y-3 overflow-y-auto pr-2 mb-4">
                  {(selectedChat.messages || []).map((message) => (
                    <div
                      key={message.id}
                      className="flex flex-col space-y-1 bg-xsm-black rounded-lg p-3 group hover:bg-xsm-black/80 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-medium text-sm ${message.sender === 'Admin' ? 'text-red-400' : 'text-xsm-yellow'}`}>
                          {message.sender}
                          {message.sender === 'Admin' && <span className="ml-2 text-xs bg-red-500 px-1.5 py-0.5 rounded font-bold">ADMIN</span>}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-xsm-light-gray">{formatDate(message.timestamp)}</span>
                          {!isCurrentUserViewer && (
                            <button
                              onClick={() => handleDeleteMessage(message.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500 rounded text-red-400 hover:text-white"
                              title="Delete message"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm mt-1">{message.content}</p>
                    </div>
                  ))}
                  {(selectedChat.messages || []).length === 0 && (
                    <div className="text-center text-xsm-light-gray py-8 text-sm">No messages yet</div>
                  )}
                </div>

                {/* Admin Message Input */}
                {!isCurrentUserViewer && (
                  <div className="border-t border-xsm-medium-gray pt-3 flex-shrink-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-red-400 font-medium text-sm">Send as Admin:</span>
                      <button
                        type="button"
                        onClick={() => setShowTemplates(!showTemplates)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded transition-colors flex items-center gap-1 border ${
                          showTemplates
                            ? 'bg-xsm-yellow border-xsm-yellow text-black'
                            : 'border-xsm-medium-gray text-xsm-light-gray hover:text-white bg-xsm-black/35'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Saved Replies</span>
                      </button>
                    </div>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Type your admin message..."
                        className="flex-1 bg-xsm-black border border-xsm-medium-gray rounded-lg px-4 py-2 focus:outline-none focus:border-xsm-yellow text-white text-sm"
                        disabled={isSending}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || isSending}
                        className="px-4 py-2 bg-xsm-yellow text-black rounded-lg hover:bg-xsm-yellow/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
                      >
                        <Send className="w-4 h-4" />
                        <span>{isSending ? 'Sending...' : 'Send'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Templates Sidebar */}
              {showTemplates && (
                <div className="w-72 border-l border-xsm-medium-gray p-4 flex flex-col min-h-0 overflow-hidden bg-xsm-black/20">
                  <div className="flex items-center justify-between mb-3 flex-shrink-0">
                    <h3 className="text-sm font-bold text-xsm-yellow flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      Saved Replies
                    </h3>
                    {!editingTemplate && (
                      <button
                        onClick={() => setEditingTemplate({ title: '', content: '' })}
                        className="p-1 hover:bg-xsm-medium-gray/30 rounded text-xsm-yellow"
                        title="Add template"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {editingTemplate ? (
                    <div className="flex-1 flex flex-col space-y-3 overflow-y-auto">
                      <h4 className="text-sm font-semibold text-white">{editingTemplate.id ? 'Edit Template' : 'Add Template'}</h4>
                      <input
                        type="text"
                        value={editingTemplate.title}
                        onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, title: e.target.value } : null)}
                        placeholder="Title/Shortcut"
                        className="w-full bg-xsm-black border border-xsm-medium-gray rounded px-3 py-1.5 text-sm focus:outline-none focus:border-xsm-yellow text-white"
                      />
                      <textarea
                        value={editingTemplate.content}
                        onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, content: e.target.value } : null)}
                        placeholder="Template text..."
                        className="w-full flex-1 min-h-[100px] bg-xsm-black border border-xsm-medium-gray rounded px-3 py-1.5 text-sm focus:outline-none focus:border-xsm-yellow text-white resize-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setEditingTemplate(null)} className="flex-1 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded">Cancel</button>
                        <button onClick={handleSaveTemplate} className="flex-1 py-1.5 text-xs bg-xsm-yellow text-black hover:bg-yellow-400 rounded font-bold">Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                      <div className="relative mb-3 flex-shrink-0">
                        <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-500" />
                        <input
                          type="text"
                          value={templateSearch}
                          onChange={(e) => setTemplateSearch(e.target.value)}
                          placeholder="Search..."
                          className="w-full bg-xsm-black border border-xsm-medium-gray rounded pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-xsm-yellow text-white"
                        />
                      </div>
                      <div className="overflow-y-auto space-y-2 flex-1 min-h-0">
                        {templates.filter(t =>
                          t.title.toLowerCase().includes(templateSearch.toLowerCase()) ||
                          t.content.toLowerCase().includes(templateSearch.toLowerCase())
                        ).map(t => (
                          <div key={t.id} className="bg-xsm-black/50 border border-xsm-medium-gray/40 hover:border-xsm-yellow/50 rounded p-2.5 group transition-all">
                            <h4 className="text-xs font-bold text-white truncate mb-1">{t.title}</h4>
                            <p className="text-[11px] text-xsm-light-gray line-clamp-2 mb-2">{t.content}</p>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => handleUseTemplate(t.content)} className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-xsm-yellow rounded text-[10px] flex items-center gap-0.5">
                                <Clipboard className="w-2.5 h-2.5" /><span>Insert</span>
                              </button>
                              <button onClick={() => handleSendTemplateInstantly(t.content)} disabled={isSending} className="px-2 py-0.5 bg-xsm-yellow text-black hover:bg-yellow-400 rounded text-[10px] font-bold flex items-center gap-0.5">
                                <Send className="w-2.5 h-2.5" /><span>Send</span>
                              </button>
                              <button onClick={() => setEditingTemplate(t)} className="p-1 hover:bg-gray-800 rounded text-gray-400 ml-auto">
                                <Edit className="w-3 h-3" />
                              </button>
                              <button onClick={() => handleDeleteTemplate(t.id)} className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-red-400">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>

      {/* ── Custom Confirm Modal ── */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-xsm-dark-gray border border-xsm-medium-gray rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-2">{confirmModal.title}</h3>
            <p className="text-sm text-xsm-light-gray mb-6 leading-relaxed">{confirmModal.message}</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={closeConfirm}
                className="px-4 py-2 rounded-lg text-sm font-medium text-xsm-light-gray border border-xsm-medium-gray hover:bg-xsm-medium-gray/40 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors shadow-lg"
              >
                {confirmModal.confirmLabel || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReviewChats;
