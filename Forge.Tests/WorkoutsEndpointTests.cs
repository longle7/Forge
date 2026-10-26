using System.Net;
using System.Net.Http.Json;
using Forge.Api.Controllers;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Forge.Tests;

/// <summary>
/// Calls the /workouts endpoints over HTTP against the real SQL Server test database.
/// </summary>
public class WorkoutsEndpointTests : IDisposable
{
    private const int Bench = 1; // built-in "Bench Press (Barbell)"
    private const int Squat = 14; // built-in "Squat (Barbell)"
    private static readonly DateTimeOffset Start = new(2026, 10, 10, 17, 30, 0, TimeSpan.FromHours(-4));

    private readonly WebApplicationFactory<Program> _factory;

    public WorkoutsEndpointTests()
    {
        TestDb.CreateClean().Dispose();
        _factory = TestDb.Factory();
    }

    public void Dispose() => _factory.Dispose();

    // Bench 135x8, 135x6, then Squat 185x5, unless other sets are given.
    private static WorkoutRequest Request(params (int ExerciseId, decimal Weight, int Reps)[] sets) =>
        new("Evening Workout", Start, Start.AddMinutes(55), sets.Length > 0
            ? [.. sets.Select(s => new WorkoutSetRequest(s.ExerciseId, s.Weight, s.Reps))]
            : [new(Bench, 135, 8), new(Bench, 135, 6), new(Squat, 185, 5)]);

    private static Task<List<WorkoutResponse>> ListAsync(HttpClient client) =>
        client.GetFromJsonAsync<List<WorkoutResponse>>("/workouts")!;

    [Fact]
    public async Task Put_CreatesThenReplaces_AndARetryNeverDuplicates()
    {
        using var alice = _factory.ClientFor("alice");
        var id = Guid.NewGuid();

        var created = await alice.PutAsJsonAsync($"/workouts/{id}", Request());
        var retried = await alice.PutAsJsonAsync($"/workouts/{id}", Request()); // Finish again after a lost response

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(HttpStatusCode.OK, retried.StatusCode);
        var workout = Assert.Single(await ListAsync(alice));
        Assert.Equal(id, workout.Id);
        Assert.Equal("Evening Workout", workout.Name);
        Assert.Equal(Start.UtcDateTime, workout.StartedAt);
        Assert.Equal(DateTimeKind.Utc, workout.StartedAt.Kind);
        Assert.Equal([(Bench, 135m, 8), (Bench, 135m, 6), (Squat, 185m, 5)], workout.Sets.Select(s => (s.ExerciseId, s.Weight, s.Reps)));

        // An edit replaces every set, in the new order.
        var edited = await alice.PutAsJsonAsync($"/workouts/{id}", Request((Squat, 190, 5), (Bench, 137.5m, 8)));

        Assert.Equal(HttpStatusCode.OK, edited.StatusCode);
        var fetched = Assert.Single(await ListAsync(alice));
        Assert.Equal([(Squat, 190m, 5), (Bench, 137.5m, 8)], fetched.Sets.Select(s => (s.ExerciseId, s.Weight, s.Reps)));
    }

    [Fact]
    public async Task List_IsNewestFirst()
    {
        using var alice = _factory.ClientFor("alice");
        var older = Guid.NewGuid();
        var newer = Guid.NewGuid();
        await alice.PutAsJsonAsync($"/workouts/{older}", Request() with { StartedAt = Start.AddDays(-2), FinishedAt = Start.AddDays(-2).AddHours(1) });
        await alice.PutAsJsonAsync($"/workouts/{newer}", Request());

        Assert.Equal([newer, older], (await ListAsync(alice)).Select(w => w.Id));
    }

    [Fact]
    public async Task OtherUsersWorkouts_AreInvisible_AndCantBeOverwritten()
    {
        using var alice = _factory.ClientFor("alice");
        using var bob = _factory.ClientFor("bob");
        var id = Guid.NewGuid();
        await alice.PutAsJsonAsync($"/workouts/{id}", Request());

        Assert.Empty(await ListAsync(bob));
        Assert.Equal(HttpStatusCode.NotFound, (await bob.PutAsJsonAsync($"/workouts/{id}", Request((Squat, 500, 1)))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.DeleteAsync($"/workouts/{id}")).StatusCode);
        Assert.Equal(3, Assert.Single(await ListAsync(alice)).Sets.Count());
    }

