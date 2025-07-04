import supabase from "../config/db.js";
import {
  formatSuccess,
  formatError,
  formatPagination,
} from "../utils/responseFormatter.js";

/**
 * Get all recipes with optional pagination
 */
export const getAllRecipes = async (req, res, next) => {
  try {
    // Optional pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const start = (page - 1) * limit;
    const end = page * limit - 1;

    // Get recipes with their images
    const { data, error, count } = await supabase
      .from("recipes")
      .select(
        `
        *,
        images (
          id,
          url,
          alt
        )
      `,
        { count: "exact" }
      )
      .range(start, end);

    if (error) throw error;

    const response = formatPagination(
      data,
      count,
      page,
      limit,
      "Recipes retrieved successfully"
    );

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching recipes:", error);
    next(error);
  }
};

/**
 * Get a recipe by ID
 */
export const getRecipeById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json(formatError("Recipe ID is required", 400));
    }

    // Get recipe with all related data including images
    const { data, error } = await supabase
      .from("recipes")
      .select(
        `
        *,
        images (
          id,
          url,
          alt
        ),
        ingredients (
          id,
          name,
          quantity,
          optional
        ),
        steps (
          id,
          step_number,
          description,
          tip
        ),
        recipe_tags (
          tag_id,
          tags (
            id,
            name
          )
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json(formatError("Recipe not found", 404));
      }
      throw error;
    }

    if (!data) {
      return res.status(404).json(formatError("Recipe not found", 404));
    }

    return res
      .status(200)
      .json(formatSuccess(data, "Recipe retrieved successfully"));
  } catch (error) {
    console.error("Error fetching recipe:", error);
    next(error);
  }
};

/**
 * Create a new recipe
 */
export const createRecipe = async (req, res, next) => {
  try {
    const {
      name,
      description,
      prepTime,
      servings,
      difficulty,
      ingredients,
      steps,
      tags,
      images,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json(formatError("Name is required", 400));
    }

    if (!prepTime || prepTime < 1) {
      return res
        .status(400)
        .json(formatError("Valid preparation time is required", 400));
    }

    if (!servings || servings < 1) {
      return res
        .status(400)
        .json(formatError("Valid number of servings is required", 400));
    }

    if (!difficulty || difficulty < 1 || difficulty > 5) {
      return res
        .status(400)
        .json(formatError("Difficulty must be between 1 and 5", 400));
    }

    if (
      !ingredients ||
      !Array.isArray(ingredients) ||
      ingredients.length === 0
    ) {
      return res
        .status(400)
        .json(formatError("At least one ingredient is required", 400));
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return res
        .status(400)
        .json(formatError("At least one step is required", 400));
    }

    // 1. Create recipe object (sin el campo images)
    const newRecipe = {
      name: name.trim(),
      description: description?.trim() || "",
      prep_time: parseInt(prepTime),
      servings: parseInt(servings),
      difficulty: parseInt(difficulty),
    };

    const { data: recipeData, error: recipeError } = await supabase
      .from("recipes")
      .insert([newRecipe])
      .select()
      .single();

    if (recipeError) throw recipeError;

    const recipeId = recipeData.id;

    try {
      // 2. Insert images if provided
      if (images && Array.isArray(images) && images.length > 0) {
        const imagesToInsert = images.map((image) => ({
          recipe_id: recipeId,
          url: image.url,
          alt: image.alt || null, // Si no se proporciona, el trigger lo generará
        }));

        const { error: imagesError } = await supabase
          .from("images")
          .insert(imagesToInsert);

        if (imagesError) throw imagesError;
      }

      // 3. Insert ingredients
      if (ingredients && ingredients.length > 0) {
        const ingredientsToInsert = ingredients.map((ingredient, index) => ({
          recipe_id: recipeId,
          name: ingredient.name,
          quantity: ingredient.quantity,
          optional: ingredient.optional || false,
        }));

        const { error: ingredientsError } = await supabase
          .from("ingredients")
          .insert(ingredientsToInsert);

        if (ingredientsError) throw ingredientsError;
      }

      // 4. Insert steps
      if (steps && steps.length > 0) {
        const stepsToInsert = steps.map((step, index) => ({
          recipe_id: recipeId,
          step_number: step.step_number || index + 1,
          description: step.description,
          tip: step.tip || null,
        }));

        const { error: stepsError } = await supabase
          .from("steps")
          .insert(stepsToInsert);

        if (stepsError) throw stepsError;
      }

      // 5. Insert recipe_tags (many-to-many)
      if (tags && tags.length > 0) {
        const tagsToInsert = tags.map((tag) => ({
          recipe_id: recipeId,
          tag_id: tag.id,
        }));

        const { error: tagsError } = await supabase
          .from("recipe_tags")
          .insert(tagsToInsert);

        if (tagsError) throw tagsError;
      }

      // 6. Get the complete recipe with images for response
      const { data: completeRecipe, error: fetchError } = await supabase
        .from("recipes")
        .select(
          `
          *,
          images (
            id,
            url,
            alt
          )
        `
        )
        .eq("id", recipeId)
        .single();

      if (fetchError) throw fetchError;

      return res
        .status(201)
        .json(
          formatSuccess(completeRecipe, "Recipe created successfully", 201)
        );
    } catch (error) {
      // Rollback: delete the recipe if any step fails
      await supabase.from("recipes").delete().eq("id", recipeId);
      throw error;
    }
  } catch (error) {
    console.error("Error creating recipe:", error);
    next(error);
  }
};

/**
 * Update an existing recipe
 */
export const updateRecipe = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      prepTime,
      servings,
      difficulty,
      ingredients,
      steps,
      tags,
      images,
    } = req.body;

    if (!id) {
      return res.status(400).json(formatError("Recipe ID is required", 400));
    }

    // First verify the recipe exists
    const { data: existingRecipe, error: fetchError } = await supabase
      .from("recipes")
      .select()
      .eq("id", id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return res.status(404).json(formatError("Recipe not found", 404));
      }
      throw fetchError;
    }

    if (!existingRecipe) {
      return res.status(404).json(formatError("Recipe not found", 404));
    }

    // Prepare data for update
    const updatedData = {};
    if (name) updatedData.name = name.trim();
    if (description !== undefined) updatedData.description = description.trim();
    if (prepTime) updatedData.prep_time = parseInt(prepTime);
    if (servings) updatedData.servings = parseInt(servings);
    if (difficulty) updatedData.difficulty = parseInt(difficulty);

    // Update recipe basic info
    if (Object.keys(updatedData).length > 0) {
      const { error: updateError } = await supabase
        .from("recipes")
        .update(updatedData)
        .eq("id", id);

      if (updateError) throw updateError;
    }

    // Update images if provided
    if (images && Array.isArray(images)) {
      // Delete existing images
      const { error: deleteImagesError } = await supabase
        .from("images")
        .delete()
        .eq("recipe_id", id);

      if (deleteImagesError) throw deleteImagesError;

      // Insert new images
      if (images.length > 0) {
        const imagesToInsert = images.map((image) => ({
          recipe_id: parseInt(id),
          url: image.url,
          ...(image.alt && { alt: image.alt }),
        }));

        const { error: imagesError } = await supabase
          .from("images")
          .insert(imagesToInsert);

        if (imagesError) throw imagesError;
      }
    }

    // Get updated recipe with images
    const { data: updatedRecipe, error: finalFetchError } = await supabase
      .from("recipes")
      .select(
        `
        *,
        images (
          id,
          url,
          alt
        )
      `
      )
      .eq("id", id)
      .single();

    if (finalFetchError) throw finalFetchError;

    return res
      .status(200)
      .json(formatSuccess(updatedRecipe, "Recipe updated successfully"));
  } catch (error) {
    console.error("Error updating recipe:", error);
    next(error);
  }
};

/**
 * Delete a recipe
 */
export const deleteRecipe = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json(formatError("Recipe ID is required", 400));
    }

    // Verify the recipe exists
    const { data: existingRecipe, error: fetchError } = await supabase
      .from("recipes")
      .select()
      .eq("id", id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return res.status(404).json(formatError("Recipe not found", 404));
      }
      throw fetchError;
    }

    if (!existingRecipe) {
      return res.status(404).json(formatError("Recipe not found", 404));
    }

    // Delete the recipe (CASCADE will handle related images)
    const { error: deleteError } = await supabase
      .from("recipes")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return res
      .status(200)
      .json(formatSuccess(null, "Recipe deleted successfully"));
  } catch (error) {
    console.error("Error deleting recipe:", error);
    next(error);
  }
};
