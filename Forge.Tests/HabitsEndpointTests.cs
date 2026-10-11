using System.Net;
using System.Net.Http.Json;
using Forge.Api.Controllers;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Forge.Tests;

/// <summary>Calls /habits over HTTP against the real SQL Server test database.</summary>
public class HabitsEndpointTests : IDisposable
{
    private static readonly DateOnly Today = DateOnly.FromDateTime(DateTime.UtcNow);
    private readonly WebApplicationFactory<Program> _factory;

    public HabitsEndpointTests()
    {
        TestDb.CreateClean().Dispose();
        _factory = TestDb.Factory();
    }

    public void Dispose() => _factory.Dispose();

    private static HabitRequest Water(bool archived = false) => new("Water", "💧", 8, 127, archived);

    private static Task<List<HabitResponse>> ListAsync(HttpClient client) => client.GetFromJsonAsync<List<HabitResponse>>("/habits")!;

    [Fact]
    public async Task Put_CreatesThenUpdates_AndChecksCountPerDay()
    {
        using var alice = _factory.ClientFor("alice");
        var id = Guid.NewGuid();

        Assert.Equal(HttpStatusCode.Created, (await alice.PutAsJsonAsync($"/habits/{id}", Water())).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await alice.PutAsJsonAsync($"/habits/{id}/checks/{Today:yyyy-MM-dd}", new HabitCheckRequest(3))).StatusCode);
        await alice.PutAsJsonAsync($"/habits/{id}/checks/{Today.AddDays(-1):yyyy-MM-dd}", new HabitCheckRequest(8));
        await alice.PutAsJsonAsync($"/habits/{id}/checks/{Today:yyyy-MM-dd}", new HabitCheckRequest(5)); // again today: replaces
        Assert.Equal(HttpStatusCode.OK, (await alice.PutAsJsonAsync($"/habits/{id}", Water() with { Name = " Water ", DailyTarget = 6 })).StatusCode);

        var habit = Assert.Single(await ListAsync(alice));
        Assert.Equal(("Water", "💧", 6, false), (habit.Name, habit.Emoji, habit.DailyTarget, habit.Archived));
        Assert.Equal([new(Today.AddDays(-1), 8), new HabitCheckDto(Today, 5)], habit.Checks); // edits keep the history

        await alice.PutAsJsonAsync($"/habits/{id}/checks/{Today:yyyy-MM-dd}", new HabitCheckRequest(0)); // cleared
        Assert.Single((await ListAsync(alice))[0].Checks);
    }

    [Fact]
    public async Task Archiving_KeepsHistory_AndDeleteRemovesEverything()
    {
        using var alice = _factory.ClientFor("alice");
        var id = Guid.NewGuid();
        await alice.PutAsJsonAsync($"/habits/{id}", Water());
        await alice.PutAsJsonAsync($"/habits/{id}/checks/{Today:yyyy-MM-dd}", new HabitCheckRequest(8));

        await alice.PutAsJsonAsync($"/habits/{id}", Water(archived: true));
        var archived = Assert.Single(await ListAsync(alice));
        Assert.True(archived.Archived);
        Assert.Single(archived.Checks);

        Assert.Equal(HttpStatusCode.NoContent, (await alice.DeleteAsync($"/habits/{id}")).StatusCode);
        Assert.Empty(await ListAsync(alice));
        using var db = TestDb.Open();
        Assert.Empty(db.HabitChecks.Where(c => c.HabitId == id));
    }

    [Fact]
    public async Task OtherUsersHabits_AreInvisible_AndUntouchable()
    {
        using var alice = _factory.ClientFor("alice");
        using var bob = _factory.ClientFor("bob");
        var id = Guid.NewGuid();
        await alice.PutAsJsonAsync($"/habits/{id}", Water());

        Assert.Empty(await ListAsync(bob));
        Assert.Equal(HttpStatusCode.NotFound, (await bob.PutAsJsonAsync($"/habits/{id}", Water() with { Name = "Mine" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.PutAsJsonAsync($"/habits/{id}/checks/{Today:yyyy-MM-dd}", new HabitCheckRequest(1))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.DeleteAsync($"/habits/{id}")).StatusCode);
        Assert.Empty((await ListAsync(alice))[0].Checks);
    }

    [Fact]
    public async Task Put_InvalidHabit_Returns400()
    {
        using var alice = _factory.ClientFor("alice");
        HabitRequest[] invalid = [Water() with { Name = "" }, Water() with { DailyTarget = 0 }, Water() with { DailyTarget = 21 }, Water() with { Days = 0 }, Water() with { Days = 128 }];

        foreach (var habit in invalid)
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await alice.PutAsJsonAsync($"/habits/{Guid.NewGuid()}", habit)).StatusCode);
        }
        Assert.Empty(await ListAsync(alice));
    }

    [Fact]
    public async Task ActiveHabits_AreCapped_ButArchivedOnesDontCount()
    {
        using var alice = _factory.ClientFor("alice");
        for (var i = 0; i < HabitsController.MaxActive; i++)
            Assert.Equal(HttpStatusCode.Created, (await alice.PutAsJsonAsync($"/habits/{Guid.NewGuid()}", Water())).StatusCode);

        Assert.Equal(HttpStatusCode.BadRequest, (await alice.PutAsJsonAsync($"/habits/{Guid.NewGuid()}", Water())).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await alice.PutAsJsonAsync($"/habits/{Guid.NewGuid()}", Water(archived: true))).StatusCode);
    }
}
