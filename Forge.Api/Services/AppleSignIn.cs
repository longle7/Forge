using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace Forge.Api.Services
{
    /// <summary>Talks to Apple for Sign in with Apple (AppleSignIn; faked in tests).</summary>
    public interface IAppleSignIn
    {
        /// <summary>The Apple user ID ("sub") an identity token from the app proves, or null if it isn't valid.</summary>
        Task<string?> SubjectOfAsync(string identityToken, CancellationToken cancellationToken);

        /// <summary>
        /// On Delete account: tells Apple to drop this app's access, as Apple requires. Takes the authorization code of
        /// a fresh sign-in. Best effort: false when it can't, which never stops the deletion.
        /// </summary>
        Task<bool> RevokeAsync(string authorizationCode, CancellationToken cancellationToken);
    }

    /// <summary>
    /// Checks identity tokens against Apple's published keys (fetched and cached by ConfigurationManager), for the
    /// app's bundle ID (Auth:AppleClientId). Revoking needs a Sign in with Apple key from developer.apple.com:
    /// Auth:AppleTeamId, Auth:AppleKeyId, and Auth:AppleP8 (the .p8 file's text), as Container App secrets. Without
    /// them, revoking is skipped.
    /// </summary>
    public class AppleSignIn : IAppleSignIn
    {
        private const string Issuer = "https://appleid.apple.com";

        private static readonly ConfigurationManager<OpenIdConnectConfiguration> AppleKeys =
            new($"{Issuer}/.well-known/openid-configuration", new OpenIdConnectConfigurationRetriever(), new HttpDocumentRetriever());

        private readonly HttpClient _http;
        private readonly ILogger<AppleSignIn> _logger;
        private readonly string _clientId;
        private readonly string? _teamId;
        private readonly string? _keyId;
        private readonly string? _p8;

        public AppleSignIn(HttpClient http, IConfiguration config, ILogger<AppleSignIn> logger)
        {
            _http = http;
            _logger = logger;
            _clientId = config["Auth:AppleClientId"] ?? "com.longledev.forge";
            _teamId = config["Auth:AppleTeamId"];
            _keyId = config["Auth:AppleKeyId"];
            _p8 = config["Auth:AppleP8"];
        }

        public async Task<string?> SubjectOfAsync(string identityToken, CancellationToken cancellationToken)
        {
            var apple = await AppleKeys.GetConfigurationAsync(cancellationToken);
            var result = await new JsonWebTokenHandler().ValidateTokenAsync(identityToken, new TokenValidationParameters
            {
                ValidIssuer = Issuer,
                ValidAudience = _clientId,
                IssuerSigningKeys = apple.SigningKeys,
            });
            return result.IsValid ? result.ClaimsIdentity.FindFirst("sub")?.Value : null;
        }

        public async Task<bool> RevokeAsync(string authorizationCode, CancellationToken cancellationToken)
        {
            if (string.IsNullOrEmpty(_teamId) || string.IsNullOrEmpty(_keyId) || string.IsNullOrEmpty(_p8))
            {
                _logger.LogWarning("Apple token not revoked: set Auth:AppleTeamId, Auth:AppleKeyId and Auth:AppleP8.");
                return false;
            }
            try
            {
                var secret = ClientSecret();
                // Apple revokes refresh tokens, so trade the code for one first.
                using var tokenResponse = await _http.PostAsync($"{Issuer}/auth/token", new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["client_id"] = _clientId,
                    ["client_secret"] = secret,
                    ["code"] = authorizationCode,
                    ["grant_type"] = "authorization_code",
                }), cancellationToken);
                tokenResponse.EnsureSuccessStatusCode();
                using var tokens = JsonDocument.Parse(await tokenResponse.Content.ReadAsStringAsync(cancellationToken));
                var refreshToken = tokens.RootElement.GetProperty("refresh_token").GetString()!;

                using var revokeResponse = await _http.PostAsync($"{Issuer}/auth/revoke", new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["client_id"] = _clientId,
                    ["client_secret"] = secret,
                    ["token"] = refreshToken,
                    ["token_type_hint"] = "refresh_token",
                }), cancellationToken);
                revokeResponse.EnsureSuccessStatusCode();
                return true;
            }
            catch (Exception e) when (e is HttpRequestException or JsonException or KeyNotFoundException or CryptographicException)
            {
                _logger.LogWarning(e, "Apple token not revoked.");
                return false;
            }
        }

        // Apple's "client secret": a short-lived JWT signed with the .p8 key (ES256).
        private string ClientSecret()
        {
            var key = ECDsa.Create();
            key.ImportFromPem(_p8);
            var now = DateTime.UtcNow;
            return new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
            {
                Issuer = _teamId,
                Audience = Issuer,
                IssuedAt = now,
                NotBefore = now,
                Expires = now.AddMinutes(5),
                Claims = new Dictionary<string, object> { ["sub"] = _clientId },
                SigningCredentials = new SigningCredentials(new ECDsaSecurityKey(key) { KeyId = _keyId }, SecurityAlgorithms.EcdsaSha256),
            });
        }
    }
}
