import React, { useState } from 'react';
import { Search, MoreVertical, User, Shield, Trash, Ban, Unlock, ChevronRight, Crown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from '@/components/ui/use-toast';
import { getAllUsers, deleteUser, updateUserRole, banUser, unbanUser, toggleVipUser } from '@/services/admin';
import { useAuth } from '@/context/useAuth';

interface UserData {
  id: string;
  username: string;
  email: string;
  status: 'active' | 'suspended' | 'pending';
  role: 'user' | 'admin';
  joinDate: string;
  lastActive: string;
  isBanned?: boolean | number;
  vipUntil?: string | null;
  isVip?: boolean;
  banReason?: string;
  banExpires?: string;
  displayName?: string | null;
  // Online presence fields (from backend)
  createdAt?: string;
  lastSeenAt?: string;
  isOnline?: boolean | number;
}

const ManageUsers: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  // Display Name modal state
  const [displayNameModal, setDisplayNameModal] = useState<{ open: boolean; user: UserData | null; value: string; saving: boolean }>({
    open: false, user: null, value: '', saving: false
  });
  const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://xsmmarket.com/api');

  const currentUserRole = (currentUser as any)?.role || 'user';
  const isCurrentUserAdmin = currentUserRole === 'admin' || (currentUser as any)?.isAdmin === true;
  const isCurrentUserManager = currentUserRole === 'manager';
  const isCurrentUserViewer = currentUserRole === 'viewer';

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    getAllUsers()
      .then((data) => {
        setUsers(data.users || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch users');
        setLoading(false);
      });
  }, []);

  const handleDeleteUser = async (user: UserData) => {
    const confirmed = window.confirm(
      `⚠️ DELETE USER CONFIRMATION ⚠️\n\n` +
      `Are you sure you want to permanently delete this user?\n\n` +
      `Username: "${user.username}"\n` +
      `Email: ${user.email}\n` +
      `Role: ${user.role}\n\n` +
      `This action cannot be undone and will permanently remove the user and all their data from the database.`
    );
    
    if (!confirmed) {
      return;
    }

    try {
      await deleteUser(user.id);
      
      // Remove the deleted user from the state
      setUsers(prevUsers => prevUsers.filter(u => u.id !== user.id));
      
      toast({
        title: "✅ User Deleted",
        description: `User "${user.username}" has been permanently deleted.`,
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        variant: "destructive",
        title: "❌ Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete user",
      });
    }
  };

  const handleChangeRole = async (user: UserData, newRole: 'admin' | 'manager' | 'viewer' | 'user') => {
    if (user.role === newRole) {
      toast({
        title: "ℹ️ Role Already Assigned",
        description: `User "${user.username}" is already a ${newRole}.`,
      });
      return;
    }

    const confirmed = window.confirm(
      `🔄 CHANGE USER ROLE ⚠️\n\n` +
      `Are you sure you want to change user "${user.username}" role?\n\n` +
      `Current Role: ${user.role || 'user'}\n` +
      `New Role: ${newRole}\n\n` +
      `This will immediately adjust their access permissions.`
    );
    
    if (!confirmed) {
      return;
    }

    try {
      // Use the role update endpoint
      await updateUserRole(user.id, newRole);
      
      // Update the user's role in the state
      setUsers(prevUsers => 
        prevUsers.map(u => 
          u.id === user.id ? { ...u, role: newRole } : u
        )
      );
      
      toast({
        title: "✅ Role Updated",
        description: `User "${user.username}" role changed to ${newRole}.`,
      });
    } catch (error) {
      console.error('Error changing user role:', error);
      toast({
        variant: "destructive",
        title: "❌ Role Change Failed",
        description: error instanceof Error ? error.message : "Failed to change user role",
      });
    }
  };

  // Custom Ban & Unban Modal States
  const [banModal, setBanModal] = useState<{ open: boolean; user: UserData | null; duration: '7d' | '30d' | 'permanent'; reason: string; submitting: boolean }>({
    open: false, user: null, duration: '7d', reason: '', submitting: false
  });
  const [unbanModal, setUnbanModal] = useState<{ open: boolean; user: UserData | null; submitting: boolean }>({
    open: false, user: null, submitting: false
  });

  const openBanModal = (user: UserData, duration: '7d' | '30d' | 'permanent') => {
    setBanModal({ open: true, user, duration, reason: user.banReason || '', submitting: false });
  };

  const submitBanUser = async () => {
    if (!banModal.user) return;
    if (!banModal.reason.trim()) {
      toast({
        variant: "destructive",
        title: "⚠️ Reason Required",
        description: "Please enter a ban reason or administrative note.",
      });
      return;
    }
    setBanModal(prev => ({ ...prev, submitting: true }));
    try {
      await banUser(banModal.user.id, banModal.reason.trim(), banModal.duration);
      let banExpires: string | undefined = undefined;
      const now = new Date();
      if (banModal.duration === '7d') {
        now.setDate(now.getDate() + 7);
        banExpires = now.toISOString();
      } else if (banModal.duration === '30d') {
        now.setDate(now.getDate() + 30);
        banExpires = now.toISOString();
      }

      setUsers(prevUsers =>
        prevUsers.map(u =>
          u.id === banModal.user!.id ? {
            ...u,
            isBanned: 1,
            banReason: banModal.reason.trim(),
            banExpires
          } : u
        )
      );

      const durationText = banModal.duration === '7d' ? '7-Day' : banModal.duration === '30d' ? '30-Day' : 'Permanent';
      toast({
        title: "✅ User Banned",
        description: `User "${banModal.user.username}" has been banned (${durationText}).`,
      });
      setBanModal({ open: false, user: null, duration: '7d', reason: '', submitting: false });
    } catch (error) {
      console.error('Error banning user:', error);
      toast({
        variant: "destructive",
        title: "❌ Ban Failed",
        description: error instanceof Error ? error.message : "Failed to ban user",
      });
      setBanModal(prev => ({ ...prev, submitting: false }));
    }
  };

  const openUnbanModal = (user: UserData) => {
    setUnbanModal({ open: true, user, submitting: false });
  };

  const submitUnbanUser = async () => {
    if (!unbanModal.user) return;
    setUnbanModal(prev => ({ ...prev, submitting: true }));
    try {
      await unbanUser(unbanModal.user.id);
      setUsers(prevUsers =>
        prevUsers.map(u =>
          u.id === unbanModal.user!.id ? {
            ...u,
            isBanned: 0,
            banReason: undefined,
            banExpires: undefined
          } : u
        )
      );
      toast({
        title: "✅ User Unbanned",
        description: `User "${unbanModal.user.username}" has been unbanned.`,
      });
      setUnbanModal({ open: false, user: null, submitting: false });
    } catch (error) {
      console.error('Error unbanning user:', error);
      toast({
        variant: "destructive",
        title: "❌ Unban Failed",
        description: error instanceof Error ? error.message : "Failed to unban user",
      });
      setUnbanModal(prev => ({ ...prev, submitting: false }));
    }
  };

  const handleToggleVip = async (user: UserData) => {
    try {
      const res = await toggleVipUser(user.id);
      setUsers(prev => prev.map(u => 
        u.id === user.id ? { ...u, vipUntil: res.vipUntil, isVip: res.isVip } : u
      ));
      toast({
        title: res.isVip ? "👑 VIP Granted" : "ℹ️ VIP Removed",
        description: res.message,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Operation Failed",
        description: error instanceof Error ? error.message : "Failed to update VIP status",
      });
    }
  };

  const handleSetDisplayName = (user: UserData) => {
    setDisplayNameModal({ open: true, user, value: user.displayName || '', saving: false });
  };

  const handleSaveDisplayName = async () => {
    if (!displayNameModal.user) return;
    setDisplayNameModal(prev => ({ ...prev, saving: true }));
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/users/${displayNameModal.user.id}/display-name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ displayName: displayNameModal.value.trim() || null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save');
      const newName = displayNameModal.value.trim() || null;
      setUsers(prev => prev.map(u => u.id === displayNameModal.user!.id ? { ...u, displayName: newName } : u));
      toast({ title: '✅ Display Name Updated', description: data.message });
      setDisplayNameModal({ open: false, user: null, value: '', saving: false });
    } catch (err) {
      toast({ variant: 'destructive', title: '❌ Failed', description: err instanceof Error ? err.message : 'Could not save display name' });
      setDisplayNameModal(prev => ({ ...prev, saving: false }));
    }
  };

  const getRelativeTime = (dateStr?: string): string => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getBanStatusLabel = (user: UserData) => {
    if (!user.isBanned) return null;
    if (!user.banExpires) return 'Permanently Banned';
    
    const expires = new Date(user.banExpires);
    const diffTime = expires.getTime() - new Date().getTime();
    if (diffTime <= 0) return 'Ban Expired';
    
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `Banned (${diffDays} days left)`;
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-400';
      case 'suspended':
        return 'text-red-400';
      case 'pending':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="p-6 bg-xsm-black min-h-screen">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-xsm-yellow mb-6">Manage Users</h1>
        
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-xsm-dark-gray border border-xsm-medium-gray rounded-lg px-4 py-2 pl-10 focus:outline-none focus:border-xsm-yellow text-white"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-xsm-medium-gray" />
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="text-center text-xsm-light-gray py-8">Loading users...</div>
        ) : error ? (
          <div className="text-center text-red-400 py-8">{error}</div>
        ) : (
        <div className="bg-xsm-dark-gray rounded-xl border border-xsm-medium-gray overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-xsm-medium-gray">
              <thead className="bg-xsm-medium-gray/20">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-xsm-light-gray uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-xsm-light-gray uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-xsm-light-gray uppercase tracking-wider">Online</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-xsm-light-gray uppercase tracking-wider">Join Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-xsm-light-gray uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-xsm-medium-gray">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-xsm-medium-gray/20">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-xsm-medium-gray flex items-center justify-center">
                            <User className="h-6 w-6 text-white" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-white flex items-center gap-2">
                            <span>{user.username}</span>
                            {user.displayName && (
                              <span className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-400/30 px-1.5 py-0.5 rounded font-normal" title="Display name shown in chat">
                                "{user.displayName}"
                              </span>
                            )}
                            {(user.isVip || (user.vipUntil && new Date(user.vipUntil) > new Date())) && (
                              <span className="flex items-center gap-0.5 bg-yellow-950 text-yellow-400 border border-yellow-700/60 px-1.5 py-0.5 rounded text-[10px] font-bold" title={`VIP Until: ${user.vipUntil}`}>
                                <Crown className="w-2.5 h-2.5 fill-current" /> VIP
                              </span>
                            )}
                            {user.role && user.role !== 'user' && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold capitalize select-none ${
                                user.role === 'admin' ? 'bg-red-950 text-red-400 border border-red-800' :
                                user.role === 'manager' ? 'bg-blue-950 text-blue-400 border border-blue-800' :
                                'bg-purple-950 text-purple-400 border border-purple-800'
                              }`}>
                                {user.role}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-xsm-light-gray">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.isBanned ? (
                        <div className="flex flex-col text-left">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950 text-red-400 border border-red-800 w-fit">
                            🚫 Banned
                          </span>
                          <span className="text-[11px] text-red-400 mt-1 font-semibold">
                            {getBanStatusLabel(user)}
                          </span>
                          {user.banReason && (
                            <span className="text-[10px] text-xsm-light-gray italic max-w-[200px] truncate block mt-0.5" title={user.banReason}>
                              Reason: {user.banReason}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(user.status)}`}>
                          {user.status}
                        </span>
                      )}
                    </td>
                    {/* Online / Last Seen column */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        {(() => {
                          // Compute online status from lastSeenAt — if seen within 5 min = online
                          const lastSeenStr = user.lastSeenAt;
                          let isOnlineComputed = false;
                          if (lastSeenStr) {
                            const d = lastSeenStr.includes('T') || lastSeenStr.includes('Z')
                              ? new Date(lastSeenStr)
                              : new Date(lastSeenStr.replace(' ', 'T') + 'Z');
                            isOnlineComputed = (Date.now() - d.getTime()) < 5 * 60 * 1000;
                          }
                          return (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnlineComputed ? 'bg-green-400 shadow-[0_0_6px_#4ade80]' : 'bg-gray-500'}`} />
                                <span className={`text-xs font-medium ${isOnlineComputed ? 'text-green-400' : 'text-xsm-light-gray'}`}>
                                  {isOnlineComputed ? 'Online' : 'Offline'}
                                </span>
                              </div>
                              {!isOnlineComputed && (
                                <span className="text-[10px] text-xsm-light-gray">
                                  Last seen: {getRelativeTime(user.lastSeenAt)}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-xsm-light-gray">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : user.joinDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {!isCurrentUserViewer && (
                        <DropdownMenu>
                          <DropdownMenuTrigger className="p-2 hover:bg-xsm-medium-gray rounded-lg transition-colors">
                            <MoreVertical className="h-5 w-5 text-xsm-light-gray" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-xsm-dark-gray border-xsm-medium-gray min-w-[180px]">

                            {/* ── Change Role submenu (Admin only) ── */}
                            {isCurrentUserAdmin && (
                              <>
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger className="text-white hover:text-xsm-yellow cursor-pointer flex items-center px-2 py-1.5 text-sm rounded-sm hover:bg-xsm-medium-gray/40 focus:bg-xsm-medium-gray/40 data-[state=open]:bg-xsm-medium-gray/40">
                                    <Shield className="w-4 h-4 mr-2 text-blue-400" />
                                    <span>Change Role</span>
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent className="bg-xsm-dark-gray border-xsm-medium-gray min-w-[180px]">
                                    <DropdownMenuItem
                                      className="text-red-400 hover:text-red-300 cursor-pointer"
                                      onClick={() => handleChangeRole(user, 'admin')}
                                    >
                                      <Shield className="w-4 h-4 mr-2" />
                                      Make Admin
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-blue-400 hover:text-blue-300 cursor-pointer"
                                      onClick={() => handleChangeRole(user, 'manager')}
                                    >
                                      <Shield className="w-4 h-4 mr-2" />
                                      Make Manager
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-purple-400 hover:text-purple-300 cursor-pointer"
                                      onClick={() => handleChangeRole(user, 'viewer')}
                                    >
                                      <Shield className="w-4 h-4 mr-2" />
                                      Make Viewer
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-xsm-medium-gray" />
                                    <DropdownMenuItem
                                      className="text-white hover:text-xsm-yellow cursor-pointer"
                                      onClick={() => handleChangeRole(user, 'user')}
                                    >
                                      <User className="w-4 h-4 mr-2" />
                                      Remove Special Role
                                    </DropdownMenuItem>
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>

                                {/* Set Display Name — admin only, for staff accounts */}
                                {user.role !== 'user' && (
                                  <DropdownMenuItem
                                    className="text-indigo-400 hover:text-indigo-300 cursor-pointer"
                                    onClick={() => handleSetDisplayName(user)}
                                  >
                                    <Shield className="w-4 h-4 mr-2 text-indigo-400" />
                                    <span>{user.displayName ? 'Edit Display Name' : 'Set Display Name'}</span>
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}

                            <DropdownMenuSeparator className="bg-xsm-medium-gray" />

                            {/* ── VIP Badge Toggle (Admin/Manager) ── */}
                            <DropdownMenuItem
                              className="text-yellow-400 hover:text-yellow-300 cursor-pointer"
                              onClick={() => handleToggleVip(user)}
                            >
                              <Crown className="w-4 h-4 mr-2 text-yellow-400 fill-yellow-400/20" />
                              <span>{user.isVip || (user.vipUntil && new Date(user.vipUntil) > new Date()) ? 'Remove VIP Status' : 'Grant VIP Status'}</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="bg-xsm-medium-gray" />

                            {/* ── Moderation / Ban submenu (Admin only) ── */}
                            {isCurrentUserAdmin && (
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="text-red-400 hover:text-red-300 cursor-pointer flex items-center px-2 py-1.5 text-sm rounded-sm hover:bg-xsm-medium-gray/40 focus:bg-xsm-medium-gray/40 data-[state=open]:bg-xsm-medium-gray/40">
                                  <Ban className="w-4 h-4 mr-2" />
                                  <span>Moderation</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="bg-xsm-dark-gray border-xsm-medium-gray min-w-[180px]">
                                  {user.isBanned && (
                                    <>
                                      <DropdownMenuItem
                                        className="text-green-400 hover:text-green-300 cursor-pointer"
                                        onClick={() => openUnbanModal(user)}
                                      >
                                        <Unlock className="w-4 h-4 mr-2" />
                                        Unban User
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator className="bg-xsm-medium-gray" />
                                    </>
                                  )}
                                  <DropdownMenuItem
                                    className="text-orange-400 hover:text-orange-300 cursor-pointer"
                                    onClick={() => openBanModal(user, '7d')}
                                  >
                                    <Ban className="w-4 h-4 mr-2" />
                                    Ban - 7 Days{user.isBanned ? ' (Change)' : ''}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-red-400 hover:text-red-300 cursor-pointer"
                                    onClick={() => openBanModal(user, '30d')}
                                  >
                                    <Ban className="w-4 h-4 mr-2" />
                                    Ban - 30 Days{user.isBanned ? ' (Change)' : ''}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-red-500 hover:text-red-400 cursor-pointer font-semibold"
                                    onClick={() => openBanModal(user, 'permanent')}
                                  >
                                    <Ban className="w-4 h-4 mr-2" />
                                    Permanent Ban{user.isBanned ? ' (Change)' : ''}
                                  </DropdownMenuItem>
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                            )}

                            {/* ── Delete User (Admin only) ── */}
                            {isCurrentUserAdmin && (
                              <>
                                <DropdownMenuSeparator className="bg-xsm-medium-gray" />
                                <DropdownMenuItem
                                  className="text-red-500 hover:text-red-400 cursor-pointer"
                                  onClick={() => handleDeleteUser(user)}
                                >
                                  <Trash className="w-4 h-4 mr-2" />
                                  Delete User
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>

      {/* Display Name Modal */}
      {displayNameModal.open && displayNameModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-xsm-dark-gray border border-xsm-medium-gray rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white mb-1">Set Display Name</h3>
            <p className="text-sm text-xsm-light-gray mb-4">
              Set a display name for <span className="text-white font-semibold">{displayNameModal.user.username}</span>.
              This name will appear in chats instead of their username.
            </p>
            <input
              type="text"
              value={displayNameModal.value}
              onChange={e => setDisplayNameModal(prev => ({ ...prev, value: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSaveDisplayName()}
              placeholder="e.g. Support Agent, Alex, Agent Mike..."
              maxLength={100}
              className="w-full bg-xsm-black border border-xsm-medium-gray rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-400 mb-1"
              autoFocus
            />
            <p className="text-xs text-xsm-light-gray mb-5">Leave blank to remove the display name and show username instead.</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDisplayNameModal({ open: false, user: null, value: '', saving: false })}
                className="px-4 py-2 rounded-lg text-sm font-medium text-xsm-light-gray border border-xsm-medium-gray hover:bg-xsm-medium-gray/40 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDisplayName}
                disabled={displayNameModal.saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg disabled:opacity-50"
              >
                {displayNameModal.saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Ban User Modal */}
      {banModal.open && banModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-xsm-dark-gray border border-red-500/40 rounded-2xl shadow-2xl w-full max-w-lg p-6 text-white">
            <div className="flex items-center gap-3 mb-4 border-b border-xsm-medium-gray/40 pb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 flex-shrink-0">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Restrict / Ban User Account</h3>
                <p className="text-xs text-red-300">Target User: <span className="font-semibold text-white">{banModal.user.username}</span> ({banModal.user.email})</p>
              </div>
            </div>

            {/* Ban Duration Selection */}
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-xsm-light-gray mb-2">Select Ban Duration</label>
              <div className="grid grid-cols-3 gap-2">
                {(['7d', '30d', 'permanent'] as const).map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setBanModal(prev => ({ ...prev, duration: d }))}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                      banModal.duration === d
                        ? 'bg-red-600/30 border-red-500 text-red-300 shadow-md shadow-red-900/30'
                        : 'bg-xsm-black border-xsm-medium-gray/60 text-xsm-light-gray hover:border-red-400/50 hover:text-white'
                    }`}
                  >
                    {d === '7d' ? '7 Days' : d === '30d' ? '30 Days' : 'Permanent'}
                  </button>
                ))}
              </div>
            </div>

            {/* Ban Reason / Administrative Note */}
            <div className="mb-5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-xsm-light-gray mb-2">Ban Reason & Administrative Note <span className="text-red-400">*</span></label>
              <textarea
                value={banModal.reason}
                onChange={e => setBanModal(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Enter detailed reason or note for restricting this account..."
                rows={3}
                className="w-full bg-xsm-black border border-xsm-medium-gray/80 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
                autoFocus
              />
              <p className="text-[11px] text-xsm-light-gray mt-1.5 leading-relaxed">
                ℹ️ <strong className="text-white">Note:</strong> Restricted users can still post listings and contact Support/Admin, but cannot message buyers/sellers directly.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-xsm-medium-gray/40">
              <button
                type="button"
                onClick={() => setBanModal({ open: false, user: null, duration: '7d', reason: '', submitting: false })}
                className="px-4 py-2 rounded-lg text-sm font-medium text-xsm-light-gray border border-xsm-medium-gray hover:bg-xsm-medium-gray/40 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitBanUser}
                disabled={banModal.submitting}
                className="px-5 py-2 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-500 text-white transition-colors shadow-lg disabled:opacity-50 flex items-center gap-1.5"
              >
                <Ban className="w-4 h-4" />
                {banModal.submitting ? 'Banning...' : 'Confirm Ban'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Unban User Modal */}
      {unbanModal.open && unbanModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-xsm-dark-gray border border-green-500/40 rounded-2xl shadow-2xl w-full max-w-md p-6 text-white">
            <div className="flex items-center gap-3 mb-4 border-b border-xsm-medium-gray/40 pb-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-400 flex-shrink-0">
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Unban User Account</h3>
                <p className="text-xs text-green-300">Target User: <span className="font-semibold text-white">{unbanModal.user.username}</span></p>
              </div>
            </div>

            <p className="text-sm text-xsm-light-gray mb-6 leading-relaxed">
              Are you sure you want to lift the restrictions on <span className="text-white font-semibold">{unbanModal.user.username}</span>?
              This will restore full messaging and direct communication capabilities for their account.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-xsm-medium-gray/40">
              <button
                type="button"
                onClick={() => setUnbanModal({ open: false, user: null, submitting: false })}
                className="px-4 py-2 rounded-lg text-sm font-medium text-xsm-light-gray border border-xsm-medium-gray hover:bg-xsm-medium-gray/40 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitUnbanUser}
                disabled={unbanModal.submitting}
                className="px-5 py-2 rounded-lg text-sm font-bold bg-green-600 hover:bg-green-500 text-white transition-colors shadow-lg disabled:opacity-50 flex items-center gap-1.5"
              >
                <Unlock className="w-4 h-4" />
                {unbanModal.submitting ? 'Unbanning...' : 'Confirm Unban'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageUsers;
