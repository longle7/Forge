import ActivityKit
import Capacitor
import Foundation

/// The web app's bridge to the workout's Live Activity (see src/liveActivity.ts). One workout shows at a time: showing a
/// workout updates its Live Activity if it's already up, starts it if not, and ends any other workout's.
/// Times come in as milliseconds since 1970. Before iOS 18 it does nothing: the LiveActivity extension needs iOS 18 for
/// Apple Watch, so it couldn't draw one.
@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endAll", returnType: CAPPluginReturnPromise),
    ]

    @objc func show(_ call: CAPPluginCall) {
        guard #available(iOS 18.0, *) else { return call.resolve() }
        guard let workoutId = call.getString("workoutId"),
              let startedAt = call.getDouble("startedAt"),
              let name = call.getString("name"),
              let exercise = call.getString("exercise"),
              let detail = call.getString("detail"),
              let setsDone = call.getInt("setsDone")
        else { return call.reject("Missing workout details") }

        let restEndsAt = call.getDouble("restEndsAt").map { Date(timeIntervalSince1970: $0 / 1000) }
        let state = WorkoutActivityAttributes.ContentState(
            name: name, exercise: exercise, detail: detail, setsDone: setsDone,
            restEndsAt: restEndsAt, restTotal: call.getInt("restTotal"))
        // Stale when the rest ends: iOS redraws it then, so a locked phone says "Rest's up" without waiting for the app.
        let content = ActivityContent(state: state, staleDate: restEndsAt)

        Task {
            var current: Activity<WorkoutActivityAttributes>?
            for activity in Activity<WorkoutActivityAttributes>.activities {
                if current == nil && activity.attributes.workoutId == workoutId {
                    current = activity
                } else {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }
            if let current {
                await current.update(content)
                return call.resolve()
            }
            do {
                let attributes = WorkoutActivityAttributes(
                    workoutId: workoutId, startedAt: Date(timeIntervalSince1970: startedAt / 1000))
                // No push token: nothing but the app updates it, and only when you tap.
                _ = try Activity.request(attributes: attributes, content: content, pushType: nil)
                call.resolve()
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func endAll(_ call: CAPPluginCall) {
        guard #available(iOS 18.0, *) else { return call.resolve() }
        Task {
            for activity in Activity<WorkoutActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            call.resolve()
        }
    }
}
