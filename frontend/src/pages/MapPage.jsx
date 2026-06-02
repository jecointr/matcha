import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Link } from 'react-router-dom';
import { profileAPI, userAPI } from '../services/api';
import { API_URL } from '../config';
import { Loader, MapPin, Navigation } from 'lucide-react';
import { useToast } from '../context/FeedbackContext';
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

// Composant pour recentrer la carte
const RecenterMap = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], 13);
  }, [lat, lng, map]);
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
  const [users, setUsers] = useState([]);
  const [myLocation, setMyLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);

  // Charger les utilisateurs
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await profileAPI.getMapUsers();
        setUsers(response.data.users);
        
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setMyLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          () => {
             setMyLocation({ lat: 48.8566, lng: 2.3522 });
          }
        );
      } catch (error) {
        console.error("Error loading map:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
        setMyLocation({ lat: latitude, lng: longitude });
        
        try {
          await userAPI.updateLocation({ latitude, longitude });
          const response = await profileAPI.getMapUsers();
          setUsers(response.data.users);
        } catch (error) {
          console.error("Failed to update location", error);
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

  if (loading || !myLocation) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
        <Loader className="w-10 h-10 animate-spin text-primary-500" />
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
        
        <RecenterMap lat={myLocation.lat} lng={myLocation.lng} />

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