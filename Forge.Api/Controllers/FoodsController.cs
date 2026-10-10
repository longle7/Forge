using System.ComponentModel.DataAnnotations;
using Forge.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Forge.Api.Controllers
{
    /// <summary>Food search for logging (USDA FoodData Central, see UsdaClient).</summary>
    [ApiController]
    [Route("foods")]
    public class FoodsController : ControllerBase
    {
        private readonly UsdaClient _usda;

        public FoodsController(UsdaClient usda)
        {
            _usda = usda;
        }

        // GET /foods?q=greek yogurt: up to 25 foods, each per one serving.
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<FoodResult>>> Search([FromQuery, Required, MinLength(2), MaxLength(100)] string q, CancellationToken cancellationToken)
        {
            try
            {
                return Ok(await _usda.SearchAsync(q, cancellationToken));
            }
            catch (Exception e) when (e is HttpRequestException || e is TaskCanceledException && !cancellationToken.IsCancellationRequested)
            {
                // USDA is down, slow, or rate-limited: say so plainly; Quick Add still works.
                return Problem(title: "Food search isn't available right now. Try again in a minute, or use Quick Add.", statusCode: StatusCodes.Status503ServiceUnavailable);
            }
        }
    }
}
