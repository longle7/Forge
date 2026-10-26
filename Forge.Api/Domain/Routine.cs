namespace Forge.Api.Domain
{
    /// <summary>
    /// A workout you do often, e.g. "Push A": its exercises and sets, saved from a finished workout and started again in
    /// one tap. Its sets are stored with it, as one JSON column.
    /// </summary>
    public class Routine
    {
        // Primary key, made up by the app (like a workout's), so saving again replaces the routine instead of copying it.
        public Guid Id { get; set; }

        // The anonymous ID the app sends as X-User-Id.
        public string UserId { get; set; } = string.Empty;

        // e.g. "Push A".
        public string Name { get; set; } = string.Empty;

        public List<RoutineSet> Sets { get; set; } = [];

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// One set in a routine: a WorkoutSet without its workout. A class of its own because EF Core can't map WorkoutSet as
    /// both a table and part of a JSON column.
    /// </summary>
    public class RoutineSet
    {
        public int ExerciseId { get; set; }

        // Like WorkoutSet's: pounds and reps for a lifting set, or for cardio a distance (miles) and time.
        public decimal Weight { get; set; }
        public int Reps { get; set; }
        public decimal? Distance { get; set; }
        public int? DurationSeconds { get; set; }

        // Lifting only: null for a normal set, or "warmup", "drop", or "failure" (see WorkoutSet.Kind).
        public string? Kind { get; set; }

        // Exercises done back to back share a group number (see WorkoutSet.Superset).
        public int? Superset { get; set; }
    }
}
