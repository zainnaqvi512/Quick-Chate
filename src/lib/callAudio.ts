import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";

export type AudioRoute = "speaker" | "earpiece" | "system";
export type AudioState = {
  route: AudioRoute;
  proximity: boolean;
  earpiece: boolean;
};
interface CallAudioPlugin {
  start(options: { video: boolean }): Promise<AudioState>;
  route(options: { route: AudioRoute }): Promise<AudioState>;
  stop(): Promise<void>;
  addListener(
    event: "routeChanged",
    listener: (state: AudioState) => void
  ): Promise<PluginListenerHandle>;
}
export const nativeCallAudio =
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("CallAudio");
export const callAudio = registerPlugin<CallAudioPlugin>("CallAudio");
