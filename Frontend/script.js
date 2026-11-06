
/* =========================================
   SAVEFRIDGE AI — FRONTEND
   ========================================= */

// API configuration.
// Keep this URL for local development.
// Before deploying, change it to your Render backend URL.
// Automatically use the local backend during development
// and the Render backend when the application is deployed.

const API_BASE_URL =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
        ? "http://127.0.0.1:8000"
        : "https://savefridge-ai.onrender.com";

const RECIPE_API_URL = `${API_BASE_URL}/generate-recipes`;
const IMAGE_API_URL = `${API_BASE_URL}/recipe-image`;
const INGREDIENT_SCAN_URL = `${API_BASE_URL}/identify-ingredients`;

// Main page elements
const ingredientInput = document.getElementById("ingredientInput");
const addIngredientBtn = document.getElementById("addIngredientBtn");
const ingredientForm = document.getElementById("ingredientForm");
const chipBox = document.getElementById("chipBox");
const generateBtn = document.getElementById("generateBtn");
const results = document.getElementById("results");
const statusText = document.getElementById("statusText");
const ingredientCount = document.getElementById("ingredientCount");
const quickChips = document.querySelectorAll(".quick-chip");

// Photo upload elements
const ingredientPhoto = document.getElementById("ingredientPhoto");
const photoPreview = document.getElementById("photoPreview");
const detectedIngredients = document.getElementById("detectedIngredients");

let ingredients = [];
let selectedPhoto = null;
let previewObjectUrl = null;
let isScanning = false;

// Pantry staples are never selected automatically.
const PANTRY_STAPLES = [
    { name: "water", label: "Water" },
    { name: "salt", label: "Salt" },
    { name: "cooking oil", label: "Cooking oil" },
    { name: "sugar", label: "Sugar" }
];

// =========================================
// UTILITIES
// =========================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

function refreshIcons(container = document) {
    if (window.lucide) {
        window.lucide.createIcons({
            root: container
        });
    }
}

function setButtonContent(button, label, iconName) {
    button.replaceChildren();

    const text = document.createElement("span");
    text.textContent = label;
    button.appendChild(text);

    if (iconName) {
        const icon = document.createElement("i");
        icon.setAttribute("data-lucide", iconName);
        icon.setAttribute("aria-hidden", "true");
        button.appendChild(icon);
        refreshIcons(button);
    }
}

function setStatus(message) {
    if (statusText) {
        statusText.textContent = message;
    }
}

// =========================================
// PANTRY STAPLES
// =========================================

function createPantrySelector() {
    if (document.getElementById("pantryStaplesSection")) {
        return;
    }

    const section = document.createElement("section");
    section.id = "pantryStaplesSection";
    section.className = "pantry-selector";

    section.innerHTML = `
        <h3>Pantry staples I have</h3>

        <p class="panel-description">
            Select only the staples you actually have.
            Unchecked staples will not be assumed available.
        </p>

        <div class="pantry-options">
            ${PANTRY_STAPLES.map((staple) => `
                <label class="pantry-option">
                    <input
                        type="checkbox"
                        class="pantry-staple-checkbox"
                        value="${escapeHTML(staple.name)}"
                    />
                    <span>${escapeHTML(staple.label)}</span>
                </label>
            `).join("")}
        </div>
    `;

    // Place the pantry selector below the ingredient entry area.
    const quickAddSection = document.querySelector(".quick-add-section");

    if (quickAddSection) {
        quickAddSection.insertAdjacentElement("afterend", section);
    } else {
        chipBox.insertAdjacentElement("afterend", section);
    }
}

function getSelectedPantryStaples() {
    return Array.from(
        document.querySelectorAll(".pantry-staple-checkbox:checked")
    ).map((checkbox) => checkbox.value);
}

// =========================================
// INGREDIENT CHIPS
// =========================================

function updateIngredientCount() {
    if (!ingredientCount) return;

    const count = ingredients.length;

    ingredientCount.textContent =
        `${count} ingredient${count === 1 ? "" : "s"} selected`;
}

function renderChips() {
    chipBox.replaceChildren();

    if (ingredients.length === 0) {
        const emptyMessage = document.createElement("span");
        emptyMessage.className = "ingredient-empty-message";
        emptyMessage.textContent = "No ingredients added yet";

        chipBox.appendChild(emptyMessage);
        updateIngredientCount();
        return;
    }

    ingredients.forEach((ingredient, index) => {
        const chip = document.createElement("div");
        chip.className = "ingredient-chip";

        const label = document.createElement("span");
        label.textContent = ingredient;

        const removeButton = document.createElement("button");
        removeButton.className = "remove-chip";
        removeButton.dataset.index = String(index);
        removeButton.type = "button";
        removeButton.setAttribute("aria-label", `Remove ${ingredient}`);

        const icon = document.createElement("i");
        icon.setAttribute("data-lucide", "x");
        icon.setAttribute("aria-hidden", "true");

        removeButton.appendChild(icon);
        chip.append(label, removeButton);
        chipBox.appendChild(chip);
    });

    updateIngredientCount();
    refreshIcons(chipBox);
}

