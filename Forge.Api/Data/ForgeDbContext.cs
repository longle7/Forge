using Forge.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Forge.Api.Data
{
    /// <summary>
    /// The database, as EF Core sees it: each DbSet below is a table, and OnModelCreating spells out keys,
    /// indexes, and column sizes. After changing an entity or this file, add a migration
    /// (dotnet ef migrations add <Name> --project Forge.Api); the API applies pending migrations at startup.
    /// </summary>
    public class ForgeDbContext : DbContext
    {
        public ForgeDbContext(DbContextOptions<ForgeDbContext> options)
            : base(options)
        {
        }

        // DbSets = tables (named after the property: "Exercises", "Workouts", "WorkoutSets"; "Id" is each one's key).
        public DbSet<Exercise> Exercises { get; set; } = null!;
        public DbSet<Workout> Workouts { get; set; } = null!;
        public DbSet<WorkoutSet> WorkoutSets { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Exercise>(entity =>
            {
                entity.HasIndex(e => e.UserId);
                entity.Property(e => e.UserId).HasMaxLength(100);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
                entity.Property(e => e.MuscleGroup).IsRequired().HasMaxLength(50);
                entity.HasData(BuiltInExercises.All);
            });

            modelBuilder.Entity<Workout>(entity =>
            {
                entity.Property(w => w.Id).ValueGeneratedNever(); // the app makes it up (see Workout.Id)
                entity.HasIndex(w => w.UserId);
                entity.Property(w => w.UserId).IsRequired().HasMaxLength(100);
                entity.Property(w => w.Name).IsRequired().HasMaxLength(100);
                entity.HasMany(w => w.Sets)
                      .WithOne()
                      .HasForeignKey(s => s.WorkoutId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<WorkoutSet>(entity =>
            {
                entity.Property(s => s.Weight).HasPrecision(6, 2); // up to 9999.99 lb
                entity.HasOne(s => s.Exercise)
                      .WithMany()
                      .HasForeignKey(s => s.ExerciseId)
                      .OnDelete(DeleteBehavior.Restrict);
            });
        }
    }
}
