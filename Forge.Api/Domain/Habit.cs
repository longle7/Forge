namespace Forge.Api.Domain
{
    /// <summary>
    /// A daily habit, like "💧 Water, 8 a day" or "🧘 Stretch": done on the days it's scheduled, with a streak.
    /// </summary>
    public class Habit
    {
        // Primary key, made up by the app (a retry or an edit saves the same habit, never a copy).
        public Guid Id { get; set; }

        // The anonymous ID the app sends as X-User-Id.
        public string UserId { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;
        public string Emoji { get; set; } = string.Empty;

        // How many times a day counts as done: 1 for a check-off, 8 for "8 glasses of water".
        public int DailyTarget { get; set; } = 1;

        // Which weekdays it's for: bit 0 = Sunday … bit 6 = Saturday (127 = every day).
        public int Days { get; set; } = 127;

        // Archived habits keep their history but leave Home.
        public DateTime? ArchivedAtUtc { get; set; }

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        public List<HabitCheck> Checks { get; set; } = [];
    }

    /// <summary>How many times a habit was done on a day (your time zone). No row means zero.</summary>
    public class HabitCheck
    {
        // Primary key: HabitId + Date.
        public Guid HabitId { get; set; }
        public DateOnly Date { get; set; }
        public int Count { get; set; }
    }
}
