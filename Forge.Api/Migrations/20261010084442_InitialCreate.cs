using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Forge.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Exercises",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    MuscleGroup = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Exercises", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Workouts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    StartedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FinishedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Workouts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WorkoutSets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    WorkoutId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ExerciseId = table.Column<int>(type: "int", nullable: false),
                    Position = table.Column<int>(type: "int", nullable: false),
                    Weight = table.Column<decimal>(type: "decimal(6,2)", precision: 6, scale: 2, nullable: false),
                    Reps = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkoutSets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkoutSets_Exercises_ExerciseId",
                        column: x => x.ExerciseId,
                        principalTable: "Exercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkoutSets_Workouts_WorkoutId",
                        column: x => x.WorkoutId,
                        principalTable: "Workouts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Exercises",
                columns: new[] { "Id", "MuscleGroup", "Name", "UserId" },
                values: new object[,]
                {
                    { 1, "Chest", "Bench Press (Barbell)", null },
                    { 2, "Chest", "Incline Bench Press (Barbell)", null },
                    { 3, "Chest", "Bench Press (Dumbbell)", null },
                    { 4, "Chest", "Incline Bench Press (Dumbbell)", null },
                    { 5, "Chest", "Chest Fly (Cable)", null },
                    { 6, "Chest", "Push Up", null },
                    { 7, "Back", "Deadlift (Barbell)", null },
                    { 8, "Back", "Pull Up", null },
                    { 9, "Back", "Chin Up", null },
                    { 10, "Back", "Lat Pulldown (Cable)", null },
                    { 11, "Back", "Bent Over Row (Barbell)", null },
                    { 12, "Back", "Seated Row (Cable)", null },
                    { 13, "Back", "Row (Dumbbell)", null },
                    { 14, "Legs", "Squat (Barbell)", null },
                    { 15, "Legs", "Front Squat (Barbell)", null },
                    { 16, "Legs", "Romanian Deadlift (Barbell)", null },
                    { 17, "Legs", "Leg Press (Machine)", null },
                    { 18, "Legs", "Lunge (Dumbbell)", null },
                    { 19, "Legs", "Leg Extension (Machine)", null },
                    { 20, "Legs", "Leg Curl (Machine)", null },
                    { 21, "Legs", "Calf Raise (Machine)", null },
                    { 22, "Legs", "Hip Thrust (Barbell)", null },
                    { 23, "Shoulders", "Overhead Press (Barbell)", null },
                    { 24, "Shoulders", "Shoulder Press (Dumbbell)", null },
                    { 25, "Shoulders", "Lateral Raise (Dumbbell)", null },
                    { 26, "Shoulders", "Face Pull (Cable)", null },
                    { 27, "Arms", "Bicep Curl (Barbell)", null },
                    { 28, "Arms", "Bicep Curl (Dumbbell)", null },
                    { 29, "Arms", "Hammer Curl (Dumbbell)", null },
                    { 30, "Arms", "Triceps Pushdown (Cable)", null },
                    { 31, "Arms", "Skullcrusher (Barbell)", null },
                    { 32, "Arms", "Dip", null },
                    { 33, "Core", "Crunch", null },
                    { 34, "Core", "Cable Crunch (Cable)", null },
                    { 35, "Core", "Hanging Leg Raise", null }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Exercises_UserId",
                table: "Exercises",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Workouts_UserId",
                table: "Workouts",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutSets_ExerciseId",
                table: "WorkoutSets",
                column: "ExerciseId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutSets_WorkoutId",
                table: "WorkoutSets",
                column: "WorkoutId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WorkoutSets");

            migrationBuilder.DropTable(
                name: "Exercises");

            migrationBuilder.DropTable(
                name: "Workouts");
        }
    }
}
