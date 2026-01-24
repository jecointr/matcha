import { useCall } from '../../context/CallContext';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { useState, useEffect } from 'react';

const VideoCallModal = () => {
  const { 
    call, callAccepted, myVideo, userVideo, 
    stream, answerCall, leaveCall, isCalling 
  } = useCall();
  
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  // Vérifier au démarrage si on a de la vidéo (pour mettre l'icône dans le bon état)
  useEffect(() => {
    if (stream) {
        const videoTracks = stream.getVideoTracks();
        setCamOn(videoTracks.length > 0 && videoTracks[0].enabled);
    }
  }, [stream]);

  if (!isCalling && !call) return null;

  const toggleMic = () => {
    if (stream) {
        stream.getAudioTracks()[0].enabled = !micOn;
        setMicOn(!micOn);
    }
  };

  const toggleCam = () => {
    if (stream) {
        const videoTracks = stream.getVideoTracks();
        // SÉCURITÉ : On ne toggle que si une piste vidéo existe
        if (videoTracks.length > 0) {
            videoTracks[0].enabled = !camOn;
            setCamOn(!camOn);
        } else {
            alert("This is an audio-only call. Cannot enable camera.");
        }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
      
      {/* Container Vidéos */}
      <div className="relative w-full max-w-4xl aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-2xl">
        
        {/* Vidéo Distante */}
        {callAccepted && !call?.callEnded ? (
           <video playsInline ref={userVideo} autoPlay className="w-full h-full object-cover" />
        ) : (
           <div className="w-full h-full flex items-center justify-center text-white flex-col gap-4">
               <div className="animate-pulse w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center text-3xl font-bold">
                  {call?.from?.name?.[0] || "?"}
               </div>
               <p className="text-xl animate-pulse">
                   {callAccepted ? "Connecting..." : (isCalling ? "Calling..." : `${call?.from?.name} is calling...`)}
               </p>
           </div>
        )}

        {/* Ma Vidéo (PiP) - Ne s'affiche que si j'ai activé la caméra */}
        {stream && camOn && (
            <div className="absolute bottom-4 right-4 w-32 md:w-48 aspect-video bg-black rounded-lg border-2 border-white/20 overflow-hidden shadow-lg">
                <video playsInline muted ref={myVideo} autoPlay className="w-full h-full object-cover" />
            </div>
        )}
      </div>

      {/* Barre de contrôle */}
      <div className="mt-6 flex gap-4">
        {call?.isReceivingCall && !callAccepted ? (
          <>
             <button onClick={answerCall} className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-full font-bold shadow-lg transform transition hover:scale-105">
                Answer Call
             </button>
             <button onClick={leaveCall} className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-full font-bold shadow-lg">
                Decline
             </button>
          </>
        ) : (
          <>
            <button onClick={toggleMic} className={`p-4 rounded-full ${micOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500'} text-white transition`}>
                {micOn ? <Mic /> : <MicOff />}
            </button>
            
            {/* Le bouton caméra change d'aspect si pas de vidéo dispo */}
            <button onClick={toggleCam} className={`p-4 rounded-full ${camOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500'} text-white transition`}>
                {camOn ? <Video /> : <VideoOff />}
            </button>
            
            <button onClick={leaveCall} className="bg-red-600 hover:bg-red-700 text-white p-4 px-8 rounded-full font-bold shadow-lg flex items-center gap-2">
                <PhoneOff /> End Call
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VideoCallModal;