using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Forge.Api.Controllers;
using Forge.Api.Services;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace Forge.Tests;

/// <summary>/scan with the photo reader faked: what the app gets back, the daily caps, and what's counted.</summary>
public class ScanEndpointTests : IDisposable
{
    private readonly FakeVision _vision = new();
    private readonly WebApplicationFactory<Program> _factory;

    public ScanEndpointTests()
    {
        TestDb.CreateClean().Dispose();
        _factory = Factory(_vision);
    }

    public void Dispose() => _factory.Dispose();

    private static WebApplicationFactory<Program> Factory(IFoodVision? vision, int perUser = 3, int global = 5) =>
        TestDb.Factory().WithWebHostBuilder(b =>
        {
            b.UseSetting("Scan:PerUserDaily", perUser.ToString());
            b.UseSetting("Scan:GlobalDaily", global.ToString());
            b.UseSetting("Anthropic:ApiKey", ""); // never a real key in tests, even if user-secrets has one
            if (vision is not null) b.ConfigureTestServices(s => s.AddSingleton(vision));
        });

    private static MultipartFormDataContent Photo(string contentType = "image/jpeg")
    {
        var image = new ByteArrayContent([0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3]);
        image.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        return new MultipartFormDataContent { { image, "image", "photo.jpg" } };
    }

    [Fact]
    public async Task Label_ReturnsOneServing_Tidied()
    {
        _vision.Label = new LabelReading(true, " Rolled Oats ", "1/2 cup (40 g)", 150.4m, 5.04m, 27m, 3m);
        using var alice = _factory.ClientFor("alice");

        var response = await alice.PostAsync("/scan/label", Photo());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new ScannedFood("Rolled Oats", "1/2 cup (40 g)", 150m, 5m, 27m, 3m), await response.Content.ReadFromJsonAsync<ScannedFood>());
    }

    [Fact]
    public async Task Label_WithNoLabelInThePhoto_Returns422_ButCounts()
    {
        _vision.Label = new LabelReading(false, "", "", 0, 0, 0, 0);
        using var alice = _factory.ClientFor("alice");

        var response = await alice.PostAsync("/scan/label", Photo());

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Contains("nutrition label", await response.Content.ReadAsStringAsync());
        using var db = TestDb.Open();
        Assert.Equal(1, db.ScanUsage.Single(u => u.UserId == "alice").Count); // Claude answered, so it cost
    }

    [Fact]
    public async Task Meal_ReturnsEachFoodWithItsPortion()
    {
        _vision.Meal = new MealReading([new("Grilled chicken breast", 150, 248, 46, 0, 5.4m), new("White rice", 180.4m, 234, 4.3m, 51, 0.5m), new(" ", 10, 5, 0, 1, 0)]);
        using var alice = _factory.ClientFor("alice");

        var foods = await (await alice.PostAsync("/scan/meal", Photo())).Content.ReadFromJsonAsync<List<ScannedFood>>();

        Assert.Equal(
            [new("Grilled chicken breast", "150 g", 248m, 46m, 0m, 5.4m), new("White rice", "180 g", 234m, 4.3m, 51m, 0.5m)],
            foods);
    }

    [Fact]
    public async Task Meal_WithNoFood_Returns422()
    {
        _vision.Meal = new MealReading([]);
        using var alice = _factory.ClientFor("alice");

        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await alice.PostAsync("/scan/meal", Photo())).StatusCode);
    }

    [Fact]
    public async Task EachUser_HasADailyCap_AndEveryoneTogetherToo()
    {
        using var alice = _factory.ClientFor("alice");
        using var bob = _factory.ClientFor("bob");
        for (var i = 0; i < 3; i++)
            Assert.Equal(HttpStatusCode.OK, (await alice.PostAsync("/scan/label", Photo())).StatusCode);

        var limited = await alice.PostAsync("/scan/label", Photo());

        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.Contains("today's 3 scans", await limited.Content.ReadAsStringAsync());

        // 5 a day for everyone: alice's 3, then bob's 2, then nobody.
        Assert.Equal(HttpStatusCode.OK, (await bob.PostAsync("/scan/meal", Photo())).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await bob.PostAsync("/scan/meal", Photo())).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await bob.PostAsync("/scan/meal", Photo())).StatusCode);
        Assert.Equal(5, _vision.Calls); // the capped requests never reached Claude
    }

    [Fact]
    public async Task WithoutAKey_Returns503_AndDoesntCount()
    {
        using var factory = Factory(vision: null); // the real reader, with no key
        using var alice = factory.ClientFor("alice");

        var response = await alice.PostAsync("/scan/label", Photo());

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Contains("isn't set up yet", await response.Content.ReadAsStringAsync());
        using var db = TestDb.Open();
        Assert.Empty(db.ScanUsage);
    }

    [Fact]
    public async Task NotAPhoto_OrNoUser_Returns400()
    {
        using var alice = _factory.ClientFor("alice");
        using var anonymous = _factory.CreateClient();

        Assert.Equal(HttpStatusCode.BadRequest, (await alice.PostAsync("/scan/label", Photo("text/plain"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await alice.PostAsync("/scan/label", new MultipartFormDataContent())).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await anonymous.PostAsync("/scan/label", Photo())).StatusCode);
        Assert.Equal(0, _vision.Calls);
    }

    private class FakeVision : IFoodVision
    {
        public LabelReading Label { get; set; } = new(true, "Oats", "1/2 cup (40 g)", 150, 5, 27, 3);
        public MealReading Meal { get; set; } = new([new("Apple", 180, 95, 0.5m, 25, 0.3m)]);
        public int Calls { get; private set; }

        public Task<LabelReading> ReadLabelAsync(byte[] jpeg, CancellationToken cancellationToken)
        {
            Calls++;
            return Task.FromResult(Label);
        }

        public Task<MealReading> ReadMealAsync(byte[] jpeg, CancellationToken cancellationToken)
        {
            Calls++;
            return Task.FromResult(Meal);
        }
    }
}
