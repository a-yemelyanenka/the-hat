using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TheHat.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Rooms",
                columns: table => new
                {
                    RoomId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    InviteCode = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    HostPlayerId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Phase = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    Settings = table.Column<string>(type: "TEXT", nullable: false),
                    Players = table.Column<string>(type: "TEXT", nullable: false),
                    Words = table.Column<string>(type: "TEXT", nullable: false),
                    Rounds = table.Column<string>(type: "TEXT", nullable: false),
                    CurrentRoundNumber = table.Column<int>(type: "INTEGER", nullable: true),
                    LastCompletedExplainerPlayerId = table.Column<string>(type: "TEXT", nullable: true),
                    LastCompletedTurnNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    CurrentTurn = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Rooms", x => x.RoomId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Rooms_InviteCode",
                table: "Rooms",
                column: "InviteCode",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Rooms");
        }
    }
}
