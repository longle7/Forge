using System.ComponentModel.DataAnnotations;
using Forge.Api.Data;
using Forge.Api.Domain;
using Microsoft.AspNetCore.Mvc;

namespace Forge.Api.Controllers
{
    /// <summary>
    /// Your goals and what they were worked out from (the app's setup), plus the Time Out unlock rules: one per user,
    /// identified by the X-User-Id header (see WorkoutsController).
    /// ponytail: header is trusted as-is, replace with the authenticated user's ID when login exists.
    /// </summary>
    [ApiController]
    [Route("profile")]
    public class ProfileController : ControllerBase
    {
        public static readonly string[] Sexes = { "male", "female" };
        public static readonly string[] Activities = { "sedentary", "light", "active", "very-active" };
        public static readonly string[] Goals = { "lose", "maintain", "gain" };

        private readonly ForgeDbContext _db;

        public ProfileController(ForgeDbContext db)
        {
            _db = db;
        }

        // GET /profile: 404 until you've set your goals.
        [HttpGet]
        public async Task<ActionResult<ProfileDto>> Get([FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var profile = await _db.UserProfiles.FindAsync(userId);
            return profile is null ? NotFound() : ProfileDto.From(profile);
        }

        // PUT /profile: creates or replaces it.
        [HttpPut]
        public async Task<ActionResult<ProfileDto>> Put(ProfileDto request, [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            if (!Sexes.Contains(request.Sex)) ModelState.AddModelError(nameof(request.Sex), "Sex must be male or female.");
            if (!Activities.Contains(request.Activity)) ModelState.AddModelError(nameof(request.Activity), $"Activity must be one of {string.Join(", ", Activities)}.");
            if (!Goals.Contains(request.Goal)) ModelState.AddModelError(nameof(request.Goal), $"Goal must be one of {string.Join(", ", Goals)}.");
            if (request.BirthYear > DateTime.UtcNow.Year - 13) ModelState.AddModelError(nameof(request.BirthYear), "Forge is for people 13 and older.");
            if (!ModelState.IsValid)
            {
                return ValidationProblem();
            }

            var profile = await _db.UserProfiles.FindAsync(userId);
            if (profile is null)
            {
                profile = new UserProfile { UserId = userId };
                _db.UserProfiles.Add(profile);
            }

            profile.Sex = request.Sex;
            profile.BirthYear = request.BirthYear;
            profile.HeightIn = request.HeightIn;
            profile.StartWeight = request.StartWeight;
            profile.Activity = request.Activity;
            profile.Goal = request.Goal;
            profile.Pace = request.Goal == "maintain" ? 0 : request.Pace;
            profile.CalorieGoal = request.CalorieGoal;
            profile.ProteinGoal = request.ProteinGoal;
            profile.CarbsGoal = request.CarbsGoal;
            profile.FatGoal = request.FatGoal;
            profile.UnlockAfterWorkout = request.UnlockAfterWorkout;
            profile.UnlockAfterMeals = request.UnlockAfterMeals;
            profile.UnlockAfterWeighIn = request.UnlockAfterWeighIn;
            profile.UnlockAfterHabits = request.UnlockAfterHabits;
            profile.UpdatedAtUtc = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return ProfileDto.From(profile);
        }
    }

    public record ProfileDto(
        [Required] string Sex,
        [Range(1900, 2100)] int BirthYear,
        [Range(36, 96)] decimal HeightIn,
        [Range(50, 1000)] decimal StartWeight,
        [Required] string Activity,
        [Required] string Goal,
        [Range(0, 2)] decimal Pace,
        [Range(800, 8000)] int CalorieGoal,
        [Range(0, 600)] int ProteinGoal,
        [Range(0, 1500)] int CarbsGoal,
        [Range(0, 600)] int FatGoal,
        bool UnlockAfterWorkout = false,
        [Range(0, 4)] int UnlockAfterMeals = 0,
        bool UnlockAfterWeighIn = false,
        bool UnlockAfterHabits = false)
    {
        public static ProfileDto From(UserProfile p) => new(
            p.Sex, p.BirthYear, p.HeightIn, p.StartWeight, p.Activity, p.Goal, p.Pace,
            p.CalorieGoal, p.ProteinGoal, p.CarbsGoal, p.FatGoal,
            p.UnlockAfterWorkout, p.UnlockAfterMeals, p.UnlockAfterWeighIn, p.UnlockAfterHabits);
    }
}
