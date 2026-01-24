import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';
import { authAPI } from '../services/api';
import { Input, Button, Alert } from '../components/ui/Input';
import PhotoUpload from '../components/profiles/PhotoUpload';
import TagSelect from '../components/profiles/TagSelect';
import LocationPicker from '../components/profiles/LocationPicker';
import { 
  User, Camera, MapPin, Heart, Edit2, Save, X, 
  Calendar, Star, Eye, ThumbsUp, Settings
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const Profile = () => {
  const { user, refreshUser, logout } = useAuth();
  
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  
  // Profile data
  const [profile, setProfile] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [tags, setTags] = useState([]);
  const [location, setLocation] = useState(null);
  
  // Edit form
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    gender: '',
    sexualPreference: 'both',
    birthDate: '',
    biography: ''
  });

  // Load profile data
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const userData = await refreshUser();
      if (userData) {
        setProfile(userData);
        setPhotos(userData.photos?.map(p => ({
          id: p.id,
          filename: p.filename,
          isProfilePicture: p.is_profile_picture
        })) || []);
        setTags(userData.tags || []);
        setLocation(userData.location);
        setFormData({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email || '',
          gender: userData.gender || '',
          sexualPreference: userData.sexualPreference || 'both',
          birthDate: userData.birthDate?.split('T')[0] || '',
          biography: userData.biography || ''
        });
      }
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Save profile data
      await userAPI.updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        gender: formData.gender,
        sexualPreference: formData.sexualPreference,
        birthDate: formData.birthDate,
        biography: formData.biography
      });

      // Save tags
      await userAPI.updateTags(tags.map(t => t.id));

      setSuccess('Profile updated successfully');
      setEditMode(false);
      await loadProfile();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form data
    setFormData({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      email: profile.email || '',
      gender: profile.gender || '',
      sexualPreference: profile.sexualPreference || 'both',
      birthDate: profile.birthDate?.split('T')[0] || '',
      biography: profile.biography || ''
    });
    setEditMode(false);
    setError('');
  };

  const getProfilePicture = () => {
    const profilePhoto = photos.find(p => p.isProfilePicture) || photos[0];
    if (profilePhoto) {
      return `${API_URL.replace('/api', '')}/uploads/${profilePhoto.filename}`;
    }
    return null;
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer définitivement votre compte ? Cette action est irréversible.")) {
      return;
    }

    try {
      await userAPI.deleteAccount();
      logout(); // Vide le contexte/localstorage
      navigate('/login'); // Redirige
    } catch (err) {
      console.error(err);
      setError("Impossible de supprimer le compte.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header with profile picture */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Profile picture */}
          <div className="relative">
            {getProfilePicture() ? (
              <img
                src={getProfilePicture()}
                alt="Profile"
                className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center border-4 border-white shadow-lg">
                <User className="w-16 h-16 text-gray-400" />
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 bg-primary-500 text-white p-2 rounded-full shadow">
              <Star className="w-4 h-4" fill="currentColor" />
            </div>
          </div>

          {/* Basic info */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold text-gray-900">
              {profile?.firstName} {profile?.lastName}
            </h1>
            <p className="text-gray-500">@{profile?.username}</p>
            
            <div className="flex flex-wrap justify-center sm:justify-start gap-4 mt-3 text-sm text-gray-600">
              {formData.birthDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {calculateAge(formData.birthDate)} years old
                </span>
              )}
              {location?.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {location.city}{location.country ? `, ${location.country}` : ''}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Heart className="w-4 h-4 text-primary-500" />
                Fame: {profile?.fameRating || 0}%
              </span>
            </div>
          </div>

          {/* Edit button */}
          <div>
            {!editMode ? (
              <Button onClick={() => setEditMode(true)} variant="outline">
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button onClick={handleSave} loading={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
                <Button onClick={handleCancel} variant="secondary">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {[
          { id: 'profile', label: 'Profile', icon: User },
          { id: 'photos', label: 'Photos', icon: Camera },
          { id: 'location', label: 'Location', icon: MapPin },
          { id: 'settings', label: 'Settings', icon: Settings }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="card">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {editMode ? (
              <>
                {/* Edit form */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                  />
                  <Input
                    label="Last Name"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                  />
                </div>

                <Input
                  label="Email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      className="input"
                    >
                      <option value="">Select...</option>
                      <option value="male">Man</option>
                      <option value="female">Woman</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Interested in</label>
                    <select
                      name="sexualPreference"
                      value={formData.sexualPreference}
                      onChange={handleInputChange}
                      className="input"
                    >
                      <option value="male">Men</option>
                      <option value="female">Women</option>
                      <option value="both">Both</option>
                    </select>
                  </div>
                </div>

                <Input
                  label="Birth Date"
                  type="date"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleInputChange}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Biography</label>
                  <textarea
                    name="biography"
                    value={formData.biography}
                    onChange={handleInputChange}
                    rows={4}
                    maxLength={500}
                    className="input resize-none"
                  />
                  <p className="text-sm text-gray-500 mt-1 text-right">
                    {formData.biography.length}/500
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Interests</label>
                  <TagSelect selectedTags={tags} onUpdate={setTags} maxTags={10} />
                </div>
              </>
            ) : (
              <>
                {/* View mode */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">About me</h3>
                  <p className="text-gray-900">{profile?.biography || 'No biography yet'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Gender</h3>
                    <p className="text-gray-900 capitalize">{profile?.gender || 'Not set'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Interested in</h3>
                    <p className="text-gray-900 capitalize">
                      {profile?.sexualPreference === 'both' ? 'Men & Women' : 
                       profile?.sexualPreference === 'male' ? 'Men' : 'Women'}
                    </p>
                  </div>
                </div>

                {tags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Interests</h3>
                    <div className="flex flex-wrap gap-2">
                      {tags.map(tag => (
                        <span key={tag.id} className="badge-primary">
                          #{tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Photos Tab */}
        {activeTab === 'photos' && (
          <PhotoUpload photos={photos} onUpdate={(newPhotos) => { setPhotos(newPhotos); loadProfile(); }} maxPhotos={5} />
        )}

        {/* Location Tab */}
        {activeTab === 'location' && (
          <LocationPicker location={location} onUpdate={(newLocation) => { setLocation(newLocation); loadProfile(); }} />
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Account Settings</h3>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Change Password</h4>
              <p className="text-sm text-gray-500 mb-3">
                To change your password, click the button below to receive a reset link by email.
              </p>
              <Button 
                  onClick={async () => {
                    try {
                      setLoading(true);
                      // On utilise l'email du profil actuel
                      await authAPI.forgotPassword(profile.email);
                      setSuccess(`Reset link sent to ${profile.email}`);
                    } catch (err) {
                      setError("Failed to send reset email.");
                    } finally {
                      setLoading(false);
                    }
                  }} 
                  variant="secondary" 
                  className="text-sm"
                >
                  Send Reset Email
                </Button>
            </div>

            <div className="p-4 bg-red-50 rounded-lg">
              <h4 className="font-medium text-red-900 mb-2">Danger Zone</h4>
              <p className="text-sm text-red-700 mb-3">
                Deleting your account is permanent and cannot be undone.
              </p>
              <button 
                onClick={handleDeleteAccount}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
              >
                Delete Account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
