using Forge.Api.Data;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Forge.Api.Services
{
    /// <summary>
    /// GET /health reports Unhealthy (503) when SQL Server can't be reached, so a host can restart or stop routing to us.
    /// </summary>
    public class DatabaseHealthCheck : IHealthCheck
    {
        private readonly ForgeDbContext _db;

        public DatabaseHealthCheck(ForgeDbContext db)
        {
            _db = db;
        }

        public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default) =>
            await _db.Database.CanConnectAsync(cancellationToken)
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy("Can't reach the database.");
    }
}
