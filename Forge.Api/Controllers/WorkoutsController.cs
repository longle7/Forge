using System.ComponentModel.DataAnnotations;
using Forge.Api.Data;
using Forge.Api.Domain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Forge.Api.Controllers
{
    /// <summary>
    /// Your finished workouts (read, save, delete).
    ///
    /// Who are you? The X-User-Id header: set from your sign-in token by the middleware in Program.cs, or sent as-is
    /// by not-yet-signed-in beta builds until Auth:RequireSignIn is on. Each endpoint only touches rows with that ID.
    /// Someone else's workout answers 404 (not 403), so nobody can tell whether it exists.
    /// Saving is one idempotent PUT: the app makes up the workout's ID when it starts, so tapping Finish again after a
    /// lost response (weak signal at the gym) saves the same workout instead of a copy, and editing a past workout is
    /// the same call. Apple Watch workouts come in the same way, with Apple Health's own workout ID, so bringing them in
    /// again never adds copies; PUT /workouts/{id}/health adds Watch data to a workout logged in Forge.
    /// </summary>
    [ApiController]
    [Route("workouts")]
    public class WorkoutsController : ControllerBase
    {
        public const int MaxSets = 300;
        public const string Health = "health";
        public static readonly TimeSpan MaxDuration = TimeSpan.FromHours(24);

        private readonly ForgeDbContext _db;

        public WorkoutsController(ForgeDbContext db)
        {
            _db = db;
        }

        // GET /workouts: newest first.
        // ponytail: returns every workout; page it when history gets long.
        [HttpGet]
        public async Task<IEnumerable<WorkoutResponse>> GetAll([FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var workouts = await _db.Workouts
                .Include(w => w.Sets)
                .Where(w => w.UserId == userId)
                .OrderByDescending(w => w.StartedAtUtc)
                .AsSplitQuery()
                .ToListAsync();

            return workouts.Select(WorkoutResponse.From);
        }

        // PUT /workouts/{id}: creates the workout (201) or replaces it and all its sets (200).
        [HttpPut("{id:guid}")]
        public async Task<ActionResult<WorkoutResponse>> Put(
            Guid id,
            WorkoutRequest request,
            [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var workout = await _db.Workouts.Include(w => w.Sets).FirstOrDefaultAsync(w => w.Id == id);
            if (workout is not null && workout.UserId != userId)
            {
                return NotFound(); // someone else's: the same answer as a missing one
            }

            var cardio = await ValidateAsync(request, userId);
            if (cardio is null)
            {
                return ValidationProblem();
            }

            var created = workout is null;
            if (workout is null)
            {
                workout = new Workout { Id = id, UserId = userId };
                _db.Workouts.Add(workout);
            }

            workout.Name = string.IsNullOrWhiteSpace(request.Name) ? "Workout" : request.Name.Trim();
            // Apple Health's numbers come only with a Health workout; editing a Forge workout keeps any it has.
            if (request.Source == Health)
            {
                workout.Source = Health;
                workout.Activity = request.Activity?.Trim();
                SetHealth(workout, request.ActiveCalories, request.AvgHeartRate, request.MaxHeartRate, request.HeartRate);
            }
            workout.StartedAtUtc = request.StartedAt.UtcDateTime;
            workout.FinishedAtUtc = request.FinishedAt.UtcDateTime;
            workout.Sets.Clear(); // the old sets are deleted (orphans of a required relationship)
            // Each set keeps only what its kind uses: weight and reps, or a cardio distance and time.
            workout.Sets.AddRange(request.Sets.Select((s, i) => cardio.Contains(s.ExerciseId)
                ? new WorkoutSet
                {
                    ExerciseId = s.ExerciseId,
                    Position = i,
                    Distance = s.Distance > 0 ? s.Distance : null,
                    DurationSeconds = s.DurationSeconds > 0 ? s.DurationSeconds : null,
                }
                : new WorkoutSet
                {
                    ExerciseId = s.ExerciseId,
                    Position = i,
                    Weight = s.Weight,
                    Reps = s.Reps,
                }));
            await _db.SaveChangesAsync();

            var response = WorkoutResponse.From(workout);
            return created ? Created($"/workouts/{id}", response) : response;
        }

        // PUT /workouts/{id}/health: Apple Health's calories and heart rate for a workout of yours, e.g. one you logged in
        // Forge while the Watch recorded it too. Changes nothing else.
        [HttpPut("{id:guid}/health")]
        public async Task<ActionResult<WorkoutResponse>> PutHealth(Guid id, WorkoutHealthRequest request, [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var workout = await _db.Workouts.Include(w => w.Sets).FirstOrDefaultAsync(w => w.Id == id && w.UserId == userId);
            if (workout is null)
            {
                return NotFound();
            }
            SetHealth(workout, request.ActiveCalories, request.AvgHeartRate, request.MaxHeartRate, request.HeartRate);
            await _db.SaveChangesAsync();
            return WorkoutResponse.From(workout);
        }

        private static void SetHealth(Workout workout, decimal? calories, int? avg, int? max, List<HeartRatePointDto>? points)
        {
            workout.ActiveCalories = calories;
            workout.AvgHeartRate = avg;
            workout.MaxHeartRate = max;
            workout.HeartRate = [.. (points ?? []).Select(p => new HeartRatePoint { S = p.S, Bpm = p.Bpm })];
        }

        // DELETE /workouts/{id}: its sets go with it (cascade delete).
        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(Guid id, [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var deleted = await _db.Workouts.Where(w => w.Id == id && w.UserId == userId).ExecuteDeleteAsync();
            return deleted == 0 ? NotFound() : NoContent();
        }

        // Checks what the attributes on the request can't: the sets' exercises, what each set needs for its kind, and
        // the times. Returns the IDs of the cardio exercises, or adds errors to ModelState and returns null when invalid.
        private async Task<HashSet<int>?> ValidateAsync(WorkoutRequest request, string userId)
        {
            if (request.Sets.Count == 0 && request.Source != Health) // the Watch records no sets for strength training
            {
                ModelState.AddModelError(nameof(request.Sets), "Check off at least one set to save a workout.");
            }
            else if (request.Sets.Count > MaxSets)
            {
                ModelState.AddModelError(nameof(request.Sets), $"A workout can have up to {MaxSets} sets.");
            }

            var exerciseIds = request.Sets.Select(s => s.ExerciseId).Distinct().ToList();
            var known = await _db.Exercises
                .Where(e => exerciseIds.Contains(e.Id) && (e.UserId == null || e.UserId == userId))
                .ToDictionaryAsync(e => e.Id, e => e.MuscleGroup == ExercisesController.Cardio);
            if (known.Count != exerciseIds.Count)
            {
                ModelState.AddModelError(nameof(request.Sets), "A set has an unknown exercise.");
            }
            else if (request.Sets.Any(s => known[s.ExerciseId] ? !(s.Distance > 0 || s.DurationSeconds > 0) : s.Reps < 1))
            {
                ModelState.AddModelError(nameof(request.Sets), "Each set needs its reps, or for cardio a distance or time.");
            }

            if (request.FinishedAt < request.StartedAt)
            {
                ModelState.AddModelError(nameof(request.FinishedAt), "FinishedAt must be after StartedAt.");
            }
            else if (request.FinishedAt - request.StartedAt > MaxDuration)
            {
                ModelState.AddModelError(nameof(request.FinishedAt), "A workout can last up to 24 hours.");
            }

            return ModelState.IsValid ? [.. known.Where(e => e.Value).Select(e => e.Key)] : null;
        }
    }

    public record WorkoutRequest(
        [MaxLength(100)] string? Name,
        DateTimeOffset StartedAt,
        DateTimeOffset FinishedAt,
        [Required] List<WorkoutSetRequest> Sets,
        [AllowedValues("forge", WorkoutsController.Health, null)] string? Source = null,
        [MaxLength(30)] string? Activity = null,
        [Range(0, 5000)] decimal? ActiveCalories = null,
        [Range(30, 250)] int? AvgHeartRate = null,
        [Range(30, 250)] int? MaxHeartRate = null,
        [MaxLength(600)] List<HeartRatePointDto>? HeartRate = null);

    public record WorkoutHealthRequest(
        [Range(0, 5000)] decimal? ActiveCalories,
        [Range(30, 250)] int? AvgHeartRate,
        [Range(30, 250)] int? MaxHeartRate,
        [MaxLength(600)] List<HeartRatePointDto>? HeartRate = null);

    // Heart rate S seconds into the workout. 600 points: 5 hours at one every 30 seconds.
    public record HeartRatePointDto([Range(0, 86_400)] int S, [Range(30, 250)] int Bpm);

    // A cardio set sends Distance (miles) and/or DurationSeconds instead of Weight and Reps.
    public record WorkoutSetRequest(
        int ExerciseId,
        [Range(0, 2000)] decimal Weight,
        [Range(0, 1000)] int Reps,
        [Range(0, 1000)] decimal? Distance = null,
        [Range(0, 86_400)] int? DurationSeconds = null);

    public record WorkoutResponse(
        Guid Id,
        string Name,
        DateTime StartedAt,
        DateTime FinishedAt,
        IEnumerable<WorkoutSetResponse> Sets,
        string Source,
        string? Activity,
        decimal? ActiveCalories,
        int? AvgHeartRate,
        int? MaxHeartRate,
        IEnumerable<HeartRatePointDto> HeartRate)
    {
        // SQL Server hands DateTimes back without a kind; mark them UTC so the JSON ends in "Z" and the app reads them right.
        public static WorkoutResponse From(Workout w) => new(
            w.Id,
            w.Name,
            DateTime.SpecifyKind(w.StartedAtUtc, DateTimeKind.Utc),
            DateTime.SpecifyKind(w.FinishedAtUtc, DateTimeKind.Utc),
            w.Sets.OrderBy(s => s.Position).Select(s => new WorkoutSetResponse(s.ExerciseId, s.Weight, s.Reps, s.Distance, s.DurationSeconds)),
            w.Source,
            w.Activity,
            w.ActiveCalories,
            w.AvgHeartRate,
            w.MaxHeartRate,
            (w.HeartRate ?? []).Select(p => new HeartRatePointDto(p.S, p.Bpm))); // null for workouts saved before heart rate
    }

    public record WorkoutSetResponse(int ExerciseId, decimal Weight, int Reps, decimal? Distance, int? DurationSeconds);
}
