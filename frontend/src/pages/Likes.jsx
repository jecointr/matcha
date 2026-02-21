import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { matchAPI, profileAPI } from '../services/api';
import ProfileCard from '../components/profiles/ProfileCard';
import { Loader, Heart, Users, ArrowLeft } from 'lucide-react';
import { Alert } from '../components/ui/Input';

const Likes = () => {
  const [activeTab, setActiveTab] = useState('received');
  const [likes, setLikes] = useState([]);
  const [matches, setMatches] = useState([]);
  const [myLikes, setMyLikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [likesRes, matchesRes, myLikesRes] = await Promise.all([
        matchAPI.getLikes(),
        matchAPI.getMatches(),
        matchAPI.getMyLikes()
      ]);
      setLikes(likesRes.data.likes);
      setMatches(matchesRes.data.matches);
      setMyLikes(myLikesRes.data.likes);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (profileId) => {
    try {
      const response = await profileAPI.like(profileId);
      
      setLikes(prev => prev.map(p => 
        p.id === profileId ? { ...p, iLikedBack: true } : p
      ));

      if (response.data.isMatch) {
        const matchesRes = await matchAPI.getMatches();
        setMatches(matchesRes.data.matches);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to like');
    }
  };

  const handleUnlike = async (profileId) => {
    try {
      await profileAPI.unlike(profileId);
      
      setMyLikes(prev => prev.filter(p => p.id !== profileId));
      
      const matchesRes = await matchAPI.getMatches();
      setMatches(matchesRes.data.matches);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to unlike');
    }
  };

  const tabs = [
    { id: 'received', label: 'Likes Received', count: likes.filter(l => !l.iLikedBack).length },
    { id: 'matches', label: 'Matches', count: matches.length },
    { id: 'sent', label: 'Likes Sent', count: myLikes.filter(l => !l.likedMeBack).length }
  ];

  const getCurrentData = () => {
    switch (activeTab) {
      case 'received':
        return likes.map(l => ({
          ...l,
          iLiked: l.iLikedBack,
          likedMe: true
        }));
      case 'matches':
        return matches.map(m => ({
          ...m,
          iLiked: true,
          likedMe: true
        }));
      case 'sent':
        return myLikes.map(l => ({
          ...l,
          iLiked: true,
          likedMe: l.likedMeBack
        }));
      default:
        return [];
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  const data = getCurrentData();

  return (
    <div className="transition-colors duration-200">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link 
          to="/browse" 
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">Likes & Matches</h1>
          <p className="text-gray-500 dark:text-gray-400 transition-colors">See who's interested in you</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b dark:border-gray-800 mb-6 transition-colors">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Content */}
      {data.length === 0 ? (
        <div className="text-center py-20 animate-fade-in">
          <Heart className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4 transition-colors" />
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">
            {activeTab === 'received' && 'No likes yet'}
            {activeTab === 'matches' && 'No matches yet'}
            {activeTab === 'sent' && 'You haven\'t liked anyone yet'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 transition-colors">
            {activeTab === 'received' && 'When someone likes your profile, they\'ll appear here'}
            {activeTab === 'matches' && 'When you match with someone, they\'ll appear here'}
            {activeTab === 'sent' && 'Start browsing to find people you like'}
          </p>
          <Link to="/browse" className="btn-primary inline-block">
            Browse Profiles
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in">
          {data.map(profile => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              onLike={handleLike}
              onUnlike={handleUnlike}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Likes;