namespace Forge.Api.Domain
{
    /// <summary>
    /// What the goals were worked out from (Settings → Goals), the daily calorie and macro goals themselves, and the
    /// Time Out unlock rules. One per user; the app shows its setup until there is one.
    /// </summary>
    public class UserProfile
    {
        // The anonymous ID the app sends as X-User-Id (primary key).
        public string UserId { get; set; } = string.Empty;

        // "male" or "female": the Mifflin-St Jeor calorie formula differs by sex.
        public string Sex { get; set; } = "male";
        public int BirthYear { get; set; }
        public decimal HeightIn { get; set; }

        // Pounds, when the goals were set; also the weight chart's starting point.
        public decimal StartWeight { get; set; }

        // How active you are outside workouts: sedentary, light, active, or very-active. Workouts are counted
        // separately (they add calories back), so they aren't part of this.
        public string Activity { get; set; } = "light";

        // lose, maintain, or gain, and how fast in pounds a week.
        public string Goal { get; set; } = "maintain";
        public decimal Pace { get; set; }

        // The weight you're working toward, in pounds (null = none set).
        public decimal? GoalWeight { get; set; }

        // Daily goals: kcal, then grams.
        public int CalorieGoal { get; set; }
        public int ProteinGoal { get; set; }
        public int CarbsGoal { get; set; }
        public int FatGoal { get; set; }

        // Calories to take off the goal on rest days in your weekly plan (0 or less), from carbs: e.g. -200.
        public int RestDayCalorieAdjust { get; set; }

        // Time Out: what has to be done today before the chosen apps unlock.
        public bool UnlockAfterWorkout { get; set; } // today's planned workout (rest days count as done)
        public int UnlockAfterMeals { get; set; } // this many meals logged today (0 = no rule)
        public bool UnlockAfterWeighIn { get; set; }
        public bool UnlockAfterHabits { get; set; } // every habit scheduled today done

        public DateTime UpdatedAtUtc { get; set; }
    }
}
