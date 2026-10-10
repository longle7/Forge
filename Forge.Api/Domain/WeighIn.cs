namespace Forge.Api.Domain
{
    /// <summary>Your body weight on a day: at most one per day (a second one that day replaces it).</summary>
    public class WeighIn
    {
        // Primary key: UserId + Date.
        public string UserId { get; set; } = string.Empty;

        // The day, in your time zone.
        public DateOnly Date { get; set; }

        // Pounds.
        public decimal Weight { get; set; }
    }
}
