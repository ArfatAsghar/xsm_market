import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllChats, adminSendMessage, adminDeleteMessage, adminDeleteChat, resolveSupportChat } from '@/services/admin';
import {
  Send, Trash2, MessageSquare, AlertTriangle, CheckCircle,
  Plus, Clipboard, Sparkles, Search, Shield,
  Lock, UserCheck, RefreshCw, X
} from 'lucide-react';
import { useAuth } from '@/context/useAuth';

interface Participant {
  id: string;
  username: string;
}

interface Message {
  id: string;
  content: string;
  sender: string;
  senderId?: number;
  isStaffMessage?: boolean;
  staffDisplayName?: string;
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
    title: '👋 Agent Introduction',
    content: 'Hello! I am the platform secure agent assigned to assist with your transaction. Please let me know if both parties are ready to begin the transfer process.'
  },
  {
    id: '2',
    title: '📹 YouTube manager invite',
    content: 'Please add the official agent email address as a Manager to the YouTube channel in your YouTube Studio settings. Once the invitation is sent, notify me here in the chat.'
  },
  {
    id: '3',
    title: '⏳ YouTube 7-Day Transfer Cooldown',
    content: 'Under Google\'s security policies, a new Manager must remain in that role for exactly 7 days before they can be promoted to Primary Owner. We will pause and resume the transfer after this period.'
  },
  {
    id: '4',
    title: '💳 Verify Payment',
    content: 'The buyer has submitted the transaction fee payment. I am currently verifying the transaction. Please do not transfer any rights or credentials until I confirm that the payment has cleared.'
  },
  {
    id: '5',
    title: '🤝 Deal Completed',
    content: 'Congratulations! The transaction has been completed successfully and ownership rights have been fully transferred to the buyer. Thank you for using XSM Market!'
  }
];

