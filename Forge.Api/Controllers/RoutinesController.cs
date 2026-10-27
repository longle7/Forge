using System.ComponentModel.DataAnnotations;
using Forge.Api.Data;
using Forge.Api.Domain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Forge.Api.Controllers
{
    /// <summary>
    /// Workouts you do often: saved from a finished workout, started again in one tap. Saved with an idempotent PUT, like
    /// workouts. Yours alone (the X-User-Id header, see WorkoutsController).
    /// </summary>
    [ApiController]
    [Route("routines")]
    public class RoutinesController : ControllerBase
    {
        // Far more than anyone needs; stops a buggy or abusive client from filling the database.
        public const int MaxPerUser = 100;

        private readonly ForgeDbContext _db;

        public RoutinesController(ForgeDbContext db)
        {
            _db = db;
        }

        // GET /routines: by name.
        [HttpGet]
        public async Task<IEnumerable<RoutineResponse>> GetAll([FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId) =>
            (await _db.Routines.Where(r => r.UserId == userId).OrderBy(r => r.Name).ToListAsync()).Select(RoutineResponse.From);

        // PUT /routines/{id}: saves a routine (201), or replaces it and its sets (200).
        [HttpPut("{id:guid}")]
        public async Task<ActionResult<RoutineResponse>> Put(
            Guid id,
            RoutineRequest request,
            [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var routine = await _db.Routines.FindAsync(id);
            if (routine is not null && routine.UserId != userId)
            {
                return NotFound(); // someone else's: the same answer as a missing one
            }

            if (routine is null && await _db.Routines.CountAsync(r => r.UserId == userId) >= MaxPerUser)
            {
                ModelState.AddModelError("", $"You can save up to {MaxPerUser} routines. Delete one to save another.");
                return ValidationProblem();
            }

            var cardio = await WorkoutsController.CheckSetsAsync(_db, ModelState, request.Sets, userId);
            if (!ModelState.IsValid)
            {
                return ValidationProblem();
            }

            var created = routine is null;
            if (routine is null)
            {
                routine = new Routine { Id = id, UserId = userId };
                _db.Routines.Add(routine);
            }

            routine.Name = request.Name.Trim();
            // Like a workout's sets: a lifting set keeps its weight, reps, and kind; a cardio set its distance and time.
            routine.Sets = [.. request.Sets.Select(s => cardio.Contains(s.ExerciseId)
                ? new RoutineSet
                {
                    ExerciseId = s.ExerciseId,
                    Distance = s.Distance > 0 ? s.Distance : null,
                    DurationSeconds = s.DurationSeconds > 0 ? s.DurationSeconds : null,
                    Superset = s.Superset,
                }
                : new RoutineSet
                {
                    ExerciseId = s.ExerciseId,
                    Weight = s.Weight,
                    Reps = s.Reps,
                    Kind = s.Kind,
                    Superset = s.Superset,
                })];
            await _db.SaveChangesAsync();

            var response = RoutineResponse.From(routine);
            return created ? StatusCode(StatusCodes.Status201Created, response) : response;
        }

        // DELETE /routines/{id}: workouts started from it stay.
        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(Guid id, [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var deleted = await _db.Routines.Where(r => r.Id == id && r.UserId == userId).ExecuteDeleteAsync();
            return deleted == 0 ? NotFound() : NoContent();
        }
    }

    // The sets are a workout's (WorkoutSetRequest), in the order the app lists them.
    public record RoutineRequest(
        [Required, MaxLength(50)] string Name,
        [Required, MinLength(1), MaxLength(WorkoutsController.MaxSets)] List<WorkoutSetRequest> Sets);

    public record RoutineResponse(Guid Id, string Name, IEnumerable<WorkoutSetRequest> Sets)
    {
        public static RoutineResponse From(Routine r) => new(
            r.Id,
            r.Name,
            r.Sets.Select(s => new WorkoutSetRequest(s.ExerciseId, s.Weight, s.Reps, s.Distance, s.DurationSeconds, s.Kind, s.Superset)));
    }
}
