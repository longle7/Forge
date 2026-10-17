using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Forge.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFiberSugarSodium : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "FiberGoal",
                table: "UserProfiles",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SodiumLimit",
                table: "UserProfiles",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SugarLimit",
                table: "UserProfiles",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Fiber",
                table: "FoodEntries",
                type: "decimal(6,1)",
                precision: 6,
                scale: 1,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Sodium",
                table: "FoodEntries",
                type: "decimal(7,1)",
                precision: 7,
                scale: 1,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Sugar",
                table: "FoodEntries",
                type: "decimal(6,1)",
                precision: 6,
                scale: 1,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FiberGoal",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "SodiumLimit",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "SugarLimit",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "Fiber",
                table: "FoodEntries");

            migrationBuilder.DropColumn(
                name: "Sodium",
                table: "FoodEntries");

            migrationBuilder.DropColumn(
                name: "Sugar",
                table: "FoodEntries");
        }
    }
}
