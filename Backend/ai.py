
import os
import json
import re

from groq import Groq
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    raise ValueError(
        "GROQ_API_KEY is missing. Check your Backend/.env file."
    )

client = Groq(api_key=api_key)


# Normalize common ingredient names.
INGREDIENT_ALIASES = {
    "tomatoes": "tomato",
    "fresh tomatoes": "tomato",
    "fresh tomato": "tomato",
    "spinach leaves": "spinach",
    "fresh spinach": "spinach",
    "all purpose flour": "flour",
    "all-purpose flour": "flour",
    "plain flour": "flour",
    "vegetable oil": "cooking oil",
    "olive oil": "cooking oil",
}


def normalize_ingredient(name):
    """Normalize ingredient names for comparison."""
    if not isinstance(name, str):
        return ""

    name = re.sub(r"\s+", " ", name.strip().lower())
    return INGREDIENT_ALIASES.get(name, name)


def get_ingredient_name(item):
    """Extract an ingredient name from a string or dictionary."""
    if isinstance(item, str):
        return item.strip()

    if isinstance(item, dict):
        name = item.get("name", "")
        return name.strip() if isinstance(name, str) else ""

    return ""


def validate_recipes(data, available_ingredients):
    """
    Validate recipes against the user's confirmed ingredients.

    Reject recipes with unavailable required ingredients.
    Remove duplicate recipe names.
    Mark optional additions as unavailable when the user
    has not confirmed that they have them.
    """
    if not isinstance(data, dict) or not isinstance(
        data.get("recipes"), list
    ):
        return {
            "recipes": [],
            "message": "The AI returned an unexpected recipe format."
        }

    available = {
        normalize_ingredient(item)
        for item in available_ingredients
        if isinstance(item, str) and item.strip()
    }

    valid_recipes = []
    seen_recipe_names = set()

    for recipe in data["recipes"]:
        if not isinstance(recipe, dict):
            continue

        recipe_name = recipe.get("name", "")

        if not isinstance(recipe_name, str) or not recipe_name.strip():
            continue

        normalized_recipe_name = re.sub(
            r"\s+", " ", recipe_name.strip().lower()
        )

        # Reject duplicate recipe names.
        if normalized_recipe_name in seen_recipe_names:
            continue

        recipe_ingredients = recipe.get("ingredients", [])

        if not isinstance(recipe_ingredients, list) or not recipe_ingredients:
            continue

        required_names = [
            normalize_ingredient(get_ingredient_name(item))
            for item in recipe_ingredients
        ]

        if any(not name for name in required_names):
            continue

        # Reject a recipe if any required ingredient is unavailable.
        missing_required = [
            name for name in required_names if name not in available
        ]

        if missing_required:
            print(
                f"Rejected recipe '{recipe_name}': "
                f"missing required ingredients: {missing_required}"
            )
            continue

        # Normalize optional additions and explicitly mark availability.
        additions = recipe.get("suggested_additions", [])

        if not isinstance(additions, list):
            additions = []

        checked_additions = []
        seen_additions = set()

        for addition in additions:
            name = get_ingredient_name(addition)

            if not name:
                continue

            normalized_name = normalize_ingredient(name)

            # Do not suggest something the user already has.
            if normalized_name in available:
                continue

            # Do not show the same optional addition twice.
            if normalized_name in seen_additions:
                continue

            seen_additions.add(normalized_name)

            if isinstance(addition, dict):
                checked = dict(addition)
            else:
                checked = {
                    "name": name,
                    "reason": "Optional addition."
                }

            checked["name"] = name
            checked["available"] = False

            checked_additions.append(checked)

        recipe["suggested_additions"] = checked_additions

        # Record the name only after the recipe passes validation.
        seen_recipe_names.add(normalized_recipe_name)
        valid_recipes.append(recipe)

    if not valid_recipes:
        return {
            "recipes": [],
            "message": (
                "We couldn't find a suitable recipe using only your "
                "available ingredients. Try adding another ingredient "
                "or selecting a pantry staple you actually have."
            )
        }

    data["recipes"] = valid_recipes

    return data


