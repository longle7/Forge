using System.ComponentModel.DataAnnotations;
using Forge.Api.Data;
using Forge.Api.Domain;
using Forge.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Forge.Api.Controllers
{
    /// <summary>
    /// Sign in with Apple. The app gets an identity token from Apple and trades it here for Forge's own token (see
    /// SessionTokens), which says which UserId your data is saved under. That's how your data follows you to a new
    /// phone, or back after deleting the app.
    /// </summary>
    [ApiController]
    [Route("auth")]
    public class AuthController : ControllerBase
    {
        private readonly ForgeDbContext _db;
        private readonly IAppleSignIn _apple;
        private readonly SessionTokens _sessions;

        public AuthController(ForgeDbContext db, IAppleSignIn apple, SessionTokens sessions)
        {
            _db = db;
            _apple = apple;
            _sessions = sessions;
        }

        // POST /auth/apple: your Forge token. The first time an Apple account signs in, it keeps LegacyUserId (the
        // anonymous ID a beta build gave that phone), so everything logged before sign-in existed stays yours. An ID
        // another Apple account already has is ignored, and you get a new, empty account instead.
        [HttpPost("apple")]
        public async Task<ActionResult<SessionResponse>> Apple(AppleSignInRequest request, CancellationToken cancellationToken)
        {
            var sub = await _apple.SubjectOfAsync(request.IdentityToken, cancellationToken);
            if (sub is null)
            {
                return Problem(title: "Sign in with Apple didn't go through. Try again.", statusCode: StatusCodes.Status401Unauthorized);
            }

            var account = await _db.AppleAccounts.FindAsync([sub], cancellationToken);
            if (account is null)
            {
                var legacy = request.LegacyUserId?.Trim();
                var keepLegacy = !string.IsNullOrEmpty(legacy) && !await _db.AppleAccounts.AnyAsync(a => a.UserId == legacy, cancellationToken);
                account = new AppleAccount { Sub = sub, UserId = keepLegacy ? legacy! : Guid.NewGuid().ToString() };
                _db.AppleAccounts.Add(account);
                try
                {
                    await _db.SaveChangesAsync(cancellationToken);
                }
                catch (DbUpdateException)
                {
                    // Two sign-ins at once (a double tap): the other one saved the account first. Use that one.
                    _db.ChangeTracker.Clear();
                    account = await _db.AppleAccounts.FindAsync([sub], cancellationToken);
                    if (account is null) throw;
                }
            }
            return new SessionResponse(_sessions.Issue(account.UserId));
        }
    }

    public record AppleSignInRequest([Required, MaxLength(5000)] string IdentityToken, [MaxLength(100)] string? LegacyUserId);

    public record SessionResponse(string Token);
}
