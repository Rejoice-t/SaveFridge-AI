from pydantic import BaseModel
from typing import  List

class IngredientRequest(BaseModel):
    #ingredients should be a list of strings, representing the ingredients provided by the user
    ingredients: List[str]