// Color palette for user participant bubbles
const PARTICIPANT_PALETTES = [
  { border: 'border-yellow-500/40', bg: 'bg-yellow-950/20', text: 'text-yellow-400', badge: 'bg-yellow-500/20 text-yellow-300' },
  { border: 'border-blue-500/40', bg: 'bg-blue-950/20', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-300' },
  { border: 'border-emerald-500/40', bg: 'bg-emerald-950/20', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
  { border: 'border-purple-500/40', bg: 'bg-purple-950/20', text: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-300' },
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

  // Staff Display Name — locked to admin-set displayName (or username fallback)
  const effectiveStaffName = (currentUser as any)?.displayName || (currentUser as any)?.username || 'Staff';
  const [sendAsStaff, setSendAsStaff] = useState<boolean>(true);

  // Custom in-app dialogs (no browser alert/confirm)
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const [noticeModal, setNoticeModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info';
  }>({ open: false, title: '', message: '' });

  const showConfirm = (title: string, message: string, onConfirm: () => void, confirmLabel = 'Confirm', danger = true) => {
    setConfirmModal({ open: true, title, message, onConfirm, confirmLabel, danger });
  };
  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, open: false }));

  const showNotice = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNoticeModal({ open: true, title, message, type });
  };
  const closeNotice = () => setNoticeModal(prev => ({ ...prev, open: false }));

  // Saved templates state
  const [templates, setTemplates] = useState<Array<{ id: string; title: string; content: string }>>(() => {
    const saved = localStorage.getItem('admin_chat_templates');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return DEFAULT_TEMPLATES;
  });
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<{ id?: string; title: string; content: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      const rawChats = data.chats || data || [];
      const normalizedChats = rawChats.map((chat: any) => ({
        ...chat,
        participants: typeof chat.participants === 'string'
          ? chat.participants.split(', ').map((name: string, i: number) => ({ id: String(i), username: name.trim() }))
          : (Array.isArray(chat.participants) ? chat.participants : []),
        messages: Array.isArray(chat.messages) ? chat.messages : [],
      }));
      setChats(normalizedChats);
      if (initialChatId) {
        const target = normalizedChats.find((c: any) => String(c.id) === String(initialChatId));
        if (target) handleSelectChat(target);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch chats');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChat = async (chat: Chat) => {
    setSelectedChat({ ...chat, messages: [] });
    try {
      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://xsmmarket.com/api');
      const response = await fetch(`${apiUrl}/chat/chats/${chat.id}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const messages = await response.json();
        const formattedMessages = Array.isArray(messages) ? messages.map((m: any) => ({
          id: String(m.id),
          content: m.content,
          sender: m.isStaffMessage
            ? (m.staffDisplayName || m.sender?.displayName || m.sender?.username || 'Official Agent')
            : (m.sender?.displayName || m.sender?.username || 'User'),
          senderId: m.senderId,
          isStaffMessage: Boolean(m.isStaffMessage),
          staffDisplayName: m.isStaffMessage ? (m.staffDisplayName || m.sender?.displayName || 'Official Agent') : undefined,
          timestamp: m.createdAt
        })) : [];
        setSelectedChat(prev => prev && prev.id === chat.id ? { ...prev, messages: formattedMessages } : prev);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch (err: any) {
      console.error('Failed to load chat messages:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedChat || !newMessage.trim() || isSending) return;
    if (isCurrentUserViewer) {
      showNotice('Viewer Mode', 'Viewer role is read-only and cannot send messages.', 'info');
      return;
    }

    try {
      setIsSending(true);
      const res = await adminSendMessage(selectedChat.id, newMessage.trim(), effectiveStaffName, sendAsStaff);

      const senderName = sendAsStaff
        ? (res.staffDisplayName || effectiveStaffName)
        : ((currentUser as any)?.displayName || currentUser?.username || 'User');

      const formattedMessage: Message = {
        id: String(res.id),
        content: res.content,
        sender: senderName,
        senderId: Number(currentUser?.id),
        isStaffMessage: sendAsStaff,
        staffDisplayName: sendAsStaff ? (res.staffDisplayName || effectiveStaffName) : undefined,
        timestamp: res.createdAt || new Date().toISOString()
      };

      setSelectedChat(prev => prev ? {
        ...prev,
        messages: [...prev.messages, formattedMessage]
      } : null);

      setChats(prev => prev.map(c =>
        c.id === selectedChat.id
          ? { ...c, messages: [...c.messages, formattedMessage], lastMessage: newMessage.trim() }
          : c
      ));

      setNewMessage('');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      showNotice('Send Failed', err.message || 'Failed to send message', 'error');
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
            chat.id === selectedChat.id
              ? { ...chat, messages: chat.messages.filter(m => m.id !== messageId) }
              : chat
          ));
        } catch (err: any) {
          showNotice('Error', 'Failed to delete message: ' + err.message, 'error');
        }
      },
      'Delete',
      true
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
          showNotice('Deleted', 'Chat has been deleted successfully.', 'success');
        } catch (err: any) {
          showNotice('Error', 'Failed to delete chat: ' + err.message, 'error');
        }
      },
      'Delete Chat',
      true
    );
  };

  // ── In-App Resolve Popup ──
  const handleResolveSupport = async () => {
    if (!selectedChat) return;
    if (isCurrentUserViewer) {
      showNotice('Viewer Mode', 'Viewer role cannot resolve support requests.', 'info');
      return;
    }

    showConfirm(
      'Resolve Support Request',
      'Mark this support request as resolved? An in-chat notification will be sent to participants indicating that support assistance is completed.',
      async () => {
        closeConfirm();
        try {
          await resolveSupportChat(selectedChat.id);
          setSelectedChat(prev => prev ? { ...prev, support_requested: false } : null);
          setChats(prev => prev.map(chat =>
            chat.id === selectedChat.id ? { ...chat, support_requested: false } : chat
          ));
          handleSelectChat(selectedChat);
          showNotice('Resolved', 'Support request marked as resolved successfully!', 'success');
        } catch (err: any) {
          showNotice('Error', 'Failed to resolve support request: ' + err.message, 'error');
        }
      },
      'Resolve Request',
      false
    );
  };

  const handleSaveTemplate = () => {
    if (!editingTemplate || !editingTemplate.title.trim() || !editingTemplate.content.trim()) {
      showNotice('Missing Fields', 'Please fill out both Title and Content fields.', 'error');
      return;
    }
    if (editingTemplate.id) {
      setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? { ...t, title: editingTemplate.title, content: editingTemplate.content } : t));
    } else {
      setTemplates(prev => [...prev, { id: String(Date.now()), title: editingTemplate.title, content: editingTemplate.content }]);
    }
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (id: string) => {
    showConfirm('Delete Template', 'Are you sure you want to delete this message template?', () => {
      closeConfirm();
      setTemplates(prev => prev.filter(t => t.id !== id));
      if (editingTemplate?.id === id) setEditingTemplate(null);
    });
  };

  const handleSendTemplateInstantly = async (content: string) => {
    if (!selectedChat || isSending || isCurrentUserViewer) return;
    try {
      setIsSending(true);
      const res = await adminSendMessage(selectedChat.id, content, staffDisplayName);
      const formattedMsg: Message = {
        id: String(res.id),
        content: res.content,
        sender: res.staffDisplayName || staffDisplayName,
        senderId: Number(currentUser?.id),
        isStaffMessage: true,
        staffDisplayName: res.staffDisplayName || staffDisplayName,
        timestamp: res.createdAt || new Date().toISOString()
      };

      setSelectedChat(prev => prev ? { ...prev, messages: [...prev.messages, formattedMsg] } : null);
      setChats(prev => prev.map(chat =>
        chat.id === selectedChat.id ? { ...chat, messages: [...chat.messages, formattedMsg], lastMessage: content } : chat
      ));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      showNotice('Error', 'Failed to send template message: ' + err.message, 'error');
    } finally {
      setIsSending(false);
    }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-xsm-yellow"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-400 gap-2">
        <AlertTriangle className="w-8 h-8" />
        <p>{error}</p>
        <button onClick={loadChats} className="px-4 py-2 bg-xsm-dark-gray border border-xsm-medium-gray text-white rounded-lg text-sm hover:bg-xsm-medium-gray transition-colors">
          Retry
        </button>
      </div>
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
      return searchMatch && (chat.support_requested == true || chat.support_requested == 1 as any);
    }
    return searchMatch;
  });

  return (
    <>
      <div className="flex flex-col h-auto min-h-[680px]">
        {/* Control Panel Header */}
        <div className="bg-xsm-dark-gray rounded-xl border border-xsm-medium-gray p-4 mb-4 flex-shrink-0">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search chats..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-xsm-black border border-xsm-medium-gray rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-xsm-yellow w-64 text-white"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-xsm-black border border-xsm-medium-gray rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-xsm-yellow text-white"
              >
                <option value="all">All Chats</option>
                <option value="support_requested">🆘 Support Requested</option>
              </select>
            </div>

            <div className="flex items-center space-x-3">
              {/* Role badge */}
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border ${
                isCurrentUserAdmin
                  ? 'bg-purple-950/40 border-purple-500/40 text-purple-300'
                  : isCurrentUserManager
                  ? 'bg-blue-950/40 border-blue-500/40 text-blue-300'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
              }`}>
                {currentUserRole} Mode
              </span>
              <span className="text-xsm-light-gray text-sm">Total Chats: {filteredChats.length}</span>
              {selectedChat && (
                <button
                  onClick={() => setSelectedChat(null)}
                  className="ml-2 px-3 py-1.5 text-sm bg-xsm-medium-gray hover:bg-xsm-medium-gray/80 text-white rounded-lg transition-colors"
                >
                  ← Back to List
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content — Split layout */}
        <div className="flex gap-4 flex-1 min-h-0">

          {/* Chat List Panel */}
          <div className={`${selectedChat ? 'hidden lg:flex lg:w-2/5 xl:w-1/3' : 'flex w-full'} flex-col bg-xsm-dark-gray rounded-xl border border-xsm-medium-gray overflow-hidden`}>
            <div className="overflow-y-auto flex-1">
              <table className="w-full">
                <thead className="sticky top-0 bg-xsm-black z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-xsm-yellow">Participants</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-xsm-yellow hidden xl:table-cell">Last Message</th>
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
                            {(chat.participants || []).map((p: any, idx: number) => {
                              const colorScheme = PARTICIPANT_PALETTES[idx % PARTICIPANT_PALETTES.length];
                              return (
                                <span
                                  key={p.id || idx}
                                  className={`text-xs px-2 py-0.5 rounded border font-semibold ${colorScheme.bg} ${colorScheme.border} ${colorScheme.text}`}
                                >
                                  {p.username}
                                </span>
                              );
                            })}
                            {(chat.support_requested == true || chat.support_requested == 1 as any) && (
                              <span className="flex items-center gap-1 bg-red-500/20 border border-red-500/40 text-red-400 text-[11px] px-2 py-0.5 rounded font-bold animate-pulse">
                                🆘 Support
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-xsm-light-gray mt-1 truncate max-w-[180px]">{chat.lastMessage}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <p className="text-sm text-xsm-light-gray max-w-xs truncate">{chat.lastMessage}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSelectChat(chat); }}
                            className="px-2.5 py-1 text-xs bg-xsm-yellow text-black rounded hover:bg-xsm-yellow/90 flex items-center gap-1 font-semibold"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Review</span>
                          </button>
                          {isCurrentUserAdmin && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }}
                              className="px-2 py-1 text-xs bg-red-500/80 hover:bg-red-600 text-white rounded flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredChats.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-400 text-sm">
                        No conversations match the current filter
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Chat Detail Panel */}
          {selectedChat && (
            <div className="flex-1 flex flex-col bg-xsm-dark-gray rounded-xl border border-xsm-medium-gray overflow-hidden min-h-0">
              {/* Chat Header */}
              <div className="flex justify-between items-start p-4 border-b border-xsm-medium-gray flex-shrink-0 bg-xsm-black/50">
                <div>
                  <h2 className="text-lg font-bold text-xsm-yellow flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Admin Chat Review
                  </h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-gray-400">Participants:</span>
                    {(selectedChat.participants || []).map((p: any, idx: number) => {
                      const colorScheme = PARTICIPANT_PALETTES[idx % PARTICIPANT_PALETTES.length];
                      return (
                        <span key={p.id || idx} className={`text-xs px-2 py-0.5 rounded font-bold border ${colorScheme.bg} ${colorScheme.border} ${colorScheme.text}`}>
                          {p.username}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Resolve Button — Triggers In-App Popup */}
                  {!isCurrentUserViewer && selectedChat.support_requested && (
                    <button
                      onClick={handleResolveSupport}
                      className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded flex items-center gap-1.5 transition-colors font-semibold shadow-md"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Resolve Request
                    </button>
                  )}

                  {isCurrentUserAdmin && (
                    <button
                      onClick={() => handleDeleteChat(selectedChat.id)}
                      className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded flex items-center gap-1.5 font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedChat(null)}
                    className="p-1.5 text-xsm-light-gray hover:text-white hover:bg-xsm-medium-gray/40 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages + Saved Replies Split */}
              <div className="flex-1 flex gap-0 overflow-hidden min-h-0">
                {/* Messages Column */}
                <div className="flex-1 flex flex-col min-h-0 p-4 bg-xsm-black/30">
                  <div className="flex-1 space-y-3 overflow-y-auto pr-2 mb-4 h-[420px] min-h-[350px]">
                    {(selectedChat.messages || []).map((message) => {
                      const isStaff = Boolean(message.isStaffMessage || message.staffDisplayName);

                      // Map participant index to color palette for user messages
                      const participantIdx = (selectedChat.participants || []).findIndex(
                        p => p.username === message.sender || String(p.id) === String(message.senderId)
                      );
                      const colorScheme = PARTICIPANT_PALETTES[
                        participantIdx >= 0 ? participantIdx % PARTICIPANT_PALETTES.length : 0
                      ];

                      if (isStaff) {
                        // Staff/Admin Dashboard message style
                        const displayName = message.staffDisplayName || message.sender || 'Staff';
                        return (
                          <div key={message.id} className="flex justify-end w-full my-2">
                            <div className="max-w-md bg-gradient-to-br from-teal-950/80 via-gray-900 to-gray-900 border border-teal-500/40 rounded-2xl rounded-tr-sm p-3.5 shadow-lg text-white">
                              <div className="flex items-center justify-between gap-2 mb-1.5 border-b border-teal-500/20 pb-1">
                                <div className="flex items-center gap-1.5">
                                  <Shield className="w-3.5 h-3.5 text-teal-400" />
                                  <span className="text-xs font-bold text-teal-300">{displayName}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-teal-400/60">{formatDate(message.timestamp)}</span>
                                  {isCurrentUserAdmin && (
                                    <button
                                      onClick={() => handleDeleteMessage(message.id)}
                                      className="p-1 hover:bg-red-500/20 text-teal-400 hover:text-red-400 rounded transition-colors"
                                      title="Delete message"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm leading-relaxed text-gray-100">{message.content}</p>
                            </div>
                          </div>
                        );
                      }

                      // User message style (distinct by participant color)
                      return (
                        <div key={message.id} className="flex justify-start w-full my-2">
                          <div className={`max-w-md rounded-2xl rounded-tl-sm p-3.5 border shadow-md bg-xsm-black ${colorScheme.border}`}>
                            <div className="flex items-center justify-between gap-2 mb-1.5 border-b border-white/10 pb-1">
                              <span className={`text-xs font-bold ${colorScheme.text}`}>
                                {message.sender}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-gray-400">{formatDate(message.timestamp)}</span>
                                {isCurrentUserAdmin && (
                                  <button
                                    onClick={() => handleDeleteMessage(message.id)}
                                    className="p-1 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded transition-colors"
                                    title="Delete message"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-gray-200 leading-relaxed">{message.content}</p>
                          </div>
                        </div>
                      );
                    })}

                    {(selectedChat.messages || []).length === 0 && (
                      <div className="text-center text-gray-400 py-12 text-sm">No messages yet in this conversation</div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input Section or Viewer Mode Banner */}
                  {isCurrentUserViewer ? (
                    <div className="border-t border-xsm-medium-gray pt-3 flex-shrink-0">
                      <div className="flex items-center justify-center gap-2 bg-amber-950/20 border border-amber-500/40 text-amber-300 p-3 rounded-lg text-sm font-semibold">
                        <Lock className="w-4 h-4 text-amber-400" />
                        <span>Viewer Mode (Read-Only) — Replying is restricted for Viewer role accounts.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-xsm-medium-gray pt-3 flex-shrink-0 bg-xsm-black/40 p-3 rounded-lg border border-xsm-medium-gray/60">
                      {/* Send-As Header with Editable Display Name & Mode Toggle */}
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <div className="flex items-center gap-3 text-xs">
                          {/* Send Mode Toggle Pill */}
                          <div className="flex items-center gap-1 bg-xsm-black p-1 rounded-lg border border-xsm-medium-gray/50">
                            <span className="text-gray-400 font-medium px-1">Mode:</span>
                            <button
                              type="button"
                              onClick={() => setSendAsStaff(true)}
                              className={`px-2.5 py-0.5 rounded font-bold text-xs flex items-center gap-1 transition-all ${
                                sendAsStaff
                                  ? 'bg-teal-600 text-white shadow'
                                  : 'text-gray-400 hover:text-white'
                              }`}
                            >
                              <Shield className="w-3 h-3" />
                              Official Staff
                            </button>
                            <button
                              type="button"
                              onClick={() => setSendAsStaff(false)}
                              className={`px-2.5 py-0.5 rounded font-bold text-xs flex items-center gap-1 transition-all ${
                                !sendAsStaff
                                  ? 'bg-xsm-yellow text-black shadow'
                                  : 'text-gray-400 hover:text-white'
                              }`}
                            >
                              <UserCheck className="w-3 h-3" />
                              Normal User (@{(currentUser as any)?.username || 'User'})
                            </button>
                          </div>


                        </div>

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
                          placeholder={sendAsStaff ? `Type response as ${effectiveStaffName}...` : `Type message as @${(currentUser as any)?.username || 'User'}...`}
                          className="flex-1 bg-xsm-black border border-xsm-medium-gray rounded-lg px-4 py-2.5 focus:outline-none focus:border-xsm-yellow text-white text-sm"
                          disabled={isSending}
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={!newMessage.trim() || isSending}
                          className="px-5 py-2.5 bg-xsm-yellow text-black rounded-lg hover:bg-xsm-yellow/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bold transition-colors shadow-md"
                        >
                          <Send className="w-4 h-4" />
                          <span>{isSending ? 'Sending...' : 'Send'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Templates / Saved Replies Sidebar */}
                {showTemplates && (
                  <div className="w-72 border-l border-xsm-medium-gray p-4 flex flex-col min-h-0 overflow-hidden bg-xsm-black/40">
                    <div className="flex items-center justify-between mb-3 flex-shrink-0">
                      <h3 className="text-sm font-bold text-xsm-yellow flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" />
                        Saved Replies
                      </h3>
                      {!editingTemplate && !isCurrentUserViewer && (
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
                            placeholder="Search templates..."
                            className="w-full bg-xsm-black border border-xsm-medium-gray rounded pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-xsm-yellow text-white"
                          />
                        </div>
                        <div className="overflow-y-auto space-y-2 flex-1 min-h-0">
                          {templates.filter(t =>
                            t.title.toLowerCase().includes(templateSearch.toLowerCase()) ||
                            t.content.toLowerCase().includes(templateSearch.toLowerCase())
                          ).map(t => (
                            <div key={t.id} className="bg-xsm-black/60 border border-xsm-medium-gray/50 hover:border-xsm-yellow/50 rounded-lg p-2.5 group transition-all">
                              <h4 className="text-xs font-bold text-white truncate mb-1">{t.title}</h4>
                              <p className="text-[11px] text-xsm-light-gray line-clamp-2 mb-2">{t.content}</p>
                              {!isCurrentUserViewer && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => setNewMessage(t.content)}
                                    className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-xsm-yellow rounded text-[10px] flex items-center gap-0.5 font-semibold"
                                  >
                                    <Clipboard className="w-2.5 h-2.5" />
                                    <span>Insert</span>
                                  </button>
                                  <button
                                    onClick={() => handleSendTemplateInstantly(t.content)}
                                    disabled={isSending}
                                    className="px-2 py-0.5 bg-xsm-yellow text-black hover:bg-yellow-400 rounded text-[10px] font-bold flex items-center gap-0.5"
                                  >
                                    <Send className="w-2.5 h-2.5" />
                                    <span>Send</span>
                                  </button>
                                  <button onClick={() => setEditingTemplate(t)} className="p-1 hover:bg-gray-800 rounded text-gray-400 ml-auto">
                                    <Edit className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => handleDeleteTemplate(t.id)} className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-red-400">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
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

      {/* ── Custom In-App Confirm Dialog (Replaces browser-level confirm) ── */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-xsm-dark-gray border border-xsm-medium-gray rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${confirmModal.danger ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'}`}>
                {confirmModal.danger ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
              </div>
              <h3 className="text-lg font-bold text-white">{confirmModal.title}</h3>
            </div>
            <p className="text-sm text-xsm-light-gray mb-6 leading-relaxed">{confirmModal.message}</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={closeConfirm}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 border border-xsm-medium-gray hover:bg-xsm-medium-gray/40 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 rounded-lg text-sm font-bold text-white transition-colors shadow-md ${
                  confirmModal.danger ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {confirmModal.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom In-App Notice Modal (Replaces browser-level alert) ── */}
      {noticeModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-xsm-dark-gray border border-xsm-medium-gray rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                noticeModal.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                noticeModal.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                'bg-blue-500/20 text-blue-400 border border-blue-500/40'
              }`}>
                {noticeModal.type === 'error' ? <AlertTriangle className="w-5 h-5" /> :
                 noticeModal.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
                 <Shield className="w-5 h-5" />}
              </div>
              <h3 className="text-lg font-bold text-white">{noticeModal.title}</h3>
            </div>
            <p className="text-sm text-xsm-light-gray mb-6 leading-relaxed">{noticeModal.message}</p>
            <div className="flex items-center justify-end">
              <button
                onClick={closeNotice}
                className="px-5 py-2 rounded-lg text-sm font-bold bg-xsm-yellow text-black hover:bg-yellow-400 transition-colors shadow-md"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReviewChats;
