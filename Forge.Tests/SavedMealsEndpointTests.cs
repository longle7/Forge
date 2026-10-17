using System.Net;
using System.Net.Http.Json;
using Forge.Api.Controllers;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Forge.Tests;

/// <summary>Calls /saved-meals over HTTP against the real SQL Server test database.</summary>
public class SavedMealsEndpointTests : IDisposable
{
    private readonly WebApplicationFactory<Program> _factory;

    public SavedMealsEndpointTests()
    {
        TestDb.CreateClean().Dispose();
        _factory = TestDb.Factory();
    }

    public void Dispose() => _factory.Dispose();

    private static readonly SavedMealItemDto Oats = new("Rolled Oats", "1/2 cup (40 g)", 2, 150, 5, 27, 3, Fiber: 4, Sugar: 1, Sodium: 0);
    private static readonly SavedMealItemDto Banana = new("Banana", null, 1, 105, 1.3m, 27, 0.4m);

    private static Task<List<SavedMealResponse>> ListAsync(HttpClient client) =>
        client.GetFromJsonAsync<List<SavedMealResponse>>("/saved-meals")!;

    [Fact]
    public async Task Put_SavesThenReplaces_AndListIsByName()
    {
        using var alice = _factory.ClientFor("alice");
        var breakfast = Guid.NewGuid();

        var created = await alice.PutAsJsonAsync($"/saved-meals/{breakfast}", new SavedMealRequest(" Usual breakfast ", [Oats, Banana]));
        var retried = await alice.PutAsJsonAsync($"/saved-meals/{breakfast}", new SavedMealRequest("Usual breakfast", [Oats, Banana]));
        await alice.PutAsJsonAsync($"/saved-meals/{Guid.NewGuid()}", new SavedMealRequest("Post-workout shake", [Banana]));

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(HttpStatusCode.OK, retried.StatusCode);
        var meals = await ListAsync(alice);
        Assert.Equal(["Post-workout shake", "Usual breakfast"], meals.Select(m => m.Name)); // trimmed, by name
        Assert.Equal([Oats, Banana with { Serving = "1 serving" }], meals[1].Items); // a missing serving gets a default

        // Replacing swaps the foods too.
        await alice.PutAsJsonAsync($"/saved-meals/{breakfast}", new SavedMealRequest("Light breakfast", [Banana]));
        var replaced = (await ListAsync(alice)).Single(m => m.Id == breakfast);
        Assert.Equal("Light breakfast", replaced.Name);
        Assert.Equal(["Banana"], replaced.Items.Select(i => i.Name));
    }

    [Fact]
    public async Task OtherUsersMeals_AreInvisible_AndCantBeChanged()
    {
        using var alice = _factory.ClientFor("alice");
        using var bob = _factory.ClientFor("bob");
        var id = Guid.NewGuid();
        await alice.PutAsJsonAsync($"/saved-meals/{id}", new SavedMealRequest("Usual breakfast", [Oats]));

        Assert.Empty(await ListAsync(bob));
        Assert.Equal(HttpStatusCode.NotFound, (await bob.PutAsJsonAsync($"/saved-meals/{id}", new SavedMealRequest("Mine now", [Banana]))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.DeleteAsync($"/saved-meals/{id}")).StatusCode);
        Assert.Equal("Usual breakfast", Assert.Single(await ListAsync(alice)).Name);
    }

    [Fact]
    public async Task Put_InvalidMeal_Returns400_AndSavesNothing()
    {
        using var alice = _factory.ClientFor("alice");
        SavedMealRequest[] invalid =
        [
            new(" ", [Oats]),
            new(new string('x', 51), [Oats]),
            new("No foods", []),
            new("Too many foods", [.. Enumerable.Repeat(Oats, 31)]),
            new("Bad food", [Oats with { Name = "" }]),
            new("Bad food", [Oats with { Servings = 0 }]),
            new("Bad food", [Oats with { Calories = 5001 }]),
            new("Bad food", [Oats with { Fat = -1 }]),
        ];

        foreach (var meal in invalid)
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await alice.PutAsJsonAsync($"/saved-meals/{Guid.NewGuid()}", meal)).StatusCode);
        }
        Assert.Empty(await ListAsync(alice));
    }

    [Fact]
    public async Task Put_StopsAtTheLimit_ButStillReplaces()
    {
        using var alice = _factory.ClientFor("alice");
        var first = Guid.NewGuid();
        await alice.PutAsJsonAsync($"/saved-meals/{first}", new SavedMealRequest("Meal 0", [Oats]));
        for (var i = 1; i < SavedMealsController.MaxPerUser; i++)
        {
            await alice.PutAsJsonAsync($"/saved-meals/{Guid.NewGuid()}", new SavedMealRequest($"Meal {i}", [Oats]));
        }

        var oneMore = await alice.PutAsJsonAsync($"/saved-meals/{Guid.NewGuid()}", new SavedMealRequest("One more", [Oats]));
        var replace = await alice.PutAsJsonAsync($"/saved-meals/{first}", new SavedMealRequest("Meal 0, renamed", [Oats]));

        Assert.Equal(HttpStatusCode.BadRequest, oneMore.StatusCode);
        Assert.Equal(HttpStatusCode.OK, replace.StatusCode);
    }

    [Fact]
    public async Task Delete_RemovesTheMeal()
    {
        using var alice = _factory.ClientFor("alice");
        var id = Guid.NewGuid();
        await alice.PutAsJsonAsync($"/saved-meals/{id}", new SavedMealRequest("Usual breakfast", [Oats]));

        Assert.Equal(HttpStatusCode.NoContent, (await alice.DeleteAsync($"/saved-meals/{id}")).StatusCode);

        Assert.Empty(await ListAsync(alice));
        Assert.Equal(HttpStatusCode.NotFound, (await alice.DeleteAsync($"/saved-meals/{id}")).StatusCode);
    }

    [Fact]
    public async Task MissingUserIdHeader_Returns400()
    {
        using var anonymous = _factory.CreateClient();

        Assert.Equal(HttpStatusCode.BadRequest, (await anonymous.GetAsync("/saved-meals")).StatusCode);
    }
}
