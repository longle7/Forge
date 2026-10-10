using System.Text.Json;
using Anthropic;
using Anthropic.Models.Beta.Messages;

namespace Forge.Api.Services
{
    /// <summary>Reads food from a photo: a nutrition label, or a plate of food (ClaudeFoodVision; faked in tests).</summary>
    public interface IFoodVision
    {
        Task<LabelReading> ReadLabelAsync(byte[] jpeg, CancellationToken cancellationToken);
        Task<MealReading> ReadMealAsync(byte[] jpeg, CancellationToken cancellationToken);
    }

    /// <summary>What a nutrition label says, per serving as printed. Found is false when there's no readable label.</summary>
    public record LabelReading(bool Found, string Name, string Serving, decimal Calories, decimal Protein, decimal Carbs, decimal Fat);

    /// <summary>The foods on a plate, each with an estimated portion and its nutrition. Empty when there's no food.</summary>
    public record MealReading(List<MealItem> Items);

    public record MealItem(string Name, decimal Grams, decimal Calories, decimal Protein, decimal Carbs, decimal Fat);

    /// <summary>Scanning isn't set up: no Anthropic:ApiKey is configured.</summary>
    public class ScanNotConfiguredException() : Exception("Scanning isn't set up: set Anthropic:ApiKey.");

    /// <summary>Claude answered, but not with a reading (it declined, or the answer didn't parse).</summary>
    public class ScanUnreadableException(string message) : Exception(message);

    /// <summary>
    /// Reads food photos with Claude: the photo and an instruction go in, and structured output (a JSON schema)
    /// guarantees the answer's shape. Anthropic:ApiKey is required (user-secrets locally, a Container App secret in
    /// production); Anthropic:Model picks the model (default claude-opus-5-5; claude-haiku-5-5 costs far less per
    /// scan). Server-side refusal fallback is on, so a rare safety decline is answered by another model in the same call.
    /// </summary>
    public class ClaudeFoodVision : IFoodVision
    {
        private const string SystemPrompt =
            "You read nutrition information from photos for a food-logging app. People take these photos in kitchens, "
            + "stores, and restaurants, so expect glare, angles, and partial views. Report what you can read or reasonably "
            + "estimate; never invent a label you can't see.";

        private const string LabelInstructions =
            "Read the Nutrition Facts label in this photo. Report the values for one serving exactly as printed: the "
            + "serving size as written (for example \"2/3 cup (55 g)\"), calories, and grams of protein, total "
            + "carbohydrate, and total fat. For name, use the product's name if it's visible on the package, otherwise an "
            + "empty string. If there's no readable nutrition label, set found to false, serving and name to empty "
            + "strings, and the numbers to 0.";

        private const string MealInstructions =
            "Identify each distinct food in this photo (for example: grilled chicken breast, white rice, broccoli) and "
            + "estimate its portion in grams and its nutrition for that portion: calories, and grams of protein, "
            + "carbohydrate, and fat. Use realistic portion sizes based on the plate and utensils, and include cooking "
            + "fats and sauces you can see as their own items. If there's no food in the photo, return no items.";

        private static readonly Dictionary<string, JsonElement> LabelSchema = Schema(new
        {
            type = "object",
            properties = new
            {
                found = new { type = "boolean" },
                name = new { type = "string" },
                serving = new { type = "string" },
                calories = new { type = "number" },
                protein = new { type = "number" },
                carbs = new { type = "number" },
                fat = new { type = "number" },
            },
            required = new[] { "found", "name", "serving", "calories", "protein", "carbs", "fat" },
            additionalProperties = false,
        });

        private static readonly Dictionary<string, JsonElement> MealSchema = Schema(new
        {
            type = "object",
            properties = new
            {
                items = new
                {
                    type = "array",
                    items = new
                    {
                        type = "object",
                        properties = new
                        {
                            name = new { type = "string" },
                            grams = new { type = "number" },
                            calories = new { type = "number" },
                            protein = new { type = "number" },
                            carbs = new { type = "number" },
                            fat = new { type = "number" },
                        },
                        required = new[] { "name", "grams", "calories", "protein", "carbs", "fat" },
                        additionalProperties = false,
                    },
                },
            },
            required = new[] { "items" },
            additionalProperties = false,
        });

        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        private readonly AnthropicClient? _client;
        private readonly string _model;

        // `http` lets tests see the request and answer it; the app leaves it to the SDK.
        public ClaudeFoodVision(IConfiguration config, HttpClient? http = null)
        {
            var apiKey = config["Anthropic:ApiKey"];
            _client = string.IsNullOrWhiteSpace(apiKey) ? null
                : http is null ? new AnthropicClient { ApiKey = apiKey }
                : new AnthropicClient { ApiKey = apiKey, HttpClient = http, MaxRetries = 0 };
            _model = config["Anthropic:Model"] is { Length: > 0 } model ? model : "claude-opus-5-5";
        }

        public Task<LabelReading> ReadLabelAsync(byte[] jpeg, CancellationToken cancellationToken) =>
            AskAsync<LabelReading>(jpeg, LabelInstructions, LabelSchema, cancellationToken);

        public Task<MealReading> ReadMealAsync(byte[] jpeg, CancellationToken cancellationToken) =>
            AskAsync<MealReading>(jpeg, MealInstructions, MealSchema, cancellationToken);

        private async Task<T> AskAsync<T>(byte[] jpeg, string instructions, Dictionary<string, JsonElement> schema, CancellationToken cancellationToken)
        {
            if (_client is null)
            {
                throw new ScanNotConfiguredException();
            }

            var response = await _client.Beta.Messages.Create(new MessageCreateParams
            {
                Model = _model,
                MaxTokens = 16000,
                // A safety decline (very unlikely for food photos) is retried by a fallback model within this call.
                Betas = ["server-side-fallback-2026-07-01"],
                Fallbacks = new Default(), // "default": the API picks the fallback by refusal category
                System = SystemPrompt,
                // Reading a label is quick work: low effort keeps each scan fast and inexpensive.
                OutputConfig = new BetaOutputConfig
                {
                    Effort = Effort.Low,
                    Format = new BetaJsonOutputFormat { Schema = schema },
                },
                Messages =
                [
                    new BetaMessageParam
                    {
                        Role = Role.User,
                        Content = new List<BetaContentBlockParam>
                        {
                            new BetaImageBlockParam { Source = new BetaBase64ImageSource { Data = Convert.ToBase64String(jpeg), MediaType = MediaType.ImageJpeg } },
                            new BetaTextBlockParam { Text = instructions },
                        },
                    },
                ],
            }, cancellationToken);

            if (response.StopReason == BetaStopReason.Refusal)
            {
                throw new ScanUnreadableException("Couldn't read that photo. Try another one, or add it another way.");
            }

            var text = string.Concat(response.Content.Select(b => b.Value).OfType<BetaTextBlock>().Select(t => t.Text));
            try
            {
                return JsonSerializer.Deserialize<T>(text, Json) ?? throw new ScanUnreadableException("Couldn't read that photo. Try again.");
            }
            catch (JsonException)
            {
                throw new ScanUnreadableException("Couldn't read that photo. Try again."); // e.g. cut off at max_tokens
            }
        }

        private static Dictionary<string, JsonElement> Schema(object schema) =>
            JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(JsonSerializer.Serialize(schema))!;
    }
}
