using System.Net;
using System.Net.Http.Json;
using Forge.Api.Controllers;
using Forge.Api.Domain;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Forge.Tests;

/// <summary>Calls DELETE /me over HTTP against the real SQL Server test database.</summary>
public class MeEndpointTests : IDisposable
{
    private readonly WebApplicationFactory<Program> _factory;

    public MeEndpointTests()
    {
        TestDb.CreateClean().Dispose();
        _factory = TestDb.Factory();
    }

    public void Dispose() => _factory.Dispose();

    // Something in every table, through the API.
    private static async Task FillAsync(HttpClient client)
    {
        var exercise = await (await client.PostAsJsonAsync("/exercises", new ExerciseRequest("Zercher Squat", "Legs"))).Content.ReadFromJsonAsync<ExerciseResponse>();
        var start = DateTimeOffset.UtcNow.AddHours(-1);
        await client.PutAsJsonAsync($"/workouts/{Guid.NewGuid()}", new WorkoutRequest("Legs", start, start.AddMinutes(40), [new(exercise!.Id, 135, 5)]));
        await client.PutAsJsonAsync("/plan/1", new { name = "Leg Day", exercises = new[] { new { exerciseId = exercise.Id, sets = 3, reps = 5 } } });
        await client.PutAsJsonAsync("/profile", new ProfileDto("male", 1994, 70, 185, "light", "lose", 1, 2150, 167, 190, 72));
        await client.PutAsJsonAsync("/weigh-ins/2026-10-10", new { weight = 185 });
        await client.PutAsJsonAsync($"/food-log/{Guid.NewGuid()}", new FoodEntryRequest(new DateOnly(2026, 10, 10), "lunch", "Sandwich", null, 1, 400, 20, 40, 12));
        await client.PutAsJsonAsync($"/saved-meals/{Guid.NewGuid()}", new SavedMealRequest("Lunch", [new("Sandwich", null, 1, 400, 20, 40, 12)]));
        var habit = Guid.NewGuid();
        await client.PutAsJsonAsync($"/habits/{habit}", new HabitRequest("Water", "💧", 8, 127));
        await client.PutAsJsonAsync($"/habits/{habit}/checks/2026-10-10", new HabitCheckRequest(3));
        // On your own exercise, so deleting it has to delete the max first.
        await client.PutAsJsonAsync($"/maxes/{Guid.NewGuid()}", new TestedMaxRequest(exercise.Id, new DateOnly(2026, 10, 10), 225));
    }

    private static int RowsOf(string userId)
    {
        using var db = TestDb.Open();
        return db.Workouts.Count(w => w.UserId == userId) + db.PlanDays.Count(d => d.UserId == userId)
            + db.Exercises.Count(e => e.UserId == userId) + db.FoodEntries.Count(f => f.UserId == userId)
            + db.SavedMeals.Count(m => m.UserId == userId) + db.WeighIns.Count(w => w.UserId == userId)
            + db.Habits.Count(h => h.UserId == userId) + db.UserProfiles.Count(p => p.UserId == userId)
            + db.TestedMaxes.Count(m => m.UserId == userId);
    }

    [Fact]
    public async Task Delete_RemovesEverythingOfYours_AndNothingElse()
    {
        using var alice = _factory.ClientFor("alice");
        using var bob = _factory.ClientFor("bob");
        await FillAsync(alice);
        await FillAsync(bob);
        using (var db = TestDb.Open())
        {
            db.ScanUsage.Add(new ScanUsage { UserId = "alice", Day = new DateOnly(2026, 10, 10), Count = 2 });
            db.SaveChanges();
        }
        Assert.Equal(9, RowsOf("alice")); // one in each table, so the fill really did fill

        Assert.Equal(HttpStatusCode.NoContent, (await alice.DeleteAsync("/me")).StatusCode);

        Assert.Equal(0, RowsOf("alice"));
        Assert.Equal(9, RowsOf("bob"));
        using var after = TestDb.Open();
        Assert.False(after.ScanUsage.Any(u => u.UserId == "alice"));
        Assert.False(after.WorkoutSets.Any(s => s.Exercise!.UserId == "alice"));
        Assert.Equal(HttpStatusCode.NoContent, (await alice.DeleteAsync("/me")).StatusCode); // nothing left: still fine
    }

    [Fact]
    public async Task MissingUserIdHeader_Returns400()
    {
        using var anonymous = _factory.CreateClient();

        Assert.Equal(HttpStatusCode.BadRequest, (await anonymous.DeleteAsync("/me")).StatusCode);
    }
}
