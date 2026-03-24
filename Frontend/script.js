const ingredientInput = document.getElementById("ingredientInput");
const addIngredientBtn = document.getElementById("addIngredientBtn");
const chipBox = document.getElementById("chipBox");
const generateBtn = document.getElementById("generateBtn");
const results = document.getElementById("results");
const statusText = document.getElementById("statusText");
const ingredientCount = document.getElementById("ingredientCount");
const quickChips = document.querySelectorAll(".quick-chip");

let ingredients = [];

function updateIngredientCount() {
    ingredientCount.textContent = `${ingredients.length} ingredient${ingredients.length === 1 ? "" : "s"} selected`;
}

function renderChips() {
    chipBox.innerHTML = "";

    if (ingredients.length === 0) {
        chipBox.innerHTML = `<span style="color:#9a9a9a; padding: 10px 6px;">No ingredients added yet</span>`;
        updateIngredientCount();
        return;
    }

    ingredients.forEach((ingredient, index) => {
        const chip = document.createElement("div");
        chip.className = "ingredient-chip";
        chip.innerHTML = `
            <span>${ingredient}</span>
            <button class="remove-chip" data-index="${index}" type="button">×</button>
        `;
        chipBox.appendChild(chip);
    });

    updateIngredientCount();
}

function addIngredient(value) {
    const cleanValue = value.trim().toLowerCase();
    if (!cleanValue) return;
    if (ingredients.includes(cleanValue)) return;

    ingredients.push(cleanValue);
    renderChips();
}

function removeIngredient(index) {
    ingredients.splice(index, 1);
    renderChips();
}

addIngredientBtn.addEventListener("click", () => {
    addIngredient(ingredientInput.value);
    ingredientInput.value = "";
    ingredientInput.focus();
});

ingredientInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        addIngredient(ingredientInput.value);
        ingredientInput.value = "";
    }
});

chipBox.addEventListener("click", (event) => {
    if (event.target.classList.contains("remove-chip")) {
        const index = Number(event.target.dataset.index);
        removeIngredient(index);
    }
});

quickChips.forEach((chip) => {
    chip.addEventListener("click", () => {
        addIngredient(chip.textContent.trim());
    });
});

function showLoadingCards() {
    results.innerHTML = "";

    for (let i = 0; i < 3; i++) {
        const card = document.createElement("div");
        card.className = "loading-card";
        card.innerHTML = `
            <div class="skeleton hero"></div>
            <div class="skeleton line-lg"></div>
            <div class="skeleton line-md"></div>
            <div class="skeleton line-sm"></div>
            <div class="skeleton button"></div>
        `;
        results.appendChild(card);
    }
}

function estimatePrepTime(recipe) {
    return `${Math.max(8, recipe.steps.length * 4)} min prep`;
}

function estimateCookTime(recipe) {
    return `${Math.max(12, recipe.steps.length * 7)} min cook`;
}

function estimateServings(recipe) {
    return `${Math.max(2, Math.min(ingredients.length + 1, 5))} servings`;
}

function makeDescription(recipe) {
    return `A simple ${recipe.name.toLowerCase()} made with ${recipe.ingredients.slice(0, 3).join(", ")}. Great for reducing waste and making the most of what is already in your kitchen.`;
}

function recipeTags(recipe) {
    const tags = [];
    if (recipe.ingredients.length > 0) tags.push(recipe.ingredients[0]);
    tags.push("waste-less");
    tags.push("quick meal");
    return tags;
}

function getDifficulty(recipe) {
    if (recipe.steps.length <= 2) return "Easy";
    if (recipe.steps.length <= 4) return "Medium";
    return "Advanced";
}

function cardGradient(index) {
    const gradients = [
        "linear-gradient(135deg, #dff7e6, #f9ecd6)",
        "linear-gradient(135deg, #e4f1ff, #f3ebff)",
        "linear-gradient(135deg, #fff2d9, #ffe4d7)",
        "linear-gradient(135deg, #dff7f4, #e8f0ff)"
    ];
    return gradients[index % gradients.length];
}

function displayRecipes(recipes) {
    results.innerHTML = "";

    if (!recipes || recipes.length === 0) {
        results.innerHTML = `
            <div class="empty-state">
                <h3>No recipes found</h3>
                <p>Try adding more ingredients and generate again.</p>
            </div>
        `;
        return;
    }

    recipes.forEach((recipe, index) => {
        const card = document.createElement("article");
        card.className = "recipe-card";
        card.style.animationDelay = `${index * 0.08}s`;

        const tags = recipeTags(recipe)
            .map(tag => `<span class="recipe-tag">${tag}</span>`)
            .join("");

        const stepsMarkup = recipe.steps
            .map(step => `<li>${step}</li>`)
            .join("");

        card.innerHTML = `
            <div class="recipe-hero" style="background:${cardGradient(index)};">
                <div class="recipe-badge">${getDifficulty(recipe)}</div>
                <div class="recipe-title-wrap">
                    <h3>${recipe.name}</h3>
                </div>
            </div>

            <div class="recipe-body">
                <p class="recipe-desc">${makeDescription(recipe)}</p>

                <div class="meta-row">
                    <div class="meta-item">🕒 ${estimatePrepTime(recipe)}</div>
                    <div class="meta-item">👩‍🍳 ${estimateCookTime(recipe)}</div>
                    <div class="meta-item">🍽️ ${estimateServings(recipe)}</div>
                </div>

                <div class="tag-row">${tags}</div>

                <button class="view-btn" type="button">View recipe ⌄</button>

                <div class="steps-panel">
                    <p class="ingredients-line"><strong>Ingredients:</strong> ${recipe.ingredients.join(", ")}</p>
                    <ol>${stepsMarkup}</ol>
                </div>
            </div>
        `;

        const viewBtn = card.querySelector(".view-btn");
        const panel = card.querySelector(".steps-panel");

        viewBtn.addEventListener("click", () => {
            const isOpen = panel.classList.toggle("open");
            viewBtn.textContent = isOpen ? "Hide recipe ⌃" : "View recipe ⌄";
        });

        results.appendChild(card);
    });
}

async function generateRecipes() {
    if (ingredients.length === 0) {
        statusText.textContent = "Add at least one ingredient first.";
        return;
    }

    statusText.textContent = "Generating recipe ideas...";
    showLoadingCards();
    generateBtn.disabled = true;
    generateBtn.textContent = "Generating...";

    try {
        const response = await fetch("http://127.0.0.1:8000/generate-recipes", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ ingredients })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        displayRecipes(data.recipes);
        statusText.textContent = `Found ${data.recipes.length} recipe${data.recipes.length === 1 ? "" : "s"} matching your ingredients.`;
        document.querySelector(".results-section").scrollIntoView({ behavior: "smooth" });
    } catch (error) {
        results.innerHTML = `
            <div class="empty-state">
                <h3>Something went wrong</h3>
                <p>${error.message}</p>
            </div>
        `;
        statusText.textContent = "Could not generate recipes.";
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = "✨ Generate Recipes";
    }
}

generateBtn.addEventListener("click", generateRecipes);

renderChips();