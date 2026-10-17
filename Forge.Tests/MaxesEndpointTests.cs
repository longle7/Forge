using System.Net;
using System.Net.Http.Json;
using Forge.Api.Controllers;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Forge.Tests;

/// <summary>Calls the /maxes endpoints over HTTP against the real SQL Server test database.</summary>
public class MaxesEndpointTests : IDisposable
{
    private const int Bench = 1; // built-in "Bench Press (Barbell)"
    private const int Squat = 14; // built-in "Squat (Barbell)"
    private static readonly DateOnly Day = new(2026, 10, 10);

    private readonly WebApplicationFactory<Program> _factory;

    public MaxesEndpointTests()
    {
        TestDb.CreateClean().Dispose();
        _factory = TestDb.Factory();
    }

    public void Dispose() => _factory.Dispose();

    private static Task<List<TestedMaxDto>> ListAsync(HttpClient client) => client.GetFromJsonAsync<List<TestedMaxDto>>("/maxes")!;

    [Fact]
    public async Task Put_CreatesThenReplaces_AndListsNewestFirst()
    {
        using var alice = _factory.ClientFor("alice");
        var id = Guid.NewGuid();

        var created = await alice.PutAsJsonAsync($"/maxes/{id}", new TestedMaxRequest(Bench, Day, 225));
        var replaced = await alice.PutAsJsonAsync($"/maxes/{id}", new TestedMaxRequest(Bench, Day, 230, 2));
        await alice.PutAsJsonAsync($"/maxes/{Guid.NewGuid()}", new TestedMaxRequest(Squat, Day.AddDays(-30), 315));

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(HttpStatusCode.OK, replaced.StatusCode);
        var maxes = await ListAsync(alice);
        Assert.Equal([new(id, Bench, Day, 230m, 2), maxes[1]], maxes);
        Assert.Equal(Squat, maxes[1].ExerciseId);
    }

    [Fact]
    public async Task OtherUsersMaxes_AreInvisible_AndCantBeChanged()
    {
        using var alice = _factory.ClientFor("alice");
        using var bob = _factory.ClientFor("bob");
        var id = Guid.NewGuid();
        await alice.PutAsJsonAsync($"/maxes/{id}", new TestedMaxRequest(Bench, Day, 225));

        Assert.Empty(await ListAsync(bob));
        Assert.Equal(HttpStatusCode.NotFound, (await bob.PutAsJsonAsync($"/maxes/{id}", new TestedMaxRequest(Bench, Day, 500))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.DeleteAsync($"/maxes/{id}")).StatusCode);
        Assert.Equal(225m, Assert.Single(await ListAsync(alice)).Weight);
    }

    [Fact]
    public async Task Put_InvalidMax_Returns400_AndSavesNothing()
    {
        using var alice = _factory.ClientFor("alice");
        using var bob = _factory.ClientFor("bob");
        var exercises = await alice.GetFromJsonAsync<List<ExerciseResponse>>("/exercises");
        var running = exercises!.Single(e => e.Name == "Running").Id;
        var bobs = (await (await bob.PostAsJsonAsync("/exercises", new ExerciseRequest("Zercher Squat", "Legs")))
            .Content.ReadFromJsonAsync<ExerciseResponse>())!.Id;

        TestedMaxRequest[] invalid =
        [
            new(Bench, Day, 0),
            new(Bench, Day, 2500),
            new(Bench, Day, 225, 0),
            new(Bench, Day, 225, 11),
            new(999_999, Day, 225), // no such exercise
            new(bobs, Day, 225), // someone else's exercise
            new(running, Day, 225), // cardio
            new(Bench, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(3), 225),
        ];
        foreach (var request in invalid)
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await alice.PutAsJsonAsync($"/maxes/{Guid.NewGuid()}", request)).StatusCode);
        }
        Assert.Empty(await ListAsync(alice));
    }

    [Fact]
    public async Task Delete_RemovesIt()
    {
        using var alice = _factory.ClientFor("alice");
        var id = Guid.NewGuid();
        await alice.PutAsJsonAsync($"/maxes/{id}", new TestedMaxRequest(Bench, Day, 225));

        Assert.Equal(HttpStatusCode.NoContent, (await alice.DeleteAsync($"/maxes/{id}")).StatusCode);
        Assert.Empty(await ListAsync(alice));
        Assert.Equal(HttpStatusCode.NotFound, (await alice.DeleteAsync($"/maxes/{id}")).StatusCode);
    }
}
