namespace Forge.Api.Domain
{
    /// <summary>
    /// A finished workout: when it was, and every set you checked off, in the order you did them.
    /// </summary>
    public class Workout
    {
        // Primary key, made up by the app when the workout starts. Saving it again (a retry after a lost response, or
        // an edit) updates this same workout instead of adding a copy.
        public Guid Id { get; set; }

        // The anonymous ID the app sends as X-User-Id (see WorkoutsController).
        public string UserId { get; set; } = string.Empty;

        // e.g. "Evening Workout" or "Push day".
        public string Name { get; set; } = string.Empty;

        public DateTime StartedAtUtc { get; set; }
        public DateTime FinishedAtUtc { get; set; }

        public List<WorkoutSet> Sets { get; set; } = [];

        // "forge" (logged in Forge), or "health": an Apple Watch / Apple Health workout the iPhone app brought in. Those
        // can have no sets (the Watch doesn't record sets for strength training).
        public string Source { get; set; } = "forge";

        // What Apple Health calls it ("running", "strength"); null for Forge's own.
        public string? Activity { get; set; }

        // From Apple Health, for a workout it recorded or one logged in Forge at the same time: active calories, and
        // heart rate (average, max, and the curve in 30-second steps).
        public decimal? ActiveCalories { get; set; }
        public int? AvgHeartRate { get; set; }
        public int? MaxHeartRate { get; set; }
        public List<HeartRatePoint> HeartRate { get; set; } = [];
    }

    /// <summary>Heart rate `S` seconds into a workout, in beats a minute.</summary>
    public class HeartRatePoint
    {
        public int S { get; set; }
        public int Bpm { get; set; }
    }
}
