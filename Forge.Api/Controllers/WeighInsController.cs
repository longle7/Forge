using System.ComponentModel.DataAnnotations;
using Forge.Api.Data;
using Forge.Api.Domain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Forge.Api.Controllers
{
    /// <summary>
    /// Your body weight, at most once a day (weighing in again that day replaces it). Yours alone (the X-User-Id header).
    /// </summary>
    [ApiController]
    [Route("weigh-ins")]
    public class WeighInsController : ControllerBase
    {
        private readonly ForgeDbContext _db;

        public WeighInsController(ForgeDbContext db)
        {
            _db = db;
        }

        // GET /weigh-ins: oldest first, ready to chart.
        // ponytail: returns every weigh-in; a daily habit for years is still only a few thousand rows.
        [HttpGet]
        public async Task<IEnumerable<WeighInResponse>> GetAll([FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId) =>
            await _db.WeighIns
                .Where(w => w.UserId == userId)
                .OrderBy(w => w.Date)
                .Select(w => new WeighInResponse(w.Date, w.Weight))
                .ToListAsync();

        // PUT /weigh-ins/2026-10-10: that day's weight (creates it, or replaces it).
        [HttpPut("{date}")]
        public async Task<WeighInResponse> Put(
            DateOnly date,
            WeighInRequest request,
            [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var weighIn = await _db.WeighIns.FindAsync(userId, date);
            if (weighIn is null)
            {
                weighIn = new WeighIn { UserId = userId, Date = date };
                _db.WeighIns.Add(weighIn);
            }

            weighIn.Weight = request.Weight;
            await _db.SaveChangesAsync();
            return new WeighInResponse(weighIn.Date, weighIn.Weight);
        }
    }

    public record WeighInRequest([Range(50, 1000)] decimal Weight);

    public record WeighInResponse(DateOnly Date, decimal Weight);
}
