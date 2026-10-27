using System.Net;
using System.Net.Http.Json;
using Forge.Api.Controllers;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Forge.Tests;

/// <summary>Calls /routines over HTTP against the real SQL Server test database.</summary>
public class RoutinesEndpointTests : IDisposable
{
    private const int Bench = 1; // built-in "Bench Press (Barbell)"
    private const int Squat = 14; // built-in "Squat (Barbell)"

    private readonly WebApplicationFactory<Program> _factory;

    public RoutinesEndpointTests()
    {
        TestDb.CreateClean().Dispose();
        _factory = TestDb.Factory();
    }

    public void Dispose() => _factory.Dispose();

    private static readonly WorkoutSetRequest BenchSet = new(Bench, 135, 8);
    private static readonly WorkoutSetRequest SquatSet = new(Squat, 185, 5);

    private static Task<List<RoutineResponse>> ListAsync(HttpClient client) =>
        client.GetFromJsonAsync<List<RoutineResponse>>("/routines")!;

    [Fact]
    public async Task Put_SavesThenReplaces_AndListIsByName()
    {
        using var alice = _factory.ClientFor("alice");
        var push = Guid.NewGuid();

        var created = await alice.PutAsJsonAsync($"/routines/{push}", new RoutineRequest(" Push A ", [BenchSet, BenchSet]));
        var retried = await alice.PutAsJsonAsync($"/routines/{push}", new RoutineRequest("Push A", [BenchSet, BenchSet]));
        await alice.PutAsJsonAsync($"/routines/{Guid.NewGuid()}", new RoutineRequest("Legs", [SquatSet]));

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(HttpStatusCode.OK, retried.StatusCode);
        var routines = await ListAsync(alice);
        Assert.Equal(["Legs", "Push A"], routines.Select(r => r.Name)); // trimmed, by name
        Assert.Equal([BenchSet, BenchSet], routines[1].Sets);

        // Replacing swaps the sets too.
        await alice.PutAsJsonAsync($"/routines/{push}", new RoutineRequest("Push B", [SquatSet]));
        var replaced = (await ListAsync(alice)).Single(r => r.Id == push);
        Assert.Equal("Push B", replaced.Name);
        Assert.Equal([SquatSet], replaced.Sets);
    }

    [Fact]
    public async Task Sets_KeepKindsAndSupersets_AndCardioKeepsOnlyDistanceAndTime()
    {
        using var alice = _factory.ClientFor("alice");
        var exercises = await alice.GetFromJsonAsync<List<ExerciseResponse>>("/exercises");
        var running = exercises!.Single(e => e.Name == "Running").Id;
        var id = Guid.NewGuid();

        await alice.PutAsJsonAsync($"/routines/{id}", new RoutineRequest("Push A",
        [
            new(Bench, 95, 10, Kind: "warmup"),
            new(Bench, 135, 8, Superset: 1),
            new(Squat, 185, 5, Kind: "failure", Superset: 1),
            new(running, 50, 3, Distance: 1, DurationSeconds: 600, Kind: "drop"), // weight, reps, and a kind don't apply
        ]));

        Assert.Equal(
            [
                new(Bench, 95, 10, Kind: "warmup"),
                new(Bench, 135, 8, Superset: 1),
                new(Squat, 185, 5, Kind: "failure", Superset: 1),
                new(running, 0, 0, Distance: 1, DurationSeconds: 600),
            ],
            Assert.Single(await ListAsync(alice)).Sets);
    }

    [Fact]
    public async Task OtherUsersRoutines_AreInvisible_AndCantBeChanged()
    {
        using var alice = _factory.ClientFor("alice");
        using var bob = _factory.ClientFor("bob");
        var id = Guid.NewGuid();
        await alice.PutAsJsonAsync($"/routines/{id}", new RoutineRequest("Push A", [BenchSet]));

        Assert.Empty(await ListAsync(bob));
        Assert.Equal(HttpStatusCode.NotFound, (await bob.PutAsJsonAsync($"/routines/{id}", new RoutineRequest("Mine now", [SquatSet]))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.DeleteAsync($"/routines/{id}")).StatusCode);
        Assert.Equal("Push A", Assert.Single(await ListAsync(alice)).Name);
    }

    [Fact]
    public async Task Put_InvalidRoutine_Returns400_AndSavesNothing()
    {
        using var alice = _factory.ClientFor("alice");
        using var bob = _factory.ClientFor("bob");
        var bobsExercise = await bob.PostAsJsonAsync("/exercises", new ExerciseRequest("Zercher Squat", "Legs"));
        var bobsExerciseId = (await bobsExercise.Content.ReadFromJsonAsync<ExerciseResponse>())!.Id;

        RoutineRequest[] invalid =
        [
            new(" ", [BenchSet]),
            new(new string('x', 51), [BenchSet]),
            new("No sets", []),
            new("Too many sets", [.. Enumerable.Repeat(BenchSet, WorkoutsController.MaxSets + 1)]),
            new("No reps", [BenchSet with { Reps = 0 }]),
            new("Bad kind", [BenchSet with { Kind = "superset" }]),
            new("Unknown exercise", [BenchSet with { ExerciseId = 999_999 }]),
            new("Someone else's exercise", [BenchSet with { ExerciseId = bobsExerciseId }]),
        ];

        foreach (var routine in invalid)
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await alice.PutAsJsonAsync($"/routines/{Guid.NewGuid()}", routine)).StatusCode);
        }
        Assert.Empty(await ListAsync(alice));
    }

    [Fact]
    public async Task Put_StopsAtTheLimit_ButStillReplaces()
    {
        using var alice = _factory.ClientFor("alice");
        var first = Guid.NewGuid();
        await alice.PutAsJsonAsync($"/routines/{first}", new RoutineRequest("Routine 0", [BenchSet]));
        for (var i = 1; i < RoutinesController.MaxPerUser; i++)
        {
            await alice.PutAsJsonAsync($"/routines/{Guid.NewGuid()}", new RoutineRequest($"Routine {i}", [BenchSet]));
        }

        var oneMore = await alice.PutAsJsonAsync($"/routines/{Guid.NewGuid()}", new RoutineRequest("One more", [BenchSet]));
        var replace = await alice.PutAsJsonAsync($"/routines/{first}", new RoutineRequest("Routine 0, renamed", [BenchSet]));

        Assert.Equal(HttpStatusCode.BadRequest, oneMore.StatusCode);
        Assert.Equal(HttpStatusCode.OK, replace.StatusCode);
    }

    [Fact]
    public async Task Delete_RemovesTheRoutine()
    {
        using var alice = _factory.ClientFor("alice");
        var id = Guid.NewGuid();
        await alice.PutAsJsonAsync($"/routines/{id}", new RoutineRequest("Push A", [BenchSet]));

        Assert.Equal(HttpStatusCode.NoContent, (await alice.DeleteAsync($"/routines/{id}")).StatusCode);

        Assert.Empty(await ListAsync(alice));
        Assert.Equal(HttpStatusCode.NotFound, (await alice.DeleteAsync($"/routines/{id}")).StatusCode);
    }

    [Fact]
    public async Task MissingUserIdHeader_Returns400()
    {
        using var anonymous = _factory.CreateClient();

        Assert.Equal(HttpStatusCode.BadRequest, (await anonymous.GetAsync("/routines")).StatusCode);
    }
}
