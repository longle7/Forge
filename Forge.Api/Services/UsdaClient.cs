using System.Globalization;
using Microsoft.Extensions.Caching.Memory;

namespace Forge.Api.Services
{
    /// <summary>
    /// Food search over USDA FoodData Central (https://fdc.nal.usda.gov): generic foods ("chicken breast", per 100 g)
    /// and branded products (per their label serving). Results are normalized to one serving and cached for a day.
    /// Usda:ApiKey is a free key from https://fdc.nal.usda.gov/api-key-signup; without one, USDA's shared DEMO_KEY is
    /// used, which is rate-limited (fine for development).
    /// </summary>
    public class UsdaClient
    {
        private const int MaxResults = 25;

        private readonly HttpClient _http;
        private readonly IMemoryCache _cache;
        private readonly string _apiKey;

        public UsdaClient(HttpClient http, IMemoryCache cache, IConfiguration config)
        {
            _http = http;
            _cache = cache;
            _apiKey = config["Usda:ApiKey"] is { Length: > 0 } key ? key : "DEMO_KEY";
        }

        /// <summary>Foods matching what someone typed. Throws HttpRequestException when USDA can't answer.</summary>
        public async Task<IReadOnlyList<FoodResult>> SearchAsync(string query, CancellationToken cancellationToken)
        {
            // A failed search throws before anything is cached, so the next try asks USDA again.
            return (await _cache.GetOrCreateAsync<IReadOnlyList<FoodResult>>("usda:" + query.Trim().ToLowerInvariant(), async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(1);
                var url = "https://api.nal.usda.gov/fdc/v1/foods/search"
                    + $"?api_key={Uri.EscapeDataString(_apiKey)}&query={Uri.EscapeDataString(query.Trim())}"
                    + "&pageSize=40&dataType=Foundation,SR%20Legacy,Branded";
                using var response = await _http.GetAsync(url, cancellationToken);
                response.EnsureSuccessStatusCode();
                var body = await response.Content.ReadFromJsonAsync<UsdaSearch>(cancellationToken);

                return (body?.Foods ?? [])
                    .Select(ToResult)
                    .OfType<FoodResult>()
                    .DistinctBy(f => (f.Name, f.Brand, f.Serving))
                    .Take(MaxResults)
                    .ToList();
            }))!;
        }

        // USDA nutrient numbers: 208 energy (kcal), 957/958 energy by Atwater factors (kcal, Foundation foods often only
        // have these), 203 protein, 205 carbohydrate, 204 fat, 291 fiber, 269 total sugars, 307 sodium (mg). Values are
        // per 100 g (or 100 ml). A nutrient the food doesn't list stays null: unknown, not zero.
        private static FoodResult? ToResult(UsdaFood food)
        {
            decimal? Nutrient(params string[] numbers) =>
                numbers.Select(n => food.FoodNutrients?.FirstOrDefault(x => x.NutrientNumber == n && x.UnitName?.ToUpperInvariant() != "KJ")?.Value)
                       .FirstOrDefault(v => v is not null);

            var calories = Nutrient("208", "957", "958");
            if (calories is null || string.IsNullOrWhiteSpace(food.Description))
            {
                return null; // nothing to log without calories
            }

            // Branded products have a label serving (e.g. 170 g, "3/4 cup"); everything else is per 100 g.
            var unit = food.ServingSizeUnit?.ToUpperInvariant() switch
            {
                "G" or "GRM" => "g",
                "ML" or "MLT" => "ml",
                _ => null,
            };
            var size = food.ServingSize is > 0 && unit is not null ? food.ServingSize.Value : (decimal?)null;
            var perServing = size / 100m ?? 1m;
            var amount = size is null ? "100 g" : $"{size.Value.ToString("0.#", CultureInfo.InvariantCulture)} {unit}";
            var serving = size is not null && !string.IsNullOrWhiteSpace(food.HouseholdServingFullText)
                ? $"{food.HouseholdServingFullText.Trim()} ({amount})"
                : amount;

            return new FoodResult(
                Tidy(food.Description)!,
                Tidy(food.BrandName ?? food.BrandOwner),
                serving,
                Math.Round(calories.Value * perServing),
                Math.Round((Nutrient("203") ?? 0) * perServing, 1),
                Math.Round((Nutrient("205") ?? 0) * perServing, 1),
                Math.Round((Nutrient("204") ?? 0) * perServing, 1),
                Nutrient("291") is { } fiber ? Math.Round(fiber * perServing, 1) : null,
                Nutrient("269") is { } sugar ? Math.Round(sugar * perServing, 1) : null,
                Nutrient("307") is { } sodium ? Math.Round(sodium * perServing) : null);
        }

        // Branded names come in capitals ("GREEK YOGURT"); show them like the rest ("Greek Yogurt").
        private static string? Tidy(string? text) =>
            string.IsNullOrWhiteSpace(text) ? null
            : text == text.ToUpperInvariant() ? CultureInfo.InvariantCulture.TextInfo.ToTitleCase(text.Trim().ToLowerInvariant())
            : text.Trim();

        private record UsdaSearch(List<UsdaFood>? Foods);

        private record UsdaFood(
            string? Description,
            string? BrandOwner,
            string? BrandName,
            decimal? ServingSize,
            string? ServingSizeUnit,
            string? HouseholdServingFullText,
            List<UsdaNutrient>? FoodNutrients);

        private record UsdaNutrient(string? NutrientNumber, string? UnitName, decimal? Value);
    }

    /// <summary>A food from search, per one serving: kcal, grams of protein, carbs, fat, fiber, and sugar, and mg of sodium.</summary>
    public record FoodResult(string Name, string? Brand, string Serving, decimal Calories, decimal Protein, decimal Carbs, decimal Fat,
        decimal? Fiber = null, decimal? Sugar = null, decimal? Sodium = null);
}
