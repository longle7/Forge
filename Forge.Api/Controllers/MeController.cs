using System.ComponentModel.DataAnnotations;
using Forge.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Forge.Api.Controllers
{
    /// <summary>
    /// Everything stored for the current user, identified by the X-User-Id header.
    /// ponytail: header is trusted as-is, replace with the authenticated user's ID when login exists.
    /// </summary>
    [ApiController]
    [Route("me")]
    public class MeController : ControllerBase
    {
        private readonly ForgeDbContext _db;

        public MeController(ForgeDbContext db)
        {
            _db = db;
        }

        // DELETE /me: the app's "Delete my data" (the App Store requires in-app deletion): every row of every table
        // that's yours. Workouts and plan days go before your own exercises, which their sets point at.
        [HttpDelete]
        public async Task<IActionResult> Delete([FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            // All or nothing, retried as a whole on a transient failure (the retrying strategy requires that).
            await _db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
                await using var transaction = await _db.Database.BeginTransactionAsync();
                await _db.Workouts.Where(w => w.UserId == userId).ExecuteDeleteAsync(); // their sets go with them
                await _db.PlanDays.Where(d => d.UserId == userId).ExecuteDeleteAsync(); // and their exercises
                await _db.Exercises.Where(e => e.UserId == userId).ExecuteDeleteAsync();
                await _db.FoodEntries.Where(f => f.UserId == userId).ExecuteDeleteAsync();
                await _db.SavedMeals.Where(m => m.UserId == userId).ExecuteDeleteAsync();
                await _db.WeighIns.Where(w => w.UserId == userId).ExecuteDeleteAsync();
                await _db.Habits.Where(h => h.UserId == userId).ExecuteDeleteAsync(); // their check-offs go with them
                await _db.UserProfiles.Where(p => p.UserId == userId).ExecuteDeleteAsync();
                await _db.ScanUsage.Where(u => u.UserId == userId).ExecuteDeleteAsync();
                await transaction.CommitAsync();
            });
            return NoContent();
        }
    }
}
