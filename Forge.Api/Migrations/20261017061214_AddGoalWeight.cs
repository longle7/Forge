using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Forge.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddGoalWeight : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "GoalWeight",
                table: "UserProfiles",
                type: "decimal(5,1)",
                precision: 5,
                scale: 1,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GoalWeight",
                table: "UserProfiles");
        }
    }
}
