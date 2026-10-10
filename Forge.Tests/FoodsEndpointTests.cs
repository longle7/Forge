using System.Net;
using System.Net.Http.Json;
using System.Text;
using Forge.Api.Services;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace Forge.Tests;

/// <summary>/foods with USDA faked: how its answers become per-serving foods, and what happens when it's down.</summary>
public class FoodsEndpointTests
{
    // Trimmed from a real FoodData Central search: a branded food (values per 100 g, with a label serving) and a
    // Foundation food (per 100 g, energy only by Atwater factors), plus one with no calories to skip.
    private const string UsdaAnswer = """
        { "foods": [
          { "description": "GREEK YOGURT, PLAIN", "dataType": "Branded", "brandOwner": "FAGE USA DAIRY INDUSTRY",
            "servingSize": 170, "servingSizeUnit": "g", "householdServingFullText": "3/4 cup",
            "foodNutrients": [ { "nutrientNumber": "208", "unitName": "KCAL", "value": 59 },
                               { "nutrientNumber": "203", "unitName": "G", "value": 10.3 },
                               { "nutrientNumber": "205", "unitName": "G", "value": 3.6 },
                               { "nutrientNumber": "204", "unitName": "G", "value": 0.4 } ] },
          { "description": "Chicken, breast, boneless, skinless, raw", "dataType": "Foundation",
            "foodNutrients": [ { "nutrientNumber": "268", "unitName": "KJ", "value": 500 },
                               { "nutrientNumber": "957", "unitName": "KCAL", "value": 120 },
                               { "nutrientNumber": "203", "unitName": "G", "value": 22.5 },
                               { "nutrientNumber": "204", "unitName": "G", "value": 1.93 } ] },
          { "description": "Water", "dataType": "SR Legacy", "foodNutrients": [] }
        ] }
        """;

    private static WebApplicationFactory<Program> FactoryAnswering(HttpStatusCode status, string body, List<Uri>? requests = null) =>
        TestDb.Factory().WithWebHostBuilder(b => b.ConfigureTestServices(services =>
            services.AddHttpClient<UsdaClient>().ConfigurePrimaryHttpMessageHandler(() => new FakeUsda(status, body, requests ?? []))));

    [Fact]
    public async Task Search_NormalizesToOneServing_AndCachesTheAnswer()
    {
        var requests = new List<Uri>();
        using var factory = FactoryAnswering(HttpStatusCode.OK, UsdaAnswer, requests);
        using var client = factory.CreateClient();

        var foods = await client.GetFromJsonAsync<List<FoodResult>>("/foods?q=greek%20yogurt");

        Assert.Equal(
            [
                new("Greek Yogurt, Plain", "Fage Usa Dairy Industry", "3/4 cup (170 g)", 100m, 17.5m, 6.1m, 0.7m),
                new("Chicken, breast, boneless, skinless, raw", null, "100 g", 120m, 22.5m, 0m, 1.9m),
            ],
            foods);
        Assert.Contains("query=greek%20yogurt", requests.Single().Query);
        Assert.Contains("api_key=DEMO_KEY", requests.Single().Query); // no key configured

        await client.GetAsync("/foods?q=Greek%20Yogurt%20"); // same search, other case and spacing
        Assert.Single(requests);
    }

    [Fact]
    public async Task Search_WhenUsdaIsDown_Returns503WithAMessage()
    {
        using var factory = FactoryAnswering(HttpStatusCode.TooManyRequests, "{}");
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/foods?q=oats");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Contains("Quick Add", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Search_NeedsTwoLetters()
    {
        using var factory = FactoryAnswering(HttpStatusCode.OK, UsdaAnswer);
        using var client = factory.CreateClient();

        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/foods?q=a")).StatusCode);
    }

    private class FakeUsda(HttpStatusCode status, string body, List<Uri> requests) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            requests.Add(request.RequestUri!);
            return Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") });
        }
    }
}
