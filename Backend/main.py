from fastapi import FastAPI
from models import IngredientRequest
#creates aplication object
app = FastAPI()
#endpoint for home page, returns a message when accessed
@app.get("/")
def home():
    #returns a message indicating that the save fridge is running in a JSON format
    return {"message": "save fridge is running"}


@app.post("/generate-recipes")
def generate_recipes(request: IngredientRequest):
    #returns a message indicating that the recipe generation is in progress, along with the ingredients provided by the user
    recipes = [ 
        {"name": "Simple Omelette","ingredients":"ingredients",
         "steps": ["Beat the eggs","Heat a pan",
                    "cook until done"]}
    ]
    return {"recipes": recipes}