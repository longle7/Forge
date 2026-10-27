using System.ComponentModel.DataAnnotations;
using Forge.Api.Data;
using Forge.Api.Domain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Forge.Api.Controllers
{
    /// <summary>
    /// Meals you eat often: saved from a day's meal, logged again in one tap. Saved with an idempotent PUT, like
    /// workouts. Yours alone (the X-User-Id header, see WorkoutsController).
    /// </summary>
    [ApiController]
    [Route("saved-meals")]
    public class SavedMealsController : ControllerBase
    {
        // Far more than anyone needs; stops a buggy or abusive client from filling the database.
        public const int MaxPerUser = 100;

        private readonly ForgeDbContext _db;

        public SavedMealsController(ForgeDbContext db)
        {
            _db = db;
        }

        // GET /saved-meals: by name.
        [HttpGet]
        public async Task<IEnumerable<SavedMealResponse>> GetAll([FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId) =>
            (await _db.SavedMeals.Where(m => m.UserId == userId).OrderBy(m => m.Name).ToListAsync()).Select(SavedMealResponse.From);

        // PUT /saved-meals/{id}: saves a meal (201), or replaces it and its foods (200).
        [HttpPut("{id:guid}")]
        public async Task<ActionResult<SavedMealResponse>> Put(
            Guid id,
            SavedMealRequest request,
            [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var meal = await _db.SavedMeals.FindAsync(id);
            if (meal is not null && meal.UserId != userId)
            {
                return NotFound(); // someone else's: the same answer as a missing one
            }

            if (meal is null && await _db.SavedMeals.CountAsync(m => m.UserId == userId) >= MaxPerUser)
            {
                ModelState.AddModelError("", $"You can save up to {MaxPerUser} meals. Delete one to save another.");
                return ValidationProblem();
            }

            var created = meal is null;
            if (meal is null)
            {
                meal = new SavedMeal { Id = id, UserId = userId };
                _db.SavedMeals.Add(meal);
            }

            meal.Name = request.Name.Trim();
            meal.Items = [.. request.Items.Select(i => new SavedMealItem
            {
                Name = i.Name.Trim(),
                Serving = string.IsNullOrWhiteSpace(i.Serving) ? "1 serving" : i.Serving.Trim(),
                Servings = i.Servings,
                Calories = i.Calories,
                Protein = i.Protein,
                Carbs = i.Carbs,
                Fat = i.Fat,
            })];
            await _db.SaveChangesAsync();

            var response = SavedMealResponse.From(meal);
            return created ? StatusCode(StatusCodes.Status201Created, response) : response;
        }

        // DELETE /saved-meals/{id}
        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(Guid id, [FromHeader(Name = "X-User-Id"), Required, MaxLength(100)] string userId)
        {
            var deleted = await _db.SavedMeals.Where(m => m.Id == id && m.UserId == userId).ExecuteDeleteAsync();
            return deleted == 0 ? NotFound() : NoContent();
        }
    }

    public record SavedMealRequest(
        [Required, MaxLength(50)] string Name,
        [Required, MinLength(1), MaxLength(30)] List<SavedMealItemDto> Items);

    // One food, per serving: the same limits as a food log entry (FoodEntryRequest).
    public record SavedMealItemDto(
        [Required, MaxLength(200)] string Name,
        [MaxLength(100)] string? Serving,
        [Range(0.01, 100)] decimal Servings,
        [Range(0, 5000)] decimal Calories,
        [Range(0, 1000)] decimal Protein,
        [Range(0, 1000)] decimal Carbs,
        [Range(0, 1000)] decimal Fat);

    public record SavedMealResponse(Guid Id, string Name, IEnumerable<SavedMealItemDto> Items)
    {
        public static SavedMealResponse From(SavedMeal m) => new(
            m.Id,
            m.Name,
            m.Items.Select(i => new SavedMealItemDto(i.Name, i.Serving, i.Servings, i.Calories, i.Protein, i.Carbs, i.Fat)));
    }
}
