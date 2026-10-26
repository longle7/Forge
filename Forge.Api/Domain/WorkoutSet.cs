namespace Forge.Api.Domain
{
    /// <summary>
    /// One set: an exercise, the weight, and how many reps, or for cardio the distance and time. Belongs to a Workout
    /// and is deleted with it.
    /// </summary>
    public class WorkoutSet
    {
        // Database ID (primary key).
        public int Id { get; set; }

        // The workout it's part of (FK to Workout.Id).
        public Guid WorkoutId { get; set; }

        // What was lifted (FK to Exercise.Id).
        public int ExerciseId { get; set; }
        public Exercise? Exercise { get; set; }

        // Order within the workout (0, 1, 2, ...): exercise by exercise, as the app lists them. Never the order sets were
        // checked off in, which in a superset goes back and forth between exercises.
        public int Position { get; set; }

        // Pounds; 0 for a bodyweight set.
        // ponytail: pounds only, add a kg display toggle if ever wanted.
        public decimal Weight { get; set; }

        // 0 for cardio.
        public int Reps { get; set; }

        // Cardio only (null otherwise): miles, and how long it took. A cardio set has at least one of them.
        public decimal? Distance { get; set; }
        public int? DurationSeconds { get; set; }

        // Lifting only: null for a normal set, or "warmup" (the app leaves it out of PRs, maxes, and totals), "drop"
        // (straight after a set, at a lighter weight), or "failure" (until no more reps would come).
        public string? Kind { get; set; }

        // Exercises done back to back as a superset share a group number (1, 2, ...) within the workout; null otherwise.
        public int? Superset { get; set; }
    }
}
