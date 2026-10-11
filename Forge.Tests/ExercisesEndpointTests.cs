using System.Net;
using System.Net.Http.Json;
using Forge.Api.Controllers;
using Forge.Api.Data;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Forge.Tests;

/// <summary>
/// Calls the /exercises endpoints over HTTP against the real SQL Server test database.
/// </summary>
public class ExercisesEndpointTests : IDisposable
{
    private readonly WebApplicationFactory<Program> _factory;

    public ExercisesEndpointTests()
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

    private static Task<List<ExerciseResponse>> ListAsync(HttpClient client) =>
        client.GetFromJsonAsync<List<ExerciseResponse>>("/exercises")!;

    [Fact]
    public async Task BuiltIns_AreListedForEveryone_ByName()
    {
        using var alice = ClientFor("alice");

        var exercises = await ListAsync(alice);

        Assert.Equal(BuiltInExercises.All.Length + 5, exercises.Count); // + the cardio ones from the AddCardio migration
        Assert.Contains(exercises, e => e.Name == "Bench Press (Barbell)" && e.MuscleGroup == "Chest" && !e.IsCustom);
        Assert.Contains(exercises, e => e.Name == "Running" && e.MuscleGroup == "Cardio" && !e.IsCustom);
        Assert.Equal(exercises.Select(e => e.Name).Order(StringComparer.OrdinalIgnoreCase), exercises.Select(e => e.Name));
    }

    [Fact]
    public async Task CustomExercises_AreVisibleOnlyToTheirOwner()
    {
        using var alice = ClientFor("alice");
        using var bob = ClientFor("bob");

        var created = await alice.PostAsJsonAsync("/exercises", new ExerciseRequest(" Zercher Squat ", "Legs"));

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var exercise = (await created.Content.ReadFromJsonAsync<ExerciseResponse>())!;
        Assert.Equal("Zercher Squat", exercise.Name); // trimmed
        Assert.True(exercise.IsCustom);
        Assert.True(exercise.Id > BuiltInExercises.All.Length); // after the built-ins
        Assert.Contains(await ListAsync(alice), e => e.Id == exercise.Id);
        Assert.DoesNotContain(await ListAsync(bob), e => e.Id == exercise.Id);
    }

    [Theory]
    [InlineData("bench press (barbell)", "Chest")] // a built-in, in another case
    [InlineData("", "Chest")]
    [InlineData("Zercher Squat", "Glutes")] // not a muscle group we group by
    public async Task Create_InvalidRequest_Returns400(string name, string muscleGroup)
    {
        using var alice = ClientFor("alice");

        var response = await alice.PostAsJsonAsync("/exercises", new ExerciseRequest(name, muscleGroup));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_TheSameNameTwice_Returns400_ButAnotherUserCanUseIt()
    {
        using var alice = ClientFor("alice");
        using var bob = ClientFor("bob");
        await alice.PostAsJsonAsync("/exercises", new ExerciseRequest("Zercher Squat", "Legs"));

        var again = await alice.PostAsJsonAsync("/exercises", new ExerciseRequest("Zercher Squat", "Legs"));

        Assert.Equal(HttpStatusCode.BadRequest, again.StatusCode);
        Assert.Contains("already an exercise called Zercher Squat", await again.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Created, (await bob.PostAsJsonAsync("/exercises", new ExerciseRequest("Zercher Squat", "Legs"))).StatusCode);
    }

    [Fact]
    public async Task MissingUserIdHeader_Returns400()
    {
        using var anonymous = _factory.CreateClient();

        Assert.Equal(HttpStatusCode.BadRequest, (await anonymous.GetAsync("/exercises")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await anonymous.PostAsJsonAsync("/exercises", new ExerciseRequest("Zercher Squat", "Legs"))).StatusCode);
    }
}
