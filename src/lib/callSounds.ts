export const RINGTONES = ["chime", "classic", "pulse"] as const;
export type Ringtone = (typeof RINGTONES)[number];
let context: AudioContext | null = null;
export function selectedRingtone(): Ringtone {
  const value = localStorage.getItem("quickchat.ringtone");
  return RINGTONES.includes(value as Ringtone) ? (value as Ringtone) : "chime";
}
export function unlockCallAudio() {
  if (typeof AudioContext === "undefined") return;
  context ??= new AudioContext();
  void context.resume().catch(() => {});
}
export function startCallTone(kind: Ringtone | "outgoing") {
  const nodes = new Set<OscillatorNode>();
  function ring() {
    if (!context || context.state !== "running") return;
    const notes =
      kind === "outgoing"
        ? [440, 480]
        : kind === "classic"
          ? [660, 880, 660, 880]
          : kind === "pulse"
            ? [520, 520, 520]
            : [523, 659, 784];
    notes.forEach((frequency, i) => {
      const ctx = context!;
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      oscillator.frequency.value = frequency;
      const start = ctx.currentTime + i * 0.19;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.08, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      nodes.add(oscillator);
      oscillator.onended = () => {
        nodes.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    });
  }
  ring();
  const timer = window.setInterval(ring, kind === "outgoing" ? 3000 : 2200);
  return () => {
    clearInterval(timer);
    nodes.forEach(node => {
      try {
        node.stop();
      } catch {
        /* already ended */
      }
    });
    nodes.clear();
  };
}
