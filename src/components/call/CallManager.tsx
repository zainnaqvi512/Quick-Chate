import { Ctx, type Peer } from "./context";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { trpc } from "@/providers/trpc";
import type { Me } from "@/lib/auth";
import { Avatar } from "@/components/Logo";
import { formatDuration } from "@/lib/format";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";


type ActiveCall = {
  id: number;
  type: "voice" | "video";
  isCaller: boolean;
  peer: Peer;
  status: "ringing" | "ongoing" | "ended";
  conversationId?: number;
};


export function CallManager({
  me,
  children,
}: {
  me: Me;
  children: ReactNode;
}) {
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [incoming, setIncoming] = useState<{
    id: number;
    type: "voice" | "video";
    offerSdp: string | null;
    caller: Peer | null;
  } | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [netState, setNetState] = useState("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const remoteRef = useRef<HTMLMediaElement | null>(null);
  const localRef = useRef<HTMLVideoElement | null>(null);
  const lastSignalIdRef = useRef(0);
  const answeredAtRef = useRef<number | null>(null);
  const candidateQueueRef = useRef<RTCIceCandidate[]>([]);
  const callRef = useRef<ActiveCall | null>(null);
  callRef.current = call;

  const utils = trpc.useUtils();
  const startMut = trpc.calls.start.useMutation();
  const acceptMut = trpc.calls.accept.useMutation();
  const rejectMut = trpc.calls.reject.useMutation();
  const endMut = trpc.calls.end.useMutation();
  const signalMut = trpc.calls.signal.useMutation();

  // Poll for incoming calls
  const incomingQuery = trpc.calls.incoming.useQuery(undefined, {
    refetchInterval: 3000,
    enabled: !call,
  });
  useEffect(() => {
    const inc = incomingQuery.data;
    if (inc && inc.caller && (!incoming || incoming.id !== inc.id)) {
      setIncoming({ id: inc.id, type: inc.type, offerSdp: inc.offerSdp, caller: inc.caller });
    }
  }, [incomingQuery.data, incoming]);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    lastSignalIdRef.current = 0;
    answeredAtRef.current = null;
    setCall(null);
    setIncoming(null);
    setMuted(false);
    setCameraOff(false);
    setDuration(0);
    setNetState("");
    candidateQueueRef.current = [];
    utils.calls.history.invalidate();
  }, [utils]);

  async function setupPc(callId: number | null, stream: MediaStream) {
    const config = await utils.calls.iceConfig.fetch();
    const pc = new RTCPeerConnection({iceServers:config.iceServers});
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const id = callId ?? callRef.current?.id ?? null;
      if (id) signalMut.mutate({ callId: id, kind: "candidate", payload: JSON.stringify(e.candidate.toJSON()) });
      else candidateQueueRef.current.push(e.candidate);
    };
    pc.ontrack = (e) => {
      if (remoteRef.current) {
        remoteRef.current.srcObject = e.streams[0];
        remoteRef.current.play().catch(() => {});
      }
    };
    pc.onconnectionstatechange = () => {
      setNetState(pc.connectionState);
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        // stay; ICE may recover
      }
    };
    pcRef.current = pc;
    return pc;
  }

  async function getMedia(video: boolean) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: video ? { width: 640, height: 480 } : false,
    });
    streamRef.current = stream;
    if (localRef.current && video) {
      localRef.current.srcObject = stream;
      localRef.current.play().catch(() => {});
    }
    return stream;
  }

  const startCall = async (peer: Peer, type: "voice" | "video", conversationId?: number) => {
      try {
        if (!conversationId) throw new Error('Open a direct conversation before calling.');
        const stream = await getMedia(type === "video");
        const pc = await setupPc(null, stream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        // wait briefly for initial ICE gathering so early candidates are included
        await new Promise((r) => setTimeout(r, 400));
        const res = await startMut.mutateAsync({
          calleeId: peer.id,
          type,
          offerSdp: JSON.stringify(pc.localDescription),
          conversationId,
        });
        setCall({ id: res.id, type, isCaller: true, peer, status: "ringing", conversationId });
        // flush queued candidates now that we have the call id
        for (const c of candidateQueueRef.current) {
          signalMut.mutate({ callId: res.id, kind: "candidate", payload: JSON.stringify(c.toJSON()) });
        }
        candidateQueueRef.current = [];
      } catch (e) {
        alert(e instanceof Error ? e.message : "Could not start call (check microphone/camera permissions)");
        cleanup();
      }
    };

  // Caller: poll for answer / status
  const callStateQuery = trpc.calls.get.useQuery(
    { id: call?.id ?? 0 },
    { enabled: !!call, refetchInterval: 1500 },
  );
  useEffect(() => {
    const data = callStateQuery.data;
    const c = callRef.current;
    if (!data || !c) return;
    if (data.status === "ongoing" && c.status !== "ongoing") {
      answeredAtRef.current = Date.now();
      setCall({ ...c, status: "ongoing" });
      if (c.isCaller && data.answerSdp && pcRef.current) {
        pcRef.current.setRemoteDescription(JSON.parse(data.answerSdp)).catch(() => {});
      }
    }
    if ((data.status === "ended" || data.status === "rejected" || data.status === "missed") && c.status !== "ended") {
      cleanup();
    }
  }, [callStateQuery.data, cleanup]);

  // Both: poll ICE signals
  const signalsQuery = trpc.calls.signals.useQuery(
    { callId: call?.id ?? 0, afterId: lastSignalIdRef.current },
    { enabled: !!call, refetchInterval: 1500 },
  );
  useEffect(() => {
    const sigs = signalsQuery.data;
    if (!sigs || sigs.length === 0 || !pcRef.current) return;
    for (const s of sigs) {
      lastSignalIdRef.current = Math.max(lastSignalIdRef.current, s.id);
      if (s.kind === "candidate") {
        pcRef.current.addIceCandidate(JSON.parse(s.payload)).catch(() => {});
      }
    }
  }, [signalsQuery.data]);

  // Duration ticker
  useEffect(() => {
    if (call?.status !== "ongoing") return;
    const t = setInterval(() => {
      if (answeredAtRef.current) setDuration(Math.floor((Date.now() - answeredAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [call?.status]);

  async function acceptIncoming() {
    if (!incoming || !incoming.caller || !incoming.offerSdp) return;
    try {
      const stream = await getMedia(incoming.type === "video");
      const pc = await setupPc(incoming.id, stream);
      await pc.setRemoteDescription(JSON.parse(incoming.offerSdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await acceptMut.mutateAsync({ id: incoming.id, answerSdp: JSON.stringify(pc.localDescription) });
      answeredAtRef.current = Date.now();
      setCall({ id: incoming.id, type: incoming.type, isCaller: false, peer: incoming.caller, status: "ongoing" });
      setIncoming(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not accept call");
      setIncoming(null);
    }
  }

  async function rejectIncoming() {
    if (!incoming) return;
    await rejectMut.mutateAsync({ id: incoming.id });
    setIncoming(null);
  }

  async function hangUp() {
    if (callRef.current) await endMut.mutateAsync({ id: callRef.current.id }).catch(() => {});
    cleanup();
  }

  function toggleMute() {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted(!muted);
  }
  function toggleCamera() {
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = cameraOff));
    setCameraOff(!cameraOff);
  }

  void me;

  return (
    <Ctx.Provider value={{ startCall }}>
      {children}
      {/* Incoming call overlay */}
      {incoming && incoming.caller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90">
          <div className="flex flex-col items-center gap-4 text-white p-8">
            <Avatar name={incoming.caller.name} url={incoming.caller.avatarUrl} size={96} />
            <h2 className="text-xl font-semibold">{incoming.caller.name}</h2>
            <p className="text-sm text-sky-300 animate-pulse">
              Incoming {incoming.type} call…
            </p>
            <div className="flex gap-8 mt-6">
              <button
                onClick={rejectIncoming}
                aria-label="Reject call"
                className="h-14 w-14 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600"
              >
                <PhoneOff className="h-6 w-6" />
              </button>
              <button
                onClick={acceptIncoming}
                aria-label="Accept call"
                className="h-14 w-14 rounded-full bg-emerald-500 flex items-center justify-center hover:bg-emerald-600 animate-bounce"
              >
                {incoming.type === "video" ? <Video className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active call overlay */}
      {call && (
        <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
          {call.type === "video" && (
            <video ref={(element) => { remoteRef.current = element; }} className="absolute inset-0 w-full h-full object-cover" playsInline autoPlay />
          )}
          {call.type === "voice" && <audio ref={(element) => { remoteRef.current = element; }} autoPlay />}
          <div className="relative flex-1 flex flex-col items-center justify-center gap-3 text-white">
            {call.type === "voice" && (
              <>
                <Avatar name={call.peer.name} url={call.peer.avatarUrl} size={96} />
                <h2 className="text-xl font-semibold">{call.peer.name}</h2>
              </>
            )}
            {call.type === "video" && (
              <h2 className="absolute top-6 text-lg font-semibold drop-shadow">{call.peer.name}</h2>
            )}
            <p className="text-sm text-sky-300">
              {call.status === "ringing"
                ? call.isCaller
                  ? "Ringing…"
                  : "Connecting…"
                : netState === "connected" || !netState
                  ? formatDuration(duration)
                  : netState}
            </p>
          </div>
          {call.type === "video" && (
            <video
              ref={localRef}
              muted
              playsInline
              autoPlay
              className="absolute bottom-24 right-4 w-28 h-40 object-cover rounded-xl border-2 border-white/30 bg-slate-800"
            />
          )}
          <div className="relative pb-10 flex items-center justify-center gap-6">
            <button
              onClick={toggleMute}
              aria-label={muted ? "Unmute" : "Mute"}
              className={`h-12 w-12 rounded-full flex items-center justify-center ${muted ? "bg-white text-slate-900" : "bg-white/20 text-white"}`}
            >
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button
              onClick={hangUp}
              aria-label="End call"
              className="h-16 w-16 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
            >
              <PhoneOff className="h-7 w-7" />
            </button>
            {call.type === "video" && (
              <button
                onClick={toggleCamera}
                aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}
                className={`h-12 w-12 rounded-full flex items-center justify-center ${cameraOff ? "bg-white text-slate-900" : "bg-white/20 text-white"}`}
              >
                {cameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
