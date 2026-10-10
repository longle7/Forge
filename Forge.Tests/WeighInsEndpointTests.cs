using System.Net;
using System.Net.Http.Json;
using Forge.Api.Controllers;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Forge.Tests;

/// <summary>Calls /weigh-ins over HTTP against the real SQL Server test database.</summary>
public class WeighInsEndpointTests : IDisposable
{
    private readonly WebApplicationFactory<Program> _factory;

    public WeighInsEndpointTests()
    {
        TestDb.CreateClean().Dispose();
        _factory = TestDb.Factory();
    }

    public void Dispose() => _factory.Dispose();

    private static Task<List<WeighInResponse>> ListAsync(HttpClient client) => client.GetFromJsonAsync<List<WeighInResponse>>("/weigh-ins")!;

    [Fact]
    public async Task OnePerDay_OldestFirst_AndDeletable()
    {
        using var alice = _factory.ClientFor("alice");
        await alice.PutAsJsonAsync("/weigh-ins/2026-10-10", new WeighInRequest(184.6m));
        await alice.PutAsJsonAsync("/weigh-ins/2026-10-08", new WeighInRequest(185.2m));
        await alice.PutAsJsonAsync("/weigh-ins/2026-10-10", new WeighInRequest(184.2m)); // again that day: replaces

        Assert.Equal(
            [new(new DateOnly(2026, 10, 8), 185.2m), new(new DateOnly(2026, 10, 10), 184.2m)],
            await ListAsync(alice));

        Assert.Equal(HttpStatusCode.NoContent, (await alice.DeleteAsync("/weigh-ins/2026-10-08")).StatusCode);
        Assert.Single(await ListAsync(alice));
        Assert.Equal(HttpStatusCode.NotFound, (await alice.DeleteAsync("/weigh-ins/2026-10-08")).StatusCode);
    }

    [Fact]
    public async Task WeighIns_ArePerUser_AndValidated()
    {
        using var alice = _factory.ClientFor("alice");
        using var bob = _factory.ClientFor("bob");
        await alice.PutAsJsonAsync("/weigh-ins/2026-10-10", new WeighInRequest(184.6m));

        Assert.Empty(await ListAsync(bob));
        Assert.Equal(HttpStatusCode.NotFound, (await bob.DeleteAsync("/weigh-ins/2026-10-10")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await alice.PutAsJsonAsync("/weigh-ins/2026-10-10", new WeighInRequest(12))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await alice.PutAsJsonAsync("/weigh-ins/2026-13-40", new WeighInRequest(184))).StatusCode);
    }
}
