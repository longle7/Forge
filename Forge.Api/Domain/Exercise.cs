namespace Forge.Api.Domain
{
    /// <summary>
    /// Something you lift, e.g. "Bench Press (Barbell)". Built-in exercises (no UserId) are there for everyone
    /// (Data/BuiltInExercises.cs); the ones you add are yours alone.
    /// </summary>
    public class Exercise
    {
        // Database ID (primary key). Built-ins have fixed IDs (see BuiltInExercises); yours come after them.
        public int Id { get; set; }

        // Who added it (the anonymous X-User-Id, see WorkoutsController); null for built-in exercises.
        public string? UserId { get; set; }

        // e.g. "Bench Press (Barbell)": the equipment in parentheses, like Strong.
        public string Name { get; set; } = string.Empty;

        // Groups the exercise list: one of ExercisesController.MuscleGroups.
        public string MuscleGroup { get; set; } = string.Empty;
    }
}
