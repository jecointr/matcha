import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { matchAPI, profileAPI } from '../services/api';
import { Loader, Eye, ArrowLeft, MapPin, Star, Circle } from 'lucide-react';
import { Alert } from '../components/ui/Input';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const Visitors = () => {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadVisitors();
  }, []);

  const loadVisitors = async () => {
    setLoading(true);
    try {
      const response = await matchAPI.getVisits();
      setVisitors(response.data.visits);
    } catch (err) {
      setError('Failed to load visitors');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">Profile Visitors</h1>
          <p className="text-gray-500 dark:text-gray-400 transition-colors">See who viewed your profile</p>
        </div>
      </div>

      {/* Error */}
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Content */}
      {visitors.length === 0 ? (
        <div className="text-center py-20">
          <Eye className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4 transition-colors" />
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">No visitors yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4 transition-colors">
            When someone views your profile, they'll appear here
          </p>
          <Link to="/browse" className="btn-primary">
            Browse Profiles
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {visitors.map(visitor => (
            <Link
              key={visitor.id}
              to={`/profile/${visitor.id}`}
              className="card p-4 flex items-center gap-4 hover:shadow-md dark:hover:bg-gray-800/80 transition-all duration-200"
            >
              {/* Photo */}
              <div className="relative">
                {visitor.profilePicture ? (
                  <img
                    src={getPhotoUrl(visitor.profilePicture)}
                    alt={visitor.firstName}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center transition-colors">
                    <span className="text-2xl">👤</span>
                  </div>
                )}
                {visitor.isOnline && (
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full transition-colors" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 transition-colors">
                  {visitor.firstName}, {visitor.age}
                </h3>
                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 transition-colors">
                  {visitor.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {visitor.city}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-amber-500">
                    <Star className="w-3 h-3" fill="currentColor" />
                    {visitor.fameRating}
                  </span>
                </div>
              </div>

              {/* Visit time */}
              <div className="text-right">
                <div className="text-sm text-gray-500 dark:text-gray-400 transition-colors">
                  {formatDate(visitor.visitedAt)}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 mt-1 transition-colors">
                  <Eye className="w-3 h-3" />
                  Viewed your profile
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Visitors;