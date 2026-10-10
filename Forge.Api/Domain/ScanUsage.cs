namespace Forge.Api.Domain
{
    /// <summary>
    /// How many photos someone scanned on a day (UTC). Each scan is a paid Claude request, so ScanController caps
    /// them per user and in total each day.
    /// </summary>
    public class ScanUsage
    {
        // Primary key: UserId + Day.
        public string UserId { get; set; } = string.Empty;
        public DateOnly Day { get; set; }

        public int Count { get; set; }
    }
}
