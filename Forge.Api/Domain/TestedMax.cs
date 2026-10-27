namespace Forge.Api.Domain
{
    /// <summary>
    /// A max you tested outside a logged workout (a meet, a test day at another gym): a weight for 1 to 10 reps on a
    /// day. Counts toward your estimated 1-rep max alongside your logged sets.
    /// </summary>
    public class TestedMax
    {
        // Made up by the app, so saving again replaces it (see Workout.Id).
        public Guid Id { get; set; }

        public string UserId { get; set; } = string.Empty;

        // A built-in exercise or one of yours; never cardio.
        public int ExerciseId { get; set; }
        public Exercise? Exercise { get; set; }

        // The day, in your time zone.
        public DateOnly Date { get; set; }

        // Pounds, for Reps reps (1 = a true 1-rep max).
        public decimal Weight { get; set; }
        public int Reps { get; set; } = 1;

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    }
}
