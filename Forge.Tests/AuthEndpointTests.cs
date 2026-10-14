using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Forge.Api.Controllers;
using Forge.Api.Services;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace Forge.Tests;

/// <summary>Sign in with Apple (Apple faked): which account you land in, beta data carrying over, and the token checks.</summary>
public class AuthEndpointTests : IDisposable
{
    private readonly FakeApple _apple = new();
    private readonly WebApplicationFactory<Program> _factory;

    public AuthEndpointTests()
    {
        TestDb.CreateClean().Dispose();
        _factory = Factory(requireSignIn: false);
    }

    public void Dispose() => _factory.Dispose();

    private WebApplicationFactory<Program> Factory(bool requireSignIn) =>
        TestDb.Factory().WithWebHostBuilder(b =>
        {
            b.UseSetting("Auth:RequireSignIn", requireSignIn.ToString());
            b.ConfigureTestServices(s => s.AddSingleton<IAppleSignIn>(_apple));
        });

    private static async Task<HttpResponseMessage> SignInAsync(WebApplicationFactory<Program> factory, string sub, string? legacyUserId = null)
    {
        using var client = factory.CreateClient();
        return await client.PostAsJsonAsync("/auth/apple", new AppleSignInRequest("apple:" + sub, legacyUserId));
    }

    // A client signed in as `sub`, the way the app is after Sign in with Apple.
    private static async Task<HttpClient> SignedInAsync(WebApplicationFactory<Program> factory, string sub, string? legacyUserId = null)
    {
        var session = await (await SignInAsync(factory, sub, legacyUserId)).Content.ReadFromJsonAsync<SessionResponse>();
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session!.Token);
        return client;
    }

    private static async Task<int> WeighInCountAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<List<WeighInResponse>>("/weigh-ins"))!.Count;

    [Fact]
    public async Task FirstSignIn_KeepsTheBetaData_AndLaterSignInsFindIt()
    {
        using var beta = _factory.ClientFor("alice-phone");
        await beta.PutAsJsonAsync("/weigh-ins/2026-10-10", new { weight = 185 });

        using var signedIn = await SignedInAsync(_factory, "alice", legacyUserId: "alice-phone");
        Assert.Equal(1, await WeighInCountAsync(signedIn));

        using var newPhone = await SignedInAsync(_factory, "alice"); // no beta ID on a new phone
        Assert.Equal(1, await WeighInCountAsync(newPhone));
    }

    [Fact]
    public async Task ABetaIdAlreadyClaimed_IsIgnored()
    {
        using var beta = _factory.ClientFor("alice-phone");
        await beta.PutAsJsonAsync("/weigh-ins/2026-10-10", new { weight = 185 });
        (await SignedInAsync(_factory, "alice", legacyUserId: "alice-phone")).Dispose();

        using var mallory = await SignedInAsync(_factory, "mallory", legacyUserId: "alice-phone");

        Assert.Equal(0, await WeighInCountAsync(mallory));
    }

    [Fact]
    public async Task TheToken_WinsOverAnXUserIdHeader()
    {
        using var beta = _factory.ClientFor("alice-phone");
        await beta.PutAsJsonAsync("/weigh-ins/2026-10-10", new { weight = 185 });

        using var mallory = await SignedInAsync(_factory, "mallory");
        mallory.DefaultRequestHeaders.Add("X-User-Id", "alice-phone");

        Assert.Equal(0, await WeighInCountAsync(mallory));
    }

    [Fact]
    public async Task BadTokens_Return401()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await SignInAsync(_factory, "")).StatusCode); // Apple says no
        using var forged = _factory.CreateClient();
        forged.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "not-a-token");
        Assert.Equal(HttpStatusCode.Unauthorized, (await forged.GetAsync("/weigh-ins")).StatusCode);
    }

    [Fact]
    public async Task RequireSignIn_TurnsAwayTheAnonymousHeader()
    {
        using var factory = Factory(requireSignIn: true);
        using var beta = factory.ClientFor("alice-phone");
        Assert.Equal(HttpStatusCode.Unauthorized, (await beta.GetAsync("/weigh-ins")).StatusCode);

        using var signedIn = await SignedInAsync(factory, "alice", legacyUserId: "alice-phone"); // still carries over
        Assert.Equal(HttpStatusCode.OK, (await signedIn.GetAsync("/weigh-ins")).StatusCode);
    }

    [Fact]
    public async Task DeleteAccount_RevokesApple_AndSigningInAgainStartsFresh()
    {
        using var alice = await SignedInAsync(_factory, "alice");
        await alice.PutAsJsonAsync("/weigh-ins/2026-10-10", new { weight = 185 });

        using var delete = new HttpRequestMessage(HttpMethod.Delete, "/me");
        delete.Headers.Add("X-Apple-Code", "code-123");
        Assert.Equal(HttpStatusCode.NoContent, (await alice.SendAsync(delete)).StatusCode);

        Assert.Equal(["code-123"], _apple.Revoked);
        using var again = await SignedInAsync(_factory, "alice");
        Assert.Equal(0, await WeighInCountAsync(again));
    }

    // Identity tokens look like "apple:<sub>"; anything else isn't valid.
    private class FakeApple : IAppleSignIn
    {
        public List<string> Revoked { get; } = [];

        public Task<string?> SubjectOfAsync(string identityToken, CancellationToken cancellationToken) =>
            Task.FromResult(identityToken.StartsWith("apple:") && identityToken.Length > 6 ? identityToken[6..] : null);

        public Task<bool> RevokeAsync(string authorizationCode, CancellationToken cancellationToken)
        {
            Revoked.Add(authorizationCode);
            return Task.FromResult(true);
        }
    }
}
