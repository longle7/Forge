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
        db.Workouts.ExecuteDelete(); // their sets go with them; sets point at exercises, so delete workouts first
        db.Exercises.Where(e => e.UserId != null).ExecuteDelete();
        return db;
    }
}
