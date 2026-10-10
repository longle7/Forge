using Forge.Api.Data;
using Microsoft.EntityFrameworkCore;

// All tests share one SQL Server test database, so run them one at a time.
[assembly: CollectionBehavior(DisableTestParallelization = true)]

namespace Forge.Tests;

/// <summary>
/// Real SQL Server test database. Defaults to local SQL Server; override with FORGE_TEST_DB.
/// </summary>
public static class TestDb
{
    public static readonly string ConnectionString =
        Environment.GetEnvironmentVariable("FORGE_TEST_DB")
        ?? "Server=localhost;Database=ForgeDb_Tests;Trusted_Connection=True;TrustServerCertificate=True;";

    public static ForgeDbContext Open() =>
        new(new DbContextOptionsBuilder<ForgeDbContext>().UseSqlServer(ConnectionString).Options);

    /// <summary>Migrates the test database and deletes all user data (the built-in exercises stay).</summary>
    public static ForgeDbContext CreateClean()
    {
        var db = Open();
        db.Database.Migrate();
        db.FoodEntries.ExecuteDelete();
        db.ScanUsage.ExecuteDelete();
        db.WeighIns.ExecuteDelete();
        db.UserProfiles.ExecuteDelete();
        // Workout sets and plan exercises point at exercises, so delete them (with their parents) before custom exercises.
        db.PlanDays.ExecuteDelete();
        db.Workouts.ExecuteDelete();
        db.Exercises.Where(e => e.UserId != null).ExecuteDelete();
        return db;
    }

    /// <summary>A test server on the test database, and a client for it that sends `userId` as X-User-Id.</summary>
    public static HttpClient ClientFor(this Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> factory, string userId)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-User-Id", userId);
        return client;
    }

    public static Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> Factory() =>
        new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program>()
            .WithWebHostBuilder(b => b.UseSetting("ConnectionStrings:DefaultConnection", ConnectionString));
}
