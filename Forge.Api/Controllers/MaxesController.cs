using System.ComponentModel.DataAnnotations;
using Forge.Api.Data;
using Forge.Api.Domain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Forge.Api.Controllers
{
    /// <summary>
    /// Maxes you tested outside a logged workout. Like workouts, a max's ID is made up by the app and saved with an
    /// idempotent PUT. Yours alone (the X-User-Id header, see WorkoutsController); someone else's answers 404.
    /// </summary>
    [ApiController]
    [Route("maxes")]
    public class MaxesController : ControllerBase
    {
        private readonly ForgeDbContext _db;

        public MaxesController(ForgeDbContext db)
        {
            _db = db;
        }

        // GET /maxes: newest first.
        [HttpGet]
        public async Task<IEnumerable<TestedMaxDto>> GetAll([FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId) =>
            await _db.TestedMaxes
                .Where(m => m.UserId == userId)
                .OrderByDescending(m => m.Date)
                .ThenByDescending(m => m.CreatedAtUtc)
                .Select(m => new TestedMaxDto(m.Id, m.ExerciseId, m.Date, m.Weight, m.Reps))
                .ToListAsync();

        // PUT /maxes/{id}: creates the max (201) or replaces it (200).
        [HttpPut("{id:guid}")]
        public async Task<ActionResult<TestedMaxDto>> Put(Guid id, TestedMaxRequest request, [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var max = await _db.TestedMaxes.FindAsync(id);
            if (max is not null && max.UserId != userId)
            {
                return NotFound(); // someone else's: the same answer as a missing one
            }

            var exercise = await _db.Exercises.FirstOrDefaultAsync(e => e.Id == request.ExerciseId && (e.UserId == null || e.UserId == userId));
            if (exercise is null)
            {
                ModelState.AddModelError(nameof(request.ExerciseId), "Pick an exercise from your list.");
            }
            else if (exercise.MuscleGroup == ExercisesController.Cardio)
            {
                ModelState.AddModelError(nameof(request.ExerciseId), "Maxes are for lifts, not cardio.");
            }
            // A day ahead of UTC is still today somewhere.
            if (request.Date > DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1))
            {
                ModelState.AddModelError(nameof(request.Date), "The date can't be in the future.");
            }
            if (!ModelState.IsValid)
            {
                return ValidationProblem();
            }

            var created = max is null;
            if (max is null)
            {
                max = new TestedMax { Id = id, UserId = userId };
                _db.TestedMaxes.Add(max);
            }

            max.ExerciseId = request.ExerciseId;
            max.Date = request.Date;
            max.Weight = request.Weight;
            max.Reps = request.Reps;
            await _db.SaveChangesAsync();

            var response = new TestedMaxDto(max.Id, max.ExerciseId, max.Date, max.Weight, max.Reps);
            return created ? StatusCode(StatusCodes.Status201Created, response) : response;
        }

        // DELETE /maxes/{id}
        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(Guid id, [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var deleted = await _db.TestedMaxes.Where(m => m.Id == id && m.UserId == userId).ExecuteDeleteAsync();
            return deleted == 0 ? NotFound() : NoContent();
        }
    }

    public record TestedMaxRequest(
        int ExerciseId,
        DateOnly Date,
        [Range(1, 2000)] decimal Weight,
        [Range(1, 10, ErrorMessage = "A tested max is for 1 to 10 reps.")] int Reps = 1);

    public record TestedMaxDto(Guid Id, int ExerciseId, DateOnly Date, decimal Weight, int Reps);
}
