using System.IO.Compression;
using System.Threading.RateLimiting;
using Forge.Api.Data;
using Forge.Api.Services;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;

// Forge API: the entry point. It runs top to bottom once, when the API starts.
//
//   1. Register services ("dependency injection"): everything a controller asks for in its constructor is set up
//      here: the database, CORS, the health check, and the rate limit.
//   2. Build the app, apply database migrations, and set up the middleware pipeline. Middleware runs in the
//      order it's added, for every request.
//   3. app.Run() starts listening for HTTP requests.
//
// How one request flows, e.g. PUT /workouts/{id} when you tap Finish:
//   forwarded IP -> compression -> error handling -> CORS -> rate limit -> routing -> WorkoutsController.Put
//     -> checks the workout (its exercises must be built-in or yours) and saves it and its sets to SQL Server
//   -> the controller's return value is serialized to JSON. Invalid input answers 400 with what's wrong.

var builder = WebApplication.CreateBuilder(args);

// ---- 1. Services -------------------------------------------------------------------------------------------

// Database: EF Core over SQL Server. One ForgeDbContext per request ("scoped").
// EnableRetryOnFailure retries the brief connection drops Azure SQL has during maintenance, instead of failing.
builder.Services.AddDbContext<ForgeDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"),
        sql => sql.EnableRetryOnFailure()));

// Food search: USDA FoodData Central, cached in memory for a day (see UsdaClient). Gives up after 10 seconds.
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient<UsdaClient>(client => client.Timeout = TimeSpan.FromSeconds(10));

// Photo scanning: Claude reads nutrition labels and plates (see ClaudeFoodVision; needs Anthropic:ApiKey).
builder.Services.AddSingleton<IFoodVision, ClaudeFoodVision>();

// Controllers handle the HTTP endpoints.
builder.Services.AddControllers();

// The website (Azure Static Web Apps) and, later, the iPhone app (capacitor://localhost) call this API cross-origin.
// Allowed origins come from configuration (Cors:AllowedOrigins); in development Vite serves the app same-origin.
// The X-User-Id header makes every call preflighted; browsers keep a preflight only 5 seconds unless told longer, which
// doubled each request's round trips. Two hours is Chrome's cap (Safari keeps it less).
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [])
    .AllowAnyHeader()
    .AllowAnyMethod()
    .SetPreflightMaxAge(TimeSpan.FromHours(2))));

// GET /health for the host's health probe: 200 when the database is reachable, 503 when not.
builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database");

// Every error is problem JSON (the app shows its "title" or first "errors" entry): unhandled exceptions become a
// 500 without internals, and bare status codes like 404 get a body.
builder.Services.AddProblemDetails();

// Compress responses: workout history grows to tens of KB, loaded over mobile data at the gym. Safe over HTTPS: no
// response carries a secret for a BREACH-style attack to extract.
builder.Services.AddResponseCompression(options => options.EnableForHttps = true);
builder.Services.Configure<BrotliCompressionProviderOptions>(options => options.Level = CompressionLevel.Optimal);
builder.Services.Configure<GzipCompressionProviderOptions>(options => options.Level = CompressionLevel.Optimal);

// The client's real IP. Each proxy in front of the API appends the address it saw to X-Forwarded-For, so with
// Proxy:Hops proxies the client is that many entries from the end, and anything a client wrote before it is ignored.
//   1 (default): only Azure's ingress, which appends the client.
//   2: Cloudflare, then Azure's ingress ("client, cloudflare"). Only safe once the ingress accepts Cloudflare's IPs
//      alone; otherwise a client could skip Cloudflare and pick the IP it's counted as.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor;
    options.ForwardLimit = builder.Configuration.GetValue("Proxy:Hops", 1);
    options.KnownIPNetworks.Clear(); // the proxies' addresses aren't fixed
    options.KnownProxies.Clear();
});

// Don't advertise the web server ("server: Kestrel") to scanners.
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

// Rate limit per client IP (RateLimit:PerMinute): one misbehaving client or script can't run up the hosting bill or
// fill the database. The app makes a handful of requests a minute, so the default leaves room for many people behind
// one address (an office, a phone carrier). /health is exempt so the host's probe never fails.
// ponytail: fixed window per IPv6 address, not per /64; limit by prefix if someone rotates addresses to get around it.
var perMinute = builder.Configuration.GetValue("RateLimit:PerMinute", 600);
builder.Services.AddRateLimiter(options =>
{
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        context.Request.Path.StartsWithSegments("/health")
            ? RateLimitPartition.GetNoLimiter("health")
            : RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = perMinute, Window = TimeSpan.FromMinutes(1) }));
    options.OnRejected = async (rejected, _) =>
    {
        if (rejected.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            rejected.HttpContext.Response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();
        await Results.Problem(title: "Too many requests. Wait a minute and try again.", statusCode: StatusCodes.Status429TooManyRequests)
            .ExecuteAsync(rejected.HttpContext);
    };
});

// Swagger: interactive API docs at /swagger (Development only, see below).
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// ---- 2. Startup and the middleware pipeline -----------------------------------------------------------------

app.UseForwardedHeaders();
app.UseResponseCompression();
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler(); // Development keeps the detailed error page
}
app.UseStatusCodePages();

// Apply pending migrations so a fresh database gets its schema (and the built-in exercises).
// ponytail: migrate on startup, move to a deploy step if multiple instances run at once.
using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider.GetRequiredService<ForgeDbContext>().Database.Migrate();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors(); // before the limiter, so a 429 carries CORS headers and the app can show its message
app.UseRateLimiter();
app.MapHealthChecks("/health");
app.MapControllers(); // every [ApiController] class in Controllers/ becomes a set of endpoints

// ---- 3. Go -------------------------------------------------------------------------------------------------
app.Run();