function addIngredient(value) {
    const cleanValue = String(value ?? "").trim().toLowerCase();

    if (!cleanValue) {
        setStatus("Enter an ingredient first.");
        return false;
    }

    if (ingredients.includes(cleanValue)) {
        setStatus(`${cleanValue} has already been added.`);
        return false;
    }

    ingredients.push(cleanValue);
    renderChips();
    setStatus(`${cleanValue} added to your ingredients.`);

    return true;
}

function removeIngredient(index) {
    if (index < 0 || index >= ingredients.length) {
        return;
    }

    const removed = ingredients[index];
    ingredients.splice(index, 1);

    renderChips();
    setStatus(`${removed} removed.`);
}

// Add ingredient through the form.
if (ingredientForm) {
    ingredientForm.addEventListener("submit", (event) => {
        event.preventDefault();

        if (addIngredient(ingredientInput.value)) {
            ingredientInput.value = "";
        }

        ingredientInput.focus();
    });
} else if (addIngredientBtn) {
    addIngredientBtn.addEventListener("click", () => {
        if (addIngredient(ingredientInput.value)) {
            ingredientInput.value = "";
        }

        ingredientInput.focus();
    });
}

// Support Enter even if the input is not inside a form.
ingredientInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !ingredientForm) {
        event.preventDefault();

        if (addIngredient(ingredientInput.value)) {
            ingredientInput.value = "";
        }
    }
});

chipBox.addEventListener("click", (event) => {
    const button = event.target.closest(".remove-chip");

    if (button && chipBox.contains(button)) {
        removeIngredient(Number(button.dataset.index));
    }
});

quickChips.forEach((chip) => {
    chip.addEventListener("click", () => {
        // The button text is plain text, so remove any leading icon
        // or decorative characters if you later add them.
        addIngredient(chip.textContent.trim());
    });
});

// =========================================
// PHOTO PREVIEW AND INGREDIENT RECOGNITION
// =========================================

function clearPhotoPreview() {
    if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = null;
    }

    if (photoPreview) {
        photoPreview.replaceChildren();
        photoPreview.hidden = true;
    }

    if (detectedIngredients) {
        detectedIngredients.replaceChildren();
        detectedIngredients.hidden = true;
    }
}

function showPhotoPreview(file) {
    clearPhotoPreview();

    previewObjectUrl = URL.createObjectURL(file);

    const image = document.createElement("img");
    image.src = previewObjectUrl;
    image.alt = "Preview of your ingredient photo";

    const caption = document.createElement("p");
    caption.textContent = file.name;
    caption.className = "photo-filename";

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "view-btn";
    setButtonContent(removeButton, "Remove photo", "trash-2");

    removeButton.addEventListener("click", () => {
        selectedPhoto = null;
        ingredientPhoto.value = "";
        clearPhotoPreview();
        setStatus("Photo removed.");
    });

    photoPreview.append(image, caption, removeButton);
    photoPreview.hidden = false;
}

async function scanIngredients(file) {
    if (isScanning) return;

    isScanning = true;

    try {
        setStatus("Looking for ingredients in your photo...");

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(INGREDIENT_SCAN_URL, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            let message = `Ingredient scan failed (${response.status}).`;

            try {
                const errorData = await response.json();
                message = errorData.detail || message;
            } catch {
                // Keep the fallback message if the server did not return JSON.
            }

            throw new Error(message);
        }

        const data = await response.json();

        if (!Array.isArray(data.ingredients)) {
            throw new Error("The server returned an unexpected ingredient list.");
        }

        displayDetectedIngredients(data.ingredients);
    } catch (error) {
        console.error("Ingredient recognition error:", error);

        setStatus(
            `${error.message} You can still add ingredients manually.`
        );
    } finally {
        isScanning = false;
    }
}

