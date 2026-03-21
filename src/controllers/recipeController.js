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
    const page = Number.parseInt(req.query.page) || 1;
    const limit = Number.parseInt(req.query.limit) || 10;
    const start = (page - 1) * limit;
    const end = page * limit - 1;

    // Use authenticated client if token is available
    const client = req.token ? getAuthenticatedClient(req.token) : supabase;

    const { data, error, count } = await client
      .from("recipes")
      .select(
        `
        *,
        user:users (
          id,
          name,
          avatar_url
        ),
        recipe_tags (
          tag_id,
          tags (
            id,
            name,
            color
          )
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
        user:users (
          id,
          name,
          avatar_url
        ),
        ingredients (
          id,
          name,
          quantity,
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
 * Validates recipe creation data
 */
const validateRecipeData = (data) => {
  const { name, prepTime, servings, difficulty, ingredients, steps, isPublic } = data;

  if (!name?.trim()) {
    return "Name is required";
  }

  if (!prepTime || prepTime < 1) {
    return "Valid preparation time is required";
  }

  if (!servings || servings < 1) {
    return "Valid number of servings is required";
  }

  if (!difficulty || difficulty < 1 || difficulty > 5) {
    return "Difficulty must be between 1 and 5";
  }

  if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
    return "At least one ingredient is required";
  }

  if (!steps || !Array.isArray(steps) || steps.length === 0) {
    return "At least one step is required";
  }

  if (isPublic === undefined || isPublic === null) {
    return "isPublic is required";
  }

  return null;
};

/**
 * Inserts ingredients for a recipe
 */
const insertIngredients = async (client, recipeId, ingredients) => {
  const ingredientsToInsert = ingredients.map((ingredient, index) => ({
    recipe_id: recipeId,
    name: ingredient.name,
    quantity: ingredient.quantity || null,
    optional: ingredient.optional || false,
    order: ingredient.order || index + 1,
  }));

  const { error } = await client.from("ingredients").insert(ingredientsToInsert);
  if (error) throw error;
};

/**
 * Inserts steps for a recipe
 */
const insertSteps = async (client, recipeId, steps) => {
  const stepsToInsert = steps.map((step, index) => ({
    recipe_id: recipeId,
    step_number: step.step_number || index + 1,
    description: step.description,
    tip: step.tip || null,
    image_url: step.imageUrl || null,
  }));

  const { error } = await client.from("steps").insert(stepsToInsert);
  if (error) throw error;
};

/**
 * Inserts tags for a recipe
 */
const insertTags = async (client, recipeId, tags) => {
  const tagsToInsert = tags.map((tag) => ({
    recipe_id: recipeId,
    tag_id: tag.id ?? tag.tag_id,
  }));

  const { error } = await client.from("recipe_tags").insert(tagsToInsert);
  if (error) throw error;
};

/**
 * Fetches complete recipe with all relations
 */
const fetchCompleteRecipe = async (client, recipeId) => {
  const { data, error } = await client
    .from("recipes")
    .select(
      `
      *,
      users (
        id,
        name,
        avatar_url
      ),
      ingredients (
        id,
        name,
        quantity,
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

  if (error) throw error;
  return data;
};

/**
 * Verifies if a recipe exists
 */
const verifyRecipeExists = async (client, id) => {
  const { data, error } = await client
    .from("recipes")
    .select()
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return { exists: false, notFound: true };
    }
    throw error;
  }

  return { exists: !!data, notFound: false };
};

/**
 * Prepares updated data for recipe
 */
const prepareRecipeUpdateData = (body) => {
  const { name, description, prepTime, servings, difficulty, calories, mainImageURL, isPublic } = body;
  const updatedData = {};

  if (name) updatedData.name = name.trim();
  if (description !== undefined) updatedData.description = description.trim();
  if (prepTime) updatedData.prep_time = Number.parseInt(prepTime);
  if (servings) updatedData.servings = Number.parseInt(servings);
  if (difficulty) updatedData.difficulty = Number.parseInt(difficulty);
  if (calories !== undefined) updatedData.calories = calories ? Number.parseInt(calories) : null;
  if (mainImageURL !== undefined) updatedData.main_image_url = mainImageURL;
  if (isPublic !== undefined) updatedData.is_public = Boolean(isPublic);

  return updatedData;
};

