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
    <div className={`card p-0 overflow-hidden group hover:shadow-lg transition-all duration-200 flex flex-col ${compact ? '' : ''}`}>
      {/* Photo Section */}
      <Link to={`/profile/${profile.id}`} className="block relative shrink-0">
        <div className={`relative ${compact ? 'h-48' : 'h-64'}`}>
          {profile.profilePicture ? (
            <img
              src={getPhotoUrl(profile.profilePicture)}
              alt={profile.firstName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center transition-colors">
              <span className="text-4xl text-gray-400 dark:text-gray-600 transition-colors">👤</span>
            </div>
          )}

          {/* Online indicator */}
          <div className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
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
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </Link>

      {/* Info Section */}
      <div className="p-4 flex flex-col grow">
        
        {/* Header: Name + Fame */}
        <div className="flex justify-between items-start mb-2">
          <div className="min-w-0">
            <Link to={`/profile/${profile.id}`} className="hover:text-primary-500 transition-colors">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white truncate transition-colors">
                {profile.firstName}, {profile.age}
              </h3>
            </Link>
            {profile.city && (
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 transition-colors">
                <MapPin className="w-3 h-3" />
                <span className="truncate">{profile.city}</span>
                {profile.distance !== null && <span className="shrink-0"> • {profile.distance} km</span>}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-1 text-amber-500 shrink-0">
            <Star className="w-4 h-4" fill="currentColor" />
            <span className="text-sm font-medium">{profile.fameRating}</span>
          </div>
        </div>

        {/* Tags */}
        <div className="mb-3 min-h-6">
          {profile.tags && profile.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {profile.tags.slice(0, 3).map(tag => (
                <span key={tag.id} className="text-xs text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-full transition-colors">
                  #{tag.name}
                </span>
              ))}
              {profile.tags.length > 3 && (
                <span className="text-xs text-gray-500 dark:text-gray-500">+{profile.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>

        {/* ZONE RÉSERVÉE */}
        <div className="h-6 mb-3 flex items-center">
          {profile.commonTags > 0 && (
            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 animate-fade-in transition-colors">
              <Hash className="w-3 h-3" />
              {profile.commonTags} common interest{profile.commonTags > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Like button */}
        <div className="mt-auto pt-2">
          {profile.iLiked ? (
            <button
              onClick={() => onUnlike && onUnlike(profile.id)}
              className="w-full py-2 cursor-pointer bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
            >
              <Heart className="w-5 h-5 text-primary-500" fill="currentColor" />
              {isConnected ? 'Connected' : 'Liked'}
            </button>
          ) : (
            <button
              onClick={() => onLike && onLike(profile.id)}
              className="w-full py-2 cursor-pointer bg-primary-500 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-primary-600 transition-colors shadow-sm"
            >
              <Heart className="w-5 h-5" />
              Like
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileCard;