import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { profileAPI } from '../services/api';
import { Alert, Button } from '../components/ui/Input';
import { 
  MapPin, Heart, Star, Calendar, Circle, MessageCircle,
  Flag, Ban, ChevronLeft, ChevronRight, Hash, Loader, X
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [matchAlert, setMatchAlert] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await profileAPI.getProfile(userId);
      setProfile(response.data.profile);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Profile not found');
      } else {
        setError(err.response?.data?.error || 'Failed to load profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    setActionLoading(true);
    try {
      const response = await profileAPI.like(userId);
      setProfile(prev => ({ ...prev, iLiked: true }));
      
      if (response.data.isMatch) {
        setMatchAlert(true);
        setProfile(prev => ({ ...prev, isConnected: true }));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to like profile');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlike = async () => {
    setActionLoading(true);
    try {
      await profileAPI.unlike(userId);
      setProfile(prev => ({ ...prev, iLiked: false, isConnected: false }));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to unlike profile');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!confirm('Are you sure you want to block this user? They won\'t be able to see your profile or contact you.')) {
      return;
    }
    
    try {
      await profileAPI.block(userId);
      navigate('/browse');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to block user');
    }
  };

  const handleReport = async () => {
    try {
      await profileAPI.report(userId, reportReason);
      setShowReportModal(false);
      setReportReason('');
      alert('Report submitted. Thank you for helping keep Matcha safe.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit report');
    }
  };

  const getPhotoUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_URL.replace('/api', '')}${url}`;
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Unknown';
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-4">{error}</h2>
        <button onClick={() => navigate(-1)} className="btn-primary">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Match alert */}
      {matchAlert && (
        <div className="mb-6 p-4 bg-linear-to-r from-primary-500 to-pink-500 text-white rounded-lg animate-fade-in shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🎉</div>
              <div>
                <p className="font-semibold text-lg">It's a Match!</p>
                <p>You and {profile.firstName} can now chat!</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link to="/chat" className="px-4 py-2 bg-white text-primary-500 rounded-lg font-medium hover:bg-gray-100 transition-colors">
                Send Message
              </Link>
              <button onClick={() => setMatchAlert(false)} className="p-2 hover:bg-white/20 rounded transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <div className="card p-0 overflow-hidden transition-colors duration-200">
        {/* Photo gallery */}
        <div className="relative bg-gray-100 dark:bg-gray-900 transition-colors">
          <div className="aspect-4/3 sm:aspect-video">
            {profile.photos && profile.photos.length > 0 ? (
              <img
                src={getPhotoUrl(profile.photos[currentPhotoIndex]?.url)}
                alt={profile.firstName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-600 transition-colors">
                <span className="text-6xl">👤</span>
              </div>
            )}
          </div>

          {/* Photo navigation */}
          {profile.photos && profile.photos.length > 1 && (
            <>
              <button
                onClick={() => setCurrentPhotoIndex(prev => prev === 0 ? profile.photos.length - 1 : prev - 1)}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={() => setCurrentPhotoIndex(prev => prev === profile.photos.length - 1 ? 0 : prev + 1)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              {/* Photo dots */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {profile.photos.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPhotoIndex(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentPhotoIndex ? 'bg-white' : 'bg-white/50 hover:bg-white/80'
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Online status */}
          <div className={`absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md ${
            profile.isOnline ? 'bg-green-500/90 text-white' : 'bg-black/60 text-white'
          }`}>
            <Circle className={`w-2 h-2 ${profile.isOnline ? 'fill-current' : ''}`} />
            {profile.isOnline ? 'Online' : formatLastSeen(profile.lastSeen)}
          </div>

          {/* Match badge */}
          {profile.isConnected && (
            <div className="absolute top-4 left-4 bg-primary-500/90 backdrop-blur-md text-white px-3 py-1.5 rounded-full flex items-center gap-2">
              <Heart className="w-4 h-4" fill="currentColor" />
              Connected
            </div>
          )}
        </div>

        {/* Profile info */}
        <div className="p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white transition-colors">
                {profile.firstName}, {profile.age}
              </h1>
              <p className="text-gray-500 dark:text-gray-400">@{profile.username}</p>
              
              <div className="flex flex-wrap gap-4 mt-2 text-gray-600 dark:text-gray-300">
                {profile.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {profile.city}{profile.country ? `, ${profile.country}` : ''}
                    {profile.distance !== null && ` (${profile.distance} km)`}
                  </span>
                )}
                <span className="flex items-center gap-1 text-amber-500">
                  <Star className="w-4 h-4" fill="currentColor" />
                  Fame: {profile.fameRating}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 w-full sm:w-auto">
              {profile.iLiked ? (
                <button
                  onClick={handleUnlike}
                  disabled={actionLoading}
                  className="flex-1 sm:flex-none px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <Heart className="w-5 h-5 text-primary-500" fill="currentColor" />
                  {profile.isConnected ? 'Connected' : 'Liked'}
                </button>
              ) : (
                <Button
                  onClick={handleLike}
                  loading={actionLoading}
                  className="flex-1 sm:flex-none px-6 py-3"
                >
                  <Heart className="w-5 h-5 mr-2" />
                  Like
                </Button>
              )}
              
              {profile.isConnected && (
                <Link
                  to="/chat"
                  className="px-6 py-3 bg-green-500 text-white rounded-lg flex items-center gap-2 hover:bg-green-600 transition-colors"
                >
                  <MessageCircle className="w-5 h-5" />
                  Chat
                </Link>
              )}
            </div>
          </div>

          {/* They liked you indicator */}
          {profile.likedMe && !profile.iLiked && (
            <div className="mb-6 p-3 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded-lg flex items-center gap-2 transition-colors">
              <Heart className="w-5 h-5" fill="currentColor" />
              {profile.firstName} liked your profile! Like back to start chatting.
            </div>
          )}

          {/* Biography */}
          {profile.biography && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 transition-colors">About</h2>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap transition-colors">{profile.biography}</p>
            </div>
          )}

          {/* Details */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Gender</h3>
              <p className="text-gray-900 dark:text-gray-100 capitalize transition-colors">{profile.gender}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Looking for</h3>
              <p className="text-gray-900 dark:text-gray-100 capitalize transition-colors">
                {profile.sexualPreference === 'both' ? 'Men & Women' : 
                 profile.sexualPreference === 'male' ? 'Men' : 'Women'}
              </p>
            </div>
          </div>

          {/* Tags */}
          {profile.tags && profile.tags.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 transition-colors">Interests</h2>
              <div className="flex flex-wrap gap-2">
                {profile.tags.map(tag => (
                  <span
                    key={tag.id}
                    className="badge-primary"
                  >
                    #{tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Report/Block actions */}
          <div className="pt-6 border-t dark:border-gray-800 flex gap-4 transition-colors">
            <button
              onClick={() => setShowReportModal(true)}
              className="text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 flex items-center gap-1 text-sm transition-colors"
            >
              <Flag className="w-4 h-4" />
              Report as fake
            </button>
            <button
              onClick={handleBlock}
              className="text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 flex items-center gap-1 text-sm transition-colors"
            >
              <Ban className="w-4 h-4" />
              Block user
            </button>
          </div>
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl transition-colors duration-200">
            <h2 className="text-xl font-bold mb-4 dark:text-white">Report User</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Why are you reporting {profile.firstName}?
            </p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Describe the issue..."
              className="input mb-4"
              rows={3}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowReportModal(false)}
                className="flex-1 py-2 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReport}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
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

export default UserProfile;