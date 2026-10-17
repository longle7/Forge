namespace Forge.Api.Domain
{
    /// <summary>
    /// A day's active calories from Apple Health (the Move ring: every workout and all other movement). One per day;
    /// syncing again replaces it, since the day's total grows until midnight.
    /// </summary>
    public class ActiveEnergy
    {
        // Primary key: UserId + Date.
        public string UserId { get; set; } = string.Empty;

        // The day, in your time zone.
        public DateOnly Date { get; set; }

        public int Kcal { get; set; }
    }
}
