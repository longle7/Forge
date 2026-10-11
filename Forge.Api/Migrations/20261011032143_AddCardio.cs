using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Forge.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCardio : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Distance",
                table: "WorkoutSets",
                type: "decimal(6,2)",
                precision: 6,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DurationSeconds",
                table: "WorkoutSets",
                type: "int",
                nullable: true);

            // Cardio built-ins: plain INSERTs, so they take the next free IDs (see BuiltInExercises).
            migrationBuilder.Sql("""
                INSERT INTO Exercises (UserId, Name, MuscleGroup) VALUES
                    (NULL, N'Running', N'Cardio'),
                    (NULL, N'Walking', N'Cardio'),
                    (NULL, N'Cycling', N'Cardio'),
                    (NULL, N'Rowing (Machine)', N'Cardio'),
                    (NULL, N'Elliptical (Machine)', N'Cardio');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM Exercises WHERE UserId IS NULL AND MuscleGroup = N'Cardio';");

            migrationBuilder.DropColumn(
                name: "Distance",
                table: "WorkoutSets");

            migrationBuilder.DropColumn(
                name: "DurationSeconds",
                table: "WorkoutSets");
        }
    }
}
