import { useState } from 'react';
import { MapPin, Navigation, Loader, AlertCircle } from 'lucide-react';
import { userAPI } from '../../services/api';

const LocationPicker = ({ location, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualMode, setManualMode] = useState(!location?.latitude);
  const [manualCity, setManualCity] = useState(location?.city || '');
  const [manualCountry, setManualCountry] = useState(location?.country || '');

  // Get GPS location
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
          // Reverse geocoding to get city/country
          const geoData = await reverseGeocode(latitude, longitude);
          
          // Save to server
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
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location permission denied. Please enter your city manually.');
            setManualMode(true);
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Location unavailable. Please enter your city manually.');
            setManualMode(true);
            break;
          default:
            setError('Failed to get location. Please enter your city manually.');
            setManualMode(true);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Simple reverse geocoding using free API
  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
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

  // Save manual location
  const handleSaveManual = async () => {
    if (!manualCity.trim()) {
      setError('Please enter a city');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Try to geocode the city to get coordinates
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
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save location');
    } finally {
      setLoading(false);
    }
  };

  // Geocode city name to coordinates
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
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Location
      </label>

      {error && (
        <div className="mb-3 p-2 bg-red-50 text-red-600 text-sm rounded flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Current location display */}
      {location?.city && !manualMode && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <MapPin className="w-5 h-5 text-green-600" />
          <span className="text-green-800">
            {location.city}{location.country ? `, ${location.country}` : ''}
          </span>
          <button
            onClick={() => setManualMode(true)}
            className="ml-auto text-sm text-green-600 hover:underline"
          >
            Change
          </button>
        </div>
      )}

      {/* Location options */}
      {(!location?.city || manualMode) && (
        <div className="space-y-4">
          {/* GPS option */}
          <button
            onClick={handleGetLocation}
            disabled={loading}
            className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader className="w-5 h-5 animate-spin text-primary-500" />
            ) : (
              <Navigation className="w-5 h-5 text-primary-500" />
            )}
            <span>Use my current location</span>
          </button>

          <div className="text-center text-gray-500 text-sm">or</div>

          {/* Manual entry */}
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
              className="btn-primary w-full"
            >
              {loading ? (
                <Loader className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                'Save Location'
              )}
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-2">
        Your location helps us find matches nearby. We never share your exact location.
      </p>
    </div>
  );
};

export default LocationPicker;
