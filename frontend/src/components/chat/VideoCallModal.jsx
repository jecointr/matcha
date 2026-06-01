import { useCall } from '../../context/CallContext';
import { PhoneOff, Phone, PhoneIncoming, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import { startRingback, startRingtone } from '../../utils/callSounds';

const getPhotoUrl = (url) => {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_URL.replace('/api', '')}${url}`;
};

const Avatar = ({ otherUser, size = 'w-28 h-28', pulse = true }) =>
  otherUser?.picture ? (
    <img
      src={getPhotoUrl(otherUser.picture)}
      alt={otherUser?.name || 'User'}
      className={`${size} rounded-full object-cover border-2 border-white/10 shadow-lg ${pulse ? 'animate-pulse' : ''}`}
    />
  ) : (
    <div className={`${size} bg-gray-700 rounded-full flex items-center justify-center text-3xl font-bold border-2 border-white/10 ${pulse ? 'animate-pulse' : ''}`}>
      {otherUser?.name?.[0] || '?'}
    </div>
  );

const CallAvatar = ({ otherUser, status }) => (
  <div className="absolute inset-0 flex items-center justify-center text-white flex-col gap-4 z-10">
    <Avatar otherUser={otherUser} />
    <p className="text-xl animate-pulse font-medium">{status}</p>
  </div>
);

const VideoCallModal = () => {
  const {
    call, callAccepted, callEnded, myVideo, userVideo,
    stream, remoteStream, answerCall, leaveCall, isCalling, callType, otherUser
  } = useCall();

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const isVideoCall = callType === 'video';
  const isIncomingRinging = call?.isReceivingCall && !callAccepted;

  // Bind the local stream to the PiP <video> whenever either becomes available.
  // The element is mounted conditionally, so imperative binding at capture time
  // would race the render — an effect re-runs once the element exists.
  useEffect(() => {
    if (myVideo.current && stream) myVideo.current.srcObject = stream;
  }, [stream, isVideoCall, camOn, myVideo]);

  // Bind the remote stream (carries the remote audio too, even for audio calls).
  useEffect(() => {
    if (userVideo.current && remoteStream) {
      userVideo.current.srcObject = remoteStream;
      userVideo.current.play?.().catch(() => {});
    }
  }, [remoteStream, callAccepted, callEnded, userVideo]);

  // Outgoing ringback while the caller waits for an answer.
  useEffect(() => {
    if (isCalling && !callAccepted) return startRingback();
  }, [isCalling, callAccepted]);

  // Incoming ringtone while a call is being received and not yet answered.
  useEffect(() => {
    if (isIncomingRinging) return startRingtone();
  }, [isIncomingRinging]);

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

  // --- Incoming-call screen: a clean, focused card with a pulsing avatar ---
  if (isIncomingRinging) {
    return (
      <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 backdrop-blur-md">
        <div className="flex flex-col items-center text-white text-center max-w-sm w-full">
          {/* Pulsing rings around the caller's avatar */}
          <div className="relative flex items-center justify-center mb-8">
            <span className="absolute w-44 h-44 rounded-full bg-primary-500/20 animate-ping" />
            <span className="absolute w-36 h-36 rounded-full bg-primary-500/10 animate-pulse" />
            <Avatar otherUser={otherUser} size="w-32 h-32" pulse={false} />
          </div>

          <p className="flex items-center gap-2 text-sm uppercase tracking-wide text-primary-300 mb-1">
            {isVideoCall ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            Incoming {isVideoCall ? 'video' : 'audio'} call
          </p>
          <h2 className="text-3xl font-bold mb-10">{otherUser?.name || 'Someone'}</h2>

          <div className="flex items-center justify-center gap-16">
            {/* Decline */}
            <button onClick={() => leaveCall()} className="flex flex-col items-center gap-2 group cursor-pointer">
              <span className="bg-red-500 group-hover:bg-red-600 text-white p-5 rounded-full shadow-lg transition transform group-hover:scale-105">
                <PhoneOff className="w-7 h-7" />
              </span>
              <span className="text-sm text-gray-300">Decline</span>
            </button>

            {/* Answer */}
            <button onClick={answerCall} className="flex flex-col items-center gap-2 group cursor-pointer">
              <span className="bg-green-500 group-hover:bg-green-600 text-white p-5 rounded-full shadow-lg transition transform group-hover:scale-105 animate-bounce">
                <PhoneIncoming className="w-7 h-7" />
              </span>
              <span className="text-sm text-gray-300">Answer</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Status shown on the avatar (outgoing ringing / in-call audio placeholder).
  const ringingStatus = isCalling ? 'Calling…' : `${otherUser?.name || 'Someone'} is calling…`;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md">

      {/* Video container */}
      <div className="relative w-full max-w-4xl aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-white/10">

        {/* Remote video/audio: the <video> stays mounted once the call is accepted
            (it also carries the remote audio); it's hidden for an audio call. */}
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
      </div>
    </div>
  );
};

export default VideoCallModal;
