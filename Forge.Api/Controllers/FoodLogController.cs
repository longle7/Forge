using System.ComponentModel.DataAnnotations;
using Forge.Api.Data;
using Forge.Api.Domain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Forge.Api.Controllers
{
    /// <summary>
    /// What you ate, by day and meal. Like workouts, an entry's ID is made up by the app and saved with an idempotent
    /// PUT, so a retry on weak signal never logs it twice. Yours alone (the X-User-Id header, see WorkoutsController).
    /// ponytail: header is trusted as-is, replace with the authenticated user's ID when login exists.
    /// </summary>
    [ApiController]
    [Route("food-log")]
    public class FoodLogController : ControllerBase
    {
        public static readonly string[] Meals = { "breakfast", "lunch", "dinner", "snack" };
        public static readonly string[] Sources = { "manual", "search", "label", "photo" };
        public const int MaxDaysPerRequest = 400;
        public const int RecentFoods = 30;

        private readonly ForgeDbContext _db;

        public FoodLogController(ForgeDbContext db)
        {
            _db = db;
        }

        // GET /food-log?date=2026-10-10: that day's entries, in the order they were logged.
        [HttpGet]
        public async Task<IEnumerable<FoodEntryDto>> GetDay(
            [FromQuery, Required] DateOnly date,
            [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId) =>
            (await _db.FoodEntries
                .Where(f => f.UserId == userId && f.Date == date)
                .OrderBy(f => f.CreatedAtUtc)
                .ToListAsync())
            .Select(FoodEntryDto.From);

        // GET /food-log/days?from=2026-09-11&to=2026-10-10: each day's totals (days with nothing logged are left out).
        [HttpGet("days")]
        public async Task<ActionResult<IEnumerable<DayTotals>>> GetDays(
            [FromQuery, Required] DateOnly from,
            [FromQuery, Required] DateOnly to,
            [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            if (to < from || to.DayNumber - from.DayNumber >= MaxDaysPerRequest)
            {
                ModelState.AddModelError(nameof(to), $"Ask for 1 to {MaxDaysPerRequest} days, with to on or after from.");
                return ValidationProblem();
            }

            return await _db.FoodEntries
                .Where(f => f.UserId == userId && f.Date >= from && f.Date <= to)
                .GroupBy(f => f.Date)
                .OrderBy(g => g.Key)
                .Select(g => new DayTotals(
                    g.Key,
                    g.Sum(f => f.Calories * f.Servings),
                    g.Sum(f => f.Protein * f.Servings),
                    g.Sum(f => f.Carbs * f.Servings),
                    g.Sum(f => f.Fat * f.Servings)))
                .ToListAsync();
        }

        // GET /food-log/recent: the foods you logged lately, each once, newest first: one tap to log again.
        [HttpGet("recent")]
        public async Task<IEnumerable<FoodEntryDto>> GetRecent([FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            // ponytail: de-duplicated in memory from the last 300 entries; enough for "recent".
            var latest = await _db.FoodEntries
                .Where(f => f.UserId == userId)
                .OrderByDescending(f => f.CreatedAtUtc)
                .Take(300)
                .ToListAsync();

            return latest
                .DistinctBy(f => (f.Name.ToLowerInvariant(), f.Serving.ToLowerInvariant()))
                .Take(RecentFoods)
                .Select(FoodEntryDto.From);
        }

        // PUT /food-log/{id}: logs an entry (201), or replaces it (200).
        [HttpPut("{id:guid}")]
        public async Task<ActionResult<FoodEntryDto>> Put(
            Guid id,
            FoodEntryRequest request,
            [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var entry = await _db.FoodEntries.FindAsync(id);
            if (entry is not null && entry.UserId != userId)
            {
                return NotFound(); // someone else's: the same answer as a missing one
            }

            if (!Meals.Contains(request.Meal)) ModelState.AddModelError(nameof(request.Meal), $"Meal must be one of {string.Join(", ", Meals)}.");
            if (request.Source is not null && !Sources.Contains(request.Source)) ModelState.AddModelError(nameof(request.Source), $"Source must be one of {string.Join(", ", Sources)}.");
            if (!ModelState.IsValid)
            {
                return ValidationProblem();
            }

            var created = entry is null;
            if (entry is null)
            {
                entry = new FoodEntry { Id = id, UserId = userId };
                _db.FoodEntries.Add(entry);
            }

            entry.Date = request.Date;
            entry.Meal = request.Meal;
            entry.Name = request.Name.Trim();
            entry.Serving = string.IsNullOrWhiteSpace(request.Serving) ? "1 serving" : request.Serving.Trim();
            entry.Servings = request.Servings;
            entry.Calories = request.Calories;
            entry.Protein = request.Protein;
            entry.Carbs = request.Carbs;
            entry.Fat = request.Fat;
            entry.Source = request.Source ?? "manual";
            await _db.SaveChangesAsync();

            var response = FoodEntryDto.From(entry);
            return created ? StatusCode(StatusCodes.Status201Created, response) : response;
        }

        // DELETE /food-log/{id}
        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(Guid id, [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var deleted = await _db.FoodEntries.Where(f => f.Id == id && f.UserId == userId).ExecuteDeleteAsync();
            return deleted == 0 ? NotFound() : NoContent();
        }
    }

    public record FoodEntryRequest(
        DateOnly Date,
        [Required] string Meal,
        [Required, MaxLength(200)] string Name,
        [MaxLength(100)] string? Serving,
        [Range(0.01, 100)] decimal Servings,
        [Range(0, 5000)] decimal Calories,
        [Range(0, 1000)] decimal Protein,
        [Range(0, 1000)] decimal Carbs,
        [Range(0, 1000)] decimal Fat,
        string? Source = null);

    public record FoodEntryDto(
        Guid Id,
        DateOnly Date,
        string Meal,
        string Name,
        string Serving,
        decimal Servings,
        decimal Calories,
        decimal Protein,
        decimal Carbs,
        decimal Fat,
        string Source)
    {
        public static FoodEntryDto From(FoodEntry f) =>
            new(f.Id, f.Date, f.Meal, f.Name, f.Serving, f.Servings, f.Calories, f.Protein, f.Carbs, f.Fat, f.Source);
    }

    public record DayTotals(DateOnly Date, decimal Calories, decimal Protein, decimal Carbs, decimal Fat);
}
