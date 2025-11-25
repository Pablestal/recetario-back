import supabase, { getAuthenticatedClient } from "../config/db.js";
import {
  formatSuccess,
  formatError,
  formatPagination,
} from "../utils/responseFormatter.js";

/**
 * Get all recipes with optional pagination
 * Updated to include main_image_url and calories
 */
export const getAllRecipes = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const start = (page - 1) * limit;
    const end = page * limit - 1;

    // Use authenticated client if token is available
    const client = req.token ? getAuthenticatedClient(req.token) : supabase;

    const { data, error, count } = await client
      .from("recipes")
      .select(
        `
        *
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
 * Updated to include step imageURL directly in steps
 */
export const getRecipeById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json(formatError("Recipe ID is required", 400));
    }

    // Use authenticated client if token is available
    const client = req.token ? getAuthenticatedClient(req.token) : supabase;

    // Get recipe with all related data
    const { data, error } = await client
      .from("recipes")
      .select(
        `
        *,
        ingredients (
          id,
          name,
          quantity,
          unit,
          optional,
          order
        ),
        steps (
          id,
          step_number,
          description,
          tip,
          image_url
        ),
        recipe_tags (
          tag_id,
          tags (
            id,
            name,
            color
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

    // Sort ingredients by order
    if (data.ingredients) {
      data.ingredients.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    // Sort steps by step_number
    if (data.steps) {
      data.steps.sort((a, b) => (a.step_number || 0) - (b.step_number || 0));
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
 * Updated to handle mainImageURL, calories, ingredient units/order, and step imageURL
 */
export const createRecipe = async (req, res, next) => {
  try {
    const {
      name,
      description,
      prepTime,
      servings,
      difficulty,
      calories,
      mainImageURL,
      ingredients,
      steps,
      tags,
      isPublic,
      created_at,
    } = req.body;

    // Validation
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

    if (isPublic === undefined || isPublic === null) {
      return res.status(400).json(formatError("isPublic is required", 400));
    }

    // Create authenticated Supabase client
    const authenticatedSupabase = getAuthenticatedClient(req.token);

    // Create recipe object
    const newRecipe = {
      name: name.trim(),
      description: description?.trim() || "",
      prep_time: parseInt(prepTime),
      servings: parseInt(servings),
      difficulty: parseInt(difficulty),
      calories: calories ? parseInt(calories) : null,
      main_image_url: mainImageURL || null,
      user_id: req.userId,
      created_at: created_at || new Date().toISOString(),
      is_public: Boolean(isPublic),
    };

    // Insert recipe using authenticated client
    const { data: recipeData, error: recipeError } = await authenticatedSupabase
      .from("recipes")
      .insert([newRecipe])
      .select()
      .single();

    if (recipeError) throw recipeError;

    const recipeId = recipeData.id;

    try {
      // Insert ingredients with unit and order
      if (ingredients && ingredients.length > 0) {
        const ingredientsToInsert = ingredients.map((ingredient, index) => ({
          recipe_id: recipeId,
          name: ingredient.name,
          quantity: ingredient.quantity || null,
          unit: ingredient.unit || null,
          optional: ingredient.optional || false,
          order: ingredient.order || index + 1,
        }));

        const { error: ingredientsError } = await authenticatedSupabase
          .from("ingredients")
          .insert(ingredientsToInsert);

        if (ingredientsError) throw ingredientsError;
      }

      // Insert steps with imageURL
      if (steps && steps.length > 0) {
        const stepsToInsert = steps.map((step, index) => ({
          recipe_id: recipeId,
          step_number: step.step_number || index + 1,
          description: step.description,
          tip: step.tip || null,
          image_url: step.imageUrl || null,
        }));

        const { error: stepsError } = await authenticatedSupabase
          .from("steps")
          .insert(stepsToInsert);

        if (stepsError) throw stepsError;
      }

      // Insert recipe_tags (many-to-many)
      if (tags && tags.length > 0) {
        const tagsToInsert = tags.map((tag) => ({
          recipe_id: recipeId,
          tag_id: tag.id,
        }));

        const { error: tagsError } = await authenticatedSupabase
          .from("recipe_tags")
          .insert(tagsToInsert);

        if (tagsError) throw tagsError;
      }

      // Get the complete recipe for response
      const { data: completeRecipe, error: fetchError } =
        await authenticatedSupabase
          .from("recipes")
          .select(
            `
          *,
          ingredients (
            id,
            name,
            quantity,
            unit,
            optional,
            order
          ),
          steps (
            id,
            step_number,
            description,
            tip,
            image_url
          ),
          recipe_tags (
            tag_id,
            tags (
              id,
              name,
              color
            )
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
      await authenticatedSupabase.from("recipes").delete().eq("id", recipeId);
      throw error;
    }
  } catch (error) {
    console.error("Error creating recipe:", error);
    next(error);
  }
};

/**
 * Update an existing recipe
 * Updated to handle new fields and step imageURL
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
      calories,
      mainImageURL,
      ingredients,
      steps,
      tags,
      isPublic,
    } = req.body;

    if (!id) {
      return res.status(400).json(formatError("Recipe ID is required", 400));
    }

    // Use authenticated client if token is available
    const client = req.token ? getAuthenticatedClient(req.token) : supabase;

    // Verify the recipe exists
    const { data: existingRecipe, error: fetchError } = await client
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
    if (calories !== undefined)
      updatedData.calories = calories ? parseInt(calories) : null;
    if (mainImageURL !== undefined) updatedData.main_image_url = mainImageURL;
    if (isPublic !== undefined) updatedData.is_public = Boolean(isPublic);

    // Update recipe basic info
    if (Object.keys(updatedData).length > 0) {
      const { error: updateError } = await client
        .from("recipes")
        .update(updatedData)
        .eq("id", id);

      if (updateError) throw updateError;
    }

    // Update ingredients if provided
    if (ingredients && Array.isArray(ingredients)) {
      // Delete existing ingredients
      await client.from("ingredients").delete().eq("recipe_id", id);

      // Insert new ingredients
      if (ingredients.length > 0) {
        const ingredientsToInsert = ingredients.map((ingredient, index) => ({
          recipe_id: parseInt(id),
          name: ingredient.name,
          quantity: ingredient.quantity || null,
          unit: ingredient.unit || null,
          optional: ingredient.optional || false,
          order: ingredient.order || index + 1,
        }));

        const { error: ingredientsError } = await client
          .from("ingredients")
          .insert(ingredientsToInsert);

        if (ingredientsError) throw ingredientsError;
      }
    }

    // Update steps with imageURL if provided
    if (steps && Array.isArray(steps)) {
      // Delete existing steps
      await client.from("steps").delete().eq("recipe_id", id);

      // Insert new steps with imageURL
      if (steps.length > 0) {
        const stepsToInsert = steps.map((step, index) => ({
          recipe_id: parseInt(id),
          step_number: step.step_number || index + 1,
          description: step.description,
          tip: step.tip || null,
          image_url: step.imageUrl || null,
        }));

        const { error: stepsError } = await client
          .from("steps")
          .insert(stepsToInsert);

        if (stepsError) throw stepsError;
      }
    }

    // Update tags if provided
    if (tags && Array.isArray(tags)) {
      // Delete existing tags
      await client.from("recipe_tags").delete().eq("recipe_id", id);

      // Insert new tags
      if (tags.length > 0) {
        const tagsToInsert = tags.map((tag) => ({
          recipe_id: parseInt(id),
          tag_id: tag.id,
        }));

        const { error: tagsError } = await client
          .from("recipe_tags")
          .insert(tagsToInsert);

        if (tagsError) throw tagsError;
      }
    }

    // Get updated recipe
    const { data: updatedRecipe, error: finalFetchError } = await client
      .from("recipes")
      .select(
        `
        *,
        ingredients (
          id,
          name,
          quantity,
          unit,
          optional,
          order
        ),
        steps (
          id,
          step_number,
          description,
          tip,
          image_url
        ),
        recipe_tags (
          tag_id,
          tags (
            id,
            name,
            color
          )
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

    // Create authenticated Supabase client
    const authenticatedSupabase = getAuthenticatedClient(req.token);

    // Verify the recipe exists
    const { data: existingRecipe, error: fetchError } =
      await authenticatedSupabase
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

    // Delete the recipe (CASCADE will handle related data)
    const { error: deleteError } = await authenticatedSupabase
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
