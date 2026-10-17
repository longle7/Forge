using System.Net;
using System.Net.Http.Json;
using Forge.Api.Controllers;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Forge.Tests;

/// <summary>Calls /activity over HTTP against the real SQL Server test database.</summary>
public class ActivityEndpointTests : IDisposable
{
    private readonly WebApplicationFactory<Program> _factory;

    public ActivityEndpointTests()
    {
        TestDb.CreateClean().Dispose();
        _factory = TestDb.Factory();
    }

    public void Dispose() => _factory.Dispose();

    private static Task<List<ActiveEnergyDto>> ListAsync(HttpClient client, string from = "2026-10-01", string to = "2026-10-31") =>
        client.GetFromJsonAsync<List<ActiveEnergyDto>>($"/activity?from={from}&to={to}")!;

    [Fact]
    public async Task OnePerDay_OldestFirst_InTheRange()
    {
        using var alice = _factory.ClientFor("alice");
        await alice.PutAsJsonAsync("/activity/2026-10-17", new ActiveEnergyRequest(310));
        await alice.PutAsJsonAsync("/activity/2026-10-15", new ActiveEnergyRequest(720));
        await alice.PutAsJsonAsync("/activity/2026-10-17", new ActiveEnergyRequest(640)); // later that day: replaces
        await alice.PutAsJsonAsync("/activity/2026-09-30", new ActiveEnergyRequest(500));

        Assert.Equal([new(new DateOnly(2026, 10, 15), 720), new(new DateOnly(2026, 10, 17), 640)], await ListAsync(alice));
        Assert.Equal([new(new DateOnly(2026, 10, 17), 640)], await ListAsync(alice, "2026-10-17", "2026-10-17"));
    }

    [Fact]
    public async Task Activity_IsPerUser_AndValidated()
    {
        using var alice = _factory.ClientFor("alice");
        using var bob = _factory.ClientFor("bob");
        await alice.PutAsJsonAsync("/activity/2026-10-17", new ActiveEnergyRequest(640));

        Assert.Empty(await ListAsync(bob));
        Assert.Equal(HttpStatusCode.BadRequest, (await alice.PutAsJsonAsync("/activity/2026-10-17", new ActiveEnergyRequest(-1))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await alice.PutAsJsonAsync("/activity/2026-10-17", new ActiveEnergyRequest(10_001))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await alice.PutAsJsonAsync("/activity/2026-13-40", new ActiveEnergyRequest(640))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await alice.GetAsync("/activity?from=2026-10-17&to=2026-10-16")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await alice.GetAsync("/activity?from=2025-01-01&to=2026-10-17")).StatusCode); // over 400 days
        Assert.Equal(HttpStatusCode.BadRequest, (await alice.GetAsync("/activity")).StatusCode);
    }
}
