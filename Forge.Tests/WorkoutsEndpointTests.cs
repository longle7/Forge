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
        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(b => b.UseSetting("ConnectionStrings:DefaultConnection", TestDb.ConnectionString));
    }

    public void Dispose() => _factory.Dispose();

    private HttpClient ClientFor(string userId)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-User-Id", userId);
        return client;
    }

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
        using var alice = ClientFor("alice");
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
        var fetched = await alice.GetFromJsonAsync<WorkoutResponse>($"/workouts/{id}");
        Assert.Equal([(Squat, 190m, 5), (Bench, 137.5m, 8)], fetched!.Sets.Select(s => (s.ExerciseId, s.Weight, s.Reps)));
    }

    [Fact]
    public async Task List_IsNewestFirst()
    {
        using var alice = ClientFor("alice");
        var older = Guid.NewGuid();
        var newer = Guid.NewGuid();
        await alice.PutAsJsonAsync($"/workouts/{older}", Request() with { StartedAt = Start.AddDays(-2), FinishedAt = Start.AddDays(-2).AddHours(1) });
        await alice.PutAsJsonAsync($"/workouts/{newer}", Request());

        Assert.Equal([newer, older], (await ListAsync(alice)).Select(w => w.Id));
    }

    [Fact]
    public async Task OtherUsersWorkouts_AreInvisible_AndCantBeOverwritten()
    {
        using var alice = ClientFor("alice");
        using var bob = ClientFor("bob");
        var id = Guid.NewGuid();
        await alice.PutAsJsonAsync($"/workouts/{id}", Request());

        Assert.Empty(await ListAsync(bob));
        Assert.Equal(HttpStatusCode.NotFound, (await bob.GetAsync($"/workouts/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.PutAsJsonAsync($"/workouts/{id}", Request((Squat, 500, 1)))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.DeleteAsync($"/workouts/{id}")).StatusCode);
        Assert.Equal(3, Assert.Single(await ListAsync(alice)).Sets.Count());
    }

    [Fact]
    public async Task Put_InvalidRequest_Returns400_AndSavesNothing()
    {
        using var alice = ClientFor("alice");
        using var bob = ClientFor("bob");
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
        ];

        foreach (var request in invalid)
        {
            var response = await alice.PutAsJsonAsync($"/workouts/{Guid.NewGuid()}", request);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
        Assert.Empty(await ListAsync(alice));
    }

    [Fact]
    public async Task Put_WithYourOwnExercise_AndNoName_SavesAsWorkout()
    {
        using var alice = ClientFor("alice");
        var mine = await alice.PostAsJsonAsync("/exercises", new ExerciseRequest("Zercher Squat", "Legs"));
        var mineId = (await mine.Content.ReadFromJsonAsync<ExerciseResponse>())!.Id;

        var response = await alice.PutAsJsonAsync($"/workouts/{Guid.NewGuid()}", Request((mineId, 95, 10)) with { Name = " " });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("Workout", (await response.Content.ReadFromJsonAsync<WorkoutResponse>())!.Name);
    }

    [Fact]
    public async Task Delete_RemovesTheWorkout()
    {
        using var alice = ClientFor("alice");
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
