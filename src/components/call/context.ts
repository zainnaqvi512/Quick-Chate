import { createContext, useContext } from "react";
export type Peer = { id: number; name: string; avatarUrl: string | null };
type CallCtx = {
  startCall: (peer: Peer, type: "voice" | "video", conversationId?: number) => void;
};

export const Ctx = createContext<CallCtx>({ startCall: () => {} });
export const useCall = () => useContext(Ctx);
