using Forge.Api.Domain;

namespace Forge.Api.Data
{
    /// <summary>
    /// The exercises everyone starts with, seeded by the InitialCreate migration (ForgeDbContext uses HasData).
    /// Custom exercises take the IDs after these, so add new built-ins in a migration with plain INSERTs (no fixed
    /// IDs), not by appending here with new IDs that someone's own exercise may already have.
    /// </summary>
    public static class BuiltInExercises
    {
        public static readonly Exercise[] All =
        [
            new() { Id = 1, Name = "Bench Press (Barbell)", MuscleGroup = "Chest" },
            new() { Id = 2, Name = "Incline Bench Press (Barbell)", MuscleGroup = "Chest" },
            new() { Id = 3, Name = "Bench Press (Dumbbell)", MuscleGroup = "Chest" },
            new() { Id = 4, Name = "Incline Bench Press (Dumbbell)", MuscleGroup = "Chest" },
            new() { Id = 5, Name = "Chest Fly (Cable)", MuscleGroup = "Chest" },
            new() { Id = 6, Name = "Push Up", MuscleGroup = "Chest" },
            new() { Id = 7, Name = "Deadlift (Barbell)", MuscleGroup = "Back" },
            new() { Id = 8, Name = "Pull Up", MuscleGroup = "Back" },
            new() { Id = 9, Name = "Chin Up", MuscleGroup = "Back" },
            new() { Id = 10, Name = "Lat Pulldown (Cable)", MuscleGroup = "Back" },
            new() { Id = 11, Name = "Bent Over Row (Barbell)", MuscleGroup = "Back" },
            new() { Id = 12, Name = "Seated Row (Cable)", MuscleGroup = "Back" },
            new() { Id = 13, Name = "Row (Dumbbell)", MuscleGroup = "Back" },
            new() { Id = 14, Name = "Squat (Barbell)", MuscleGroup = "Legs" },
            new() { Id = 15, Name = "Front Squat (Barbell)", MuscleGroup = "Legs" },
            new() { Id = 16, Name = "Romanian Deadlift (Barbell)", MuscleGroup = "Legs" },
            new() { Id = 17, Name = "Leg Press (Machine)", MuscleGroup = "Legs" },
            new() { Id = 18, Name = "Lunge (Dumbbell)", MuscleGroup = "Legs" },
            new() { Id = 19, Name = "Leg Extension (Machine)", MuscleGroup = "Legs" },
            new() { Id = 20, Name = "Leg Curl (Machine)", MuscleGroup = "Legs" },
            new() { Id = 21, Name = "Calf Raise (Machine)", MuscleGroup = "Legs" },
            new() { Id = 22, Name = "Hip Thrust (Barbell)", MuscleGroup = "Legs" },
            new() { Id = 23, Name = "Overhead Press (Barbell)", MuscleGroup = "Shoulders" },
            new() { Id = 24, Name = "Shoulder Press (Dumbbell)", MuscleGroup = "Shoulders" },
            new() { Id = 25, Name = "Lateral Raise (Dumbbell)", MuscleGroup = "Shoulders" },
            new() { Id = 26, Name = "Face Pull (Cable)", MuscleGroup = "Shoulders" },
            new() { Id = 27, Name = "Bicep Curl (Barbell)", MuscleGroup = "Arms" },
            new() { Id = 28, Name = "Bicep Curl (Dumbbell)", MuscleGroup = "Arms" },
            new() { Id = 29, Name = "Hammer Curl (Dumbbell)", MuscleGroup = "Arms" },
            new() { Id = 30, Name = "Triceps Pushdown (Cable)", MuscleGroup = "Arms" },
            new() { Id = 31, Name = "Skullcrusher (Barbell)", MuscleGroup = "Arms" },
            new() { Id = 32, Name = "Dip", MuscleGroup = "Arms" },
            new() { Id = 33, Name = "Crunch", MuscleGroup = "Core" },
            new() { Id = 34, Name = "Cable Crunch (Cable)", MuscleGroup = "Core" },
            new() { Id = 35, Name = "Hanging Leg Raise", MuscleGroup = "Core" },
        ];
    }
}
