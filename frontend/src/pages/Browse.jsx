import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { profileAPI } from '../services/api';
import ProfileCard from '../components/profiles/ProfileCard';
import Filters from '../components/profiles/Filters';
import { Loader, Search, Users, Heart, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert } from '../components/ui/Input';

const Browse = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [matchAlert, setMatchAlert] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, pages: 0 });
  
  const [filters, setFilters] = useState({
    minAge: '',
    maxAge: '',
    minFame: '',
    maxFame: '',
    maxDistance: '',
    tags: [],
    sortBy: 'match',
    sortOrder: 'desc'
  });

  const loadProfiles = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    
    try {
      const params = {
        page,
        limit: pagination.limit,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        ...(filters.minAge && { minAge: filters.minAge }),
        ...(filters.maxAge && { maxAge: filters.maxAge }),
        ...(filters.minFame && { minFame: filters.minFame }),
        ...(filters.maxFame && { maxFame: filters.maxFame }),
        ...(filters.maxDistance && { maxDistance: filters.maxDistance }),
        ...(filters.tags.length > 0 && { tags: filters.tags.join(',') })
      };

      const response = await profileAPI.getBrowse(params);
      setProfiles(response.data.profiles);
      setPagination(prev => ({ ...prev, ...response.data.pagination }));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit]);

  useEffect(() => {
    loadProfiles(1);
  }, [filters]);

  const handleLike = async (profileId) => {
    try {
      const response = await profileAPI.like(profileId);
      
      // Update local state
      setProfiles(prev => prev.map(p => 
        p.id === profileId ? { ...p, iLiked: true } : p
      ));

      // Show match alert if it's a match
      if (response.data.isMatch) {
        const profile = profiles.find(p => p.id === profileId);
        setMatchAlert({
          name: profile?.firstName || 'Someone',
          id: profileId
        });
        setTimeout(() => setMatchAlert(null), 5000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to like profile');
    }
  };

  const handleUnlike = async (profileId) => {
    try {
      await profileAPI.unlike(profileId);
      
      // Update local state
      setProfiles(prev => prev.map(p => 
        p.id === profileId ? { ...p, iLiked: false } : p
      ));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to unlike profile');
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      setPagination(prev => ({ ...prev, page: newPage }));
      loadProfiles(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Discover</h1>
          <p className="text-gray-500">Find your perfect match</p>
        </div>

        {/* Quick links */}
        <div className="flex gap-2">
          <Link
            to="/search"
            className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
          >
            <Search className="w-4 h-4" />
            Search
          </Link>
          <Link
            to="/likes"
            className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
          >
            <Heart className="w-4 h-4" />
            Likes
          </Link>
          <Link
            to="/visitors"
            className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
          >
            <Eye className="w-4 h-4" />
            Visitors
          </Link>
        </div>
      </div>

      {/* Match alert */}
      {matchAlert && (
        <div className="mb-6 p-4 bg-linear-to-r from-primary-500 to-pink-500 text-white rounded-lg animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🎉</div>
              <div>
                <p className="font-semibold text-lg">It's a Match!</p>
                <p>You and {matchAlert.name} liked each other</p>
              </div>
            </div>
            <Link
              to={`/chat`}
              className="px-4 py-2 bg-white text-primary-500 rounded-lg font-medium hover:bg-gray-100"
            >
              Send Message
            </Link>
          </div>
        </div>
      )}

      {/* Filters */}
      <Filters filters={filters} onChange={setFilters} />

      {/* Error */}
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader className="w-8 h-8 text-primary-500 animate-spin" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-20">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No profiles found</h3>
          <p className="text-gray-500 mb-4">Try adjusting your filters</p>
          <button
            onClick={() => setFilters({
              minAge: '',
              maxAge: '',
              minFame: '',
              maxFame: '',
              maxDistance: '',
              tags: [],
              sortBy: 'match',
              sortOrder: 'desc'
            })}
            className="btn-primary"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          {/* Profile grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {profiles.map(profile => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                onLike={handleLike}
                onUnlike={handleUnlike}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                  let pageNum;
                  if (pagination.pages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.page >= pagination.pages - 2) {
                    pageNum = pagination.pages - 4 + i;
                  } else {
                    pageNum = pagination.page - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-10 h-10 rounded-lg ${
                        pagination.page === pageNum
                          ? 'bg-primary-500 text-white'
                          : 'border hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <span className="text-sm text-gray-500 ml-4">
                {pagination.total} profiles
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Browse;
