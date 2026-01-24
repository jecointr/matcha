import { useState, useRef, useCallback } from 'react';
import { Camera, X, Star, Loader, Plus, RotateCw, Check, Image as ImageIcon } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Cropper from 'react-easy-crop';
import { userAPI } from '../../services/api';
import getCroppedImg from '../../utils/canvasUtils'; // Assurez-vous que le chemin est bon

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const PhotoUpload = ({ photos = [], onUpdate, maxPhotos = 5 }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  
  // États pour l'éditeur d'image
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [activeFilter, setActiveFilter] = useState(''); // '', 'grayscale(100%)', 'sepia(100%)'

  // --- Gestion du Drag & Drop ---
  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    // Lire le fichier pour l'afficher dans l'éditeur
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setImageSrc(reader.result); // Ouvre la modale
      setError('');
      // Reset editor states
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

  // --- Logique de l'éditeur ---
  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSaveEditedImage = async () => {
    try {
      setUploading(true);
      // 1. Générer le fichier croppé via Canvas
      const croppedBlob = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation,
        activeFilter
      );
      
      // 2. Préparer l'envoi
      const formData = new FormData();
      // On nomme le fichier "edited.jpg" car le backend génère son propre nom UUID de toute façon
      formData.append('photo', croppedBlob, 'edited.jpg');

      // 3. Envoyer au backend
      const response = await userAPI.uploadPhoto(formData);
      onUpdate([...photos, response.data.photo]);
      
      // 4. Fermer la modale
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

  // --- Actions existantes (Suppression / Profile Pic) ---
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
              className="w-full h-full object-cover rounded-lg shadow-sm"
            />
            {photo.isProfilePicture && (
              <div className="absolute top-1 left-1 bg-primary-500 text-white p-1 rounded-full shadow-md">
                <Star className="w-3 h-3" fill="currentColor" />
              </div>
            )}
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

        {/* --- Zone de Drag & Drop --- */}
        {photos.length < maxPhotos && (
          <div
            {...getRootProps()}
            className={`
              aspect-square border-2 border-dashed rounded-lg
              flex flex-col items-center justify-center cursor-pointer
              transition-colors relative overflow-hidden
              ${isDragActive 
                ? 'border-primary-500 bg-primary-50' 
                : 'border-gray-300 hover:border-primary-500 hover:bg-gray-50'
              }
              ${uploading ? 'opacity-50 pointer-events-none' : ''}
            `}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <Loader className="w-6 h-6 text-primary-500 animate-spin" />
            ) : (
              <>
                <Plus className={`w-6 h-6 ${isDragActive ? 'text-primary-500' : 'text-gray-400'}`} />
                <span className="text-xs text-gray-500 mt-1 text-center px-2">
                  {isDragActive ? 'Drop here' : 'Add / Drop'}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-2">
        Drag and drop supported. Click star to set main photo.
      </p>

      {/* --- MODALE D'ÉDITION --- */}
      {imageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl overflow-hidden w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-semibold text-gray-800">Edit Photo</h3>
              <button onClick={handleCloseEditor} className="text-gray-500 hover:text-gray-700">
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
                aspect={1} // Force carré pour les photos de profil
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                style={{
                  containerStyle: { filter: activeFilter } // Aperçu visuel du filtre
                }}
              />
            </div>

            {/* Contrôles */}
            <div className="p-4 space-y-4 bg-gray-50 flex-1 overflow-y-auto">
              
              {/* Zoom & Rotation */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <ImageIcon className="w-4 h-4 text-gray-500" />
                  <span className="text-xs font-medium w-12">Zoom</span>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <RotateCw className="w-4 h-4 text-gray-500" />
                  <span className="text-xs font-medium w-12">Rotate</span>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={1}
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="flex-1 h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-primary-600"
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
                      px-3 py-1 text-xs rounded-full border transition-colors
                      ${activeFilter === f.value 
                        ? 'bg-gray-800 text-white border-gray-800' 
                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }
                    `}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t bg-white flex justify-end gap-3">
              <button 
                onClick={handleCloseEditor}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditedImage}
                disabled={uploading}
                className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
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