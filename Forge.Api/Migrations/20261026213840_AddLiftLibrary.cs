using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Forge.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLiftLibrary : Migration
    {
        // The new built-ins, as SQL rows of (Name, MuscleGroup).
        private const string Lifts = """
            (N'Chest Press (Machine)', N'Chest'),
            (N'Pec Deck (Machine)', N'Chest'),
            (N'Decline Bench Press (Barbell)', N'Chest'),
            (N'Chest Fly (Dumbbell)', N'Chest'),
            (N'T-Bar Row (Barbell)', N'Back'),
            (N'Single Arm Row (Cable)', N'Back'),
            (N'Straight Arm Pulldown (Cable)', N'Back'),
            (N'Inverted Row', N'Back'),
            (N'Arnold Press (Dumbbell)', N'Shoulders'),
            (N'Rear Delt Fly (Dumbbell)', N'Shoulders'),
            (N'Lateral Raise (Cable)', N'Shoulders'),
            (N'Shoulder Press (Machine)', N'Shoulders'),
            (N'Upright Row (Barbell)', N'Shoulders'),
            (N'Preacher Curl (Barbell)', N'Arms'),
            (N'Bicep Curl (Cable)', N'Arms'),
            (N'Overhead Triceps Extension (Cable)', N'Arms'),
            (N'Overhead Triceps Extension (Dumbbell)', N'Arms'),
            (N'Close Grip Bench Press (Barbell)', N'Arms'),
            (N'Goblet Squat (Dumbbell)', N'Legs'),
            (N'Bulgarian Split Squat (Dumbbell)', N'Legs'),
            (N'Hack Squat (Machine)', N'Legs'),
            (N'Romanian Deadlift (Dumbbell)', N'Legs'),
            (N'Seated Calf Raise (Machine)', N'Legs'),
            (N'Glute Bridge', N'Legs'),
            (N'Sumo Deadlift (Barbell)', N'Legs'),
            (N'Step Up (Dumbbell)', N'Legs'),
            (N'Hip Abduction (Machine)', N'Legs'),
            (N'Bodyweight Squat', N'Legs'),
            (N'Kettlebell Swing (Kettlebell)', N'Legs'),
            (N'Ab Wheel Rollout', N'Core'),
            (N'Russian Twist', N'Core'),
            (N'Woodchop (Cable)', N'Core'),
            (N'Farmer''s Carry (Dumbbell)', N'Core')
            """;

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Plain INSERTs, so they take the next free IDs (see BuiltInExercises), skipping a name a built-in already has.
            // ponytail: someone who already added a lift with one of these names sees it twice; merge theirs into the
            // built-in (moving its sets, plan and maxes) if that comes up.
            migrationBuilder.Sql($"""
                INSERT INTO Exercises (UserId, Name, MuscleGroup)
                SELECT NULL, New.Name, New.MuscleGroup
                FROM (VALUES {Lifts}) AS New (Name, MuscleGroup)
                WHERE NOT EXISTS (SELECT 1 FROM Exercises WHERE UserId IS NULL AND Name = New.Name);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($"""
                DELETE FROM Exercises
                WHERE UserId IS NULL AND Name IN (SELECT Name FROM (VALUES {Lifts}) AS New (Name, MuscleGroup));
                """);
        }
    }
}
