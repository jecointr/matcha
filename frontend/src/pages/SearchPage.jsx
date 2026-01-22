import { useState, useEffect } from 'react';
import { profileAPI } from '../services/api';
import ProfileCard from '../components/profiles/ProfileCard';
import Filters from '../components/profiles/Filters';
import { Loader, Search, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert } from '../components/ui/Input';

const SearchPage = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, pages: 0 });
  
  const [filters, setFilters] = useState({
    minAge: '',
    maxAge: '',
    minFame: '',
    maxFame: '',
    maxDistance: '',
    location: '',
    gender: '',
    tags: [],
    sortBy: 'match',
    sortOrder: 'desc'
  });

  const handleSearch = async (page = 1) => {
    setLoading(true);
    setError('');
    setSearched(true);
    
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
        ...(filters.location && { location: filters.location }),
        ...(filters.gender && { gender: filters.gender }),
        ...(filters.tags.length > 0 && { tags: filters.tags.join(',') })
      };

      const response = await profileAPI.search(params);
      setProfiles(response.data.profiles);
      setPagination(prev => ({ ...prev, ...response.data.pagination }));
    } catch (err) {
      setError(err.response?.data?.error || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (profileId) => {
    try {
      await profileAPI.like(profileId);
      setProfiles(prev => prev.map(p => 
        p.id === profileId ? { ...p, iLiked: true } : p
      ));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to like profile');
    }
  };

  const handleUnlike = async (profileId) => {
    try {
      await profileAPI.unlike(profileId);
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
      handleSearch(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Advanced Search</h1>
        <p className="text-gray-500">Find exactly who you're looking for</p>
      </div>

      {/* Filters */}
      <Filters 
        filters={filters} 
        onChange={setFilters} 
        onSearch={() => handleSearch(1)}
        isSearch={true} 
      />

      {/* Initial state */}
      {!searched && !loading && (
        <div className="text-center py-20">
          <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Start your search</h3>
          <p className="text-gray-500 mb-6">Use the filters above to find your match</p>
          <button onClick={() => handleSearch(1)} className="btn-primary">
            <Search className="w-4 h-4 mr-2" />
            Search Now
          </button>
        </div>
      )}

      {/* Error */}
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader className="w-8 h-8 text-primary-500 animate-spin" />
        </div>
      )}

      {/* Results */}
      {searched && !loading && (
        <>
          {profiles.length === 0 ? (
            <div className="text-center py-20">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No results found</h3>
              <p className="text-gray-500">Try adjusting your search criteria</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">
                Found {pagination.total} profile{pagination.total !== 1 ? 's' : ''}
              </p>

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
                    className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <span className="px-4 text-gray-600">
                    Page {pagination.page} of {pagination.pages}
                  </span>

                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                    className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default SearchPage;
