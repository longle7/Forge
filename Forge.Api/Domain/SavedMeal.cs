namespace Forge.Api.Domain
{
    /// <summary>
    /// A meal you eat often, e.g. "Usual breakfast": oats, a banana, and coffee. Saved from a day's meal, logged again
    /// in one tap. Its foods are stored with it, as one JSON column.
    /// </summary>
    public class SavedMeal
    {
        // Primary key, made up by the app (like a workout's), so saving again replaces the meal instead of copying it.
        public Guid Id { get; set; }

        // The anonymous ID the app sends as X-User-Id.
        public string UserId { get; set; } = string.Empty;

        // e.g. "Usual breakfast".
        public string Name { get; set; } = string.Empty;

        public List<SavedMealItem> Items { get; set; } = [];

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    }

    /// <summary>One food in a saved meal: a FoodEntry without its day and meal.</summary>
    public class SavedMealItem
    {
        public string Name { get; set; } = string.Empty;
        public string Serving { get; set; } = string.Empty;
        public decimal Servings { get; set; } = 1;

        // Per serving: kcal, then grams.
        public decimal Calories { get; set; }
        public decimal Protein { get; set; }
        public decimal Carbs { get; set; }
        public decimal Fat { get; set; }
    }
}
