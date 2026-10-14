using System.Security.Cryptography;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Forge.Api.Services
{
    /// <summary>
    /// Forge's own sign-in token, handed out after Sign in with Apple and sent back as "Authorization: Bearer". It
    /// says which UserId you are, signed with Auth:SigningKey (a Container App secret, at least 32 characters) so
    /// nobody can make one up. It lasts a year; signing in again gives a fresh one for the same account.
    /// </summary>
    public class SessionTokens
    {
        private const string Issuer = "forge";
        private readonly SymmetricSecurityKey _key;

        public SessionTokens(IConfiguration config, IHostEnvironment environment)
        {
            var secret = config["Auth:SigningKey"];
            if (string.IsNullOrEmpty(secret))
            {
                // Development makes one up: tokens then last until the API restarts.
                if (!environment.IsDevelopment()) throw new InvalidOperationException("Set Auth:SigningKey (32+ characters).");
                secret = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
            }
            _key = new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(secret));
        }

        public string Issue(string userId) => new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = Issuer,
            Audience = Issuer,
            Expires = DateTime.UtcNow.AddYears(1),
            Claims = new Dictionary<string, object> { ["uid"] = userId },
            SigningCredentials = new SigningCredentials(_key, SecurityAlgorithms.HmacSha256),
        });

        /// <summary>The UserId a token was issued for, or null if it's forged, expired, or garbled.</summary>
        public async Task<string?> UserIdOfAsync(string token)
        {
            var result = await new JsonWebTokenHandler().ValidateTokenAsync(token, new TokenValidationParameters
            {
                ValidIssuer = Issuer,
                ValidAudience = Issuer,
                IssuerSigningKey = _key,
            });
            return result.IsValid ? result.ClaimsIdentity.FindFirst("uid")?.Value : null;
        }
    }
}