if (ingredientPhoto) {
    ingredientPhoto.addEventListener("change", async () => {
        const file = ingredientPhoto.files?.[0];

        if (!file) return;

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.type)) {
            setStatus("Please choose a JPG, PNG, or WebP image.");
            ingredientPhoto.value = "";
            return;
        }

        if (file.size > 8 * 1024 * 1024) {
            setStatus("Please choose an image smaller than 8 MB.");
            ingredientPhoto.value = "";
            return;
        }

        selectedPhoto = file;
        showPhotoPreview(file);
        await scanIngredients(file);
    });
}

function displayDetectedIngredients(detected) {
    detectedIngredients.replaceChildren();

    const heading = document.createElement("h3");
    heading.textContent = "Review detected ingredients";

    const explanation = document.createElement("p");
    explanation.textContent =
        "Select the ingredients you can see in the photo. Nothing will be added until you confirm.";

    detectedIngredients.append(heading, explanation);

    if (detected.length === 0) {
        const message = document.createElement("p");
        message.textContent =
            "No ingredients were confidently identified. Try a clearer photo or add ingredients manually.";

        detectedIngredients.appendChild(message);
        detectedIngredients.hidden = false;
        setStatus("Scan complete. No ingredients were identified.");
        return;
    }

    const list = document.createElement("div");
    list.className = "detected-ingredient-list";

    detected.forEach((item, index) => {
        if (!item || typeof item.name !== "string" || !item.name.trim()) {
            return;
        }

        const name = item.name.trim().toLowerCase();
        const confidence = ["high", "medium", "low"].includes(item.confidence)
            ? item.confidence
            : "medium";

        const label = document.createElement("label");
        label.className = "pantry-option detected-ingredient-option";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = name;
        checkbox.checked = !ingredients.includes(name);
        checkbox.id = `detectedIngredient${index}`;

        const copy = document.createElement("span");
        copy.className = "detected-ingredient-copy";

        const ingredientName = document.createElement("strong");
        ingredientName.textContent = name;

        const confidenceText = document.createElement("small");
        confidenceText.textContent = `${confidence} confidence`;

        copy.append(ingredientName, confidenceText);
        label.append(checkbox, copy);
        list.appendChild(label);
    });

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "generate-btn";
    setButtonContent(confirmButton, "Add selected ingredients", "check");

    confirmButton.addEventListener("click", () => {
        const selected = Array.from(
            list.querySelectorAll('input[type="checkbox"]:checked')
        );

        let addedCount = 0;

        selected.forEach((checkbox) => {
            if (addIngredient(checkbox.value)) {
                addedCount++;
            }
        });

        detectedIngredients.hidden = true;

        setStatus(
            addedCount > 0
                ? `Added ${addedCount} ingredient${addedCount === 1 ? "" : "s"} from your photo. Please check the list before generating recipes.`
                : "No new ingredients were added. Check your existing ingredient list."
        );
    });

    detectedIngredients.append(list, confirmButton);
    detectedIngredients.hidden = false;

    setStatus(
        `Found ${detected.length} possible ingredient${detected.length === 1 ? "" : "s"}. Review and confirm them below.`
    );

    refreshIcons(detectedIngredients);
}

// =========================================
// LOADING PLACEHOLDERS
// =========================================

