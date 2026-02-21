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
      } catch (err) { console.error('Failed to load tags'); }
    };
    loadTags();
  }, []);

  useEffect(() => { setLocalFilters(filters); }, [filters]);

  const handleChange = (key, value) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSortSelect = (e) => {
    const value = e.target.value;
    const [sortBy, sortOrder] = value.split('_');
    
    const newFilters = { 
      ...localFilters, 
      sortBy, 
      sortOrder: sortOrder || 'desc'
    };
    
    setLocalFilters(newFilters);
    onChange(newFilters);
  };

  const getCurrentSortValue = () => {
    if (localFilters.sortBy === 'age' || localFilters.sortBy === 'fame') {
      return `${localFilters.sortBy}_${localFilters.sortOrder}`;
    }
    return localFilters.sortBy;
  };

  const handleApply = () => {
    onChange(localFilters);
    if (onSearch) onSearch();
    setIsOpen(false);
  };

  const handleReset = () => {
    const resetFilters = {
      minAge: '', maxAge: '', minFame: '', maxFame: '',
      maxDistance: '', location: '', gender: '', tags: [],
      sortBy: 'match', sortOrder: 'desc'
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
      <div className="flex flex-wrap gap-3 items-center">
        
        {/* Tri (Sort) */}
        <div className="relative">
          <select
            value={getCurrentSortValue()}
            onChange={handleSortSelect}
            className="appearance-none pl-4 pr-10 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer hover:border-gray-400 dark:hover:border-gray-600 transition-all"
          >
            <optgroup label="Relevance" className="dark:bg-gray-900">
              <option value="match">Best Match</option>
              <option value="distance">Nearest First</option>
              {isSearch && <option value="tags">Most Common Tags</option>}
            </optgroup>
            
            <optgroup label="Age" className="dark:bg-gray-900">
              <option value="age_asc">Youngest First</option>
              <option value="age_desc">Oldest First</option>
            </optgroup>

            <optgroup label="Popularity" className="dark:bg-gray-900">
              <option value="fame_desc">Most Popular</option>
              <option value="fame_asc">Least Popular</option>
            </optgroup>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>

        {/* Bouton Filtres */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all cursor-pointer ${
            activeFiltersCount > 0 
              ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-400' 
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
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

        {activeFiltersCount > 0 && (
          <button onClick={handleReset} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 cursor-pointer transition-colors">
            <X className="w-4 h-4" /> Reset
          </button>
        )}
      </div>

      {/* Section étendue des filtres */}
      {isOpen && (
        <div className="mt-4 p-4 bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-800 animate-fade-in shadow-sm transition-colors duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Age Range</label>
              <div className="flex gap-2 items-center">
                <input type="number" min="18" max="100" placeholder="Min" value={localFilters.minAge} onChange={(e) => handleChange('minAge', e.target.value)} className="input py-2 w-20" />
                <span className="text-gray-400">-</span>
                <input type="number" min="18" max="100" placeholder="Max" value={localFilters.maxAge} onChange={(e) => handleChange('maxAge', e.target.value)} className="input py-2 w-20" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fame Rating</label>
              <div className="flex gap-2 items-center">
                <input type="number" min="0" max="100" placeholder="Min" value={localFilters.minFame} onChange={(e) => handleChange('minFame', e.target.value)} className="input py-2 w-20" />
                <span className="text-gray-400">-</span>
                <input type="number" min="0" max="100" placeholder="Max" value={localFilters.maxFame} onChange={(e) => handleChange('maxFame', e.target.value)} className="input py-2 w-20" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Distance (km)</label>
              <input type="number" min="1" placeholder="e.g. 50" value={localFilters.maxDistance} onChange={(e) => handleChange('maxDistance', e.target.value)} className="input py-2" />
            </div>
            {isSearch && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
                  <input type="text" placeholder="Search by city..." value={localFilters.location} onChange={(e) => handleChange('location', e.target.value)} className="input py-2" />
                </div>
                <div className="mt-4 sm:mt-0">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gender</label>
                  <select value={localFilters.gender} onChange={(e) => handleChange('gender', e.target.value)} className="input py-2">
                    <option value="">Any</option>
                    <option value="male">Men</option>
                    <option value="female">Women</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </>
            )}
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Interests</label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar">
              {availableTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => handleTagToggle(tag.id)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors cursor-pointer ${
                    (localFilters.tags || []).includes(tag.id) 
                      ? 'bg-primary-500 text-white' 
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  #{tag.name}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3 pt-4 border-t dark:border-gray-800">
            <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white cursor-pointer transition-colors">Cancel</button>
            <button onClick={handleApply} className="btn-primary flex items-center gap-2 cursor-pointer"><Search className="w-4 h-4" /> Apply Filters</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Filters;