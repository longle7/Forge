using System.ComponentModel.DataAnnotations;
using Anthropic.Exceptions;
using Forge.Api.Data;
using Forge.Api.Domain;
using Forge.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Forge.Api.Controllers
{
    /// <summary>
    /// Photo logging: a nutrition label (POST /scan/label) or a plate of food (POST /scan/meal), sent as a JPEG in a
    /// multipart form field named "image". The app shows what comes back for you to check and edit before logging it.
    /// Photos go to Claude (IFoodVision) and are never stored. Each scan costs money, so there's a daily cap per user
    /// (Scan:PerUserDaily) and for everyone together (Scan:GlobalDaily).
    /// </summary>
    [ApiController]
    [Route("scan")]
    public class ScanController : ControllerBase
    {
        public const long MaxImageBytes = 5 * 1024 * 1024; // the app sends ~200 KB; this leaves room for a full photo

        private readonly ForgeDbContext _db;
        private readonly IFoodVision _vision;
        private readonly ILogger<ScanController> _log;
        private readonly int _perUserDaily;
        private readonly int _globalDaily;

        public ScanController(ForgeDbContext db, IFoodVision vision, IConfiguration config, ILogger<ScanController> log)
        {
            _db = db;
            _vision = vision;
            _log = log;
            _perUserDaily = config.GetValue("Scan:PerUserDaily", 30);
            _globalDaily = config.GetValue("Scan:GlobalDaily", 100);
        }

        // POST /scan/label: what one serving of a packaged food is, read from its Nutrition Facts label.
        [HttpPost("label")]
        [RequestSizeLimit(MaxImageBytes + 64 * 1024)]
        public Task<IActionResult> Label(IFormFile image, [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId, CancellationToken cancellationToken) =>
            ScanAsync(image, userId, async jpeg =>
            {
                var label = await _vision.ReadLabelAsync(jpeg, cancellationToken);
                return label.Found
                    ? Ok(new ScannedFood(label.Name.Trim(), string.IsNullOrWhiteSpace(label.Serving) ? "1 serving" : label.Serving.Trim(), Round(label.Calories, 0), Round(label.Protein), Round(label.Carbs), Round(label.Fat), Optional(label.Fiber), Optional(label.Sugar), Optional(label.Sodium, 0)))
                    : Problem(title: "Couldn't find a nutrition label in that photo. Try again with the whole label in view.", statusCode: StatusCodes.Status422UnprocessableEntity);
            });

        // POST /scan/meal: the foods on a plate, each with an estimated portion and its nutrition.
        [HttpPost("meal")]
        [RequestSizeLimit(MaxImageBytes + 64 * 1024)]
        public Task<IActionResult> Meal(IFormFile image, [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId, CancellationToken cancellationToken) =>
            ScanAsync(image, userId, async jpeg =>
            {
                var meal = await _vision.ReadMealAsync(jpeg, cancellationToken);
                var items = meal.Items
                    .Where(i => !string.IsNullOrWhiteSpace(i.Name) && i.Calories >= 0)
                    .Select(i => new ScannedFood(i.Name.Trim(), $"{Round(i.Grams, 0)} g", Round(i.Calories, 0), Round(i.Protein), Round(i.Carbs), Round(i.Fat), Optional(i.Fiber), Optional(i.Sugar), Optional(i.Sodium, 0)))
                    .ToList();
                return items.Count > 0
                    ? Ok(items)
                    : Problem(title: "Couldn't spot any food in that photo. Try again with the plate in view.", statusCode: StatusCodes.Status422UnprocessableEntity);
            });

        // Checks the photo and today's caps, runs the scan, and counts it once Claude has answered (that's when it costs).
        private async Task<IActionResult> ScanAsync(IFormFile? image, string userId, Func<byte[], Task<IActionResult>> read)
        {
            if (image is null || image.Length == 0 || !image.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            {
                ModelState.AddModelError("image", "Send a photo in the \"image\" field.");
                return ValidationProblem();
            }
            if (image.Length > MaxImageBytes)
            {
                ModelState.AddModelError("image", "That photo is too large (5 MB at most).");
                return ValidationProblem();
            }

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var usage = await _db.ScanUsage.FindAsync(userId, today);
            if ((usage?.Count ?? 0) >= _perUserDaily)
            {
                return Problem(title: $"You've used today's {_perUserDaily} scans. They reset tomorrow; search and Quick Add still work.", statusCode: StatusCodes.Status429TooManyRequests);
            }
            if (await _db.ScanUsage.Where(u => u.Day == today).SumAsync(u => u.Count) >= _globalDaily)
            {
                return Problem(title: "Scanning has reached today's limit. Try again tomorrow; search and Quick Add still work.", statusCode: StatusCodes.Status429TooManyRequests);
            }

            using var buffer = new MemoryStream();
            await image.CopyToAsync(buffer);

            IActionResult result;
            try
            {
                result = await read(buffer.ToArray());
            }
            catch (ScanNotConfiguredException)
            {
                return Problem(title: "Scanning isn't set up yet. Search and Quick Add still work.", statusCode: StatusCodes.Status503ServiceUnavailable);
            }
            catch (ScanUnreadableException e)
            {
                result = Problem(title: e.Message, statusCode: StatusCodes.Status422UnprocessableEntity);
            }
            catch (AnthropicUnauthorizedException e)
            {
                _log.LogError(e, "Claude rejected the Anthropic API key.");
                return Problem(title: "Scanning isn't set up right. Search and Quick Add still work.", statusCode: StatusCodes.Status503ServiceUnavailable);
            }
            catch (AnthropicBadRequestException e)
            {
                _log.LogWarning(e, "Claude couldn't take the photo.");
                return Problem(title: "Couldn't read that photo. Try taking another one.", statusCode: StatusCodes.Status422UnprocessableEntity);
            }
            catch (Exception e) when (e is AnthropicApiException or AnthropicIOException or TaskCanceledException && !HttpContext.RequestAborted.IsCancellationRequested)
            {
                // Busy (429), down (5xx), or unreachable: nothing was read, so it doesn't count.
                _log.LogWarning(e, "Claude was unavailable for a scan.");
                return Problem(title: "Scanning isn't available right now. Try again in a minute.", statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            // Claude answered (paid for, read or not): count it.
            if (usage is null)
            {
                _db.ScanUsage.Add(new ScanUsage { UserId = userId, Day = today, Count = 1 });
            }
            else
            {
                usage.Count++;
            }
            await _db.SaveChangesAsync();
            return result;
        }

        private static decimal Round(decimal value, int decimals = 1) => Math.Round(Math.Max(0, value), decimals);
        private static decimal? Optional(decimal? value, int decimals = 1) => value is { } v ? Round(v, decimals) : null;
    }

    /// <summary>A food read from a photo, per one serving: ready to check, edit, and log.</summary>
    public record ScannedFood(string Name, string Serving, decimal Calories, decimal Protein, decimal Carbs, decimal Fat,
        decimal? Fiber = null, decimal? Sugar = null, decimal? Sodium = null);
}
