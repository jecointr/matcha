import { createContext, useState, useRef, useEffect, useContext } from 'react';
import Peer from 'simple-peer';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const CallContext = createContext();

export const useCall = () => useContext(CallContext);

export const CallProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  const [call, setCall] = useState(null); // { isReceivingCall, from, signal }
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [stream, setStream] = useState(null);
  const [isCalling, setIsCalling] = useState(false);
  
  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();

  // Écouter les appels entrants
  useEffect(() => {
    if (!socket) return;

    // LOG DE DEBUG : Vérifier que l'écouteur est actif
    console.log(`🎧 CallContext: Socket prêt, écoute des appels entrants pour user ${user?.id}...`);

    socket.on("call:incoming", ({ from, signal }) => {
      console.log("📞 DEBUG FRONTEND: Appel entrant REÇU de", from); // <--- LOG IMPORTANT
      setCall({ isReceivingCall: true, from, signal });
    });

    socket.on("call:ended", () => {
        console.log("📞 DEBUG FRONTEND: Appel terminé reçu via socket");
        leaveCall(false); 
    });

    return () => {
        socket.off("call:incoming");
        socket.off("call:ended");
    };
  }, [socket, user]);

  // Initialiser la caméra/micro
  const startStream = async (videoEnabled = true) => {
      try {
          const currentStream = await navigator.mediaDevices.getUserMedia({ 
              video: videoEnabled, 
              audio: true 
          });
          setStream(currentStream);
          if (myVideo.current) myVideo.current.srcObject = currentStream;
          return currentStream;
      } catch (err) {
          console.error("Media Error:", err);
          alert("Impossible d'accéder aux périphériques.");
          return null;
      }
  };

  const callUser = async (idToCall, isVideoCall = true) => {
    setIsCalling(true);
    
    // On demande le stream avec ou sans vidéo selon le bouton cliqué
    const currentStream = await startStream(isVideoCall);
    
    if (!currentStream) return;

    const peer = new Peer({ initiator: true, trickl: false, stream: currentStream });

    peer.on("signal", (data) => {
      console.log(`🚀 DEBUG FRONTEND: Envoi du signal d'appel vers ${idToCall}`); // <--- LOG IMPORTANT
      socket.emit("call:user", {
        userToCall: idToCall,
        signalData: data,
        fromUser: { id: user.id, name: user.firstName, picture: user.profilePicture },
        callType: isVideoCall ? 'video' : 'audio'
      });
    });

    peer.on("stream", (remoteStream) => {
      if (userVideo.current) userVideo.current.srcObject = remoteStream;
    });

    socket.on("call:accepted", (signal) => {
      setCallAccepted(true);
      peer.signal(signal);
    });

    connectionRef.current = peer;
  };

  const answerCall = async () => {
    setCallAccepted(true);
    const currentStream = await startStream();
    if (!currentStream) return;

    // initiator: false signifie "je réponds"
    const peer = new Peer({ initiator: false, trickl: false, stream: currentStream });

    peer.on("signal", (data) => {
      socket.emit("call:answer", { signal: data, to: call.from.id });
    });

    peer.on("stream", (remoteStream) => {
      if (userVideo.current) userVideo.current.srcObject = remoteStream;
    });

    peer.signal(call.signal);
    connectionRef.current = peer;
  };

  const leaveCall = (emitEvent = true) => {
    setCallEnded(true);
    
    // Si on est à l'origine de la fin de l'appel, on prévient l'autre
    if (emitEvent && socket && (call?.from?.id || isCalling)) {
         // Note: Dans une app complexe, on stockerait l'ID de l'autre participant plus précisément
         // Ici on simplifie en supposant que l'UI gère l'ID
    }

    if (connectionRef.current) connectionRef.current.destroy();
    if (stream) stream.getTracks().forEach(track => track.stop());
    
    setCall(null);
    setStream(null);
    setIsCalling(false);
    setCallAccepted(false);
    
    // Petit reload pour nettoyer proprement les contextes Peer parfois capricieux
    // window.location.reload(); // Optionnel mais souvent utile en dev
  };

  return (
    <CallContext.Provider value={{
      call,
      callAccepted,
      myVideo,
      userVideo,
      stream,
      callUser,
      answerCall,
      leaveCall,
      isCalling
    }}>
      {children}
    </CallContext.Provider>
  );
};