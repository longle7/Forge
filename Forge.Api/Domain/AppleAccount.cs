namespace Forge.Api.Domain
{
    /// <summary>
    /// A Sign in with Apple account and the UserId its data is saved under. The first sign-in on a beta build keeps
    /// the anonymous ID that phone already had, so nothing moves: every table stays keyed by UserId (see AuthController).
    /// </summary>
    public class AppleAccount
    {
        // Apple's stable user identifier (the identity token's "sub"); primary key.
        public string Sub { get; set; } = string.Empty;

        // Unique: one Apple account per UserId.
        public string UserId { get; set; } = string.Empty;
    }
}
