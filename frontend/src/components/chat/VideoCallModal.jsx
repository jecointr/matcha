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
        if (videoTracks.length > 0) {
            videoTracks[0].enabled = !camOn;
            setCamOn(!camOn);
        } else {
            alert("This is an audio-only call. Cannot enable camera.");
        }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md">
      
      {/* Container Vidéos */}
      <div className="relative w-full max-w-4xl aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-white/10">
        
        {/* Vidéo Distante */}
        {callAccepted && !call?.callEnded ? (
            <video playsInline ref={userVideo} autoPlay className="w-full h-full object-cover" />
        ) : (
            <div className="w-full h-full flex items-center justify-center text-white flex-col gap-4">
                {/* MODIF : bg-gray-800 dark:bg-gray-800 pour l'avatar */}
                <div className="animate-pulse w-24 h-24 bg-gray-700 dark:bg-gray-800 rounded-full flex items-center justify-center text-3xl font-bold border-2 border-white/10">
                  {call?.from?.name?.[0] || "?"}
                </div>
                <p className="text-xl animate-pulse font-medium">
                    {callAccepted ? "Connecting..." : (isCalling ? "Calling..." : `${call?.from?.name} is calling...`)}
                </p>
            </div>
        )}

        {/* Ma Vidéo (PiP) */}
        {stream && camOn && (
            <div className="absolute bottom-4 right-4 w-32 md:w-48 aspect-video bg-black rounded-lg border-2 border-white/20 overflow-hidden shadow-lg z-10">
                <video playsInline muted ref={myVideo} autoPlay className="w-full h-full object-cover" />
            </div>
        )}
      </div>

      {/* Barre de contrôle */}
      <div className="mt-8 flex gap-6">
        {call?.isReceivingCall && !callAccepted ? (
          <>
             <button onClick={answerCall} className="bg-green-500 hover:bg-green-600 text-white px-10 py-4 rounded-full font-bold shadow-lg transform transition hover:scale-105 cursor-pointer flex items-center gap-2">
                <Video className="w-5 h-5" /> Answer Call
             </button>
             <button onClick={leaveCall} className="bg-red-500 hover:bg-red-600 text-white px-10 py-4 rounded-full font-bold shadow-lg transform transition hover:scale-105 cursor-pointer">
                Decline
             </button>
          </>
        ) : (
          <>
            <button onClick={toggleMic} className={`p-5 rounded-full transition-all cursor-pointer ${micOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-500 text-white'}`}>
                {micOn ? <Mic /> : <MicOff />}
            </button>
            
            <button onClick={toggleCam} className={`p-5 rounded-full transition-all cursor-pointer ${camOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-500 text-white'}`}>
                {camOn ? <Video /> : <VideoOff />}
            </button>
            
            <button onClick={leaveCall} className="bg-red-600 hover:bg-red-700 text-white p-5 px-10 rounded-full font-bold shadow-lg flex items-center gap-2 transform transition hover:scale-105 cursor-pointer">
                <PhoneOff /> End Call
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VideoCallModal;