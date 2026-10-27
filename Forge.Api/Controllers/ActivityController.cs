using System.ComponentModel.DataAnnotations;
using Forge.Api.Data;
using Forge.Api.Domain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Forge.Api.Controllers
{
    /// <summary>
    /// Your active calories a day, synced from Apple Health on the iPhone (saving a day again replaces it). Yours alone
    /// (the X-User-Id header).
    /// </summary>
    [ApiController]
    [Route("activity")]
    public class ActivityController : ControllerBase
    {
        private readonly ForgeDbContext _db;

        public ActivityController(ForgeDbContext db)
        {
            _db = db;
        }

        // GET /activity?from=2026-10-11&to=2026-10-17: oldest first (days without any are left out).
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ActiveEnergyDto>>> GetDays(
            [FromQuery, Required] DateOnly from,
            [FromQuery, Required] DateOnly to,
            [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            if (to < from || to.DayNumber - from.DayNumber >= FoodLogController.MaxDaysPerRequest)
            {
                ModelState.AddModelError(nameof(to), $"Ask for 1 to {FoodLogController.MaxDaysPerRequest} days, with to on or after from.");
                return ValidationProblem();
            }

            return await _db.ActiveEnergy
                .Where(a => a.UserId == userId && a.Date >= from && a.Date <= to)
                .OrderBy(a => a.Date)
                .Select(a => new ActiveEnergyDto(a.Date, a.Kcal))
                .ToListAsync();
        }

        // PUT /activity/2026-10-17: that day's active calories (creates it, or replaces it).
        [HttpPut("{date}")]
        public async Task<ActiveEnergyDto> Put(
            DateOnly date,
            ActiveEnergyRequest request,
            [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var day = await _db.ActiveEnergy.FindAsync(userId, date);
            if (day is null)
            {
                day = new ActiveEnergy { UserId = userId, Date = date };
                _db.ActiveEnergy.Add(day);
            }

            day.Kcal = request.Kcal;
            await _db.SaveChangesAsync();
            return new ActiveEnergyDto(day.Date, day.Kcal);
        }
    }

    public record ActiveEnergyRequest([Range(0, 10_000)] int Kcal);

    public record ActiveEnergyDto(DateOnly Date, int Kcal);
}
