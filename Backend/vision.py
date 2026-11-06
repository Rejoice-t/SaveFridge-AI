
import os
import io
import json
import re

from PIL import Image, ImageOps
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    raise ValueError(
        "GROQ_API_KEY is missing. Check your Backend/.env file."
    )

client = Groq(api_key=api_key)

VISION_MODEL = "qwen/qwen3.8-27b"


def prepare_image(image_bytes):
    """
    Validate the uploaded image, correct its orientation,
    resize it if necessary, and convert it to JPEG.
    """

    try:
        image = Image.open(io.BytesIO(image_bytes))
        image.verify()

        image = Image.open(io.BytesIO(image_bytes))
        image = ImageOps.exif_transpose(image)
        image = image.convert("RGB")

        # Keep the image manageable for the vision API.
        image.thumbnail((1600, 1600))

        output = io.BytesIO()

        image.save(
            output,
            format="JPEG",
            quality=85,
            optimize=True
        )

        return output.getvalue()

    except Exception as error:
        print("Image processing error:", repr(error))
        raise ValueError(
            "The uploaded file is not a valid image. "
            "Please upload a clear JPG, PNG, or WebP image."
        )


def identify_ingredients(image_bytes):
    """
    Identify clearly visible food ingredients in an image.

    Returns:
        {
            "ingredients": [
                {
                    "name": "tomato",
                    "confidence": "high"
                }
            ]
        }
    """

    prepared_image = prepare_image(image_bytes)

    import base64

    encoded_image = base64.b64encode(
        prepared_image
    ).decode("utf-8")

    image_url = f"data:image/jpeg;base64,{encoded_image}"

    prompt = """
You are SaveFridge AI's food ingredient recognition assistant.

Examine the uploaded photograph carefully.

Your task is to identify individual food ingredients that are
clearly visible in the image.

IMPORTANT RULES:

1. Identify multiple ingredients when several are visible.
2. Identify only ingredients that you can actually see.
3. Do not guess ingredients hidden inside containers, bags,
   packaging, or behind other objects.
4. Do not identify kitchen equipment, plates, utensils,
   decorations, or non-food objects as ingredients.
5. If the image contains one ingredient, return one ingredient.
6. If the image contains several ingredients, return each
   identifiable ingredient separately.
7. Use simple, common ingredient names.
8. Avoid duplicate ingredient names.
9. Do not invent quantities or assume the contents of
   opaque packaging.
10. If you are uncertain, use medium or low confidence.
11. If no food ingredients can be confidently identified,
    return an empty ingredients array.

CONFIDENCE LEVELS:

- high: The ingredient is clearly visible and recognizable.
- medium: The ingredient is probably identifiable but
  has some visual ambiguity.
- low: The identification is uncertain.

Return valid JSON only, using this exact structure:

{
    "ingredients": [
        {
            "name": "tomato",
            "confidence": "high"
        },
        {
            "name": "spinach",
            "confidence": "medium"
        }
    ]
}
"""

    try:
        response = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_url
                            }
                        }
                    ]
                }
            ],
            temperature=0.2,
            max_tokens=1500,
            response_format={"type": "json_object"}
        )

        if not response.choices:
            raise ValueError(
                "The AI did not return an ingredient list."
            )

        ai_output = response.choices[0].message.content

        if not ai_output:
            raise ValueError(
                "The AI returned an empty response."
            )

        ai_output = ai_output.strip()

        # Remove code fences if the model unexpectedly adds them.
        if ai_output.startswith("```"):
            ai_output = re.sub(
                r"^```(?:json)?\s*|\s*```$",
                "",
                ai_output,
                flags=re.IGNORECASE
            ).strip()

        data = json.loads(ai_output)

        if not isinstance(data, dict):
            raise ValueError("Unexpected AI response format.")

        detected = data.get("ingredients", [])

        if not isinstance(detected, list):
            raise ValueError("Invalid ingredient list returned.")

        cleaned_ingredients = []
        seen = set()

        for item in detected:
            if not isinstance(item, dict):
                continue

            name = item.get("name")

            if not isinstance(name, str):
                continue

            name = re.sub(r"\s+", " ", name.strip().lower())

            if not name or len(name) > 60:
                continue

            if name in seen:
                continue

            confidence = item.get("confidence", "medium")

            if confidence not in ["high", "medium", "low"]:
                confidence = "medium"

            seen.add(name)

            cleaned_ingredients.append({
                "name": name,
                "confidence": confidence
            })

            # Prevent unexpectedly large ingredient lists.
            if len(cleaned_ingredients) >= 30:
                break

        return {
            "ingredients": cleaned_ingredients
        }

    except Exception as error:
        print("Ingredient recognition error:", repr(error))
        raise
