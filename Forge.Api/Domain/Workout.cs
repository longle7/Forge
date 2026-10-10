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
    }
}
