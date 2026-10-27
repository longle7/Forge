using System.Net;
using System.Net.Http.Json;
using Forge.Api.Controllers;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Forge.Tests;

/// <summary>Apple Watch / Apple Health workouts on /workouts, over HTTP against the real SQL Server test database.</summary>
public class HealthWorkoutsEndpointTests : IDisposable
{
    private const int Bench = 1; // built-in "Bench Press (Barbell)"
    private static readonly DateTimeOffset Start = new(2026, 10, 10, 17, 30, 0, TimeSpan.FromHours(-4));
    private static readonly List<HeartRatePointDto> Curve = [new(0, 98), new(30, 121), new(60, 144)];

    private readonly WebApplicationFactory<Program> _factory;

    public HealthWorkoutsEndpointTests()
    {
        TestDb.CreateClean().Dispose();
        _factory = TestDb.Factory();
    }

    public void Dispose() => _factory.Dispose();

    // A strength session from the Watch: no sets, but calories and heart rate.
    private static WorkoutRequest WatchStrength() =>
        new("Strength Training", Start, Start.AddMinutes(50), [], "health", "strength", 312, 128, 161, Curve);

    private static WorkoutRequest Logged() => new("Push Day", Start, Start.AddMinutes(55), [new(Bench, 185, 5)]);

    private static Task<List<WorkoutResponse>> ListAsync(HttpClient client) => client.GetFromJsonAsync<List<WorkoutResponse>>("/workouts")!;

    [Fact]
    public async Task AWatchWorkout_CanHaveNoSets_AndKeepsItsHealthData()
    {
        using var alice = _factory.ClientFor("alice");
        var id = Guid.NewGuid(); // Apple Health's own ID for it

        Assert.Equal(HttpStatusCode.Created, (await alice.PutAsJsonAsync($"/workouts/{id}", WatchStrength())).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await alice.PutAsJsonAsync($"/workouts/{id}", WatchStrength())).StatusCode); // brought in again

        var workout = Assert.Single(await ListAsync(alice));
        Assert.Equal(("health", "strength", 312m, 128, 161), (workout.Source, workout.Activity, workout.ActiveCalories, workout.AvgHeartRate, workout.MaxHeartRate));
        Assert.Equal(Curve, workout.HeartRate);
        Assert.Empty(workout.Sets);
    }

    [Fact]
    public async Task AForgeWorkout_StillNeedsASet_AndAnEditKeepsItsWatchData()
    {
        using var alice = _factory.ClientFor("alice");
        var id = Guid.NewGuid();

        Assert.Equal(HttpStatusCode.BadRequest, (await alice.PutAsJsonAsync($"/workouts/{id}", Logged() with { Sets = [] })).StatusCode);

        await alice.PutAsJsonAsync($"/workouts/{id}", Logged());
        var attached = await alice.PutAsJsonAsync($"/workouts/{id}/health", new WorkoutHealthRequest(298, 131, 158, Curve));
        Assert.Equal(HttpStatusCode.OK, attached.StatusCode);

        // Editing the sets in Forge sends no Watch data: what was attached stays.
        await alice.PutAsJsonAsync($"/workouts/{id}", Logged() with { Sets = [new(Bench, 190, 5)] });
        var workout = Assert.Single(await ListAsync(alice));
        Assert.Equal(("forge", 298m, 131, 158), (workout.Source, workout.ActiveCalories, workout.AvgHeartRate, workout.MaxHeartRate));
        Assert.Equal(Curve, workout.HeartRate);
        Assert.Equal(190m, Assert.Single(workout.Sets).Weight);
    }

    [Fact]
    public async Task PutHealth_IsYoursOnly_AndValidated()
    {
        using var alice = _factory.ClientFor("alice");
        using var bob = _factory.ClientFor("bob");
        var id = Guid.NewGuid();
        await alice.PutAsJsonAsync($"/workouts/{id}", Logged());

        Assert.Equal(HttpStatusCode.NotFound, (await bob.PutAsJsonAsync($"/workouts/{id}/health", new WorkoutHealthRequest(298, 131, 158))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await alice.PutAsJsonAsync($"/workouts/{Guid.NewGuid()}/health", new WorkoutHealthRequest(298, 131, 158))).StatusCode);

        WorkoutHealthRequest[] invalid =
        [
            new(6000, 131, 158),
            new(298, 20, 158),
            new(298, 131, 300),
            new(298, 131, 158, [new(0, 400)]),
            new(298, 131, 158, [.. Enumerable.Range(0, 601).Select(i => new HeartRatePointDto(i * 30, 120))]),
        ];
        foreach (var request in invalid)
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await alice.PutAsJsonAsync($"/workouts/{id}/health", request)).StatusCode);
        }
        Assert.Equal(HttpStatusCode.BadRequest, (await alice.PutAsJsonAsync($"/workouts/{Guid.NewGuid()}", WatchStrength() with { Source = "fitbit" })).StatusCode);
        Assert.Null(Assert.Single(await ListAsync(alice)).ActiveCalories);
    }

    [Fact]
    public async Task WorkoutsSavedBeforeHeartRate_StillList()
    {
        using var alice = _factory.ClientFor("alice");
        var id = Guid.NewGuid();
        await alice.PutAsJsonAsync($"/workouts/{id}", Logged());
        using (var db = TestDb.Open())
        {
            // What the migration leaves on older rows.
            await db.Database.ExecuteSqlRawAsync("UPDATE Workouts SET HeartRate = NULL WHERE Id = {0}", id);
        }

        var workout = Assert.Single(await ListAsync(alice));
        Assert.Empty(workout.HeartRate);
        Assert.Equal("forge", workout.Source);
    }
}