/**
 * Updates recipe basic information
 */
const updateRecipeBasicInfo = async (client, id, updatedData) => {
  if (Object.keys(updatedData).length === 0) return;

  const { error } = await client
    .from("recipes")
    .update(updatedData)
    .eq("id", id);

  if (error) throw error;
};

/**
 * Updates ingredients for a recipe (delete and replace)
 */
const updateIngredients = async (client, recipeId, ingredients) => {
  await client.from("ingredients").delete().eq("recipe_id", recipeId);

  if (ingredients.length > 0) {
    await insertIngredients(client, recipeId, ingredients);
  }
};

/**
 * Updates steps for a recipe (delete and replace)
 */
const updateSteps = async (client, recipeId, steps) => {
  await client.from("steps").delete().eq("recipe_id", recipeId);

  if (steps.length > 0) {
    await insertSteps(client, recipeId, steps);
  }
};

/**
 * Updates tags for a recipe (delete and replace)
 */
const updateTags = async (client, recipeId, tags) => {
  const { error: deleteError } = await client.from("recipe_tags").delete().eq("recipe_id", recipeId);
  if (deleteError) throw deleteError;

  if (tags.length > 0) {
    await insertTags(client, recipeId, tags);
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

    const validationError = validateRecipeData(req.body);
    if (validationError) {
      return res.status(400).json(formatError(validationError, 400));
    }

    const authenticatedSupabase = getAuthenticatedClient(req.token);

    const newRecipe = {
      name: name.trim(),
      description: description?.trim() || "",
      prep_time: Number.parseInt(prepTime),
      servings: Number.parseInt(servings),
      difficulty: Number.parseInt(difficulty),
      calories: calories ? Number.parseInt(calories) : null,
      main_image_url: mainImageURL || null,
      user_id: req.userId,
      created_at: created_at || new Date().toISOString(),
      is_public: Boolean(isPublic),
    };

    const { data: recipeData, error: recipeError } = await authenticatedSupabase
      .from("recipes")
      .insert([newRecipe])
      .select()
      .single();

    if (recipeError) throw recipeError;

    const recipeId = recipeData.id;

    try {
      await insertIngredients(authenticatedSupabase, recipeId, ingredients);
      await insertSteps(authenticatedSupabase, recipeId, steps);

      if (tags?.length > 0) {
        await insertTags(authenticatedSupabase, recipeId, tags);
      }

      const completeRecipe = await fetchCompleteRecipe(authenticatedSupabase, recipeId);

      return res
        .status(201)
        .json(formatSuccess(completeRecipe, "Recipe created successfully", 201));
    } catch (error) {
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
    const { ingredients, steps, tags } = req.body;

    if (!id) {
      return res.status(400).json(formatError("Recipe ID is required", 400));
    }

    const client = req.token ? getAuthenticatedClient(req.token) : supabase;

    const { exists, notFound } = await verifyRecipeExists(client, id);
    if (notFound) {
      return res.status(404).json(formatError("Recipe not found", 404));
    }
    if (!exists) {
      return res.status(404).json(formatError("Recipe not found", 404));
    }

    const updatedData = prepareRecipeUpdateData(req.body);
    await updateRecipeBasicInfo(client, id, updatedData);

    if (ingredients && Array.isArray(ingredients)) {
      await updateIngredients(client, id, ingredients);
    }

    if (steps && Array.isArray(steps)) {
      await updateSteps(client, id, steps);
    }

    if (tags && Array.isArray(tags)) {
      await updateTags(client, id, tags);
    }

    const updatedRecipe = await fetchCompleteRecipe(client, id);

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
