import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

export function NativeBack() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = App.addListener("backButton", () => {
      if (window.history.state?.idx > 0) window.history.back();
      // Stay on the root screen. Closing is left to the OS home/app switcher.
    });
    return () => {
      void listener.then(handle => handle.remove());
    };
  }, []);
  return null;
}