function showLoadingCards() {
    results.replaceChildren();

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

// =========================================
// RECIPE INFORMATION
// =========================================

function estimatePrepTime(recipe) {
    const minutes = Number(recipe.prep_time_minutes);
    return `${Number.isFinite(minutes) ? minutes : 0} min prep`;
}

function estimateCookTime(recipe) {
    const minutes = Number(recipe.cook_time_minutes);
    return `${Number.isFinite(minutes) ? minutes : 0} min cook`;
}

function estimateServings(recipe) {
    const servings = Number(recipe.servings);
    return `${Number.isFinite(servings) && servings > 0 ? servings : 2} servings`;
}

function getIngredientName(item) {
    if (typeof item === "string") {
        return item;
    }

    return item?.name || "Ingredient";
}

function makeDescription(recipe) {
    if (recipe.description) {
        return recipe.description;
    }

    const ingredientNames = (recipe.ingredients || [])
        .slice(0, 3)
        .map(getIngredientName);

    return `A simple ${recipe.name} made with ${ingredientNames.join(", ")}.`;
}

function recipeTags(recipe) {
    const tags = [];
    const firstIngredient = recipe.ingredients?.[0];

    if (firstIngredient) {
        tags.push(getIngredientName(firstIngredient));
    }

    tags.push("Waste less", "Quick meal");

    return tags;
}

function getDifficulty(recipe) {
    return recipe.difficulty || "Easy";
}

function cardGradient(index) {
    const gradients = [
        "linear-gradient(135deg, #e9def5, #f4e7d8)",
        "linear-gradient(135deg, #e2eee0, #f5eadb)",
        "linear-gradient(135deg, #f6e7ec, #eae4f7)",
        "linear-gradient(135deg, #dff0ed, #e8e4f7)"
    ];

    return gradients[index % gradients.length];
}

// =========================================
// RECIPE PHOTOS
// =========================================

async function getRecipeImage(recipeName) {
    try {
        const response = await fetch(
            `${IMAGE_API_URL}?query=${encodeURIComponent(recipeName)}`
        );

        if (!response.ok) {
            throw new Error(`Image request failed: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Recipe image error:", error);
        return null;
    }
}

function addPhotoCredit(hero, photo) {
    if (!photo.photographer || !photo.photographer_url) {
        return;
    }

    const credit = document.createElement("a");
    credit.className = "photo-credit";
    credit.href = photo.photographer_url;
    credit.target = "_blank";
    credit.rel = "noopener noreferrer";
    credit.textContent = `Photo: ${photo.photographer}`;

    hero.appendChild(credit);
}

// =========================================
// RECIPE INGREDIENTS
// =========================================

function formatIngredient(item) {
    if (typeof item === "string") {
        return `
            <li>
                <span>${escapeHTML(item)}</span>
                <strong>Quantity not provided</strong>
            </li>
        `;
    }

    const name = escapeHTML(item?.name || "Ingredient");
    const quantity = item?.quantity;
    const unit = escapeHTML(item?.unit || "");

    const quantityText =
        quantity !== null && quantity !== undefined && quantity !== ""
            ? `${escapeHTML(quantity)} ${unit}`.trim()
            : "Quantity not provided";

    return `
        <li>
            <span>${name}</span>
            <strong>${quantityText}</strong>
        </li>
    `;
}

function formatSuggestedAdditions(additions) {
    if (!Array.isArray(additions) || additions.length === 0) {
        return "";
    }

    const items = additions
        .filter((item) => item && item.name)
        .map((item) => `
            <li>
                <strong>${escapeHTML(item.name)}</strong>
                <span>${escapeHTML(item.reason || "Optional addition.")}</span>
                <small class="unavailable-label">
                    Not in your confirmed ingredients — optional
                </small>
            </li>
        `)
        .join("");

    if (!items) return "";

    return `
        <div class="suggested-additions">
            <h4>Optional additions</h4>
            <p>
                These ingredients are not required. Use them only if you
                have them or choose to get them.
            </p>
            <ul>${items}</ul>
        </div>
    `;
}

// =========================================
// DISPLAY RECIPE CARDS
// =========================================

function displayRecipes(recipes, message = "") {
    results.replaceChildren();

    if (!Array.isArray(recipes) || recipes.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.className = "empty-state";

        const heading = document.createElement("h3");
        heading.textContent = "No suitable recipes found";

        const paragraph = document.createElement("p");
        paragraph.textContent = message ||
            "Try adding another ingredient or selecting a pantry staple you actually have.";

        emptyState.append(heading, paragraph);
        results.appendChild(emptyState);
        return;
    }

    recipes.forEach((recipe, index) => {
        const card = document.createElement("article");
        card.className = "recipe-card";
        card.style.animationDelay = `${index * 0.08}s`;

        const recipeName = escapeHTML(recipe.name || "Recipe");
        const description = escapeHTML(makeDescription(recipe));

        const tags = recipeTags(recipe)
            .map((tag) => `<span class="recipe-tag">${escapeHTML(tag)}</span>`)
            .join("");

        const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
        const stepsMarkup = steps
            .map((step) => `<li>${escapeHTML(step)}</li>`)
            .join("");

        const recipeIngredients = Array.isArray(recipe.ingredients)
            ? recipe.ingredients
            : [];

        const ingredientsMarkup = recipeIngredients
            .map(formatIngredient)
            .join("");

        const optionalAdditionsMarkup =
            formatSuggestedAdditions(recipe.suggested_additions);

        card.innerHTML = `
            <div class="recipe-hero" style="background:${cardGradient(index)};">
                <img
                    class="recipe-image"
                    alt="${recipeName}"
                    loading="lazy"
                />

                <div class="recipe-image-overlay"></div>

                <div class="recipe-badge">
                    ${escapeHTML(getDifficulty(recipe))}
                </div>

                <div class="recipe-title-wrap">
                    <h3>${recipeName}</h3>
                </div>
            </div>

            <div class="recipe-body">
                <p class="recipe-desc">${description}</p>

                <div class="meta-row">
                    <div class="meta-item">
                        <i data-lucide="clock" aria-hidden="true"></i>
                        <span>${estimatePrepTime(recipe)}</span>
                    </div>

                    <div class="meta-item">
                        <i data-lucide="cooking-pot" aria-hidden="true"></i>
                        <span>${estimateCookTime(recipe)}</span>
                    </div>

                    <div class="meta-item">
                        <i data-lucide="users" aria-hidden="true"></i>
                        <span>${estimateServings(recipe)}</span>
                    </div>
                </div>

                <div class="tag-row">${tags}</div>

                <button
                    class="view-btn"
                    type="button"
                    aria-expanded="false"
                >
                    <span>View recipe</span>
                    <i data-lucide="chevron-down" aria-hidden="true"></i>
                </button>

                <div class="steps-panel">
                    <div class="ingredients-section">
                        <h4>Ingredients you need</h4>
                        <ul class="recipe-ingredients">
                            ${ingredientsMarkup}
                        </ul>
                    </div>

                    ${optionalAdditionsMarkup}

                    <div class="instructions-section">
                        <h4>Instructions</h4>
                        <ol>${stepsMarkup}</ol>
                    </div>
                </div>
            </div>
        `;

        // Load recipe photo asynchronously.
        const recipeImage = card.querySelector(".recipe-image");
        const imageOverlay = card.querySelector(".recipe-image-overlay");
        const recipeHero = card.querySelector(".recipe-hero");

        getRecipeImage(recipe.name || "food").then((photo) => {
            if (!photo || !photo.image_url) {
                recipeImage.style.display = "none";
                imageOverlay.style.display = "none";
                return;
            }

            recipeImage.onerror = () => {
                recipeImage.style.display = "none";
                imageOverlay.style.display = "none";
            };

            recipeImage.src = photo.image_url;
            addPhotoCredit(recipeHero, photo);
        });

        // Expand and collapse recipe instructions.
        const viewButton = card.querySelector(".view-btn");
        const stepsPanel = card.querySelector(".steps-panel");

        viewButton.addEventListener("click", () => {
            const isOpen = stepsPanel.classList.toggle("open");

            viewButton.setAttribute("aria-expanded", String(isOpen));

            setButtonContent(
                viewButton,
                isOpen ? "Hide recipe" : "View recipe",
                isOpen ? "chevron-up" : "chevron-down"
            );
        });

        results.appendChild(card);
        refreshIcons(card);
    });
}

// =========================================
// GENERATE RECIPES
// =========================================

async function generateRecipes() {
    if (ingredients.length === 0) {
        setStatus("Add at least one ingredient first.");
        ingredientInput.focus();
        return;
    }

    const selectedPantryStaples = getSelectedPantryStaples();

    setStatus("Generating recipes using your available ingredients...");
    showLoadingCards();

    generateBtn.disabled = true;
    setButtonContent(generateBtn, "Generating recipes...", "loader-circle");

    try {
        const response = await fetch(RECIPE_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                ingredients,
                pantry_staples: selectedPantryStaples
            })
        });

        if (!response.ok) {
            let message = `Server error: ${response.status}`;

            try {
                const errorData = await response.json();
                message = errorData.detail || errorData.error || message;
            } catch {
                // Use fallback message.
            }

            throw new Error(message);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        if (!Array.isArray(data.recipes)) {
            throw new Error("The server returned an unexpected recipe format.");
        }

        displayRecipes(data.recipes, data.message);

        if (data.recipes.length > 0) {
            setStatus(
                `Found ${data.recipes.length} recipe${data.recipes.length === 1 ? "" : "s"} using your available ingredients.`
            );
        } else {
            setStatus(
                data.message || "No suitable recipes found. Try other ingredients."
            );
        }

        const resultsSection = document.querySelector(".results-section");

        if (resultsSection) {
            resultsSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    } catch (error) {
        console.error("Recipe generation error:", error);

        results.replaceChildren();

        const emptyState = document.createElement("div");
        emptyState.className = "empty-state";

        const heading = document.createElement("h3");
        heading.textContent = "Something went wrong";

        const paragraph = document.createElement("p");
        paragraph.textContent = error.message ||
            "Could not generate recipes. Please try again.";

        emptyState.append(heading, paragraph);
        results.appendChild(emptyState);

        setStatus("Could not generate recipes. Check that the backend is running.");
    } finally {
        generateBtn.disabled = false;
        setButtonContent(generateBtn, "Find my recipes", "arrow-up-right");
    }
}

generateBtn.addEventListener("click", generateRecipes);

// =========================================
// INITIALIZE
// =========================================

createPantrySelector();
renderChips();
refreshIcons();
