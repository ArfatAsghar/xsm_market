import React, { useState } from 'react';
import { Search, MoreVertical, User, Shield, Trash } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from '@/components/ui/use-toast';
import { getAllUsers, deleteUser, updateUserRole } from '@/services/admin';

interface UserData {
  id: string;
  username: string;
  email: string;
  status: 'active' | 'suspended' | 'pending';
  role: 'user' | 'admin';
  joinDate: string;
  lastActive: string;
}

const ManageUsers: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    getAllUsers()
      .then((data) => {
        setUsers(data);
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

  const handleChangeRole = async (user: UserData) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    
    const confirmed = window.confirm(
      `🔄 CHANGE USER ROLE ⚠️\n\n` +
      `Change user role?\n\n` +
      `User: "${user.username}"\n` +
      `Current Role: ${user.role}\n` +
      `New Role: ${newRole}\n\n` +
      `${newRole === 'admin' ? 'This will grant admin privileges to the user.' : 'This will remove admin privileges from the user.'}`
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
          u.id === user.id ? { ...u, role: newRole as 'user' | 'admin' } : u
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
                          <div className="text-sm font-medium text-white">{user.username}</div>
                          <div className="text-sm text-xsm-light-gray">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(user.status)}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-xsm-light-gray">
                      {user.joinDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="p-2 hover:bg-xsm-medium-gray rounded-lg transition-colors">
                          <MoreVertical className="h-5 w-5 text-xsm-light-gray" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-xsm-dark-gray border-xsm-medium-gray">
                          <DropdownMenuItem 
                            className="text-white hover:text-xsm-yellow cursor-pointer"
                            onClick={() => handleChangeRole(user)}
                          >
                            <Shield className="w-4 h-4 mr-2" />
                            Change Role to {user.role === 'admin' ? 'User' : 'Admin'}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-500 hover:text-red-400 cursor-pointer"
                            onClick={() => handleDeleteUser(user)}
                          >
                            <Trash className="w-4 h-4 mr-2" />
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default ManageUsers;
