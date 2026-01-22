import { useState, useEffect } from 'react';
import { Filter, X, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { userAPI } from '../../services/api';

const Filters = ({ filters, onChange, onSearch, isSearch = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);
  const [localFilters, setLocalFilters] = useState(filters);

  // Initialisation des tags
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

  // Helper pour mettre à jour l'état local
  const handleChange = (key, value) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  // GESTION INTELLIGENTE DU TRI
  // On décompose la valeur "age_asc" en { sortBy: 'age', sortOrder: 'asc' }
  const handleSortSelect = (e) => {
    const value = e.target.value;
    const [sortBy, sortOrder] = value.split('_'); // ex: 'age_asc' -> ['age', 'asc']
    
    const newFilters = { 
      ...localFilters, 
      sortBy, 
      sortOrder: sortOrder || 'desc' // par défaut desc si pas précisé
    };
    
    setLocalFilters(newFilters);
    onChange(newFilters); // Appel immédiat au parent
  };

  // Génère la valeur actuelle combinée pour le <select>
  const getCurrentSortValue = () => {
    if (localFilters.sortBy === 'age' || localFilters.sortBy === 'fame') {
      return `${localFilters.sortBy}_${localFilters.sortOrder}`;
    }
    return localFilters.sortBy; // 'match' ou 'distance' ou 'tags'
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
        
        {/* --- C'EST ICI QUE TOUT CHANGE --- */}
        <div className="relative">
          <select
            value={getCurrentSortValue()}
            onChange={handleSortSelect}
            className="appearance-none pl-4 pr-10 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer hover:border-gray-400 transition-colors"
          >
            <optgroup label="Relevance">
              <option value="match">Best Match</option>
              <option value="distance">Nearest First</option>
              {isSearch && <option value="tags">Most Common Tags</option>}
            </optgroup>
            
            <optgroup label="Age">
              <option value="age_asc">Youngest First</option>
              <option value="age_desc">Oldest First</option>
            </optgroup>

            <optgroup label="Popularity">
              <option value="fame_desc">Most Popular</option>
              <option value="fame_asc">Least Popular</option>
            </optgroup>
          </select>
          {/* Petite flèche custom pour faire joli */}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
        {/* ---------------------------------- */}

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

        {activeFiltersCount > 0 && (
          <button onClick={handleReset} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <X className="w-4 h-4" /> Reset
          </button>
        )}
      </div>

      {/* Expanded filters section (inchangée, je la remets pour la complétude) */}
      {isOpen && (
        <div className="mt-4 p-4 bg-white rounded-lg border animate-fade-in shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age Range</label>
              <div className="flex gap-2 items-center">
                <input type="number" min="18" max="100" placeholder="Min" value={localFilters.minAge} onChange={(e) => handleChange('minAge', e.target.value)} className="input py-2 w-20" />
                <span className="text-gray-400">-</span>
                <input type="number" min="18" max="100" placeholder="Max" value={localFilters.maxAge} onChange={(e) => handleChange('maxAge', e.target.value)} className="input py-2 w-20" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fame Rating</label>
              <div className="flex gap-2 items-center">
                <input type="number" min="0" max="100" placeholder="Min" value={localFilters.minFame} onChange={(e) => handleChange('minFame', e.target.value)} className="input py-2 w-20" />
                <span className="text-gray-400">-</span>
                <input type="number" min="0" max="100" placeholder="Max" value={localFilters.maxFame} onChange={(e) => handleChange('maxFame', e.target.value)} className="input py-2 w-20" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Distance (km)</label>
              <input type="number" min="1" placeholder="e.g. 50" value={localFilters.maxDistance} onChange={(e) => handleChange('maxDistance', e.target.value)} className="input py-2" />
            </div>
            {isSearch && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input type="text" placeholder="Search by city..." value={localFilters.location} onChange={(e) => handleChange('location', e.target.value)} className="input py-2" />
                </div>
                <div className="mt-4 sm:mt-0">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Interests</label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {availableTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => handleTagToggle(tag.id)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    (localFilters.tags || []).includes(tag.id) ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  #{tag.name}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
            <button onClick={handleApply} className="btn-primary flex items-center gap-2"><Search className="w-4 h-4" /> Apply Filters</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Filters;