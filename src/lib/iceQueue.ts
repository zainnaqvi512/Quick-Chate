/** Candidates may arrive before the answer. Preserve order until SDP is installed. */
type Candidate = {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
};
type PeerConnection = {
  remoteDescription: unknown;
  signalingState: string;
  connectionState: string;
  addIceCandidate: (candidate: Candidate) => Promise<void>;
};
export class IceQueue {
  private pending: Candidate[] = [];
  private tail: Promise<void> = Promise.resolve();
  add(candidate: Candidate) {
    this.pending.push(candidate);
  }
  flush(pc: PeerConnection) {
    this.tail = this.tail
      .catch(() => {})
      .then(async () => {
        if (!pc.remoteDescription || pc.signalingState === "closed") return;
        while (this.pending.length) {
          if (pc.connectionState === "closed") return;
          await pc.addIceCandidate(this.pending.shift()!);
        }
      });
    return this.tail;
  }
}
