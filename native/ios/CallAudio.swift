// Added to the generated AppDelegate compilation unit by scripts/mobile.mjs.
import AVFoundation

@objc(CallAudioPlugin)
public class CallAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CallAudioPlugin"
    public let jsName = "CallAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "route", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]
    private var active = false
    private var video = false
    private var observer: NSObjectProtocol?
    public override func load() {
        observer = NotificationCenter.default.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self = self, self.active else { return }
            self.notifyListeners("routeChanged", data: self.state())
        }
    }
    private func state() -> [String: Any] {
        let ports = AVAudioSession.sharedInstance().currentRoute.outputs.map { $0.portType }
        let route = ports.contains(.builtInSpeaker) ? "speaker" : ports.contains(.builtInReceiver) ? "earpiece" : "system"
        let enabled = active && !video && route == "earpiece"
        UIDevice.current.isProximityMonitoringEnabled = enabled
        return ["route": route, "earpiece": UIDevice.current.userInterfaceIdiom == .phone,
                "proximity": UIDevice.current.isProximityMonitoringEnabled]
    }
    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                self.video = call.getBool("video") ?? false
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playAndRecord, mode: self.video ? .videoChat : .voiceChat, options: [.allowBluetooth])
                try session.setActive(true)
                self.active = true
                let external = session.currentRoute.outputs.contains { $0.portType != .builtInReceiver && $0.portType != .builtInSpeaker }
                try session.overrideOutputAudioPort(self.video && !external ? .speaker : .none)
                call.resolve(self.state())
            } catch { self.releaseAudio(); call.reject("Could not initialize call audio", nil, error) }
        }
    }
    @objc func route(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let route = call.getString("route") ?? "system"
            guard self.active, ["speaker", "earpiece", "system"].contains(route) else { call.reject("No active call or invalid route"); return }
            do {
                let session = AVAudioSession.sharedInstance()
                if route == "earpiece" {
                    guard UIDevice.current.userInterfaceIdiom == .phone else { call.reject("This device has no earpiece"); return }
                    if let mic = session.availableInputs?.first(where: { $0.portType == .builtInMic }) { try session.setPreferredInput(mic) }
                } else { try session.setPreferredInput(nil) }
                try session.overrideOutputAudioPort(route == "speaker" ? .speaker : .none)
                let state = self.state()
                self.notifyListeners("routeChanged", data: state)
                call.resolve(state)
            } catch { call.reject("Audio route is unavailable", nil, error) }
        }
    }
    private func releaseAudio() {
        UIDevice.current.isProximityMonitoringEnabled = false
        guard active else { return }
        active = false
        let session = AVAudioSession.sharedInstance()
        try? session.overrideOutputAudioPort(.none)
        try? session.setPreferredInput(nil)
        try? session.setActive(false, options: .notifyOthersOnDeactivation)
    }
    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.releaseAudio(); call.resolve() }
    }
    deinit {
        if let observer = observer { NotificationCenter.default.removeObserver(observer) }
        DispatchQueue.main.async {
            UIDevice.current.isProximityMonitoringEnabled = false
        }
    }
}

class CallViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(CallAudioPlugin())
    }
}
