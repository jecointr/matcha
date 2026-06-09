import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Loader, AlertCircle, Search, Check } from 'lucide-react';
import { userAPI } from '../../services/api';

const LocationPicker = ({ location, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualMode, setManualMode] = useState(!location?.latitude);

  // Autocomplete state. Starts empty (even when a location is already set): the
  // current location is shown in the green banner below, not in this input. This
  // avoids pre-filling an unsaveable value (no suggestion selected) and a useless
  // geocoder request on mount.
  const [queryText, setQueryText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  // Guardrail: a location can only be saved if it comes from a real, selected
  // suggestion (with coordinates) — never from raw free text. Typing again
  // clears the selection, forcing the user to pick a suggestion before saving.
  const [selectedPlace, setSelectedPlace] = useState(null);

  const abortRef = useRef(null);

  // Get the GPS position
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

          // Save to the server
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
      () => {
        // Permission denied or unavailable → manual entry
        setLoading(false);
        setError('Location permission denied or unavailable. Please search for your city.');
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
      // The subject requires GPS positioning "down to their neighborhood", so we
      // ask Nominatim for building-level detail (zoom=18) and keep the
      // neighbourhood, not just the city.
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await response.json();
      const addr = data.address || {};

      const neighbourhood =
        addr.neighbourhood || addr.suburb || addr.quarter || addr.city_district || '';
      const city =
        addr.city || addr.town || addr.village || addr.municipality || 'Unknown';

      return {
        // "Neighbourhood, City" when available, otherwise just the city.
        city: [neighbourhood, city].filter(Boolean).join(', '),
        country: addr.country || 'Unknown'
      };
    } catch {
      return { city: 'Unknown', country: 'Unknown' };
    }
  };

  // --- City autocomplete (OpenStreetMap / Nominatim) ---
  // Debounced search: we never query on every keystroke (Nominatim's usage
  // policy caps at ~1 req/s). Stale in-flight requests are aborted.
  useEffect(() => {
    // Don't search right after a pick, or for too-short queries.
    if (selectedPlace || queryText.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const handle = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSearching(true);
      try {
        // Photon (Komoot) — OSM-based geocoder built for type-ahead autocomplete.
        // Restricted to populated places (city/town/village) for the right granularity.
        const url =
          `https://photon.komoot.io/api/?q=${encodeURIComponent(queryText.trim())}` +
          `&limit=6&lang=en&osm_tag=place:city&osm_tag=place:town&osm_tag=place:village`;
        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json();

        const seen = new Set();
        const places = (data.features || [])
          .map((f) => {
            const p = f.properties || {};
            const [lng, lat] = f.geometry?.coordinates || [];
            const city = p.name || p.city || '';
            const region = p.state || p.county || '';
            const country = p.country || '';
            return {
              lat,
              lng,
              city,
              country,
              shortLabel: [city, country].filter(Boolean).join(', '),
              label: [city, region, country].filter(Boolean).join(', ')
            };
          })
          // Keep only real, geocodable localities; dedupe by full label.
          .filter((pl) => pl.city && typeof pl.lat === 'number' && typeof pl.lng === 'number')
          .filter((pl) => {
            if (seen.has(pl.label)) return false;
            seen.add(pl.label);
            return true;
          });

        setSuggestions(places);
      } catch (err) {
        if (err.name !== 'AbortError') setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => clearTimeout(handle);
  }, [queryText, selectedPlace]);

  const handleSelectSuggestion = (place) => {
    setSelectedPlace(place);
    setQueryText(place.shortLabel);
    setSuggestions([]);
    setError('');
  };

  const handleSaveManual = async () => {
    // Guardrail: only a selected suggestion (with coordinates) can be saved.
    if (!selectedPlace) {
      setError('Please pick a city from the suggestions.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await userAPI.updateLocation({
        latitude: selectedPlace.lat,
        longitude: selectedPlace.lng,
        city: selectedPlace.city,
        country: selectedPlace.country || null,
        consent: false
      });

      onUpdate({
        latitude: selectedPlace.lat,
        longitude: selectedPlace.lng,
        city: selectedPlace.city,
        country: selectedPlace.country,
        consent: false
      });
      setManualMode(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save location');
    } finally {
      setLoading(false);
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
            onClick={() => {
              setManualMode(true);
              setQueryText('');
              setSelectedPlace(null);
              setSuggestions([]);
              setError('');
            }}
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

          {/* Saisie Manuelle — autocomplete géocodé */}
          <div className="space-y-3">
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={queryText}
                  onChange={(e) => {
                    setQueryText(e.target.value);
                    setSelectedPlace(null); // typing invalidates any previous pick
                  }}
                  placeholder="Start typing your city…"
                  className="input pl-9 pr-9"
                  autoComplete="off"
                />
                {searching && (
                  <Loader className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-500 animate-spin" />
                )}
                {selectedPlace && !searching && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                )}
              </div>

              {/* Suggestions dropdown */}
              {suggestions.length > 0 && !selectedPlace && (
                <ul className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto animate-fade-in">
                  {suggestions.map((s) => (
                    <li key={`${s.lat},${s.lng}`}>
                      <button
                        type="button"
                        onClick={() => handleSelectSuggestion(s)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors flex items-start gap-2"
                      >
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <span className="truncate">{s.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              onClick={handleSaveManual}
              disabled={loading || !selectedPlace}
              className="btn-primary w-full cursor-pointer py-2.5 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
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
