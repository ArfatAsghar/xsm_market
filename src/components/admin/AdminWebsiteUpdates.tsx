import React, { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, Send } from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';

const API_URL = import.meta.env.VITE_API_URL || 'https://xsmmarket.com/api';

interface UpdateItem {
  id: number;
  title: string;
  description: string;
  created_at: string;
}

const AdminWebsiteUpdates: React.FC = () => {
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [publishing, setPublishing] = useState(false);
  const { showSuccess, showError } = useNotifications();

  useEffect(() => {
    fetchUpdates();
  }, []);

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/updates`);
      const data = await res.json();
      if (data.success && Array.isArray(data.updates)) {
        setUpdates(data.updates);
      }
    } catch (err: any) {
      console.error('Failed to fetch updates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      showError('Required', 'Title and description are required.');
      return;
    }

    try {
      setPublishing(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/updates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: title.trim(), description: description.trim() })
      });
      const data = await res.json();
      if (res.ok && (data.success || data.message?.includes('success') || data.id)) {
        showSuccess('Update Published! 📢', 'New announcement is now live on the homepage ticker and chat channel.');
        setTitle('');
        setDescription('');
        fetchUpdates();
      } else {
        showError('Publish Failed', data.message || 'Failed to publish update');
      }
    } catch (err: any) {
      showError('Error', err.message || 'Server error while publishing update');
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this website update announcement?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/updates/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        showSuccess('Deleted', 'Announcement removed successfully.');
        setUpdates(prev => prev.filter(u => u.id !== id));
      } else {
        showError('Delete Failed', data.message || 'Failed to delete update');
      }
    } catch (err: any) {
      showError('Error', err.message || 'Failed to delete update');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-gradient-to-r from-amber-950/40 via-xsm-dark-gray to-xsm-dark-gray p-6 rounded-xl border border-xsm-yellow/30 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-xsm-yellow text-black flex items-center justify-center font-bold shadow-md">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Website Updates & Announcements</h2>
            <p className="text-sm text-xsm-light-gray">
              Publish announcements that appear on the homepage scrolling ticker and the pinned Chat channel.
            </p>
          </div>
        </div>
        <span className="text-sm font-semibold bg-xsm-yellow/20 text-xsm-yellow px-3 py-1.5 rounded-full border border-xsm-yellow/40">
          {updates.length} Active Announcements
        </span>
      </div>

      {/* Publish Form */}
      <div className="bg-xsm-dark-gray p-6 rounded-xl border border-xsm-medium-gray shadow-md">
        <h3 className="text-lg font-bold text-xsm-yellow mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5" /> Publish New Announcement
        </h3>
        <form onSubmit={handlePublish} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-xsm-light-gray mb-1">Announcement Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. 🚀 Platform Security Upgrade Complete"
              className="w-full px-4 py-2.5 bg-xsm-black text-white rounded-lg border border-xsm-medium-gray focus:outline-none focus:border-xsm-yellow"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-xsm-light-gray mb-1">Announcement Details</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the update or announcement details here..."
              className="w-full px-4 py-2.5 bg-xsm-black text-white rounded-lg border border-xsm-medium-gray focus:outline-none focus:border-xsm-yellow"
            />
          </div>
          <button
            type="submit"
            disabled={publishing}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-xsm-yellow text-xsm-black font-bold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 shadow-md"
          >
            <Send className="w-4 h-4" />
            {publishing ? 'Publishing...' : 'Publish Announcement'}
          </button>
        </form>
      </div>

      {/* Existing Announcements Feed */}
      <div className="bg-xsm-dark-gray p-6 rounded-xl border border-xsm-medium-gray shadow-md">
        <h3 className="text-lg font-bold text-white mb-4">Published Announcements</h3>
        {loading ? (
          <p className="text-gray-400 text-center py-6">Loading announcements...</p>
        ) : updates.length === 0 ? (
          <p className="text-gray-400 text-center py-6">No announcements published yet.</p>
        ) : (
          <div className="space-y-3">
            {updates.map(item => (
              <div
                key={item.id}
                className="p-4 bg-xsm-black/60 rounded-xl border border-xsm-medium-gray/40 flex items-start justify-between gap-4 hover:border-xsm-yellow/40 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xsm-yellow">📌</span>
                    <h4 className="text-white font-bold text-base">{item.title}</h4>
                    <span className="text-xs text-gray-500 ml-auto">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{item.description}</p>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Delete Announcement"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminWebsiteUpdates;
