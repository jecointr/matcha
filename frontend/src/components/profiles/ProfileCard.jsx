import { Link } from 'react-router-dom';
import { MapPin, Heart, Star, Hash, Circle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const ProfileCard = ({ profile, onLike, onUnlike, compact = false }) => {
  const getPhotoUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_URL.replace('/api', '')}${url}`;
  };

  const isConnected = profile.iLiked && profile.likedMe;

  return (
    <div className={`card p-0 overflow-hidden group hover:shadow-lg transition-shadow ${compact ? '' : ''}`}>
      {/* Photo */}
      <Link to={`/profile/${profile.id}`} className="block relative">
        <div className={`relative ${compact ? 'h-48' : 'h-64'}`}>
          {profile.profilePicture ? (
            <img
              src={getPhotoUrl(profile.profilePicture)}
              alt={profile.firstName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <span className="text-4xl text-gray-400">👤</span>
            </div>
          )}

          {/* Online indicator */}
          <div className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
            profile.isOnline 
              ? 'bg-green-500 text-white' 
              : 'bg-gray-900/60 text-white'
          }`}>
            <Circle className={`w-2 h-2 ${profile.isOnline ? 'fill-current' : ''}`} />
            {profile.isOnline ? 'Online' : 'Offline'}
          </div>

          {/* Match indicator */}
          {isConnected && (
            <div className="absolute top-3 left-3 bg-primary-500 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
              <Heart className="w-3 h-3" fill="currentColor" />
              Match
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </Link>

      {/* Info */}
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <Link to={`/profile/${profile.id}`} className="hover:text-primary-500">
              <h3 className="font-semibold text-lg text-gray-900">
                {profile.firstName}, {profile.age}
              </h3>
            </Link>
            {profile.city && (
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {profile.city}
                {profile.distance !== null && ` • ${profile.distance} km`}
              </p>
            )}
          </div>
          
          {/* Fame rating */}
          <div className="flex items-center gap-1 text-amber-500">
            <Star className="w-4 h-4" fill="currentColor" />
            <span className="text-sm font-medium">{profile.fameRating}</span>
          </div>
        </div>

        {/* Tags */}
        {profile.tags && profile.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {profile.tags.slice(0, 3).map(tag => (
              <span key={tag.id} className="text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                #{tag.name}
              </span>
            ))}
            {profile.tags.length > 3 && (
              <span className="text-xs text-gray-500">+{profile.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Common tags indicator */}
        {profile.commonTags > 0 && (
          <p className="text-xs text-green-600 mb-3 flex items-center gap-1">
            <Hash className="w-3 h-3" />
            {profile.commonTags} common interest{profile.commonTags > 1 ? 's' : ''}
          </p>
        )}

        {/* Like button */}
        <div className="flex gap-2">
          {profile.iLiked ? (
            <button
              onClick={() => onUnlike && onUnlike(profile.id)}
              className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
            >
              <Heart className="w-5 h-5 text-primary-500" fill="currentColor" />
              {isConnected ? 'Connected' : 'Liked'}
            </button>
          ) : (
            <button
              onClick={() => onLike && onLike(profile.id)}
              className="flex-1 py-2 bg-primary-500 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-primary-600 transition-colors"
            >
              <Heart className="w-5 h-5" />
              Like
            </button>
          )}
        </div>

        {/* They liked you indicator */}
        {profile.likedMe && !profile.iLiked && (
          <p className="text-xs text-center text-primary-500 mt-2">
            ❤️ Liked your profile
          </p>
        )}
      </div>
    </div>
  );
};

export default ProfileCard;
