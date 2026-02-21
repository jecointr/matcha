import { useState, useRef, useCallback } from 'react';
import { Camera, X, Star, Loader, Plus, RotateCw, Check, Image as ImageIcon } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Cropper from 'react-easy-crop';
import { userAPI } from '../../services/api';
import getCroppedImg from '../../utils/canvasUtils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const PhotoUpload = ({ photos = [], onUpdate, maxPhotos = 5 }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [activeFilter, setActiveFilter] = useState(''); // '', 'grayscale(100%)', 'sepia(100%)'

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setImageSrc(reader.result);
      setError('');
      setZoom(1);
      setRotation(0);
      setActiveFilter('');
    });
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    maxFiles: 1,
    disabled: uploading || photos.length >= maxPhotos
  });

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSaveEditedImage = async () => {
    try {
      setUploading(true);
      const croppedBlob = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation,
        activeFilter
      );
      
      const formData = new FormData();
      formData.append('photo', croppedBlob, 'edited.jpg');

      const response = await userAPI.uploadPhoto(formData);
      onUpdate([...photos, response.data.photo]);
      
      setImageSrc(null);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleCloseEditor = () => {
    setImageSrc(null);
    setError('');
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
    <div className="transition-colors duration-200">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">
        Photos ({photos.length}/{maxPhotos})
      </label>

      {error && (
        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded transition-colors animate-fade-in">
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
              className="w-full h-full object-cover rounded-lg shadow-sm border dark:border-gray-800 transition-colors"
            />
            {photo.isProfilePicture && (
              <div className="absolute top-1 left-1 bg-primary-500 text-white p-1 rounded-full shadow-md z-10">
                <Star className="w-3 h-3" fill="currentColor" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
              {!photo.isProfilePicture && (
                <button
                  onClick={() => handleSetProfilePicture(photo.id)}
                  className="p-2 bg-white rounded-full text-gray-700 hover:bg-gray-100 cursor-pointer transition-transform hover:scale-110"
                  title="Set as profile picture"
                >
                  <Star className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => handleDelete(photo.id)}
                className="p-2 bg-white rounded-full text-red-500 hover:bg-red-50 cursor-pointer transition-transform hover:scale-110"
                title="Delete"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {/* --- Zone de Drag & Drop --- */}
        {photos.length < maxPhotos && (
          <div
            {...getRootProps()}
            className={`
              aspect-square border-2 border-dashed rounded-lg
              flex flex-col items-center justify-center cursor-pointer
              transition-all duration-200 relative overflow-hidden
              ${isDragActive 
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' 
                : 'border-gray-300 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800/30'
              }
              ${uploading ? 'opacity-50 pointer-events-none' : ''}
            `}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <Loader className="w-6 h-6 text-primary-500 animate-spin" />
            ) : (
              <>
                <Plus className={`w-6 h-6 transition-colors ${isDragActive ? 'text-primary-500' : 'text-gray-400 dark:text-gray-500'}`} />
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center px-2">
                  {isDragActive ? 'Drop here' : 'Add / Drop'}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic transition-colors">
        Drag and drop supported. Click star to set main photo.
      </p>

      {/* --- MODALE D'ÉDITION --- */}
      {imageSrc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] transition-colors border dark:border-gray-800">
            
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-800 transition-colors">
              <h3 className="font-semibold text-gray-800 dark:text-white transition-colors">Edit Photo</h3>
              <button onClick={handleCloseEditor} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Zone de Crop */}
            <div className="relative h-64 sm:h-80 bg-gray-900 w-full">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                style={{
                  containerStyle: { filter: activeFilter }
                }}
              />
            </div>

            {/* Contrôles */}
            <div className="p-4 space-y-4 bg-gray-50 dark:bg-gray-800/50 flex-1 overflow-y-auto transition-colors duration-200">
              
              {/* Zoom & Rotation */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <ImageIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-xs font-medium w-12 dark:text-gray-300 transition-colors">Zoom</span>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <RotateCw className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-xs font-medium w-12 dark:text-gray-300 transition-colors">Rotate</span>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={1}
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="flex-1 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                </div>
              </div>

              {/* Filtres */}
              <div className="flex justify-center gap-2 pt-2">
                {[
                  { name: 'Normal', value: '' },
                  { name: 'B&W', value: 'grayscale(100%)' },
                  { name: 'Sepia', value: 'sepia(100%)' },
                ].map((f) => (
                  <button
                    key={f.name}
                    onClick={() => setActiveFilter(f.value)}
                    className={`
                      px-3 py-1 text-xs rounded-full border transition-all cursor-pointer
                      ${activeFilter === f.value 
                        ? 'bg-primary-600 text-white border-primary-600 shadow-sm' 
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:border-primary-500'
                      }
                    `}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-end gap-3 transition-colors duration-200">
              <button 
                onClick={handleCloseEditor}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditedImage}
                disabled={uploading}
                className="px-6 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-md transition-all active:scale-95"
              >
                {uploading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save Photo
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoUpload;