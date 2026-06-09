import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Link } from 'react-router-dom';
import { profileAPI, userAPI } from '../services/api';
import { API_URL } from '../config';
import { Loader, MapPin, Navigation, Check } from 'lucide-react';
import { useToast } from '../context/FeedbackContext';
import { useAuth } from '../context/AuthContext';
import 'leaflet/dist/leaflet.css';
// react-leaflet-cluster v4 no longer auto-imports its CSS — required manually.
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';
import L from 'leaflet';

// Fix for the default Leaflet icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Composant pour recentrer la carte. `nonce` permet de forcer un recentrage
// même quand lat/lng n'ont pas changé (ex: clic "locate me" alors qu'on a juste
// panné/zoomé ailleurs) — sans lui, l'effet ne se redéclencherait pas.
const RecenterMap = ({ lat, lng, nonce }) => {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], 13);
  }, [lat, lng, nonce, map]);
  return null;
};

// Round profile-photo marker (dating-app style) so isolated users read as faces
// on the map instead of the generic blue pin clashing with the cluster bubbles.
const buildUserIcon = (user) => {
  const src = user.profile_picture
    ? `${API_URL.replace('/api', '')}/uploads/${user.profile_picture}`
    : '/default-avatar.svg';
  return L.divIcon({
    className: 'user-marker',
    html: `<img src="${src}" alt="" onerror="this.src='/default-avatar.svg'" />`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
  });
};

const MapPage = () => {
  const toast = useToast();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [myLocation, setMyLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  // Bumped to force the map to recenter on the user even if coords are unchanged.
  const [recenterNonce, setRecenterNonce] = useState(0);
  // The map REQUIRES precise GPS: without a granted geolocation the user is
  // neither shown nor able to view the map (the rest of the app still works).
  // This avoids plotting anyone at a declared/manual — i.e. potentially fake —
  // position, which would mislead other users on a proximity feature.
  //
  // Flow phases:
  //   checking → reading the existing geolocation permission on mount
  //   intro    → app-level explanation shown BEFORE the native browser prompt.
  //              The native prompt is one-shot (a "Block" can't be re-triggered
  //              by code), so we ask in-app first to avoid accidental permanent
  //              blocks and to explain the privacy trade-off.
  //   locating → native prompt open / acquiring + reverse-geocoding the position
  //   confirm  → "you were located in X — save it to your account?" (Confirm/Cancel),
  //              so the account location is never overwritten silently.
  //   denied   → permission refused or unavailable
  //   map      → the interactive map
  const [phase, setPhase] = useState('checking');
  const [pending, setPending] = useState(null);   // { lat, lng, city, country }
  const [confirming, setConfirming] = useState(false);

  // Reverse-geocode GPS coords to a human place — both to name it in the
  // confirmation and to keep the account's city/country in sync with the coords.
  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      return {
        city: data.address?.city || data.address?.town || data.address?.village || 'Unknown',
        country: data.address?.country || 'Unknown',
      };
    } catch {
      return { city: 'Unknown', country: 'Unknown' };
    }
  };

  // Persist the chosen position (consent=true → joins the precise-GPS map) and
  // load the other map users.
  const persistAndShow = async ({ lat, lng, city, country }) => {
    await userAPI.updateLocation({ latitude: lat, longitude: lng, city, country, consent: true });
    const response = await profileAPI.getMapUsers();
    setUsers(response.data.users);
    setMyLocation({ lat, lng });
    setPhase('map');
  };

  // Fire the native geolocation prompt, then reverse-geocode the result.
  // skipConfirm: true for users who already granted permission (seamless return);
  // false for the intro flow, which routes through the confirmation step.
  const acquirePosition = (skipConfirm) => {
    setPhase('locating');
    if (!navigator.geolocation) {
      setPhase('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const geo = await reverseGeocode(latitude, longitude);
        const loc = { lat: latitude, lng: longitude, city: geo.city, country: geo.country };
        if (skipConfirm) {
          try {
            await persistAndShow(loc);
          } catch (error) {
            console.error('Error loading map:', error);
            toast.error('Failed to load the map.');
            setPhase('denied');
          }
        } else {
          setPending(loc);
          setPhase('confirm');
        }
      },
      () => setPhase('denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // On mount: the decision is keyed on the ACCOUNT's stored consent, NOT on the
  // browser permission. A browser-level grant can leak across accounts on the
  // same origin (e.g. another account tested earlier on localhost), which must
  // never silently locate a manual/never-located account. So:
  //   account already consented (location.consent === true) → seamless refresh
  //   otherwise → app-level intro + explicit confirmation before any write.
  // We wait for `user` to load, then decide exactly once.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current || !user) return;
    didInit.current = true;
    if (user.location?.consent === true) {
      acquirePosition(true);
    } else {
      setPhase('intro');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const confirmLocation = async () => {
    if (!pending) return;
    setConfirming(true);
    try {
      await persistAndShow(pending);
      setPending(null);
    } catch (error) {
      console.error('Failed to save location', error);
      toast.error('Failed to save your location.');
    } finally {
      setConfirming(false);
    }
  };

  const cancelConfirm = () => {
    setPending(null);
    setPhase('intro');
  };

  // Floating button on the map: refresh my precise position (explicit click, so
  // no confirmation needed) and keep city/country in sync.
  const handleLocateMe = () => {
    setLocating(true);
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const geo = await reverseGeocode(latitude, longitude);
          await userAPI.updateLocation({
            latitude, longitude, city: geo.city, country: geo.country, consent: true,
          });
          const response = await profileAPI.getMapUsers();
          setUsers(response.data.users);
          setMyLocation({ lat: latitude, lng: longitude });
          setRecenterNonce((n) => n + 1); // always recenter, even if coords unchanged
        } catch (error) {
          console.error("Failed to update location", error);
          toast.error("Unable to update your location.");
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        console.error("Location error", error);
        toast.error("Unable to retrieve your location.");
        setLocating(false);
      }
    );
  };

  // Spinner while reading the permission on mount or acquiring the position.
  if (phase === 'checking' || phase === 'locating') {
    return (
      <div className="flex h-[calc(100vh-140px)] w-full items-center justify-center rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
        <div className="text-center">
          <Loader className="w-10 h-10 animate-spin text-primary-500 mx-auto" />
          {phase === 'locating' && (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Locating you…</p>
          )}
        </div>
      </div>
    );
  }

  // App-level intro shown BEFORE the native browser prompt.
  if (phase === 'intro') {
    return (
      <div className="flex h-[calc(100vh-140px)] w-full items-center justify-center rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
        <div className="max-w-md text-center px-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/20">
            <MapPin className="h-8 w-8 text-primary-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Show yourself on the map
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            The map needs your precise location. Enabling it will update your account
            location and let other users see you nearby. The rest of the app works fine
            without it.
          </p>
          <button
            onClick={() => acquirePosition(false)}
            className="btn-primary mt-5 inline-flex items-center gap-2 px-5 py-2.5"
          >
            <Navigation className="h-5 w-5" />
            Enable my location
          </button>
        </div>
      </div>
    );
  }

  // Confirmation: name the located place and require an explicit OK before the
  // account location is overwritten.
  if (phase === 'confirm' && pending) {
    return (
      <div className="flex h-[calc(100vh-140px)] w-full items-center justify-center rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
        <div className="max-w-md text-center px-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/20">
            <MapPin className="h-8 w-8 text-primary-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            You've been located
          </h2>
          <p className="mt-2 text-gray-700 dark:text-gray-200">
            You appear to be in{' '}
            <strong>
              {pending.city}{pending.country ? `, ${pending.country}` : ''}
            </strong>.
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Confirming will set this as your account location and place you on the map.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              onClick={cancelConfirm}
              disabled={confirming}
              className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmLocation}
              disabled={confirming}
              className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 disabled:opacity-50"
            >
              {confirming ? (
                <Loader className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  Confirm
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Gate: permission denied or unavailable.
  if (phase === 'denied' || !myLocation) {
    return (
      <div className="flex h-[calc(100vh-140px)] w-full items-center justify-center rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
        <div className="max-w-md text-center px-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/20">
            <MapPin className="h-8 w-8 text-primary-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            The map requires your precise location
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Enable location access to see other users and appear on the map. The rest
            of the app works fine without it.
          </p>
          <button
            onClick={() => acquirePosition(false)}
            className="btn-primary mt-5 inline-flex items-center gap-2 px-5 py-2.5"
          >
            <Navigation className="h-5 w-5" />
            Enable location
          </button>
          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500 italic">
            If nothing happens, you may have blocked location for this site — unblock it
            in your browser settings, then try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] w-full relative rounded-xl overflow-hidden shadow-xl border border-gray-200 dark:border-gray-800 transition-colors duration-200">
      
      {/* Geolocation button */}
      <button
        onClick={handleLocateMe}
        disabled={locating}
        className="absolute top-4 right-4 z-[400] bg-white dark:bg-gray-800 p-3 rounded-full shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
        title="Update my precise location"
      >
        {locating ? (
          <Loader className="w-6 h-6 animate-spin text-primary-500" />
        ) : (
          <Navigation className="w-6 h-6 text-gray-700 dark:text-gray-200" />
        )}
      </button>

      <MapContainer 
        center={[myLocation.lat, myLocation.lng]} 
        zoom={13} 
        scrollWheelZoom={true} 
        style={{ height: "100%", width: "100%" }}
        className="z-10"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <RecenterMap lat={myLocation.lat} lng={myLocation.lng} nonce={recenterNonce} />

        {/* Marqueur "Moi" */}
        <Marker position={[myLocation.lat, myLocation.lng]}>
          <Popup>
            <div className="text-center dark:text-gray-100">
              <span className="font-bold">You are here</span>
            </div>
          </Popup>
        </Marker>

        {/* Marqueurs des autres utilisateurs — regroupés en clusters (se scindent au zoom).
            chunkedLoading: ajout des marqueurs par lots pour rester fluide sur un gros volume. */}
        <MarkerClusterGroup chunkedLoading>
        {users.map((user) => (
          <Marker
            key={user.id}
            position={[user.latitude, user.longitude]}
            icon={buildUserIcon(user)}
          >
            <Popup className="custom-popup">
              <div className="w-32 text-center transition-colors">
                <div className="w-16 h-16 mx-auto mb-2 rounded-full overflow-hidden border-2 border-primary-500">
                  <img 
                    src={user.profile_picture ? `${API_URL.replace('/api', '')}/uploads/${user.profile_picture}` : '/default-avatar.svg'} 
                    alt={user.username}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 transition-colors">{user.first_name}</h3>
                <div className="flex items-center justify-center gap-1 text-yellow-500 text-xs mb-2">
                  <span>★</span> {user.fame_rating}
                </div>
                <Link 
                  to={`/profile/${user.id}`}
                  className="block w-full py-1 bg-primary-500 text-white text-xs rounded hover:bg-primary-600 transition-colors"
                >
                  View Profile
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
};

export default MapPage;