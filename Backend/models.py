
from pydantic import BaseModel, Field
from typing import List


class IngredientRequest(BaseModel):
    ingredients: List[str]
    pantry_staples: List[str] = Field(default_factory=list)