    [Fact]
    public async Task Put_InvalidRequest_Returns400_AndSavesNothing()
    {
        using var alice = _factory.ClientFor("alice");
        using var bob = _factory.ClientFor("bob");
        var bobsExercise = await bob.PostAsJsonAsync("/exercises", new ExerciseRequest("Zercher Squat", "Legs"));
        var bobsExerciseId = (await bobsExercise.Content.ReadFromJsonAsync<ExerciseResponse>())!.Id;

        WorkoutRequest[] invalid =
        [
            Request() with { Sets = [] },
            Request((Bench, 135, 0)), // no reps
            Request((Bench, -5, 5)),
            Request((Bench, 2500, 1)),
            Request((999_999, 135, 5)), // no such exercise
            Request((bobsExerciseId, 135, 5)), // someone else's exercise
            Request() with { FinishedAt = Start.AddMinutes(-1) },
            Request() with { FinishedAt = Start.AddHours(25) },
            Request() with { Name = new string('x', 101) },
            Request() with { Sets = [new(Bench, 135, 8, Kind: "superset")] }, // a superset has its own field
            Request() with { Sets = [new(Bench, 135, 8, Superset: 0)] },
        ];

        foreach (var request in invalid)
        {
            var response = await alice.PutAsJsonAsync($"/workouts/{Guid.NewGuid()}", request);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
        Assert.Empty(await ListAsync(alice));
    }

    [Fact]
    public async Task CardioSets_KeepDistanceAndTime_AndStrengthSetsKeepWeightAndReps()
    {
        using var alice = _factory.ClientFor("alice");
        var exercises = await alice.GetFromJsonAsync<List<ExerciseResponse>>("/exercises");
        var running = exercises!.Single(e => e.Name == "Running").Id;
        var elliptical = exercises!.Single(e => e.Name == "Elliptical (Machine)").Id;
        var stairs = (await (await alice.PostAsJsonAsync("/exercises", new ExerciseRequest("Stair Climber", "Cardio")))
            .Content.ReadFromJsonAsync<ExerciseResponse>())!.Id; // your own exercise in Cardio is cardio too
        var id = Guid.NewGuid();

        var response = await alice.PutAsJsonAsync($"/workouts/{id}", Request() with
        {
            Sets =
            [
                new(running, Weight: 50, Reps: 3, Distance: 3.1m, DurationSeconds: 1620), // weight and reps don't apply
                new(elliptical, 0, 0, DurationSeconds: 1800), // time only
                new(stairs, 0, 0, Distance: 0, DurationSeconds: 600),
                new(Bench, 135, 8, Distance: 2, DurationSeconds: 60), // distance and time don't apply
            ],
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var sets = Assert.Single(await ListAsync(alice)).Sets;
        Assert.Equal(
            [(running, 0m, 0, 3.1m, 1620), (elliptical, 0m, 0, null, 1800), (stairs, 0m, 0, null, 600), (Bench, 135m, 8, null, (int?)null)],
            sets.Select(s => (s.ExerciseId, s.Weight, s.Reps, s.Distance, s.DurationSeconds)));

        WorkoutSetRequest[] invalid =
        [
            new(running, 0, 5), // reps, but no distance or time
            new(running, 0, 0, Distance: 0, DurationSeconds: 0),
            new(running, 0, 0, Distance: -1, DurationSeconds: 600),
            new(running, 0, 0, DurationSeconds: 90_000), // over 24 hours
            new(Bench, 0, 0, Distance: 3), // a strength set needs reps
        ];
        foreach (var set in invalid)
        {
            var bad = await alice.PutAsJsonAsync($"/workouts/{Guid.NewGuid()}", Request() with { Sets = [set] });
            Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        }
        Assert.Single(await ListAsync(alice));
    }

    [Fact]
    public async Task SetKindsAndSupersets_RoundTrip_ButCardioSetsHaveNoKind()
    {
        using var alice = _factory.ClientFor("alice");
        var exercises = await alice.GetFromJsonAsync<List<ExerciseResponse>>("/exercises");
        var running = exercises!.Single(e => e.Name == "Running").Id;

        // A bench warm-up, bench and squats as a superset, and a bench drop set; then a run.
        var response = await alice.PutAsJsonAsync($"/workouts/{Guid.NewGuid()}", Request() with
        {
            Sets =
            [
                new(Bench, 95, 10, Kind: "warmup"),
                new(Bench, 135, 8, Superset: 1),
                new(Squat, 185, 5, Kind: "failure", Superset: 1),
                new(Bench, 115, 10, Kind: "drop"),
                new(running, 0, 0, DurationSeconds: 600, Kind: "warmup", Superset: 2), // keeps its superset, never a kind
            ],
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(
            [(Bench, "warmup", null), (Bench, null, 1), (Squat, "failure", 1), (Bench, "drop", null), (running, null, (int?)2)],
            Assert.Single(await ListAsync(alice)).Sets.Select(s => (s.ExerciseId, s.Kind, s.Superset)));
    }

    [Fact]
    public async Task Put_WithYourOwnExercise_AndNoName_SavesAsWorkout()
    {
        using var alice = _factory.ClientFor("alice");
        var mine = await alice.PostAsJsonAsync("/exercises", new ExerciseRequest("Zercher Squat", "Legs"));
        var mineId = (await mine.Content.ReadFromJsonAsync<ExerciseResponse>())!.Id;

        var response = await alice.PutAsJsonAsync($"/workouts/{Guid.NewGuid()}", Request((mineId, 95, 10)) with { Name = " " });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("Workout", (await response.Content.ReadFromJsonAsync<WorkoutResponse>())!.Name);
    }

    [Fact]
    public async Task Delete_RemovesTheWorkout()
    {
        using var alice = _factory.ClientFor("alice");
        var id = Guid.NewGuid();
        await alice.PutAsJsonAsync($"/workouts/{id}", Request());

        Assert.Equal(HttpStatusCode.NoContent, (await alice.DeleteAsync($"/workouts/{id}")).StatusCode);

        Assert.Empty(await ListAsync(alice));
        Assert.Equal(HttpStatusCode.NotFound, (await alice.DeleteAsync($"/workouts/{id}")).StatusCode);
        using var db = TestDb.Open();
        Assert.Empty(db.WorkoutSets.Where(s => s.WorkoutId == id)); // its sets went with it
    }

    [Fact]
    public async Task MissingUserIdHeader_Returns400()
    {
        using var anonymous = _factory.CreateClient();

        Assert.Equal(HttpStatusCode.BadRequest, (await anonymous.GetAsync("/workouts")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await anonymous.PutAsJsonAsync($"/workouts/{Guid.NewGuid()}", Request())).StatusCode);
    }
}
