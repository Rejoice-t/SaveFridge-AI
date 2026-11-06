
import os

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import IngredientRequest
from ai import generate_recipes
from dotenv import load_dotenv

load_dotenv()

# Create the FastAPI application
app = FastAPI()

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
    return {"message": "SaveFridge AI is running"}


# Endpoint to generate recipes
@app.post("/generate-recipes")
def generate_recipe_endpoint(request: IngredientRequest):
    return generate_recipes(
        request.ingredients,
        request.pantry_staples
    )


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
        return {"image_url": None, "photographer": None, "photographer_url": None}

    photo = data["results"][0]

    return {
        "image_url": photo["urls"]["regular"],
        "photographer": photo["user"]["name"],
        "photographer_url": photo["user"]["links"]["html"],
    }
