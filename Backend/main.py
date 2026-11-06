
import os

import httpx

from fastapi import (
    FastAPI,
    HTTPException,
    UploadFile,
    File
)

from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from models import IngredientRequest
from ai import generate_recipes
from vision import identify_ingredients

from dotenv import load_dotenv

load_dotenv()

# Create the FastAPI application
app = FastAPI(
    title="SaveFridge AI API",
    description="AI-powered recipe generation and ingredient recognition.",
    version="2.0.0"
)

# Allow the frontend to communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Home endpoint to test whether the server is running
@app.get("/")
def home():
    return {
        "message": "SaveFridge AI is running"
    }


# Endpoint to generate recipes
@app.post("/generate-recipes")
def generate_recipe_endpoint(request: IngredientRequest):
    return generate_recipes(
        request.ingredients,
        request.pantry_staples
    )


# Endpoint to identify ingredients from an uploaded photograph
@app.post("/identify-ingredients")
async def identify_ingredients_endpoint(
    file: UploadFile = File(...)
):
    allowed_types = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ]

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Please upload a JPG, PNG, or WebP image."
        )

    try:
        image_bytes = await file.read(8 * 1024 * 1024 + 1)

        if not image_bytes:
            raise HTTPException(
                status_code=400,
                detail="The uploaded image is empty."
            )

        if len(image_bytes) > 8 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="The image must be smaller than 8 MB."
            )

        result = await run_in_threadpool(
            identify_ingredients,
            image_bytes
        )

        return result

    except HTTPException:
        raise

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except Exception as error:
        print("Ingredient endpoint error:", repr(error))

        raise HTTPException(
            status_code=502,
            detail=(
                "Ingredient recognition failed. "
                "Please try again with another image."
            )
        )

    finally:
        await file.close()


# Endpoint to search for a food photograph
@app.get("/recipe-image")
async def get_recipe_image(query: str):
    access_key = os.getenv("UNSPLASH_ACCESS_KEY")

    if not access_key:
        raise HTTPException(
            status_code=500,
            detail="Unsplash Access Key is not configured."
        )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://api.unsplash.com/search/photos",
                params={
                    "query": f"{query} food",
                    "per_page": 1,
                    "orientation": "landscape",
                },
                headers={
                    "Authorization": f"Client-ID {access_key}"
                },
            )

        response.raise_for_status()
        data = response.json()

    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Could not retrieve a photograph from Unsplash."
        )

    if not data.get("results"):
        return {
            "image_url": None,
            "photographer": None,
            "photographer_url": None
        }

    photo = data["results"][0]

    return {
        "image_url": photo["urls"]["regular"],
        "photographer": photo["user"]["name"],
        "photographer_url": photo["user"]["links"]["html"],
    }
