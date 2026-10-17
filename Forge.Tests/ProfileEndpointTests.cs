using System.Net;
using System.Net.Http.Json;
using Forge.Api.Controllers;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Forge.Tests;

/// <summary>Calls /profile over HTTP against the real SQL Server test database.</summary>
public class ProfileEndpointTests : IDisposable
{
    private readonly WebApplicationFactory<Program> _factory;

    public ProfileEndpointTests()
    {
        TestDb.CreateClean().Dispose();
        _factory = TestDb.Factory();
    }

    public void Dispose() => _factory.Dispose();

    private static ProfileDto Profile() =>
        new("male", 1994, 70, 185.4m, "light", "lose", 1, 2150, 167, 190, 72);

    [Fact]
    public async Task NotSetUp_Returns404_ThenPutCreatesAndReplaces()
    {
        using var alice = _factory.ClientFor("alice");

        Assert.Equal(HttpStatusCode.NotFound, (await alice.GetAsync("/profile")).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await alice.PutAsJsonAsync("/profile", Profile())).StatusCode);
        Assert.Equal(Profile(), await alice.GetFromJsonAsync<ProfileDto>("/profile"));

        var withRules = Profile() with { Goal = "maintain", Pace = 1, CalorieGoal = 2650, UnlockAfterWorkout = true, UnlockAfterMeals = 2, RestDayCalorieAdjust = -200, GoalWeight = 175.5m };
        await alice.PutAsJsonAsync("/profile", withRules);
        var saved = await alice.GetFromJsonAsync<ProfileDto>("/profile");
        Assert.Equal(withRules with { Pace = 0 }, saved); // maintaining has no pace
    }

    [Fact]
    public async Task Profiles_AreOnePerUser()
    {
        using var alice = _factory.ClientFor("alice");
        using var bob = _factory.ClientFor("bob");
        await alice.PutAsJsonAsync("/profile", Profile());

        Assert.Equal(HttpStatusCode.NotFound, (await bob.GetAsync("/profile")).StatusCode);
    }

    [Fact]
    public async Task Put_InvalidProfile_Returns400()
    {
        using var alice = _factory.ClientFor("alice");
        ProfileDto[] invalid =
        [
            Profile() with { Sex = "other" },
            Profile() with { Activity = "couch" },
            Profile() with { Goal = "bulk" },
            Profile() with { BirthYear = DateTime.UtcNow.Year - 5 },
            Profile() with { HeightIn = 20 },
            Profile() with { CalorieGoal = 300 },
            Profile() with { UnlockAfterMeals = 5 },
            Profile() with { RestDayCalorieAdjust = -1500 },
            Profile() with { RestDayCalorieAdjust = 100 }, // rest days can only take calories off
            Profile() with { GoalWeight = 20 },
        ];

        foreach (var profile in invalid)
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await alice.PutAsJsonAsync("/profile", profile)).StatusCode);
        }
        Assert.Equal(HttpStatusCode.NotFound, (await alice.GetAsync("/profile")).StatusCode);
    }
}
