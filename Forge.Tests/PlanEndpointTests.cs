using System.Net;
using System.Net.Http.Json;
using Forge.Api.Controllers;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Forge.Tests;

/// <summary>Calls /plan over HTTP against the real SQL Server test database.</summary>
public class PlanEndpointTests : IDisposable
{
    private const int Monday = 1;
    private const int Bench = 1; // built-in "Bench Press (Barbell)"
    private const int Pulldown = 10; // built-in "Lat Pulldown (Cable)"
    private const int Squat = 14; // built-in "Squat (Barbell)"

    private readonly WebApplicationFactory<Program> _factory;

    public PlanEndpointTests()
    {
        TestDb.CreateClean().Dispose();
        _factory = TestDb.Factory();
    }

    public void Dispose() => _factory.Dispose();

    private static PlanDayRequest PushDay() => new("Push Day", [new(Bench, 4, 8), new(Pulldown, 3, 10)]);

    private static Task<List<PlanDayResponse>> PlanAsync(HttpClient client) => client.GetFromJsonAsync<List<PlanDayResponse>>("/plan")!;

    [Fact]
    public async Task PlanADay_ReplaceIt_ThenMakeItARestDay()
    {
        using var alice = _factory.ClientFor("alice");
        Assert.Empty(await PlanAsync(alice)); // every day is a rest day to start

        Assert.Equal(HttpStatusCode.OK, (await alice.PutAsJsonAsync($"/plan/{Monday}", PushDay())).StatusCode);
        var monday = Assert.Single(await PlanAsync(alice));
        Assert.Equal((Monday, "Push Day"), (monday.DayOfWeek, monday.Name));
        Assert.Equal([new(Bench, 4, 8), new(Pulldown, 3, 10)], monday.Exercises);

        // Replacing keeps one plan for the day, with the new exercises in their new order, and when it was first planned.
        await alice.PutAsJsonAsync($"/plan/{Monday}", new PlanDayRequest(" Legs ", [new(Squat, 5, 5)]));
        var replaced = Assert.Single(await PlanAsync(alice));
        Assert.Equal("Legs", replaced.Name);
        Assert.Equal([new PlanExerciseDto(Squat, 5, 5)], replaced.Exercises);
        Assert.Equal(monday.CreatedAt, replaced.CreatedAt);

        Assert.Equal(HttpStatusCode.NoContent, (await alice.DeleteAsync($"/plan/{Monday}")).StatusCode);
        Assert.Empty(await PlanAsync(alice));
    }

    [Fact]
    public async Task Plans_ArePerUser()
    {
        using var alice = _factory.ClientFor("alice");
        using var bob = _factory.ClientFor("bob");
        await alice.PutAsJsonAsync($"/plan/{Monday}", PushDay());

        Assert.Empty(await PlanAsync(bob));
        await bob.DeleteAsync($"/plan/{Monday}"); // only ever bob's own
        Assert.Single(await PlanAsync(alice));
    }

    [Fact]
    public async Task Put_InvalidPlan_Returns400_AndAnUnknownDay404()
    {
        using var alice = _factory.ClientFor("alice");
        PlanDayRequest[] invalid =
        [
            PushDay() with { Exercises = [] },
            PushDay() with { Name = "" },
            PushDay() with { Exercises = [new(999_999, 3, 10)] },
            PushDay() with { Exercises = [new(Bench, 0, 10)] },
            PushDay() with { Exercises = [new(Bench, 3, 101)] },
        ];

        foreach (var plan in invalid)
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await alice.PutAsJsonAsync($"/plan/{Monday}", plan)).StatusCode);
        }
        Assert.Equal(HttpStatusCode.NotFound, (await alice.PutAsJsonAsync("/plan/7", PushDay())).StatusCode);
        Assert.Empty(await PlanAsync(alice));
    }
}