def generate_recipes(ingredients, pantry_staples=None):
    """
    Generate up to three distinct recipes using confirmed ingredients.
    """

    pantry_staples = pantry_staples or []

    allowed_staples = {
        "water",
        "salt",
        "cooking oil",
        "sugar"
    }

    selected_staples = []

    for staple in pantry_staples:
        if not isinstance(staple, str):
            continue

        normalized = normalize_ingredient(staple)

        if normalized in allowed_staples:
            selected_staples.append(normalized)

    # Clean and normalize user-entered ingredients.
    user_ingredients = []

    for item in ingredients:
        if isinstance(item, str) and item.strip():
            user_ingredients.append(item.strip())

    if not user_ingredients:
        return {
            "recipes": [],
            "message": "Please enter at least one ingredient you have."
        }

    # Only user-entered ingredients and explicitly selected staples count.
    available_ingredients = list(dict.fromkeys(
        user_ingredients + selected_staples
    ))

    ingredient_text = ", ".join(available_ingredients)

    prompt = f"""
You are SaveFridge AI, a cooking assistant focused on reducing food waste.

Your task is to recommend practical recipes using the ingredients
the user confirms they have.

CONFIRMED AVAILABLE INGREDIENTS:
{ingredient_text}

STRICT INGREDIENT RULES:
1. Every required ingredient must be in the confirmed list.
2. Never assume the user has milk, eggs, butter, pepper, spices,
   flour, or any other ingredient unless it appears in the confirmed list.
3. Do not add unlisted ingredients to the required ingredients array.
4. Every recipe must be independently possible using its listed
   required ingredients.
5. Do not describe a dish as pancakes, bread, or another dish if it
   cannot reasonably be made with the available ingredients.
6. If a recipe requires a missing ingredient, choose a different recipe.
7. Never rely on an unavailable ingredient as a substitution.
8. Cooking instructions must not depend on unavailable ingredients.
9. Water, salt, cooking oil, and sugar are available only if they
   appear in the confirmed list above.
10. Do not treat optional additions as ingredients the user already has.

RECIPE VARIETY RULES:
11. Return exactly 3 distinct recipes whenever 3 practical recipes
    are possible using the confirmed ingredients.
12. If fewer than 3 practical recipes are possible, return only the
    valid recipes you can make. Never invent ingredients just to reach 3.
13. Make the recipes meaningfully different in dish type, preparation
    method, or final result.
14. Do not return the same recipe with minor changes to its name,
    quantities, or instructions.
15. Do not generate multiple versions of the same dish simply to
    reach the requested recipe count.
16. Prioritize recipes that use the user's available ingredients
    and help reduce food waste.

RECIPE QUALITY RULES:
17. Use realistic quantities and units.
18. Include sensible cooking times and serving sizes.
19. Provide no more than 5 clear steps per recipe.
20. Keep instructions beginner-friendly and practical.
21. List optional ingredients under suggested_additions only.
22. Optional additions must never be required to complete the recipe.
23. If no practical recipe is possible, return an empty recipes array.

OUTPUT REQUIREMENTS:
- Return valid JSON only.
- Do not include Markdown or explanations outside the JSON.
- The recipes field must always be an array.
- Each recipe must follow the structure below.

Return JSON in this format:
{{
  "recipes": [
    {{
      "name": "Recipe name",
      "description": "Short description",
      "servings": 2,
      "prep_time_minutes": 10,
      "cook_time_minutes": 15,
      "difficulty": "Easy",
      "ingredients": [
        {{
          "name": "Spinach",
          "quantity": 80,
          "unit": "g"
        }}
      ],
      "steps": [
        "First instruction",
        "Second instruction"
      ],
      "suggested_additions": [
        {{
          "name": "Cheese",
          "reason": "Adds flavor but is not required."
        }}
      ]
    }}
  ],
  "message": ""
}}

Ensure every recipe is valid, practical, distinct, and uses only
confirmed ingredients as required ingredients.
"""

    ai_output = ""

    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3,
            max_tokens=8000,
            reasoning_effort="low"
        )

        if not response.choices:
            print("Groq returned no choices.")
            print("Response:", response.model_dump())

            return {
                "recipes": [],
                "message": "The AI did not return a recipe. Please try again."
            }

        choice = response.choices[0]
        message = choice.message
        ai_output = message.content or ""

        if not ai_output.strip():
            print("Groq returned empty content.")
            print("Finish reason:", choice.finish_reason)
            print("Message:", message.model_dump())
            print("Response usage:", response.usage)

            return {
                "recipes": [],
                "message": (
                    "The AI returned no recipe content. "
                    "Check the backend terminal for details."
                )
            }

        ai_output = ai_output.strip()

        # Remove Markdown code fences if the model includes them.
        if ai_output.startswith("```"):
            ai_output = re.sub(
                r"^```(?:json)?\s*|\s*```$",
                "",
                ai_output,
                flags=re.IGNORECASE
            ).strip()

        data = json.loads(ai_output)

        if not isinstance(data, dict):
            return {
                "recipes": [],
                "message": "The AI returned an unexpected recipe format."
            }

        result = validate_recipes(data, available_ingredients)

        # Preserve a useful message from the AI if no valid recipes remain.
        if not result.get("recipes") and data.get("message"):
            result["message"] = data["message"]

        return result

    except json.JSONDecodeError as error:
        print("Could not parse Groq JSON response:", error)
        print("AI output:", ai_output)

        return {
            "recipes": [],
            "message": "The AI returned invalid recipe data. Please try again."
        }

    except Exception as error:
        print("Recipe generation error:", repr(error))

        return {
            "recipes": [],
            "message": (
                "Recipe generation failed. Check the backend terminal "
                "for details, then try again."
            )
        }
