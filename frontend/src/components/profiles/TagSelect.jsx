import { useState, useEffect } from 'react';
import { X, Plus, Hash } from 'lucide-react';
import { userAPI } from '../../services/api';

const TagSelect = ({ selectedTags = [], onUpdate, maxTags = 10 }) => {
  const [availableTags, setAvailableTags] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadTags = async () => {
      try {
        const response = await userAPI.getTags();
        setAvailableTags(response.data.tags);
      } catch (err) {
        console.error('Failed to load tags:', err);
      }
    };
    loadTags();
  }, []);

  const filteredTags = availableTags.filter(tag =>
    tag.name.includes(searchQuery.toLowerCase()) &&
    !selectedTags.find(t => t.id === tag.id)
  );

  const canCreateTag = searchQuery.length >= 2 &&
    !availableTags.find(t => t.name === searchQuery.toLowerCase()) &&
    selectedTags.length < maxTags;

  const handleSelectTag = (tag) => {
    if (selectedTags.length >= maxTags) {
      setError(`Maximum ${maxTags} tags allowed`);
      return;
    }
    onUpdate([...selectedTags, tag]);
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleRemoveTag = (tagId) => {
    onUpdate(selectedTags.filter(t => t.id !== tagId));
  };

  const handleCreateTag = async () => {
    if (!canCreateTag) return;

    setLoading(true);
    setError('');

    try {
      const response = await userAPI.createTag(searchQuery);
      const newTag = response.data.tag;
      
      setAvailableTags(prev => [...prev, newTag]);
      
      onUpdate([...selectedTags, newTag]);
      setSearchQuery('');
      setShowDropdown(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create tag');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && canCreateTag) {
      e.preventDefault();
      handleCreateTag();
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Interests ({selectedTags.length}/{maxTags})
      </label>

      {error && (
        <div className="mb-2 p-2 bg-red-50 text-red-600 text-sm rounded">
          {error}
        </div>
      )}

      {/* Selected tags */}
      <div className="flex flex-wrap gap-2 mb-3">
        {selectedTags.map(tag => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
          >
            <Hash className="w-3 h-3" />
            {tag.name}
            <button
              onClick={() => handleRemoveTag(tag.id)}
              className="ml-1 hover:text-primary-900"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      {/* Search input */}
      {selectedTags.length < maxTags && (
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search or create tags..."
            className="input"
          />

          {/* Dropdown */}
          {showDropdown && (searchQuery || filteredTags.length > 0) && (
            <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-auto">
              {/* Create new tag option */}
              {canCreateTag && (
                <button
                  onClick={handleCreateTag}
                  disabled={loading}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-primary-600"
                >
                  <Plus className="w-4 h-4" />
                  Create "#{searchQuery}"
                </button>
              )}

              {/* Existing tags */}
              {filteredTags.slice(0, 10).map(tag => (
                <button
                  key={tag.id}
                  onClick={() => handleSelectTag(tag)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                >
                  <Hash className="w-4 h-4 text-gray-400" />
                  {tag.name}
                </button>
              ))}

              {filteredTags.length === 0 && !canCreateTag && searchQuery && (
                <div className="px-4 py-2 text-gray-500 text-sm">
                  No matching tags found
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowDropdown(false)}
        />
      )}

      <p className="text-xs text-gray-500 mt-2">
        Add interests to help find better matches
      </p>
    </div>
  );
};

export default TagSelect;
