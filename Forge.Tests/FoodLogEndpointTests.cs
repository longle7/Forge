using System.Net;
using System.Net.Http.Json;
using Forge.Api.Controllers;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Forge.Tests;

/// <summary>Calls /food-log over HTTP against the real SQL Server test database.</summary>
public class FoodLogEndpointTests : IDisposable
{
    private static readonly DateOnly Today = new(2026, 10, 10);

    private readonly WebApplicationFactory<Program> _factory;

    public FoodLogEndpointTests()
    {
        TestDb.CreateClean().Dispose();
        _factory = TestDb.Factory();
    }

    public void Dispose() => _factory.Dispose();

    // Greek yogurt: 1 cup = 150 kcal, 20 g protein, 9 g carbs, 4 g fat.
    private static FoodEntryRequest Yogurt(DateOnly? date = null, decimal servings = 1, string meal = "breakfast") =>
        new(date ?? Today, meal, "Greek Yogurt", "1 cup (227 g)", servings, 150, 20, 9, 4, "search");

    private static Task<List<FoodEntryDto>> DayAsync(HttpClient client, DateOnly date) =>
        client.GetFromJsonAsync<List<FoodEntryDto>>($"/food-log?date={date:yyyy-MM-dd}")!;

    [Fact]
    public async Task Put_LogsThenReplaces_AndARetryNeverDuplicates()
    {
        using var alice = _factory.ClientFor("alice");
        var id = Guid.NewGuid();

        Assert.Equal(HttpStatusCode.Created, (await alice.PutAsJsonAsync($"/food-log/{id}", Yogurt())).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await alice.PutAsJsonAsync($"/food-log/{id}", Yogurt())).StatusCode); // a retry
        await alice.PutAsJsonAsync($"/food-log/{id}", Yogurt(servings: 1.5m, meal: "snack")); // an edit

        var entry = Assert.Single(await DayAsync(alice, Today));
        Assert.Equal((id, "snack", 1.5m, "search"), (entry.Id, entry.Meal, entry.Servings, entry.Source));
        Assert.Empty(await DayAsync(alice, Today.AddDays(-1)));
    }

    [Fact]
    public async Task Days_TotalsEachDay_ServingsIncluded()
    {
        using var alice = _factory.ClientFor("alice");
        await alice.PutAsJsonAsync($"/food-log/{Guid.NewGuid()}", Yogurt(servings: 2));
        await alice.PutAsJsonAsync($"/food-log/{Guid.NewGuid()}", Yogurt(meal: "lunch"));
        await alice.PutAsJsonAsync($"/food-log/{Guid.NewGuid()}", Yogurt(date: Today.AddDays(-2)));
        await alice.PutAsJsonAsync($"/food-log/{Guid.NewGuid()}", Yogurt(date: Today.AddDays(-40))); // outside the range

        var days = await alice.GetFromJsonAsync<List<DayTotals>>($"/food-log/days?from={Today.AddDays(-29):yyyy-MM-dd}&to={Today:yyyy-MM-dd}");

        Assert.Equal(
            [new(Today.AddDays(-2), 150m, 20m), new(Today, 450m, 60m)],
            days);
        Assert.Equal(HttpStatusCode.BadRequest, (await alice.GetAsync($"/food-log/days?from={Today:yyyy-MM-dd}&to={Today.AddDays(-1):yyyy-MM-dd}")).StatusCode);
    }

    [Fact]
    public async Task Recent_ListsEachFoodOnce_NewestFirst()
    {
        using var alice = _factory.ClientFor("alice");
        await alice.PutAsJsonAsync($"/food-log/{Guid.NewGuid()}", Yogurt());
        await alice.PutAsJsonAsync($"/food-log/{Guid.NewGuid()}", Yogurt() with { Name = "Banana", Serving = "1 medium" });
        await alice.PutAsJsonAsync($"/food-log/{Guid.NewGuid()}", Yogurt() with { Name = "greek yogurt" }); // same food, other case

        var recent = await alice.GetFromJsonAsync<List<FoodEntryDto>>("/food-log/recent");

        Assert.Equal(["greek yogurt", "Banana"], recent!.Select(f => f.Name));
    }

    [Fact]
    public async Task OtherUsersEntries_AreInvisible_AndCantBeOverwritten()
    {
        using var alice = _factory.ClientFor("alice");
        using var bob = _factory.ClientFor("bob");
        var id = Guid.NewGuid();
        await alice.PutAsJsonAsync($"/food-log/{id}", Yogurt());

        Assert.Empty(await DayAsync(bob, Today));
        Assert.Equal(HttpStatusCode.NotFound, (await bob.PutAsJsonAsync($"/food-log/{id}", Yogurt(servings: 9))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.DeleteAsync($"/food-log/{id}")).StatusCode);
        Assert.Equal(1m, Assert.Single(await DayAsync(alice, Today)).Servings);

        Assert.Equal(HttpStatusCode.NoContent, (await alice.DeleteAsync($"/food-log/{id}")).StatusCode);
        Assert.Empty(await DayAsync(alice, Today));
    }

    [Fact]
    public async Task Put_InvalidEntry_Returns400()
    {
        using var alice = _factory.ClientFor("alice");
        FoodEntryRequest[] invalid =
        [
            Yogurt(meal: "brunch"),
            Yogurt(servings: 0),
            Yogurt() with { Name = "" },
            Yogurt() with { Calories = -1 },
            Yogurt() with { Source = "magic" },
        ];

        foreach (var entry in invalid)
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await alice.PutAsJsonAsync($"/food-log/{Guid.NewGuid()}", entry)).StatusCode);
        }
        Assert.Empty(await DayAsync(alice, Today));
    }
}
