import { useState } from 'react';
import { MapPin, Navigation, Loader, AlertCircle } from 'lucide-react';
import { userAPI } from '../../services/api';

const LocationPicker = ({ location, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualMode, setManualMode] = useState(!location?.latitude);
  const [manualCity, setManualCity] = useState(location?.city || '');
  const [manualCountry, setManualCountry] = useState(location?.country || '');

  // Récupérer la position GPS
  const handleGetLocation = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setManualMode(true);
      return;
    }

    setLoading(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          // Reverse geocoding pour obtenir ville/pays
          const geoData = await reverseGeocode(latitude, longitude);
          
          // Sauvegarde sur le serveur
          await userAPI.updateLocation({
            latitude,
            longitude,
            city: geoData.city,
            country: geoData.country,
            consent: true
          });

          onUpdate({
            latitude,
            longitude,
            city: geoData.city,
            country: geoData.country,
            consent: true
          });

          setManualMode(false);
        } catch (err) {
          setError('Failed to save location');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        setError('Location permission denied or unavailable. Please enter manually.');
        setManualMode(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await response.json();
      
      return {
        city: data.address?.city || data.address?.town || data.address?.village || 'Unknown',
        country: data.address?.country || 'Unknown'
      };
    } catch {
      return { city: 'Unknown', country: 'Unknown' };
    }
  };

  const handleSaveManual = async () => {
    if (!manualCity.trim()) {
      setError('Please enter a city');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const coords = await geocodeCity(manualCity, manualCountry);
      
      await userAPI.updateLocation({
        latitude: coords?.lat || null,
        longitude: coords?.lng || null,
        city: manualCity.trim(),
        country: manualCountry.trim() || null,
        consent: false
      });

      onUpdate({
        latitude: coords?.lat,
        longitude: coords?.lng,
        city: manualCity.trim(),
        country: manualCountry.trim(),
        consent: false
      });
      setManualMode(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save location');
    } finally {
      setLoading(false);
    }
  };

  const geocodeCity = async (city, country) => {
    try {
      const query = country ? `${city}, ${country}` : city;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      const data = await response.json();
      
      if (data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
      return null;
    } catch {
      return null;
    }
  };

  return (
    <div className="transition-colors duration-200">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Location
      </label>

      {error && (
        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Affichage de la position actuelle */}
      {location?.city && !manualMode && (
        <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 transition-colors">
          <MapPin className="w-5 h-5 text-green-600 dark:text-green-400" />
          <span className="text-green-800 dark:text-green-200 font-medium">
            {location.city}{location.country ? `, ${location.country}` : ''}
          </span>
          <button
            onClick={() => setManualMode(true)}
            className="ml-auto text-sm text-green-600 dark:text-green-400 hover:underline cursor-pointer font-medium"
          >
            Change
          </button>
        </div>
      )}

      {/* Options de saisie de localisation */}
      {(!location?.city || manualMode) && (
        <div className="space-y-4 animate-fade-in">
          {/* Option GPS */}
          <button
            onClick={handleGetLocation}
            disabled={loading}
            className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all flex items-center justify-center gap-2 cursor-pointer group"
          >
            {loading ? (
              <Loader className="w-5 h-5 animate-spin text-primary-500" />
            ) : (
              <Navigation className="w-5 h-5 text-primary-500 group-hover:scale-110 transition-transform" />
            )}
            <span className="font-medium dark:text-gray-200">Use my current location</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800"></div>
            <div className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wider">or</div>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800"></div>
          </div>

          {/* Saisie Manuelle */}
          <div className="space-y-3">
            <input
              type="text"
              value={manualCity}
              onChange={(e) => setManualCity(e.target.value)}
              placeholder="City *"
              className="input"
            />
            <input
              type="text"
              value={manualCountry}
              onChange={(e) => setManualCountry(e.target.value)}
              placeholder="Country (optional)"
              className="input"
            />
            <button
              onClick={handleSaveManual}
              disabled={loading || !manualCity.trim()}
              className="btn-primary w-full cursor-pointer py-2.5 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : (
                'Save Location'
              )}
            </button>
            {location?.city && (
                <button 
                    onClick={() => setManualMode(false)}
                    className="w-full py-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                    Cancel
                </button>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 italic">
        Your location helps us find matches nearby. We never share your exact location.
      </p>
    </div>
  );
};

export default LocationPicker;