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
        public DbSet<UserProfile> UserProfiles { get; set; } = null!;
        public DbSet<PlanDay> PlanDays { get; set; } = null!;
        public DbSet<PlanExercise> PlanExercises { get; set; } = null!;
        public DbSet<WeighIn> WeighIns { get; set; } = null!;
        public DbSet<FoodEntry> FoodEntries { get; set; } = null!;
        public DbSet<ScanUsage> ScanUsage { get; set; } = null!;
        public DbSet<Habit> Habits { get; set; } = null!;
        public DbSet<HabitCheck> HabitChecks { get; set; } = null!;
        public DbSet<SavedMeal> SavedMeals { get; set; } = null!;
        public DbSet<AppleAccount> AppleAccounts { get; set; } = null!;

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
                entity.Property(s => s.Distance).HasPrecision(6, 2); // miles
                entity.HasOne(s => s.Exercise)
                      .WithMany()
                      .HasForeignKey(s => s.ExerciseId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<UserProfile>(entity =>
            {
                entity.HasKey(p => p.UserId);
                entity.Property(p => p.UserId).HasMaxLength(100);
                entity.Property(p => p.Sex).IsRequired().HasMaxLength(10);
                entity.Property(p => p.Activity).IsRequired().HasMaxLength(20);
                entity.Property(p => p.Goal).IsRequired().HasMaxLength(10);
                entity.Property(p => p.HeightIn).HasPrecision(4, 1);
                entity.Property(p => p.StartWeight).HasPrecision(5, 1);
                entity.Property(p => p.Pace).HasPrecision(3, 2);
            });

            modelBuilder.Entity<PlanDay>(entity =>
            {
                entity.HasIndex(d => new { d.UserId, d.DayOfWeek }).IsUnique(); // one plan per weekday
                entity.Property(d => d.UserId).IsRequired().HasMaxLength(100);
                entity.Property(d => d.Name).IsRequired().HasMaxLength(50);
                entity.HasMany(d => d.Exercises)
                      .WithOne()
                      .HasForeignKey(e => e.PlanDayId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<PlanExercise>(entity =>
            {
                entity.HasOne(e => e.Exercise)
                      .WithMany()
                      .HasForeignKey(e => e.ExerciseId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<WeighIn>(entity =>
            {
                entity.HasKey(w => new { w.UserId, w.Date }); // one per day
                entity.Property(w => w.UserId).HasMaxLength(100);
                entity.Property(w => w.Weight).HasPrecision(5, 1);
            });

            modelBuilder.Entity<FoodEntry>(entity =>
            {
                entity.Property(f => f.Id).ValueGeneratedNever(); // the app makes it up (see FoodEntry.Id)
                entity.HasIndex(f => new { f.UserId, f.Date });
                entity.Property(f => f.UserId).IsRequired().HasMaxLength(100);
                entity.Property(f => f.Meal).IsRequired().HasMaxLength(10);
                entity.Property(f => f.Name).IsRequired().HasMaxLength(200);
                entity.Property(f => f.Serving).IsRequired().HasMaxLength(100);
                entity.Property(f => f.Source).IsRequired().HasMaxLength(10);
                entity.Property(f => f.Servings).HasPrecision(6, 2);
                entity.Property(f => f.Calories).HasPrecision(7, 1);
                entity.Property(f => f.Protein).HasPrecision(6, 1);
                entity.Property(f => f.Carbs).HasPrecision(6, 1);
                entity.Property(f => f.Fat).HasPrecision(6, 1);
            });

            modelBuilder.Entity<Habit>(entity =>
            {
                entity.Property(h => h.Id).ValueGeneratedNever(); // the app makes it up (see Habit.Id)
                entity.HasIndex(h => h.UserId);
                entity.Property(h => h.UserId).IsRequired().HasMaxLength(100);
                entity.Property(h => h.Name).IsRequired().HasMaxLength(50);
                entity.Property(h => h.Emoji).IsRequired().HasMaxLength(16);
                entity.HasMany(h => h.Checks)
                      .WithOne()
                      .HasForeignKey(c => c.HabitId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<HabitCheck>(entity => entity.HasKey(c => new { c.HabitId, c.Date })); // one count per day

            modelBuilder.Entity<SavedMeal>(entity =>
            {
                entity.Property(m => m.Id).ValueGeneratedNever(); // the app makes it up (see SavedMeal.Id)
                entity.HasIndex(m => m.UserId);
                entity.Property(m => m.UserId).IsRequired().HasMaxLength(100);
                entity.Property(m => m.Name).IsRequired().HasMaxLength(50);
                entity.OwnsMany(m => m.Items, items =>
                {
                    items.ToJson(); // its foods, as one JSON column
                    // The same sizes as FoodEntry's.
                    items.Property(i => i.Servings).HasPrecision(6, 2);
                    items.Property(i => i.Calories).HasPrecision(7, 1);
                    items.Property(i => i.Protein).HasPrecision(6, 1);
                    items.Property(i => i.Carbs).HasPrecision(6, 1);
                    items.Property(i => i.Fat).HasPrecision(6, 1);
                });
            });

            modelBuilder.Entity<ScanUsage>(entity =>
            {
                entity.ToTable("ScanUsage");
                entity.HasKey(u => new { u.UserId, u.Day }); // one count per user per day
                entity.Property(u => u.UserId).HasMaxLength(100);
            });

            modelBuilder.Entity<AppleAccount>(entity =>
            {
                entity.HasKey(a => a.Sub);
                entity.Property(a => a.Sub).HasMaxLength(100);
                entity.HasIndex(a => a.UserId).IsUnique(); // a beta ID is claimed by one Apple account at most
                entity.Property(a => a.UserId).IsRequired().HasMaxLength(100);
            });
        }
    }
}
