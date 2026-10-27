import ActivityKit
import Foundation

/// The workout in progress, as its Live Activity shows it. Shared by the app, which starts and updates it
/// (LiveActivityPlugin), and the LiveActivity extension, which draws it on the Lock Screen, in the Dynamic Island, and
/// on Apple Watch.
@available(iOS 16.1, *)
struct WorkoutActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var name: String      // the workout's name, which can change mid-workout
        var exercise: String  // the next set's exercise, or empty when there's no next set
        var detail: String    // "Set 2 of 4", "All sets done", or "No sets yet"
        var setsDone: Int
        var restEndsAt: Date? // while resting
        var restTotal: Int?   // the rest's length in seconds
    }

    var workoutId: String
    var startedAt: Date
}
