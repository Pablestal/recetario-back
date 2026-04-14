import supabase, { getAuthenticatedClient } from "../config/db.js";
import {
  formatSuccess,
  formatError,
  formatPagination,
} from "../utils/responseFormatter.js";

export const favoriteRecipe = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = getAuthenticatedClient(req.token);

    const { data: recipe, error: recipeError } = await client
      .from("recipes")
      .select("id")
      .eq("id", id)
      .single();

    if (recipeError?.code === "PGRST116" || !recipe) {
      return res.status(404).json(formatError("Recipe not found", 404));
    }

    const { data: existing } = await client
      .from("recipe_favorites")
      .select("user_id")
      .eq("user_id", req.userId)
      .eq("recipe_id", id)
      .maybeSingle();

    if (existing) {
      return res.status(409).json(formatError("Recipe already favorited", 409));
    }

    const { error } = await client
      .from("recipe_favorites")
      .insert({ user_id: req.userId, recipe_id: id });

    if (error) throw error;

    return res.status(201).json(formatSuccess(null, "Recipe added to favorites", 201));
  } catch (error) {
    console.error("Error favoriting recipe:", error);
    next(error);
  }
};

export const unfavoriteRecipe = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = getAuthenticatedClient(req.token);

    const { error } = await client
      .from("recipe_favorites")
      .delete()
      .eq("user_id", req.userId)
      .eq("recipe_id", id);

    if (error) throw error;

    return res.status(200).json(formatSuccess(null, "Recipe removed from favorites"));
  } catch (error) {
    console.error("Error unfavoriting recipe:", error);
    next(error);
  }
};

export const isRecipeFavorited = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = getAuthenticatedClient(req.token);

    const { data } = await client
      .from("recipe_favorites")
      .select("user_id")
      .eq("user_id", req.userId)
      .eq("recipe_id", id)
      .maybeSingle();

    return res.status(200).json(formatSuccess({ isFavorited: !!data }, "OK"));
  } catch (error) {
    console.error("Error checking favorite status:", error);
    next(error);
  }
};

export const getMyFavorites = async (req, res, next) => {
  try {
    const client = getAuthenticatedClient(req.token);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const start = (page - 1) * limit;
    const end = page * limit - 1;

    const { data, error, count } = await client
      .from("recipe_favorites")
      .select(
        `added_at:created_at,
         recipe:recipes(
           id, name, description, prep_time, servings, difficulty,
           calories, main_image_url, is_public, created_at,
           user:users!user_id(id, name, username, avatar_url),
           recipe_tags(tag_id, tags(id, name, color))
         )`,
        { count: "exact" }
      )
      .eq("user_id", req.userId)
      .range(start, end)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const recipes = data.map((row) => row.recipe);

    return res.status(200).json(
      formatPagination(recipes, count, page, limit, "Favorites retrieved successfully")
    );
  } catch (error) {
    console.error("Error fetching favorites:", error);
    next(error);
  }
};
