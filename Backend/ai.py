import os
from groq import Groq
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

# Create Groq client
client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)

def generate_recipes(ingredients):

    ingredient_text = ", ".join(ingredients)

    prompt = f"""
Generate 3 simple recipes using these ingredients:
{ingredient_text}

Return ONLY valid JSON in this exact format:

{{
  "recipes": [
    {{
      "name": "Recipe name",
      "ingredients": ["ingredient1", "ingredient2"],
      "steps": ["step1", "step2"]
    }}
  ]
}}

Rules:
- Do not include any text outside JSON
- Do not explain anything
- Ensure the JSON is valid
"""

    response = client.chat.completions.create(
        messages=[
            {"role": "user", "content": prompt}
        ],
        model="llama-3.3-70b-versatile",
    )
    ai_output = response.choices[0].message.content
    try:
        return json.loads(ai_output) #convert string  to dictionary 
    except:
        return {"error": "Invalid AI response","raw":ai_output}
