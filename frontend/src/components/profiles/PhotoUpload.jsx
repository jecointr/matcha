import { useState, useRef } from 'react';
import { Camera, X, Star, Loader, Plus } from 'lucide-react';
import { userAPI } from '../../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const PhotoUpload = ({ photos = [], onUpdate, maxPhotos = 5 }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPEG, PNG and WebP images are allowed');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('photo', file);

      const response = await userAPI.uploadPhoto(formData);
      onUpdate([...photos, response.data.photo]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload photo');
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (photoId) => {
    if (!confirm('Delete this photo?')) return;

    try {
      await userAPI.deletePhoto(photoId);
      onUpdate(photos.filter(p => p.id !== photoId));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete photo');
    }
  };

  const handleSetProfilePicture = async (photoId) => {
    try {
      await userAPI.setProfilePicture(photoId);
      onUpdate(photos.map(p => ({
        ...p,
        isProfilePicture: p.id === photoId
      })));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set profile picture');
    }
  };

  const getPhotoUrl = (photo) => {
    const url = photo.url || `/uploads/${photo.filename}`;
    return url.startsWith('http') ? url : `${API_URL.replace('/api', '')}${url}`;
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Photos ({photos.length}/{maxPhotos})
      </label>

      {error && (
        <div className="mb-3 p-2 bg-red-50 text-red-600 text-sm rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {/* Existing photos */}
        {photos.map((photo) => (
          <div key={photo.id} className="relative aspect-square group">
            <img
              src={getPhotoUrl(photo)}
              alt="Profile photo"
              className="w-full h-full object-cover rounded-lg"
            />
            
            {/* Profile picture badge */}
            {photo.isProfilePicture && (
              <div className="absolute top-1 left-1 bg-primary-500 text-white p-1 rounded-full">
                <Star className="w-3 h-3" fill="currentColor" />
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
              {!photo.isProfilePicture && (
                <button
                  onClick={() => handleSetProfilePicture(photo.id)}
                  className="p-2 bg-white rounded-full text-gray-700 hover:bg-gray-100"
                  title="Set as profile picture"
                >
                  <Star className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => handleDelete(photo.id)}
                className="p-2 bg-white rounded-full text-red-500 hover:bg-red-50"
                title="Delete"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Upload button */}
        {photos.length < maxPhotos && (
          <label className={`
            aspect-square border-2 border-dashed border-gray-300 rounded-lg
            flex flex-col items-center justify-center cursor-pointer
            hover:border-primary-500 hover:bg-primary-50 transition-colors
            ${uploading ? 'pointer-events-none opacity-50' : ''}
          `}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />
            {uploading ? (
              <Loader className="w-6 h-6 text-primary-500 animate-spin" />
            ) : (
              <>
                <Plus className="w-6 h-6 text-gray-400" />
                <span className="text-xs text-gray-500 mt-1">Add</span>
              </>
            )}
          </label>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-2">
        First photo will be your profile picture. Click the star to change it.
      </p>
    </div>
  );
};

export default PhotoUpload;
