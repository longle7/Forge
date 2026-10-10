namespace Forge.Api.Domain
{
    /// <summary>
    /// One weekday of your weekly plan, e.g. Monday = "Push Day" with its exercises. It repeats every week; a weekday
    /// with no PlanDay is a rest day.
    /// </summary>
    public class PlanDay
    {
        // Database ID (primary key).
        public int Id { get; set; }

        // The anonymous ID the app sends as X-User-Id.
        public string UserId { get; set; } = string.Empty;

        // 0 = Sunday … 6 = Saturday, like JavaScript's Date.getDay().
        public int DayOfWeek { get; set; }

        // e.g. "Push Day".
        public string Name { get; set; } = string.Empty;

        // When this weekday was first planned: how far back "sticking to the plan" can count.
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        public List<PlanExercise> Exercises { get; set; } = [];
    }

    /// <summary>An exercise in a PlanDay, with its target: Sets × Reps (e.g. Bench Press, 4 × 8).</summary>
    public class PlanExercise
    {
        public int Id { get; set; }
        public int PlanDayId { get; set; }
        public int ExerciseId { get; set; }
        public Exercise? Exercise { get; set; }

        // Order within the day.
        public int Position { get; set; }

        public int Sets { get; set; }
        public int Reps { get; set; }
    }
}
