using System.ComponentModel.DataAnnotations;
using Forge.Api.Data;
using Forge.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Forge.Api.Controllers
{
    /// <summary>
    /// Everything stored for the current user, identified by the X-User-Id header (set from your sign-in token, see
    /// the sign-in middleware in Program.cs).
    /// </summary>
    [ApiController]
    [Route("me")]
    public class MeController : ControllerBase
    {
        private readonly ForgeDbContext _db;
        private readonly IAppleSignIn _apple;

        public MeController(ForgeDbContext db, IAppleSignIn apple)
        {
            _db = db;
            _apple = apple;
        }

        // DELETE /me: the app's "Delete account" (the App Store requires in-app deletion): every row of every table
        // that's yours, and your Apple sign-in. Workouts and plan days go before your own exercises, which their sets
        // point at. X-Apple-Code is the authorization code of a fresh Sign in with Apple, so Apple can be told to drop
        // Forge's access too, as Apple requires (best effort: the data goes either way).
        [HttpDelete]
        public async Task<IActionResult> Delete([FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId,
            [FromHeader(Name = "X-Apple-Code"), MaxLength(1000)] string? appleCode, CancellationToken cancellationToken)
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
                await _db.AppleAccounts.Where(a => a.UserId == userId).ExecuteDeleteAsync(); // signing in again starts fresh
                await transaction.CommitAsync();
            });
            if (!string.IsNullOrEmpty(appleCode))
            {
                await _apple.RevokeAsync(appleCode, cancellationToken);
            }
            return NoContent();
        }
    }
}
