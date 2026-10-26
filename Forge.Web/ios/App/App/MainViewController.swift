import Capacitor

/// The app's web view, plus the plugin that lives in the app itself: LiveActivityPlugin shares
/// WorkoutActivityAttributes with the LiveActivity extension. Capacitor registers the npm and plugins/ ones by itself.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LiveActivityPlugin())
    }
}
