import { useState, useEffect } from 'react';
import { Filter, X, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { userAPI } from '../../services/api';

const Filters = ({ filters, onChange, onSearch, isSearch = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    const loadTags = async () => {
      try {
        const res = await userAPI.getTags();
        setAvailableTags(res.data.tags);
      } catch (err) {
        console.error('Failed to load tags');
      }
    };
    loadTags();
  }, []);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleChange = (key, value) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
  };

  const handleApply = () => {
    onChange(localFilters);
    if (onSearch) onSearch();
    setIsOpen(false);
  };

  const handleReset = () => {
    const resetFilters = {
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
    };
    setLocalFilters(resetFilters);
    onChange(resetFilters);
  };

  const handleTagToggle = (tagId) => {
    const currentTags = localFilters.tags || [];
    const newTags = currentTags.includes(tagId)
      ? currentTags.filter(t => t !== tagId)
      : [...currentTags, tagId];
    handleChange('tags', newTags);
  };

  const activeFiltersCount = Object.entries(localFilters).filter(([key, value]) => {
    if (key === 'sortBy' || key === 'sortOrder') return false;
    if (Array.isArray(value)) return value.length > 0;
    return value !== '' && value !== null && value !== undefined;
  }).length;

  return (
    <div className="mb-6">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Sort dropdown */}
        <div className="flex items-center gap-2">
          <select
            value={localFilters.sortBy}
            onChange={(e) => {
              handleChange('sortBy', e.target.value);
              onChange({ ...localFilters, sortBy: e.target.value });
            }}
            className="input py-2 pr-8"
          >
            <option value="match">Best Match</option>
            <option value="distance">Distance</option>
            <option value="age">Age</option>
            <option value="fame">Fame Rating</option>
            {isSearch && <option value="tags">Common Tags</option>}
          </select>
        </div>

        {/* Toggle filters button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
            activeFiltersCount > 0 
              ? 'bg-primary-50 border-primary-200 text-primary-700' 
              : 'bg-white border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeFiltersCount > 0 && (
            <span className="bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full">
              {activeFiltersCount}
            </span>
          )}
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Quick reset */}
        {activeFiltersCount > 0 && (
          <button
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Reset
          </button>
        )}
      </div>

      {/* Expanded filters */}
      {isOpen && (
        <div className="mt-4 p-4 bg-white rounded-lg border animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Age range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age Range</label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min="18"
                  max="100"
                  placeholder="Min"
                  value={localFilters.minAge}
                  onChange={(e) => handleChange('minAge', e.target.value)}
                  className="input py-2 w-20"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  min="18"
                  max="100"
                  placeholder="Max"
                  value={localFilters.maxAge}
                  onChange={(e) => handleChange('maxAge', e.target.value)}
                  className="input py-2 w-20"
                />
              </div>
            </div>

            {/* Fame range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fame Rating</label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Min"
                  value={localFilters.minFame}
                  onChange={(e) => handleChange('minFame', e.target.value)}
                  className="input py-2 w-20"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Max"
                  value={localFilters.maxFame}
                  onChange={(e) => handleChange('maxFame', e.target.value)}
                  className="input py-2 w-20"
                />
              </div>
            </div>

            {/* Distance */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Distance (km)</label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 50"
                value={localFilters.maxDistance}
                onChange={(e) => handleChange('maxDistance', e.target.value)}
                className="input py-2"
              />
            </div>

            {/* Location (search only) */}
            {isSearch && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  placeholder="Search by city..."
                  value={localFilters.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  className="input py-2"
                />
              </div>
            )}

            {/* Gender (search only) */}
            {isSearch && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select
                  value={localFilters.gender}
                  onChange={(e) => handleChange('gender', e.target.value)}
                  className="input py-2"
                >
                  <option value="">Any</option>
                  <option value="male">Men</option>
                  <option value="female">Women</option>
                  <option value="other">Other</option>
                </select>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Interests</label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {availableTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => handleTagToggle(tag.id)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    (localFilters.tags || []).includes(tag.id)
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  #{tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* Apply button */}
          <div className="mt-4 flex justify-end gap-3">
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="btn-primary flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Filters;
