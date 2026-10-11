using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Forge.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddHabits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "UnlockAfterHabits",
                table: "UserProfiles",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "Habits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Emoji = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    DailyTarget = table.Column<int>(type: "int", nullable: false),
                    Days = table.Column<int>(type: "int", nullable: false),
                    ArchivedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Habits", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HabitChecks",
                columns: table => new
                {
                    HabitId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Count = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HabitChecks", x => new { x.HabitId, x.Date });
                    table.ForeignKey(
                        name: "FK_HabitChecks_Habits_HabitId",
                        column: x => x.HabitId,
                        principalTable: "Habits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Habits_UserId",
                table: "Habits",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "HabitChecks");

            migrationBuilder.DropTable(
                name: "Habits");

            migrationBuilder.DropColumn(
                name: "UnlockAfterHabits",
                table: "UserProfiles");
        }
    }
}
