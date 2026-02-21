import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';
import { Button, Alert } from '../components/ui/Input';
import PhotoUpload from '../components/profiles/PhotoUpload';
import TagSelect from '../components/profiles/TagSelect';
import LocationPicker from '../components/profiles/LocationPicker';
import { User, ChevronRight, ChevronLeft, Check } from 'lucide-react';

const CompleteProfile = () => {
  const navigate = useNavigate();
  const { user, updateUser, refreshUser } = useAuth();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form data
  const [formData, setFormData] = useState({
    gender: user?.gender || '',
    sexualPreference: user?.sexualPreference || 'both',
    birthDate: user?.birthDate?.split('T')[0] || '',
    biography: user?.biography || ''
  });
  
  const [photos, setPhotos] = useState([]);
  const [tags, setTags] = useState([]);
  const [location, setLocation] = useState(user?.location || null);

  // Load user photos and tags on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userData = await refreshUser();
        if (userData) {
          setPhotos(userData.photos?.map(p => ({
            id: p.id,
            filename: p.filename,
            isProfilePicture: p.is_profile_picture
          })) || []);
          setTags(userData.tags || []);
          setLocation(userData.location);
          setFormData(prev => ({
            ...prev,
            gender: userData.gender || '',
            sexualPreference: userData.sexualPreference || 'both',
            birthDate: userData.birthDate?.split('T')[0] || '',
            biography: userData.biography || ''
          }));
        }
      } catch (err) {
        console.error('Failed to load user data:', err);
      }
    };
    loadUserData();
  }, []);

  // Calculate age from birth date
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveStep = async () => {
    setLoading(true);
    setError('');

    try {
      // Save profile data
      await userAPI.updateProfile({
        gender: formData.gender,
        sexualPreference: formData.sexualPreference,
        birthDate: formData.birthDate,
        biography: formData.biography
      });

      // Save tags
      if (tags.length > 0) {
        await userAPI.updateTags(tags.map(t => t.id));
      }

      return true;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save profile');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    // Validate current step
    if (step === 1) {
      if (!formData.gender) {
        setError('Please select your gender');
        return;
      }
      if (!formData.birthDate) {
        setError('Please enter your birth date');
        return;
      }
      const age = calculateAge(formData.birthDate);
      if (age < 18) {
        setError('You must be at least 18 years old');
        return;
      }
    }
    
    if (step === 2) {
      if (!formData.biography || formData.biography.trim().length < 10) {
        setError('Please write at least 10 characters about yourself');
        return;
      }
    }

    if (step === 3) {
      if (photos.length === 0) {
        setError('Please upload at least one photo');
        return;
      }
    }

    if (step === 4) {
      if (!location?.city) {
        setError('Please set your location');
        return;
      }
    }

    setError('');
    
    // Save progress
    const saved = await handleSaveStep();
    if (!saved) return;

    if (step < 5) {
      setStep(step + 1);
    } else {
      // Final step - refresh user and redirect
      await refreshUser();
      navigate('/browse');
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setError('');
    }
  };

  // Progress indicator
  const steps = [
    { num: 1, label: 'Basic Info' },
    { num: 2, label: 'About You' },
    { num: 3, label: 'Photos' },
    { num: 4, label: 'Location' },
    { num: 5, label: 'Interests' }
  ];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors">
          <User className="w-8 h-8 text-primary-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">Complete Your Profile</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2 transition-colors">Let's set up your profile to find better matches</p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {steps.map((s) => (
            <div
              key={s.num}
              className={`flex flex-col items-center transition-colors ${s.num <= step ? 'text-primary-500' : 'text-gray-400 dark:text-gray-500'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                s.num < step ? 'bg-primary-500 text-white' :
                s.num === step ? 'border-2 border-primary-500 text-primary-500 dark:border-primary-400 dark:text-primary-400' :
                'border-2 border-gray-300 text-gray-400 dark:border-gray-700 dark:text-gray-500'
              }`}>
                {s.num < step ? <Check className="w-4 h-4" /> : s.num}
              </div>
              <span className="text-xs mt-1 hidden sm:block">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full transition-colors">
          <div
            className="h-2 bg-primary-500 rounded-full transition-all duration-300"
            style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Error display */}
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Step content */}
      <div className="card transition-colors">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold dark:text-white">Basic Information</h2>
            
            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                I am a
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'male', label: 'Man' },
                  { value: 'female', label: 'Woman' },
                  { value: 'other', label: 'Other' }
                ].map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, gender: option.value }))}
                    className={`p-3 border-2 rounded-lg text-center transition-colors ${
                      formData.gender === option.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sexual Preference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Interested in
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'male', label: 'Men' },
                  { value: 'female', label: 'Women' },
                  { value: 'both', label: 'Both' }
                ].map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, sexualPreference: option.value }))}
                    className={`p-3 border-2 rounded-lg text-center transition-colors ${
                      formData.sexualPreference === option.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Birth Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Birth Date
              </label>
              <input
                type="date"
                name="birthDate"
                value={formData.birthDate}
                onChange={handleInputChange}
                max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                className="input"
              />
              {formData.birthDate && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Age: {calculateAge(formData.birthDate)} years old
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Biography */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold dark:text-white">About You</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Biography
              </label>
              <textarea
                name="biography"
                value={formData.biography}
                onChange={handleInputChange}
                placeholder="Tell others about yourself... What are your hobbies? What are you looking for?"
                rows={6}
                maxLength={500}
                className="input resize-none"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-right">
                {formData.biography.length}/500
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Photos */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold dark:text-white">Your Photos</h2>
            <PhotoUpload
              photos={photos}
              onUpdate={setPhotos}
              maxPhotos={5}
            />
          </div>
        )}

        {/* Step 4: Location */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold dark:text-white">Your Location</h2>
            <LocationPicker
              location={location}
              onUpdate={setLocation}
            />
          </div>
        )}

        {/* Step 5: Interests */}
        {step === 5 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold dark:text-white">Your Interests</h2>
            <TagSelect
              selectedTags={tags}
              onUpdate={setTags}
              maxTags={10}
            />
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t dark:border-gray-800 transition-colors">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className={`flex items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              step === 1
                ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <Button onClick={handleNext} loading={loading}>
            {step === 5 ? 'Complete Profile' : 'Continue'}
            {step < 5 && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CompleteProfile;