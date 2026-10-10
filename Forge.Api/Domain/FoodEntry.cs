namespace Forge.Api.Domain
{
    /// <summary>
    /// Something you ate: a food, its serving, how many servings, and its nutrition per serving, counted toward a day
    /// and a meal.
    /// </summary>
    public class FoodEntry
    {
        // Primary key, made up by the app, so saving again (a retry after a lost response, or an edit) updates this
        // entry instead of adding a copy.
        public Guid Id { get; set; }

        // The anonymous ID the app sends as X-User-Id.
        public string UserId { get; set; } = string.Empty;

        // The day it counts toward, in your time zone.
        public DateOnly Date { get; set; }

        // breakfast, lunch, dinner, or snack.
        public string Meal { get; set; } = "breakfast";

        // e.g. "Greek Yogurt, Plain" and its serving, "1 cup (227 g)".
        public string Name { get; set; } = string.Empty;
        public string Serving { get; set; } = string.Empty;
        public decimal Servings { get; set; } = 1;

        // Per serving: kcal, then grams.
        public decimal Calories { get; set; }
        public decimal Protein { get; set; }
        public decimal Carbs { get; set; }
        public decimal Fat { get; set; }

        // Where it came from: manual, search, label (photo of a nutrition label), or photo (of the plate).
        public string Source { get; set; } = "manual";

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    }
}
