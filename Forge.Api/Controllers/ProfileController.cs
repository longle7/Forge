using System.ComponentModel.DataAnnotations;
using Forge.Api.Data;
using Forge.Api.Domain;
using Microsoft.AspNetCore.Mvc;

namespace Forge.Api.Controllers
{
    /// <summary>
    /// Your goals and what they were worked out from (the app's setup), plus the Time Out unlock rules: one per user,
    /// identified by the X-User-Id header (see WorkoutsController).
    /// </summary>
    [ApiController]
    [Route("profile")]
    public class ProfileController : ControllerBase
    {
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
            profile.GoalWeight = request.GoalWeight;
            profile.CalorieGoal = request.CalorieGoal;
            profile.ProteinGoal = request.ProteinGoal;
            profile.CarbsGoal = request.CarbsGoal;
            profile.FatGoal = request.FatGoal;
            profile.FiberGoal = request.FiberGoal;
            profile.SugarLimit = request.SugarLimit;
            profile.SodiumLimit = request.SodiumLimit;
            profile.RestDayCalorieAdjust = request.RestDayCalorieAdjust;
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
        [Required, AllowedValues("male", "female", ErrorMessage = "Sex must be male or female.")] string Sex,
        [Range(1900, 2100)] int BirthYear,
        [Range(36, 96)] decimal HeightIn,
        [Range(50, 1000)] decimal StartWeight,
        [Required, AllowedValues("sedentary", "light", "active", "very-active", ErrorMessage = "Activity must be sedentary, light, active, or very-active.")] string Activity,
        [Required, AllowedValues("lose", "maintain", "gain", ErrorMessage = "Goal must be lose, maintain, or gain.")] string Goal,
        [Range(0, 2)] decimal Pace,
        [Range(800, 8000)] int CalorieGoal,
        [Range(0, 600)] int ProteinGoal,
        [Range(0, 1500)] int CarbsGoal,
        [Range(0, 600)] int FatGoal,
        bool UnlockAfterWorkout = false,
        [Range(0, 4)] int UnlockAfterMeals = 0,
        bool UnlockAfterWeighIn = false,
        bool UnlockAfterHabits = false,
        [Range(-1000, 0)] int RestDayCalorieAdjust = 0,
        [Range(50, 1000)] decimal? GoalWeight = null,
        [Range(1, 150)] int? FiberGoal = null,
        [Range(1, 500)] int? SugarLimit = null,
        [Range(100, 10_000)] int? SodiumLimit = null)
    {
        public static ProfileDto From(UserProfile p) => new(
            p.Sex, p.BirthYear, p.HeightIn, p.StartWeight, p.Activity, p.Goal, p.Pace,
            p.CalorieGoal, p.ProteinGoal, p.CarbsGoal, p.FatGoal,
            p.UnlockAfterWorkout, p.UnlockAfterMeals, p.UnlockAfterWeighIn, p.UnlockAfterHabits, p.RestDayCalorieAdjust, p.GoalWeight,
            p.FiberGoal, p.SugarLimit, p.SodiumLimit);
    }
}
