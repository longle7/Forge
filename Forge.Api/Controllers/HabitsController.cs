using System.ComponentModel.DataAnnotations;
using Forge.Api.Data;
using Forge.Api.Domain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Forge.Api.Controllers
{
    /// <summary>
    /// Your daily habits and their check-offs. Like workouts, a habit's ID is made up by the app and saved with an
    /// idempotent PUT. Yours alone (the X-User-Id header, see WorkoutsController); someone else's habit answers 404.
    /// ponytail: header is trusted as-is, replace with the authenticated user's ID when login exists.
    /// </summary>
    [ApiController]
    [Route("habits")]
    public class HabitsController : ControllerBase
    {
        public const int MaxActive = 30;
        public const int HistoryDays = 400; // enough for a year's streaks and charts

        private readonly ForgeDbContext _db;

        public HabitsController(ForgeDbContext db)
        {
            _db = db;
        }

        // GET /habits: every habit (archived ones too, flagged), each with its check-offs from the last 400 days.
        [HttpGet]
        public async Task<IEnumerable<HabitResponse>> GetAll([FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var since = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-HistoryDays);
            var habits = await _db.Habits
                .Include(h => h.Checks.Where(c => c.Date >= since))
                .Where(h => h.UserId == userId)
                .OrderBy(h => h.CreatedAtUtc)
                .AsSplitQuery()
                .ToListAsync();
            return habits.Select(HabitResponse.From);
        }

        // PUT /habits/{id}: creates the habit (201) or updates it (200); its check-offs stay.
        [HttpPut("{id:guid}")]
        public async Task<ActionResult<HabitResponse>> Put(Guid id, HabitRequest request, [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var habit = await _db.Habits.Include(h => h.Checks).FirstOrDefaultAsync(h => h.Id == id);
            if (habit is not null && habit.UserId != userId)
            {
                return NotFound(); // someone else's: the same answer as a missing one
            }

            if ((request.Days & 127) == 0)
            {
                ModelState.AddModelError(nameof(request.Days), "Pick at least one day.");
            }
            else
            {
                // A new habit, or an archived one coming back, takes one of the active places.
                var becomingActive = !request.Archived && (habit is null || habit.ArchivedAtUtc is not null);
                if (becomingActive && await _db.Habits.CountAsync(h => h.UserId == userId && h.ArchivedAtUtc == null) >= MaxActive)
                {
                    ModelState.AddModelError("", $"You can have up to {MaxActive} habits. Archive one to add another.");
                }
            }
            if (!ModelState.IsValid)
            {
                return ValidationProblem();
            }

            var created = habit is null;
            if (habit is null)
            {
                habit = new Habit { Id = id, UserId = userId };
                _db.Habits.Add(habit);
            }

            habit.Name = request.Name.Trim();
            habit.Emoji = request.Emoji?.Trim() ?? string.Empty;
            habit.DailyTarget = request.DailyTarget;
            habit.Days = request.Days & 127;
            habit.ArchivedAtUtc = request.Archived ? habit.ArchivedAtUtc ?? DateTime.UtcNow : null;
            await _db.SaveChangesAsync();

            var response = HabitResponse.From(habit);
            return created ? StatusCode(StatusCodes.Status201Created, response) : response;
        }

        // DELETE /habits/{id}: the habit and all its check-offs.
        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(Guid id, [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var deleted = await _db.Habits.Where(h => h.Id == id && h.UserId == userId).ExecuteDeleteAsync();
            return deleted == 0 ? NotFound() : NoContent();
        }

        // PUT /habits/{id}/checks/2026-10-10: how many times it was done that day (0 clears the day).
        [HttpPut("{id:guid}/checks/{date}")]
        public async Task<IActionResult> Check(Guid id, DateOnly date, HabitCheckRequest request, [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            if (!await _db.Habits.AnyAsync(h => h.Id == id && h.UserId == userId))
            {
                return NotFound();
            }

            var check = await _db.HabitChecks.FindAsync(id, date);
            if (request.Count == 0)
            {
                if (check is not null) _db.HabitChecks.Remove(check);
            }
            else if (check is null)
            {
                _db.HabitChecks.Add(new HabitCheck { HabitId = id, Date = date, Count = request.Count });
            }
            else
            {
                check.Count = request.Count;
            }
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }

    public record HabitRequest(
        [Required, MaxLength(50)] string Name,
        [MaxLength(16)] string? Emoji,
        [Range(1, 20)] int DailyTarget,
        [Range(1, 127)] int Days,
        bool Archived = false);

    public record HabitCheckRequest([Range(0, 100)] int Count);

    public record HabitCheckDto(DateOnly Date, int Count);

    public record HabitResponse(Guid Id, string Name, string Emoji, int DailyTarget, int Days, bool Archived, DateTime CreatedAt, IEnumerable<HabitCheckDto> Checks)
    {
        public static HabitResponse From(Habit h) => new(
            h.Id,
            h.Name,
            h.Emoji,
            h.DailyTarget,
            h.Days,
            h.ArchivedAtUtc is not null,
            DateTime.SpecifyKind(h.CreatedAtUtc, DateTimeKind.Utc),
            h.Checks.OrderBy(c => c.Date).Select(c => new HabitCheckDto(c.Date, c.Count)));
    }
}
