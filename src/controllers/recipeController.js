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

    const { data, error, count } = await supabase
      .from("recipes")
      .select("*", { count: "exact" })
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

    const { data, error } = await supabase
      .from("recipes")
      .select()
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
    const { title, body, ingredients } = req.body;

    // Basic validation
    if (!title || !body) {
      return res
        .status(400)
        .json(formatError("Title and body are required fields", 400));
    }

    // Prepare new recipe object
    const newRecipe = {
      title,
      body,
      ingredients: ingredients || [],
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("recipes")
      .insert([newRecipe])
      .select();

    if (error) throw error;

    return res
      .status(201)
      .json(formatSuccess(data[0], "Recipe created successfully", 201));
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
    const { title, body, ingredients } = req.body;

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
    const updatedData = {
      ...(title && { title }),
      ...(body && { body }),
      ...(ingredients && { ingredients }),
      updated_at: new Date().toISOString(),
    };

    // Perform the update
    const { data, error: updateError } = await supabase
      .from("recipes")
      .update(updatedData)
      .eq("id", id)
      .select();

    if (updateError) throw updateError;

    return res
      .status(200)
      .json(formatSuccess(data[0], "Recipe updated successfully"));
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

    // Delete the recipe
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
