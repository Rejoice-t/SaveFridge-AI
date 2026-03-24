from fastapi import FastAPI
from models import IngredientRequest
from ai import generate_recipes
from fastapi.middleware.cors import CORSMiddleware

# Create the FastAPI application
app = FastAPI()
## CORS middleware to allow requests from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Home endpoint to test if the server is running
@app.get("/")
def home():
    return {"message": "SaveFridge AI is running"}

# Endpoint to generate recipes
@app.post("/generate-recipes")
def generate_recipe_endpoint(request: IngredientRequest):

    recipes = generate_recipes(request.ingredients)
    
    return  recipes