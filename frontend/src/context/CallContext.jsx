import { createContext, useState, useRef, useEffect, useContext } from 'react';
import Peer from 'simple-peer';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { useToast } from './FeedbackContext';
import { playEndTone } from '../utils/callSounds';

const CallContext = createContext();

// How long the caller rings before giving up ("No answer").
const RING_TIMEOUT_MS = 30000;

export const useCall = () => useContext(CallContext);

export const CallProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const toast = useToast();

  const [call, setCall] = useState(null); // { isReceivingCall, from, signal }
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [stream, setStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null); // the other party's audio/video
  const [isCalling, setIsCalling] = useState(false);
  const [callType, setCallType] = useState('video'); // 'video' | 'audio'
  const [otherUser, setOtherUser] = useState(null); // { id, name, picture } of the other party

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();
  const otherIdRef = useRef(null);        // other participant id (for hang-up)
  const streamRef = useRef(null);         // stable stream ref for cleanup
  const callAcceptedRef = useRef(false);  // mirror of callAccepted for timeout/handlers
  const isCallingRef = useRef(false);     // true while we are the outgoing caller
  const ringTimeoutRef = useRef(null);    // "no answer" timeout

  // Listen for incoming calls
  useEffect(() => {
    if (!socket) return;

    socket.on("call:incoming", ({ from, signal, callType }) => {
      setCall({ isReceivingCall: true, from, signal });
      setCallType(callType || 'video');
      setOtherUser(from);
      otherIdRef.current = from?.id ?? null;
    });

    socket.on("call:ended", () => {
        // If the call never connected, show a neutral message. The caller sees the
        // SAME "No answer" whether the callee declined or simply didn't pick up — no
        // wording ever reveals an explicit rejection.
        if (!callAcceptedRef.current) {
          toast.info(isCallingRef.current ? "No answer." : "Missed call.");
        }
        leaveCall(false);
    });

    // Callee's answer: registered once (avoids a listener leak per call); relay the signal to the current peer.
    socket.on("call:accepted", (signal) => {
      setCallAccepted(true);
      callAcceptedRef.current = true;
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
      if (connectionRef.current) connectionRef.current.signal(signal);
    });

    return () => {
        socket.off("call:incoming");
        socket.off("call:ended");
        socket.off("call:accepted");
    };
  }, [socket, user]);

  // Initialize camera/mic
  const startStream = async (videoEnabled = true) => {
      try {
          const currentStream = await navigator.mediaDevices.getUserMedia({ 
              video: videoEnabled, 
              audio: true 
          });
          setStream(currentStream);
          streamRef.current = currentStream;
          // Binding to the <video> element is done in VideoCallModal via an effect:
          // the element is mounted conditionally, so it may not exist yet here.
          return currentStream;
      } catch (err) {
          console.error("Media Error:", err);
          toast.error("Could not access your camera or microphone.");
          return null;
      }
  };

  const callUser = async (idToCall, isVideoCall = true, targetUser = null) => {
    setIsCalling(true);
    setCallType(isVideoCall ? 'video' : 'audio');
    setOtherUser(targetUser); // { id, name, picture } of the callee
    otherIdRef.current = idToCall;
    isCallingRef.current = true;

    // Request the stream with or without video depending on the call type
    const currentStream = await startStream(isVideoCall);

    if (!currentStream) {
      setIsCalling(false);
      isCallingRef.current = false;
      return;
    }

    // Caller's profile picture (so the callee sees who is calling)
    const myPhoto = user?.photos?.find(p => p.is_profile_picture)?.filename;

    const peer = new Peer({ initiator: true, trickle: false, stream: currentStream });

    peer.on("signal", (data) => {
      socket.emit("call:user", {
        userToCall: idToCall,
        signalData: data,
        fromUser: { id: user.id, name: user.firstName, picture: myPhoto ? `/uploads/${myPhoto}` : null },
        callType: isVideoCall ? 'video' : 'audio'
      });
    });

    peer.on("stream", (incomingStream) => {
      setRemoteStream(incomingStream);
    });

    peer.on("error", () => {
      if (!connectionRef.current) return; // already torn down
      toast.error("Connection failed.");
      leaveCall(true);
    });

    connectionRef.current = peer;

    // Ring timeout: if the callee never answers, stop ringing.
    ringTimeoutRef.current = setTimeout(() => {
      if (!callAcceptedRef.current) {
        toast.info("No answer.");
        leaveCall(true);
      }
    }, RING_TIMEOUT_MS);
  };

  const answerCall = async () => {
    setCallAccepted(true);
    callAcceptedRef.current = true;
    // Only request the camera for video calls
    const currentStream = await startStream(callType === 'video');
    if (!currentStream) return;

    // initiator: false = we are answering
    const peer = new Peer({ initiator: false, trickle: false, stream: currentStream });

    peer.on("signal", (data) => {
      socket.emit("call:answer", { signal: data, to: call.from.id });
    });

    peer.on("stream", (incomingStream) => {
      setRemoteStream(incomingStream);
    });

    peer.on("error", () => {
      if (!connectionRef.current) return; // already torn down
      toast.error("Connection failed.");
      leaveCall(true);
    });

    peer.signal(call.signal);
    connectionRef.current = peer;
  };

  const leaveCall = (emitEvent = true) => {
    setCallEnded(true);

    // Soften the cut-off: a short end tone when a *connected* call hangs up.
    // (Non-connected cases already get a "No answer"/"Missed call" toast.)
    if (callAcceptedRef.current) {
      playEndTone();
      toast.info("Call ended.");
    }

    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }

    // If we initiated the end (hang-up or decline), tell the other participant to leave too.
    if (emitEvent && socket && otherIdRef.current) {
      socket.emit("call:end", { to: otherIdRef.current });
    }

    // Null the ref first, then destroy: a synchronous 'close'/'error' from destroy()
    // then short-circuits the peer handlers (which check connectionRef.current).
    if (connectionRef.current) {
      const peer = connectionRef.current;
      connectionRef.current = null;
      peer.destroy();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setCall(null);
    setStream(null);
    setRemoteStream(null);
    setIsCalling(false);
    setCallAccepted(false);
    setCallEnded(false);
    setOtherUser(null);
    otherIdRef.current = null;
    callAcceptedRef.current = false;
    isCallingRef.current = false;
  };

  return (
    <CallContext.Provider value={{
      call,
      callAccepted,
      myVideo,
      userVideo,
      stream,
      remoteStream,
      callUser,
      answerCall,
      leaveCall,
      isCalling,
      callType,
      callEnded,
      otherUser
    }}>
      {children}
    </CallContext.Provider>
  );
};