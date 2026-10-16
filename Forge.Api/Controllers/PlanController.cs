using System.ComponentModel.DataAnnotations;
using Forge.Api.Data;
using Forge.Api.Domain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Forge.Api.Controllers
{
    /// <summary>
    /// Your weekly plan: each weekday (0 = Sunday … 6 = Saturday) is a planned workout, like Monday = Push Day with
    /// Bench Press 4 × 8, or a rest day (no plan). It repeats every week. Yours alone (the X-User-Id header).
    /// </summary>
    [ApiController]
    [Route("plan")]
    public class PlanController : ControllerBase
    {
        public const int MaxExercises = 30;

        private readonly ForgeDbContext _db;

        public PlanController(ForgeDbContext db)
        {
            _db = db;
        }

        // GET /plan: the planned weekdays; one that isn't listed is a rest day.
        [HttpGet]
        public async Task<IEnumerable<PlanDayResponse>> Get([FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var days = await _db.PlanDays
                .Include(d => d.Exercises)
                .Where(d => d.UserId == userId)
                .OrderBy(d => d.DayOfWeek)
                .ToListAsync();

            return days.Select(PlanDayResponse.From);
        }

        // PUT /plan/1: plans Monday, or replaces its plan.
        [HttpPut("{day:int:range(0,6)}")]
        public async Task<ActionResult<PlanDayResponse>> Put(
            int day,
            PlanDayRequest request,
            [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var exerciseIds = request.Exercises.Select(e => e.ExerciseId).Distinct().ToList();
            var known = await _db.Exercises.CountAsync(e => exerciseIds.Contains(e.Id) && (e.UserId == null || e.UserId == userId));
            if (known != exerciseIds.Count)
            {
                ModelState.AddModelError(nameof(request.Exercises), "The plan has an unknown exercise.");
            }

            if (!ModelState.IsValid)
            {
                return ValidationProblem();
            }

            var planDay = await _db.PlanDays.Include(d => d.Exercises).FirstOrDefaultAsync(d => d.UserId == userId && d.DayOfWeek == day);
            if (planDay is null)
            {
                planDay = new PlanDay { UserId = userId, DayOfWeek = day };
                _db.PlanDays.Add(planDay);
            }

            planDay.Name = request.Name.Trim();
            planDay.Exercises.Clear(); // the old ones are deleted (orphans of a required relationship)
            planDay.Exercises.AddRange(request.Exercises.Select((e, i) => new PlanExercise
            {
                ExerciseId = e.ExerciseId,
                Position = i,
                Sets = e.Sets,
                Reps = e.Reps,
            }));
            await _db.SaveChangesAsync();

            return PlanDayResponse.From(planDay);
        }

        // DELETE /plan/1: Monday becomes a rest day.
        [HttpDelete("{day:int:range(0,6)}")]
        public async Task<IActionResult> Delete(int day, [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            await _db.PlanDays.Where(d => d.UserId == userId && d.DayOfWeek == day).ExecuteDeleteAsync();
            return NoContent();
        }
    }

    public record PlanDayRequest(
        [Required, MaxLength(50)] string Name,
        [Required, MinLength(1, ErrorMessage = "Add at least one exercise, or make it a rest day."),
         MaxLength(PlanController.MaxExercises, ErrorMessage = "A day can have up to {1} exercises.")] List<PlanExerciseDto> Exercises);

    public record PlanExerciseDto(
        int ExerciseId,
        [Range(1, 20)] int Sets,
        [Range(1, 100)] int Reps);

    public record PlanDayResponse(int DayOfWeek, string Name, DateTime CreatedAt, IEnumerable<PlanExerciseDto> Exercises)
    {
        public static PlanDayResponse From(PlanDay d) => new(
            d.DayOfWeek,
            d.Name,
            DateTime.SpecifyKind(d.CreatedAtUtc, DateTimeKind.Utc),
            d.Exercises.OrderBy(e => e.Position).Select(e => new PlanExerciseDto(e.ExerciseId, e.Sets, e.Reps)));
    }
}
