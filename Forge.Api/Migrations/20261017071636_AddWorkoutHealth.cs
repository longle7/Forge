using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Forge.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkoutHealth : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ActiveCalories",
                table: "Workouts",
                type: "decimal(6,1)",
                precision: 6,
                scale: 1,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Activity",
                table: "Workouts",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AvgHeartRate",
                table: "Workouts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HeartRate",
                table: "Workouts",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MaxHeartRate",
                table: "Workouts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "Workouts",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "forge");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ActiveCalories",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "Activity",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "AvgHeartRate",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "HeartRate",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "MaxHeartRate",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "Workouts");
        }
    }
}
