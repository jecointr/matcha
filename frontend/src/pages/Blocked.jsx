import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { profileAPI } from '../services/api';
import { Loader, Ban, ArrowLeft, MapPin, Star, ShieldOff } from 'lucide-react';
import { Alert } from '../components/ui/Input';

import { API_URL } from '../config';

const Blocked = () => {
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unblockingId, setUnblockingId] = useState(null);

  useEffect(() => {
    loadBlocked();
  }, []);

  const loadBlocked = async () => {
    setLoading(true);
    try {
      const response = await profileAPI.getBlocked();
      setBlocked(response.data.blocked);
    } catch (err) {
      setError('Failed to load blocked users');
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (userId) => {
    setUnblockingId(userId);
    try {
      await profileAPI.unblock(userId);
      setBlocked(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to unblock user');
    } finally {
      setUnblockingId(null);
    }
  };

  const getPhotoUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_URL.replace('/api', '')}${url}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/browse" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">Blocked Users</h1>
          <p className="text-gray-500 dark:text-gray-400 transition-colors">Manage the people you've blocked</p>
        </div>
      </div>

      {/* Error */}
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Content */}
      {blocked.length === 0 ? (
        <div className="text-center py-20">
          <Ban className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4 transition-colors" />
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">No blocked users</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4 transition-colors">
            Users you block won't be able to see your profile or message you.
          </p>
          <Link to="/browse" className="btn-primary">
            Browse Profiles
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {blocked.map(user => (
            <div
              key={user.id}
              className="card p-4 flex items-center gap-4 transition-all duration-200"
            >
              {/* Photo (lien vers le profil) */}
              <Link to={`/profile/${user.id}`} className="relative shrink-0">
                {user.profilePicture ? (
                  <img
                    src={getPhotoUrl(user.profilePicture)}
                    alt={user.firstName}
                    className="w-16 h-16 rounded-full object-cover grayscale"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center transition-colors">
                    <span className="text-2xl">👤</span>
                  </div>
                )}
              </Link>

              {/* Info */}
              <Link to={`/profile/${user.id}`} className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 transition-colors">
                  {user.firstName}{user.age ? `, ${user.age}` : ''}
                </h3>
                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 transition-colors">
                  {user.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {user.city}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-amber-500">
                    <Star className="w-3 h-3" fill="currentColor" />
                    {user.fameRating}
                  </span>
                </div>
              </Link>

              {/* Unblock */}
              <button
                onClick={() => handleUnblock(user.id)}
                disabled={unblockingId === user.id}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              >
                {unblockingId === user.id ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldOff className="w-4 h-4" />
                )}
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Blocked;
