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
import {
  callAudio,
  nativeCallAudio,
  type AudioState,
  type AudioRoute,
} from "@/lib/callAudio";
import { IceQueue } from "@/lib/iceQueue";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
  Headphones,
  SwitchCamera,
  ChevronDown,
  Pause,
  Play,
  MonitorUp,
} from "lucide-react";

type ActiveCall = {
  id: number;
  type: "voice" | "video";
  isCaller: boolean;
  peer: Peer;
  status: "ringing" | "ongoing";
  conversationId?: number;
};
type Incoming = {
  id: number;
  type: "voice" | "video";
  offerSdp: string | null;
  caller: Peer | null;
};
function Control({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
  danger = false,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-center gap-2 disabled:opacity-35"
    >
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-full transition ${danger ? "bg-red-500 text-white" : active ? "bg-white text-blue-950" : "bg-white/15 text-white hover:bg-white/25"}`}
      >
        {children}
      </span>
      <span className="text-xs">{label}</span>
    </button>
  );
}

export function CallManager({ children }: { me: Me; children: ReactNode }) {
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [held, setHeld] = useState(false);
  const [peerHeld, setPeerHeld] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [netState, setNetState] = useState("connecting");
  const [notice, setNotice] = useState("");
  const [audio, setAudio] = useState<AudioState>({
    route: "system",
    proximity: false,
    earpiece: false,
  });
  const [routeMenu, setRouteMenu] = useState(false);
  const [afterId, setAfterId] = useState(0);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);
  const shareStream = useRef<MediaStream | null>(null);
  const remoteRef = useRef<HTMLMediaElement | null>(null);
  const localRef = useRef<HTMLVideoElement | null>(null);
  const callRef = useRef<ActiveCall | null>(null);
  const busyRef = useRef(false);
  const generation = useRef(0);
  const outgoing = useRef<RTCIceCandidate[]>([]);
  const ice = useRef(new IceQueue());
  const appliedAnswer = useRef(false);
  const connectedAt = useRef<number | null>(null);
  const facing = useRef<"user" | "environment">("user");
  const preferences = useRef({ muted: false, cameraOff: false, held: false });
  const signalCursor = useRef(0);
  const dismissedIncoming = useRef(0);
  const utils = trpc.useUtils();
  const startMut = trpc.calls.start.useMutation();
  const acceptMut = trpc.calls.accept.useMutation();
  const rejectMut = trpc.calls.reject.useMutation();
  const endMut = trpc.calls.end.useMutation();
  const endCall = endMut.mutate;
  const signalMut = trpc.calls.signal.useMutation();

  const releaseMedia = useCallback(() => {
    if (callRef.current)
      dismissedIncoming.current = Math.max(
        dismissedIncoming.current,
        callRef.current.id
      );
    generation.current++;
    pcRef.current?.close();
    pcRef.current = null;
    for (const stream of [
      streamRef.current,
      remoteStream.current,
      shareStream.current,
    ])
      stream?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    remoteStream.current = null;
    shareStream.current = null;
    if (remoteRef.current) remoteRef.current.srcObject = null;
    if (localRef.current) localRef.current.srcObject = null;
    if (nativeCallAudio) void callAudio.stop().catch(() => {});
    busyRef.current = false;
    callRef.current = null;
    outgoing.current = [];
    ice.current = new IceQueue();
    appliedAnswer.current = false;
    connectedAt.current = null;
    signalCursor.current = 0;
    preferences.current = { muted: false, cameraOff: false, held: false };
  }, []);
  const cleanup = useCallback(() => {
    releaseMedia();
    setCall(null);
    setIncoming(null);
    setBusy(false);
    setMuted(false);
    setCameraOff(false);
    setHeld(false);
    setPeerHeld(false);
    setMinimized(false);
    setSharing(false);
    setDuration(0);
    setNetState("connecting");
    setAfterId(0);
    setRouteMenu(false);
    void utils.calls.history.invalidate();
    void utils.calls.incoming.invalidate();
  }, [releaseMedia, utils]);
  useEffect(() => () => releaseMedia(), [releaseMedia]);
  useEffect(() => {
    if (!nativeCallAudio) return;
    const listener = callAudio.addListener("routeChanged", setAudio);
    return () => {
      void listener.then(l => l.remove()).catch(() => {});
    };
  }, []);
  function updateCall(c: ActiveCall) {
    callRef.current = c;
    setCall(c);
  }
  function lock() {
    if (busyRef.current || callRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setNotice("");
    return true;
  }
  function checkGeneration(value: number) {
    if (value !== generation.current) throw new Error("Call cancelled");
  }

  const incomingQuery = trpc.calls.incoming.useQuery(undefined, {
    refetchInterval: 2000,
    enabled: !call && !busy,
  });
  useEffect(() => {
    if (!call && !busy && incomingQuery.isSuccess)
      setIncoming(
        incomingQuery.data?.caller &&
          incomingQuery.data.id > dismissedIncoming.current
          ? incomingQuery.data
          : null
      );
  }, [incomingQuery.data, incomingQuery.isSuccess, call, busy]);

  async function getMedia(video: boolean, epoch: number) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: video ? { width: 640, height: 480, facingMode: "user" } : false,
    });
    if (epoch !== generation.current) {
      stream.getTracks().forEach(t => t.stop());
      throw new Error("Call cancelled");
    }
    streamRef.current = stream;
    if (nativeCallAudio) {
      try {
        setAudio(await callAudio.start({ video }));
      } catch {
        setNotice(
          "Phone audio controls are unavailable. The system audio route is in use."
        );
      }
    }
    checkGeneration(epoch);
    return stream;
  }
  async function setupPc(stream: MediaStream, epoch: number) {
    const config = await utils.calls.iceConfig.fetch();
    checkGeneration(epoch);
    if (!config.relayConfigured)
      setNotice(
        "Relay service is not configured. Calls across some networks may fail."
      );
    const pc = new RTCPeerConnection({ iceServers: config.iceServers });
    pcRef.current = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    pc.onicecandidate = e => {
      if (!e.candidate || epoch !== generation.current) return;
      if (callRef.current)
        signalMut.mutate({
          callId: callRef.current.id,
          kind: "candidate",
          payload: JSON.stringify(e.candidate.toJSON()),
        });
      else outgoing.current.push(e.candidate);
    };
    pc.ontrack = e => {
      if (epoch !== generation.current) return;
      remoteStream.current = e.streams[0] || new MediaStream([e.track]);
      if (remoteRef.current) {
        remoteRef.current.srcObject = remoteStream.current;
        void remoteRef.current
          .play()
          .catch(() => setNotice("Tap the call screen to enable audio."));
      }
    };
    pc.onconnectionstatechange = () => {
      if (epoch !== generation.current) return;
      setNetState(pc.connectionState);
      if (pc.connectionState === "connected" && !connectedAt.current)
        connectedAt.current = Date.now();
      if (pc.connectionState === "failed")
        setNotice("Connection failed. End the call and try again.");
    };
    return pc;
  }
  function flushOutgoing(id: number) {
    for (const candidate of outgoing.current)
      signalMut.mutate({
        callId: id,
        kind: "candidate",
        payload: JSON.stringify(candidate.toJSON()),
      });
    outgoing.current = [];
  }
  async function startCall(
    peer: Peer,
    type: "voice" | "video",
    conversationId?: number
  ) {
    if (incoming || !lock()) return;
    const epoch = generation.current;
    try {
      if (!conversationId)
        throw new Error("Open a direct conversation before calling.");
      const stream = await getMedia(type === "video", epoch);
      const pc = await setupPc(stream, epoch);
      await pc.setLocalDescription(await pc.createOffer());
      checkGeneration(epoch);
      const result = await startMut.mutateAsync({
        calleeId: peer.id,
        type,
        offerSdp: JSON.stringify(pc.localDescription),
        conversationId,
      });
      if (epoch !== generation.current) {
        endMut.mutate({ id: result.id });
        return;
      }
      updateCall({
        id: result.id,
        type,
        isCaller: true,
        peer,
        status: "ringing",
        conversationId,
      });
      flushOutgoing(result.id);
    } catch (e) {
      if (epoch === generation.current) {
        cleanup();
        setNotice(e instanceof Error ? e.message : "Could not start call.");
      }
    } finally {
      if (epoch === generation.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }
  const callState = trpc.calls.get.useQuery(
    { id: call?.id ?? 0 },
    { enabled: !!call, refetchInterval: 1000 }
  );
  useEffect(() => {
    const data = callState.data,
      c = callRef.current,
      pc = pcRef.current;
    if (!data || !c || data.id !== c.id || !pc) return;
    if (["ended", "rejected", "missed"].includes(data.status)) {
      cleanup();
      return;
    }
    if (data.status === "ongoing") {
      if (c.status !== "ongoing") {
        callRef.current = { ...c, status: "ongoing" };
        setCall(callRef.current);
      }
      if (c.isCaller && data.answerSdp && !appliedAnswer.current) {
        appliedAnswer.current = true;
        const queue = ice.current;
        void pc
          .setRemoteDescription(JSON.parse(data.answerSdp))
          .then(() => queue.flush(pc))
          .catch(() =>
            setNotice(
              "Could not establish the call. Please end it and try again."
            )
          );
      }
    }
  }, [callState.data, cleanup]);
  const signals = trpc.calls.signals.useQuery(
    { callId: call?.id ?? 0, afterId },
    { enabled: !!call, refetchInterval: 1000 }
  );
  useEffect(() => {
    const pc = pcRef.current;
    if (!signals.data || !pc) return;
    for (const s of signals.data) {
      if (s.id <= signalCursor.current) continue;
      signalCursor.current = s.id;
      try {
        if (s.kind === "candidate") ice.current.add(JSON.parse(s.payload));
        if (s.kind === "control")
          setPeerHeld(Boolean(JSON.parse(s.payload).held));
      } catch {
        setNotice("A call update could not be read.");
      }
    }
    setAfterId(signalCursor.current);
    void ice.current
      .flush(pc)
      .catch(() =>
        setNotice("A connection candidate failed; checking other routes.")
      );
  }, [signals.data]);
  useEffect(() => {
    if (!call) return;
    const timer = setInterval(() => {
      if (connectedAt.current)
        setDuration(Math.floor((Date.now() - connectedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [call]);
  useEffect(() => {
    if (!call || call.status !== "ringing") return;
    const timer = setTimeout(() => {
      endCall({ id: call.id });
      cleanup();
      setNotice("No answer.");
    }, 60000);
    return () => clearTimeout(timer);
  }, [call, cleanup, endCall]);
  async function acceptIncoming() {
    const inc = incoming;
    if (!inc?.caller || !inc.offerSdp || !lock()) return;
    const epoch = generation.current;
    try {
      const stream = await getMedia(inc.type === "video", epoch);
      const pc = await setupPc(stream, epoch);
      await pc.setRemoteDescription(JSON.parse(inc.offerSdp));
      await pc.setLocalDescription(await pc.createAnswer());
      await acceptMut.mutateAsync({
        id: inc.id,
        answerSdp: JSON.stringify(pc.localDescription),
      });
      if (epoch !== generation.current) {
        endMut.mutate({ id: inc.id });
        return;
      }
      updateCall({
        id: inc.id,
        type: inc.type,
        isCaller: false,
        peer: inc.caller,
        status: "ongoing",
      });
      setIncoming(null);
      flushOutgoing(inc.id);
    } catch (e) {
      if (epoch === generation.current) {
        cleanup();
        setNotice(e instanceof Error ? e.message : "Could not accept call.");
      }
    } finally {
      if (epoch === generation.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }
  function hangUp() {
    const id = callRef.current?.id;
    cleanup();
    if (id)
      endMut.mutate(
        { id },
        {
          onError: () =>
            setNotice(
              "Call ended on this device. The server could not be reached."
            ),
        }
      );
  }
  function applyPreferences() {
    const p = preferences.current;
    streamRef.current
      ?.getAudioTracks()
      .forEach(t => (t.enabled = !p.muted && !p.held));
    streamRef.current
      ?.getVideoTracks()
      .forEach(t => (t.enabled = !p.cameraOff && !p.held));
    shareStream.current
      ?.getVideoTracks()
      .forEach(t => (t.enabled = !p.held && !p.cameraOff));
    if (remoteRef.current) remoteRef.current.muted = p.held;
  }
  function toggleMute() {
    preferences.current.muted = !preferences.current.muted;
    setMuted(preferences.current.muted);
    applyPreferences();
  }
  function toggleCamera() {
    preferences.current.cameraOff = !preferences.current.cameraOff;
    setCameraOff(preferences.current.cameraOff);
    applyPreferences();
  }
  function toggleHold() {
    const c = callRef.current;
    if (!c) return;
    preferences.current.held = !preferences.current.held;
    setHeld(preferences.current.held);
    applyPreferences();
    signalMut.mutate(
      {
        callId: c.id,
        kind: "control",
        payload: JSON.stringify({ held: preferences.current.held }),
      },
      {
        onError: () =>
          setNotice("Call paused locally. Could not notify the other person."),
      }
    );
  }
  async function route(value: AudioRoute) {
    try {
      setAudio(await callAudio.route({ route: value }));
      setRouteMenu(false);
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "This audio route is unavailable."
      );
    }
  }
  async function browserOutput() {
    const devices = navigator.mediaDevices as MediaDevices & {
      selectAudioOutput?: () => Promise<MediaDeviceInfo>;
    };
    const element = remoteRef.current as HTMLMediaElement & {
      setSinkId?: (id: string) => Promise<void>;
    };
    if (!devices.selectAudioOutput || !element?.setSinkId) {
      setNotice(
        "Choose audio output in your device settings. Earpiece switching and proximity require the installed mobile app."
      );
      return;
    }
    try {
      const device = await devices.selectAudioOutput();
      await element.setSinkId(device.deviceId);
    } catch {
      setNotice("Audio output was not changed.");
    }
  }
  async function flipCamera() {
    if (busyRef.current || sharing) return;
    busyRef.current = true;
    setBusy(true);
    const epoch = generation.current;
    let next: MediaStream | null = null;
    try {
      const target = facing.current === "user" ? "environment" : "user";
      next = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { exact: target }, width: 640, height: 480 },
      });
      checkGeneration(epoch);
      const track = next.getVideoTracks()[0],
        old = streamRef.current?.getVideoTracks()[0];
      const sender = pcRef.current
        ?.getSenders()
        .find(s => s.track?.kind === "video");
      if (!sender || !streamRef.current) throw new Error("Camera unavailable");
      track.enabled =
        !preferences.current.cameraOff && !preferences.current.held;
      await sender.replaceTrack(track);
      checkGeneration(epoch);
      if (old) {
        streamRef.current.removeTrack(old);
        old.stop();
      }
      streamRef.current.addTrack(track);
      facing.current = target;
      if (localRef.current)
        localRef.current.srcObject = new MediaStream([track]);
      next = null;
    } catch {
      next?.getTracks().forEach(t => t.stop());
      if (epoch === generation.current)
        setNotice("The other camera is unavailable on this device.");
    } finally {
      if (epoch === generation.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }
  async function stopSharing() {
    const sender = pcRef.current
      ?.getSenders()
      .find(s => s.track?.kind === "video");
    const camera = streamRef.current?.getVideoTracks()[0];
    try {
      if (sender && camera) await sender.replaceTrack(camera);
    } catch {
      setNotice("Camera could not be restored. End the call and try again.");
    }
    shareStream.current?.getTracks().forEach(t => t.stop());
    shareStream.current = null;
    setSharing(false);
  }
  async function shareScreen() {
    if (busyRef.current) return;
    if (sharing) {
      await stopSharing();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    const epoch = generation.current;
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      checkGeneration(epoch);
      const sender = pcRef.current
        ?.getSenders()
        .find(s => s.track?.kind === "video");
      if (!sender) throw new Error("Start a video call to share your screen.");
      const track = stream.getVideoTracks()[0];
      track.enabled =
        !preferences.current.held && !preferences.current.cameraOff;
      await sender.replaceTrack(track);
      checkGeneration(epoch);
      shareStream.current = stream;
      setSharing(true);
      track.onended = () => void stopSharing();
    } catch {
      stream?.getTracks().forEach(t => t.stop());
      if (epoch === generation.current)
        setNotice("Screen sharing was cancelled or is unavailable.");
    } finally {
      if (epoch === generation.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }
  const attachRemote = useCallback((element: HTMLMediaElement | null) => {
    remoteRef.current = element;
    if (element) {
      element.srcObject = remoteStream.current;
      element.muted = preferences.current.held;
    }
  }, []);
  const attachLocal = useCallback((element: HTMLVideoElement | null) => {
    localRef.current = element;
    if (element) element.srcObject = streamRef.current;
  }, []);

  return (
    <Ctx.Provider value={{ startCall }}>
      {children}
      {notice && !call && !incoming && (
        <div
          role="status"
          className="fixed bottom-20 left-4 right-4 z-50 rounded-xl border bg-card p-4 shadow-lg"
        >
          {notice}
          <button className="ml-4 text-blue-600" onClick={() => setNotice("")}>
            Dismiss
          </button>
        </div>
      )}
      {busy && !call && !incoming && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 text-white flex flex-col gap-5 items-center justify-center">
          <p>Preparing microphone and camera…</p>
          <button onClick={cleanup}>Cancel</button>
        </div>
      )}
      {incoming?.caller && !call && (
        <div
          role="dialog"
          aria-label="Incoming call"
          className="fixed inset-0 z-50 bg-gradient-to-b from-blue-950 to-slate-950 text-white flex flex-col items-center justify-center gap-6"
        >
          <p className="text-blue-200">
            Quick Chat · Incoming {incoming.type} call
          </p>
          <Avatar
            name={incoming.caller.name}
            url={incoming.caller.avatarUrl}
            size={112}
          />
          <h2 className="text-3xl">{incoming.caller.name}</h2>
          {notice && (
            <p role="status" className="max-w-sm px-4 text-sm text-center">
              {notice}
            </p>
          )}
          <div className="flex gap-16 mt-10">
            <Control
              label="Decline"
              danger
              disabled={busy}
              onClick={() => {
                const id = incoming.id;
                setIncoming(null);
                rejectMut.mutate(
                  { id },
                  {
                    onSuccess: () => void utils.calls.incoming.invalidate(),
                    onError: () =>
                      setNotice("Could not decline the call. Try again."),
                  }
                );
              }}
            >
              <PhoneOff />
            </Control>
            <Control
              label={busy ? "Connecting…" : "Accept"}
              disabled={busy}
              onClick={() => void acceptIncoming()}
            >
              <Phone />
            </Control>
          </div>
        </div>
      )}
      {call && (
        <div
          className={
            minimized
              ? "fixed top-3 inset-x-3 z-50 rounded-2xl bg-blue-950 text-white shadow-xl"
              : "fixed inset-0 z-50 bg-gradient-to-b from-blue-950 via-slate-900 to-slate-950 text-white flex flex-col"
          }
          onClick={() => {
            void remoteRef.current?.play().catch(() => {});
          }}
        >
          {call.type === "video" ? (
            <video
              ref={attachRemote}
              playsInline
              autoPlay
              className={
                minimized
                  ? "hidden"
                  : "absolute inset-0 w-full h-full object-cover opacity-75"
              }
            />
          ) : (
            <audio ref={attachRemote} autoPlay />
          )}
          {minimized && (
            <div className="flex items-center gap-3 p-3">
              <button
                className="flex-1 text-left"
                onClick={() => setMinimized(false)}
              >
                {call.peer.name} ·{" "}
                {held
                  ? "On hold"
                  : netState === "connected"
                    ? formatDuration(duration)
                    : "Connecting…"}{" "}
                <span className="text-xs text-blue-200">Tap to return</span>
              </button>
              <button
                aria-label="End call"
                onClick={hangUp}
                className="rounded-full bg-red-500 p-3"
              >
                <PhoneOff size={20} />
              </button>
            </div>
          )}
          <div
            className={
              minimized ? "hidden" : "relative flex flex-1 min-h-0 flex-col"
            }
          >
            <header className="flex items-center justify-between px-6 pt-8">
              <button
                aria-label="Minimize call"
                onClick={() => setMinimized(true)}
                className="p-2"
              >
                <ChevronDown />
              </button>
              <p className="text-sm text-blue-200">
                Quick Chat · {call.type} call
              </p>
              <span className="w-10" />
            </header>
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-6">
              <h2 className="text-3xl font-semibold text-center">
                {call.peer.name}
              </h2>
              <p role="status" className="text-blue-200">
                {held
                  ? "On hold"
                  : peerHeld
                    ? "On hold by the other person"
                    : call.status === "ringing"
                      ? "Ringing…"
                      : netState === "connected"
                        ? formatDuration(duration)
                        : netState === "disconnected"
                          ? "Reconnecting…"
                          : netState === "failed"
                            ? "Connection failed"
                            : "Connecting…"}
              </p>
              {call.type === "voice" && (
                <div className="my-8 ring-8 ring-white/5 rounded-full">
                  <Avatar
                    name={call.peer.name}
                    url={call.peer.avatarUrl}
                    size={144}
                  />
                </div>
              )}
              {notice && (
                <p
                  role="status"
                  className="max-w-sm text-center text-xs text-amber-200"
                >
                  {notice}
                </p>
              )}
            </div>
            {call.type === "video" && (
              <video
                ref={attachLocal}
                muted
                playsInline
                autoPlay
                className="absolute top-24 right-4 w-24 h-32 object-cover rounded-xl border border-white/30 bg-slate-800"
              />
            )}
            <div className="rounded-t-3xl bg-slate-950/85 px-6 pt-6 pb-10 backdrop-blur">
              {routeMenu && (
                <div className="flex justify-center gap-3 mb-5">
                  {(["system", "earpiece", "speaker"] as const).map(value => (
                    <button
                      key={value}
                      disabled={value === "earpiece" && !audio.earpiece}
                      className="rounded-lg border border-white/20 px-3 py-2 text-sm capitalize disabled:opacity-30"
                      onClick={() => void route(value)}
                    >
                      {value === "system" ? "Headset / system" : value}
                    </button>
                  ))}
                </div>
              )}
              <div className="mx-auto grid max-w-sm grid-cols-3 gap-x-8 gap-y-6">
                <Control
                  label={
                    nativeCallAudio
                      ? audio.route === "speaker"
                        ? "Speaker"
                        : audio.route === "earpiece"
                          ? "Earpiece"
                          : "Audio output"
                      : "Audio output"
                  }
                  active={audio.route === "speaker"}
                  onClick={() =>
                    nativeCallAudio
                      ? setRouteMenu(!routeMenu)
                      : void browserOutput()
                  }
                >
                  {audio.route === "speaker" ? <Volume2 /> : <Headphones />}
                </Control>
                <Control
                  label={
                    call.type === "video"
                      ? cameraOff
                        ? "Camera on"
                        : "Camera off"
                      : "Video call"
                  }
                  disabled={call.type !== "video"}
                  active={cameraOff}
                  onClick={toggleCamera}
                >
                  {cameraOff ? <VideoOff /> : <Video />}
                </Control>
                <Control
                  label={muted ? "Unmute" : "Mute"}
                  active={muted}
                  onClick={toggleMute}
                >
                  {muted ? <MicOff /> : <Mic />}
                </Control>
                <Control
                  label={held ? "Resume" : "Hold"}
                  disabled={call.status !== "ongoing"}
                  active={held}
                  onClick={toggleHold}
                >
                  {held ? <Play /> : <Pause />}
                </Control>
                <Control
                  label="Flip camera"
                  disabled={call.type !== "video" || busy || sharing}
                  onClick={() => void flipCamera()}
                >
                  <SwitchCamera />
                </Control>
                <Control label="End" danger onClick={hangUp}>
                  <PhoneOff />
                </Control>
              </div>
              {call.type === "video" &&
                !nativeCallAudio &&
                typeof navigator.mediaDevices?.getDisplayMedia ===
                  "function" && (
                  <button
                    className="mx-auto mt-6 flex gap-2 items-center text-xs text-blue-200"
                    onClick={() => void shareScreen()}
                  >
                    <MonitorUp size={16} />
                    {sharing ? "Stop sharing screen" : "Share screen"}
                  </button>
                )}
              {call.type === "voice" && (
                <p className="mt-5 text-center text-xs text-slate-400">
                  To use video, end this call and start a video call.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
