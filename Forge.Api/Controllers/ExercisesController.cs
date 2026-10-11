using System.ComponentModel.DataAnnotations;
using Forge.Api.Data;
using Forge.Api.Domain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Forge.Api.Controllers
{
    /// <summary>
    /// The exercises you can log: the built-in ones plus any you added. Yours are visible only to you (the X-User-Id
    /// header, see WorkoutsController).
    /// ponytail: header is trusted as-is, replace with the authenticated user's ID when login exists.
    /// </summary>
    [ApiController]
    [Route("exercises")]
    public class ExercisesController : ControllerBase
    {
        public static readonly string[] MuscleGroups = { "Chest", "Back", "Legs", "Shoulders", "Arms", "Core", Cardio, "Other" };

        // Exercises in this group are cardio: their sets are a distance and a time, not weight and reps.
        public const string Cardio = "Cardio";

        // Far more than anyone needs; stops a buggy or abusive client from filling the database.
        public const int MaxCustomPerUser = 200;

        private readonly ForgeDbContext _db;

        public ExercisesController(ForgeDbContext db)
        {
            _db = db;
        }

        // GET /exercises
        [HttpGet]
        public async Task<IEnumerable<ExerciseResponse>> GetAll([FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var exercises = await _db.Exercises
                .Where(e => e.UserId == null || e.UserId == userId)
                .OrderBy(e => e.Name)
                .ToListAsync();

            return exercises.Select(ExerciseResponse.From);
        }

        // POST /exercises
        [HttpPost]
        public async Task<ActionResult<ExerciseResponse>> Create(
            ExerciseRequest request,
            [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var name = request.Name.Trim();
            if (!MuscleGroups.Contains(request.MuscleGroup))
            {
                ModelState.AddModelError(nameof(request.MuscleGroup), $"MuscleGroup must be one of {string.Join(", ", MuscleGroups)}.");
            }
            else if (await _db.Exercises.CountAsync(e => e.UserId == userId) >= MaxCustomPerUser)
            {
                ModelState.AddModelError("", $"You can add up to {MaxCustomPerUser} exercises.");
            }
            // SQL Server compares case-insensitively, so "bench press (barbell)" counts as taken too.
            else if (await _db.Exercises.AnyAsync(e => (e.UserId == null || e.UserId == userId) && e.Name == name))
            {
                ModelState.AddModelError(nameof(request.Name), $"There's already an exercise called {name}.");
            }

            if (!ModelState.IsValid)
            {
                return ValidationProblem();
            }

            var exercise = new Exercise { UserId = userId, Name = name, MuscleGroup = request.MuscleGroup };
            _db.Exercises.Add(exercise);
            await _db.SaveChangesAsync();

            return StatusCode(StatusCodes.Status201Created, ExerciseResponse.From(exercise));
        }
    }

    public record ExerciseRequest(
        [Required, MaxLength(100)] string Name,
        [Required] string MuscleGroup);

    public record ExerciseResponse(int Id, string Name, string MuscleGroup, bool IsCustom)
    {
        public static ExerciseResponse From(Exercise e) => new(e.Id, e.Name, e.MuscleGroup, e.UserId != null);
    }
}
