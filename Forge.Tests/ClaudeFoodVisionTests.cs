using System.Net;
using System.Text;
using System.Text.Json;
using Forge.Api.Services;
using Microsoft.Extensions.Configuration;

namespace Forge.Tests;

/// <summary>
/// The real Claude request, with Anthropic's API faked: what's sent (model, photo, schema, fallback) and how the
/// answer is read. No network, no key needed.
/// </summary>
public class ClaudeFoodVisionTests
{
    private static readonly byte[] Photo = [0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3]; // the start of a JPEG

    private static IConfiguration Config(string? apiKey = "sk-ant-test") =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Anthropic:ApiKey"] = apiKey }).Build();

    // A Messages API answer: an (omitted) thinking block, then the structured output as text.
    private static string Answer(string json, string stopReason = "end_turn") => JsonSerializer.Serialize(new
    {
        id = "msg_test",
        type = "message",
        role = "assistant",
        model = "claude-opus-5-5",
        content = new object[]
        {
            new { type = "thinking", thinking = "", signature = "sig" },
            new { type = "text", text = json },
        },
        stop_reason = stopReason,
        stop_sequence = (string?)null,
        usage = new { input_tokens = 1200, output_tokens = 80 },
    });

    [Fact]
    public async Task ReadLabel_SendsThePhotoWithTheSchemaAndFallback_AndReadsTheAnswer()
    {
        var api = new FakeAnthropic(Answer("""{"found":true,"name":"Rolled Oats","serving":"1/2 cup (40 g)","calories":150,"protein":5,"carbs":27,"fat":3,"fiber":4,"sugar":1,"sodium":0}"""));
        var vision = new ClaudeFoodVision(Config(), new HttpClient(api));

        var label = await vision.ReadLabelAsync(Photo, CancellationToken.None);

        Assert.Equal(new LabelReading(true, "Rolled Oats", "1/2 cup (40 g)", 150, 5, 27, 3, 4, 1, 0), label);

        var request = JsonDocument.Parse(api.Body!).RootElement;
        Assert.Equal("claude-opus-5-5", request.GetProperty("model").GetString());
        Assert.Equal("default", request.GetProperty("fallbacks").GetString());
        Assert.Contains("server-side-fallback-2026-07-01", api.Betas);
        var output = request.GetProperty("output_config");
        Assert.Equal("low", output.GetProperty("effort").GetString());
        Assert.Equal("json_schema", output.GetProperty("format").GetProperty("type").GetString());
        Assert.False(output.GetProperty("format").GetProperty("schema").GetProperty("additionalProperties").GetBoolean());
        Assert.Contains("sodium", output.GetProperty("format").GetProperty("schema").GetProperty("required").EnumerateArray().Select(r => r.GetString()));
        var image = request.GetProperty("messages")[0].GetProperty("content")[0];
        Assert.Equal("image", image.GetProperty("type").GetString());
        Assert.Equal("image/jpeg", image.GetProperty("source").GetProperty("media_type").GetString());
        Assert.Equal(Convert.ToBase64String(Photo), image.GetProperty("source").GetProperty("data").GetString());
    }

    [Fact]
    public async Task ReadMeal_ReadsTheItems()
    {
        var api = new FakeAnthropic(Answer("""{"items":[{"name":"Grilled chicken breast","grams":150,"calories":248,"protein":46,"carbs":0,"fat":5.4},{"name":"White rice","grams":180,"calories":234,"protein":4.3,"carbs":51,"fat":0.5}]}"""));
        var vision = new ClaudeFoodVision(Config(), new HttpClient(api));

        var meal = await vision.ReadMealAsync(Photo, CancellationToken.None);

        Assert.Equal(["Grilled chicken breast", "White rice"], meal.Items.Select(i => i.Name));
        Assert.Equal(150m, meal.Items[0].Grams);
    }

    [Fact]
    public async Task ARefusal_OrAnUnreadableAnswer_IsUnreadable()
    {
        var refused = new ClaudeFoodVision(Config(), new HttpClient(new FakeAnthropic(Answer("", "refusal"))));
        var garbled = new ClaudeFoodVision(Config(), new HttpClient(new FakeAnthropic(Answer("""{"found":tr"""))));

        await Assert.ThrowsAsync<ScanUnreadableException>(() => refused.ReadLabelAsync(Photo, CancellationToken.None));
        await Assert.ThrowsAsync<ScanUnreadableException>(() => garbled.ReadLabelAsync(Photo, CancellationToken.None));
    }

    [Fact]
    public async Task WithoutAKey_ItIsNotConfigured()
    {
        var vision = new ClaudeFoodVision(Config(apiKey: ""));

        await Assert.ThrowsAsync<ScanNotConfiguredException>(() => vision.ReadLabelAsync(Photo, CancellationToken.None));
    }

    private class FakeAnthropic(string answer) : HttpMessageHandler
    {
        public string? Body { get; private set; }
        public List<string> Betas { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Body = await request.Content!.ReadAsStringAsync(cancellationToken);
            if (request.Headers.TryGetValues("anthropic-beta", out var betas))
                Betas.AddRange(betas.SelectMany(b => b.Split(',', StringSplitOptions.TrimEntries)));
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(answer, Encoding.UTF8, "application/json") };
        }
    }
}
