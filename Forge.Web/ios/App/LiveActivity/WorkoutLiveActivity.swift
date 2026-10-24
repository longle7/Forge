import ActivityKit
import SwiftUI
import WidgetKit

// The workout in progress on the Lock Screen, in the Dynamic Island, and in the Apple Watch Smart Stack. The app sends
// what changes when you tap (see LiveActivityPlugin); the time so far and the rest count by themselves in between.

@main
struct LiveActivityBundle: WidgetBundle {
    var body: some Widget {
        WorkoutLiveActivity()
    }
}

/// Forge's coral (--color-coral in src/index.css). Bright, so it's for icons, the rest bar, and text on black.
private let coral = Color(red: 255 / 255, green: 107 / 255, blue: 74 / 255)

struct WorkoutLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            WorkoutView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    WorkoutTitle(name: context.state.name)
                        .font(.headline)
                        .dynamicIsland(verticalPlacement: .belowIfTooWide)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ElapsedTime(startedAt: context.attributes.startedAt)
                        .font(.headline)
                        .multilineTextAlignment(.trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(context.state.nextSet).lineLimit(1)
                        RestView(context: context)
                    }
                }
            } compactLeading: {
                // Small enough for a workout past an hour ("1:02:33") to fit beside the dumbbell.
                HStack(spacing: 4) {
                    Dumbbell()
                    ElapsedTime(startedAt: context.attributes.startedAt)
                }
                .font(.caption.weight(.semibold))
                .frame(maxWidth: 64)
            } compactTrailing: {
                Group {
                    if let rest = context.rest {
                        RestCountdown(endsAt: rest.upperBound).foregroundStyle(coral)
                    } else {
                        SetsDone(count: context.state.setsDone)
                    }
                }
                .font(.caption.weight(.semibold))
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 64)
            } minimal: {
                if let rest = context.rest {
                    RestCountdown(endsAt: rest.upperBound)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(coral)
                        .multilineTextAlignment(.center)
                } else {
                    Dumbbell()
                }
            }
            .keylineTint(coral)
        }
        .supplementalActivityFamilies([.small])
    }
}

/// The Lock Screen's view, or the Smart Stack's on Apple Watch (the small family).
struct WorkoutView: View {
    @Environment(\.activityFamily) private var family
    let context: ActivityViewContext<WorkoutActivityAttributes>

    var body: some View {
        switch family {
        case .small: WatchView(context: context)
        default: LockScreenView(context: context)
        }
    }
}

/// The workout's name and time so far, the next set, and the rest.
struct LockScreenView: View {
    let context: ActivityViewContext<WorkoutActivityAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                WorkoutTitle(name: context.state.name)
                Spacer()
                ElapsedTime(startedAt: context.attributes.startedAt)
                    .multilineTextAlignment(.trailing)
            }
            .font(.headline)
            Text(context.state.nextSet)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            RestView(context: context)
        }
        .padding(16)
    }
}

/// A few short lines for the watch: the next set, then the rest or the time so far.
struct WatchView: View {
    let context: ActivityViewContext<WorkoutActivityAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            // With no next set, the workout's name heads it instead.
            Text(context.state.exercise.isEmpty ? context.state.name : context.state.exercise)
                .font(.headline)
                .lineLimit(1)
            Text(context.state.detail)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Group {
                if let rest = context.rest {
                    RestCountdown(endsAt: rest.upperBound).foregroundStyle(coral)
                } else if context.restIsUp {
                    Text("Rest's up")
                } else {
                    ElapsedTime(startedAt: context.attributes.startedAt)
                }
            }
            .font(.title3.weight(.semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The rest on the Lock Screen and in the expanded Dynamic Island: the time left over a bar that empties, both counting
/// by themselves, then "Rest's up" until the app sends what's next.
struct RestView: View {
    let context: ActivityViewContext<WorkoutActivityAttributes>

    var body: some View {
        if let rest = context.rest {
            VStack(spacing: 4) {
                HStack {
                    Text("Rest")
                    Spacer()
                    RestCountdown(endsAt: rest.upperBound)
                        .multilineTextAlignment(.trailing)
                }
                .font(.subheadline.weight(.semibold))
                ProgressView(timerInterval: rest, countsDown: true) {
                    EmptyView()
                } currentValueLabel: {
                    EmptyView()
                }
                .tint(coral)
            }
        } else if context.restIsUp {
            Text("Rest's up")
                .font(.subheadline.weight(.semibold))
        }
    }
}

struct WorkoutTitle: View {
    let name: String

    var body: some View {
        Label {
            Text(name).lineLimit(1)
        } icon: {
            Dumbbell()
        }
    }
}

struct Dumbbell: View {
    var body: some View {
        Image(systemName: "dumbbell.fill").foregroundStyle(coral)
    }
}

/// The workout's time so far, counting up by itself.
struct ElapsedTime: View {
    let startedAt: Date

    var body: some View {
        Text(startedAt, style: .timer).monospacedDigit()
    }
}

/// The rest's time left, counting down by itself. `min` keeps a rest that's already over from making a range that ends
/// before it starts, which would crash.
struct RestCountdown: View {
    let endsAt: Date

    var body: some View {
        Text(timerInterval: min(Date.now, endsAt)...endsAt, countsDown: true).monospacedDigit()
    }
}

/// How many sets are checked off, after a check mark.
struct SetsDone: View {
    let count: Int

    var body: some View {
        HStack(spacing: 2) {
            Image(systemName: "checkmark")
            Text("\(count)")
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Sets done: \(count)")
    }
}

private extension WorkoutActivityAttributes.ContentState {
    /// "Bench Press · Set 2 of 4", or just "All sets done".
    var nextSet: String { exercise.isEmpty ? detail : "\(exercise) · \(detail)" }
}

private extension ActivityViewContext where Attributes == WorkoutActivityAttributes {
    /// The rest while it counts down: from its start (its end less its length) to its end. It goes stale when the rest
    /// ends (see LiveActivityPlugin), and iOS redraws it.
    var rest: ClosedRange<Date>? {
        guard let end = state.restEndsAt, !isStale else { return nil }
        return end.addingTimeInterval(-Double(state.restTotal ?? 0))...end
    }

    /// The rest ran out and the app hasn't sent anything since (the phone is locked, say).
    var restIsUp: Bool { state.restEndsAt != nil && isStale }
}
