import { useCall } from '../../context/CallContext';
import { PhoneOff, Phone, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { useState, useEffect } from 'react';
import { API_URL } from '../../config';

const getPhotoUrl = (url) => {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_URL.replace('/api', '')}${url}`;
};

const CallAvatar = ({ otherUser, status }) => (
  <div className="absolute inset-0 flex items-center justify-center text-white flex-col gap-4 z-10">
    {otherUser?.picture ? (
      <img
        src={getPhotoUrl(otherUser.picture)}
        alt={otherUser?.name || 'User'}
        className="w-28 h-28 rounded-full object-cover border-2 border-white/10 shadow-lg animate-pulse"
      />
    ) : (
      <div className="animate-pulse w-24 h-24 bg-gray-700 dark:bg-gray-800 rounded-full flex items-center justify-center text-3xl font-bold border-2 border-white/10">
        {otherUser?.name?.[0] || "?"}
      </div>
    )}
    <p className="text-xl animate-pulse font-medium">{status}</p>
  </div>
);

const VideoCallModal = () => {
  const {
    call, callAccepted, callEnded, myVideo, userVideo,
    stream, answerCall, leaveCall, isCalling, callType, otherUser
  } = useCall();

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const isVideoCall = callType === 'video';

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
        }
    }
  };

  // Status shown on the avatar
  const ringingStatus = isCalling
    ? "Calling..."
    : `${otherUser?.name || 'Someone'} is calling...`;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md">

      {/* Video container */}
      <div className="relative w-full max-w-4xl aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-white/10">

        {/* Remote video/audio: the <video> element stays mounted when the call is accepted
            (it also carries the remote audio), but it's hidden for an audio call. */}
        {callAccepted && !callEnded ? (
          <>
            <video
              playsInline
              ref={userVideo}
              autoPlay
              className={`w-full h-full object-cover ${isVideoCall ? '' : 'hidden'}`}
            />
            {!isVideoCall && <CallAvatar otherUser={otherUser} status="On call" />}
          </>
        ) : (
          <CallAvatar otherUser={otherUser} status={ringingStatus} />
        )}

        {/* My video (PiP) - video calls only */}
        {stream && isVideoCall && camOn && (
            <div className="absolute bottom-4 right-4 w-32 md:w-48 aspect-video bg-black rounded-lg border-2 border-white/20 overflow-hidden shadow-lg z-20">
                <video playsInline muted ref={myVideo} autoPlay className="w-full h-full object-cover" />
            </div>
        )}
      </div>

      {/* Control bar */}
      <div className="mt-8 flex gap-6">
        {call?.isReceivingCall && !callAccepted ? (
          <>
             <button onClick={answerCall} className="bg-green-500 hover:bg-green-600 text-white px-10 py-4 rounded-full font-bold shadow-lg transform transition hover:scale-105 cursor-pointer flex items-center gap-2">
                {isVideoCall ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />} Answer Call
             </button>
             <button onClick={() => leaveCall()} className="bg-red-500 hover:bg-red-600 text-white px-10 py-4 rounded-full font-bold shadow-lg transform transition hover:scale-105 cursor-pointer">
                Decline
             </button>
          </>
        ) : (
          <>
            <button onClick={toggleMic} className={`p-5 rounded-full transition-all cursor-pointer ${micOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-500 text-white'}`}>
                {micOn ? <Mic /> : <MicOff />}
            </button>

            {/* Camera button for video calls only */}
            {isVideoCall && (
              <button onClick={toggleCam} className={`p-5 rounded-full transition-all cursor-pointer ${camOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-500 text-white'}`}>
                  {camOn ? <Video /> : <VideoOff />}
              </button>
            )}

            <button onClick={() => leaveCall()} className="bg-red-600 hover:bg-red-700 text-white p-5 px-10 rounded-full font-bold shadow-lg flex items-center gap-2 transform transition hover:scale-105 cursor-pointer">
                <PhoneOff /> End Call
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VideoCallModal;
