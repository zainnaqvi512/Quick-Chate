package app.quickchat.preview;

import android.content.Context;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Foreground calls only. No sensor data leaves the device. */
@CapacitorPlugin(name = "CallAudio")
public class CallAudioPlugin extends Plugin {
    private AudioManager audio;
    private PowerManager.WakeLock proximity;
    private boolean active = false;
    private boolean video = false;
    private int previousMode;
    private boolean previousSpeaker;
    private final Handler main = new Handler(Looper.getMainLooper());
    private AudioManager.OnCommunicationDeviceChangedListener routeListener;
    private AudioDeviceCallback devices;

    @Override public void load() {
        audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        PowerManager power = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        if (power.isWakeLockLevelSupported(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK)) {
            proximity = power.newWakeLock(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK, "QuickChat:CallProximity");
            proximity.setReferenceCounted(false);
        }
        if (Build.VERSION.SDK_INT >= 31) {
            routeListener = device -> publish();
            audio.addOnCommunicationDeviceChangedListener(getContext().getMainExecutor(), routeListener);
        }
        devices = new AudioDeviceCallback() {
            @Override public void onAudioDevicesAdded(AudioDeviceInfo[] added) { publish(); }
            @Override public void onAudioDevicesRemoved(AudioDeviceInfo[] removed) { publish(); }
        };
        audio.registerAudioDeviceCallback(devices, main);
    }

    private boolean hasEarpiece() {
        for (AudioDeviceInfo device : audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS))
            if (device.getType() == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) return true;
        return false;
    }
    private String currentRoute() {
        if (Build.VERSION.SDK_INT >= 31) {
            AudioDeviceInfo device = audio.getCommunicationDevice();
            if (device == null) return "system";
            if (device.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) return "speaker";
            if (device.getType() == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) return "earpiece";
            return "system";
        }
        if (audio.isSpeakerphoneOn()) return "speaker";
        if (audio.isBluetoothScoOn() || audio.isWiredHeadsetOn()) return "system";
        return hasEarpiece() ? "earpiece" : "system";
    }
    private JSObject state() {
        String route = currentRoute();
        boolean enabled = active && !video && route.equals("earpiece") && proximity != null;
        if (proximity != null) {
            if (enabled && !proximity.isHeld()) proximity.acquire(4 * 60 * 60 * 1000L);
            if (!enabled && proximity.isHeld()) proximity.release();
        }
        JSObject result = new JSObject();
        result.put("route", route);
        result.put("earpiece", hasEarpiece());
        result.put("proximity", enabled);
        return result;
    }
    private void publish() {
        if (active) notifyListeners("routeChanged", state());
    }
    private void choose(String route) throws Exception {
        if (route.equals("earpiece") && !hasEarpiece()) throw new Exception("This device has no earpiece");
        if (Build.VERSION.SDK_INT >= 31) {
            if (route.equals("system")) { audio.clearCommunicationDevice(); return; }
            int type = route.equals("speaker") ? AudioDeviceInfo.TYPE_BUILTIN_SPEAKER : AudioDeviceInfo.TYPE_BUILTIN_EARPIECE;
            for (AudioDeviceInfo device : audio.getAvailableCommunicationDevices()) {
                if (device.getType() == type) {
                    if (!audio.setCommunicationDevice(device)) throw new Exception("Audio route was rejected by the system");
                    return;
                }
            }
            throw new Exception("Audio route is unavailable");
        }
        audio.setSpeakerphoneOn(route.equals("speaker"));
        if (route.equals("earpiece") && !currentRoute().equals("earpiece"))
            throw new Exception("Disconnect your headset to use the earpiece on this Android version");
    }
    @PluginMethod public void start(PluginCall call) {
        main.post(() -> {
            try {
                if (!active) { previousMode = audio.getMode(); previousSpeaker = audio.isSpeakerphoneOn(); }
                active = true;
                video = Boolean.TRUE.equals(call.getBoolean("video", false));
                audio.setMode(AudioManager.MODE_IN_COMMUNICATION);
                choose("system");
                if (video && !currentRoute().equals("system")) choose("speaker");
                call.resolve(state());
            } catch (Exception e) { stopAudio(); call.reject("Could not initialize call audio", e); }
        });
    }
    @PluginMethod public void route(PluginCall call) {
        main.post(() -> {
            String route = call.getString("route", "system");
            if (!active || !(route.equals("system") || route.equals("speaker") || route.equals("earpiece"))) {
                call.reject("No active call or invalid route"); return;
            }
            try { choose(route); JSObject value = state(); notifyListeners("routeChanged", value); call.resolve(value); }
            catch (Exception e) { call.reject(e.getMessage(), e); }
        });
    }
    private void stopAudio() {
        if (proximity != null && proximity.isHeld()) proximity.release();
        if (active) {
            active = false;
            if (Build.VERSION.SDK_INT >= 31) audio.clearCommunicationDevice();
            else audio.setSpeakerphoneOn(previousSpeaker);
            audio.setMode(previousMode);
        }
    }
    @PluginMethod public void stop(PluginCall call) { main.post(() -> { stopAudio(); call.resolve(); }); }
    @Override protected void handleOnDestroy() {
        main.post(() -> {
            stopAudio();
            audio.unregisterAudioDeviceCallback(devices);
            if (Build.VERSION.SDK_INT >= 31 && routeListener != null) audio.removeOnCommunicationDeviceChangedListener(routeListener);
        });
    }
}
