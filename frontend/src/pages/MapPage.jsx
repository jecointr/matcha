import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { profileAPI, userAPI } from '../services/api'; // userAPI pour mettre à jour la loc
import { Loader, MapPin, Navigation } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix pour les icônes Leaflet par défaut qui buggent avec Vite/Webpack
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

const MapPage = () => {
  const [users, setUsers] = useState([]);
  const [myLocation, setMyLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);

  // Charger les utilisateurs
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Récupérer ma position actuelle (depuis le profil ou navigateur)
        // Ici on suppose qu'on récupère la liste qui contient les distances calculées par rapport à la DB
        const response = await profileAPI.getMapUsers();
        setUsers(response.data.users);
        
        // On essaie de récupérer la vraie position GPS navigateur pour centrer
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setMyLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          () => {
             // Fallback: Paris par défaut si refus
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

  // Fonction Bonus : Update Precise GPS
  const handleLocateMe = () => {
    setLocating(true);
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setMyLocation({ lat: latitude, lng: longitude });
        
        try {
          // Sauvegarder la nouvelle position précise en DB
          await userAPI.updateLocation({ latitude, longitude });
          // Recharger les utilisateurs proches
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
        alert("Unable to retrieve your location");
        setLocating(false);
      }
    );
  };

  if (loading || !myLocation) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader className="w-10 h-10 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] w-full relative rounded-xl overflow-hidden shadow-xl border border-gray-200">
      
      {/* Bouton de géolocalisation (Bonus) */}
      <button
        onClick={handleLocateMe}
        disabled={locating}
        className="absolute top-4 right-4 z-[400] bg-white p-3 rounded-full shadow-md hover:bg-gray-50 transition-colors"
        title="Update my precise location"
      >
        {locating ? (
          <Loader className="w-6 h-6 animate-spin text-primary-500" />
        ) : (
          <Navigation className="w-6 h-6 text-gray-700" />
        )}
      </button>

      <MapContainer 
        center={[myLocation.lat, myLocation.lng]} 
        zoom={13} 
        scrollWheelZoom={true} 
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <RecenterMap lat={myLocation.lat} lng={myLocation.lng} />

        {/* Marqueur "Moi" */}
        <Marker position={[myLocation.lat, myLocation.lng]}>
          <Popup>
            <div className="text-center">
              <span className="font-bold">You are here</span>
            </div>
          </Popup>
        </Marker>

        {/* Marqueurs des autres utilisateurs */}
        {users.map((user) => (
          <Marker 
            key={user.id} 
            position={[user.latitude, user.longitude]}
          >
            <Popup>
              <div className="w-32 text-center">
                <div className="w-16 h-16 mx-auto mb-2 rounded-full overflow-hidden">
                  <img 
                    src={user.profile_picture ? `${import.meta.env.VITE_API_URL}/../uploads/${user.profile_picture}` : '/default-avatar.png'} 
                    alt={user.username}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="font-bold text-gray-900">{user.first_name}</h3>
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
      </MapContainer>
    </div>
  );
};

export default MapPage;
