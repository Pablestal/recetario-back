import supabase, { getAuthenticatedClient } from "../config/db.js";
import {
  formatSuccess,
  formatError,
} from "../utils/responseFormatter.js";

export const createCollection = async (req, res, next) => {
  try {
    const client = getAuthenticatedClient(req.token);
    const { name, description, cover_image_url, is_public = true } = req.body;

    if (!name?.trim()) {
      return res.status(400).json(formatError("Name is required", 400));
    }

    const { data, error } = await client
      .from("collections")
      .insert({
        user_id: req.userId,
        name: name.trim(),
        description: description || null,
        cover_image_url: cover_image_url || null,
        is_public: Boolean(is_public),
      })
      .select("id, name, description, cover_image_url, is_public, is_default, created_at, collection_recipes(count)")
      .single();

    if (error) throw error;

    const { collection_recipes, ...rest } = data;
    return res.status(201).json(formatSuccess(
      { ...rest, recipe_count: collection_recipes?.[0]?.count ?? 0 },
      "Collection created successfully",
      201
    ));
  } catch (error) {
    console.error("Error creating collection:", error);
    next(error);
  }
};

export const getCollection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = req.token ? getAuthenticatedClient(req.token) : supabase;

    const { data: collection, error } = await client
      .from("collections")
      .select(
        `id, name, description, cover_image_url, is_public, is_default, created_at, user_id,
         collection_recipes(
           added_at,
           recipe:recipes(
             id, name, description, prep_time, servings, difficulty,
             calories, main_image_url, is_public, created_at,
             user:users!user_id(id, name, username, avatar_url),
             recipe_tags(tag_id, tags(id, name, color))
           )
         )`
      )
      .eq("id", id)
      .single();

    if (error?.code === "PGRST116" || !collection) {
      return res.status(404).json(formatError("Collection not found", 404));
    }
    if (error) throw error;

    if (!collection.is_public && collection.user_id !== req.userId) {
      return res.status(403).json(formatError("Access denied", 403));
    }

    const isOwner = collection.user_id === req.userId;
    const recipes = (collection.collection_recipes || [])
      .map((r) => r.recipe)
      .filter((r) => r && (isOwner || r.is_public));
    const { user_id, collection_recipes, ...rest } = collection;

    return res.status(200).json(
      formatSuccess({ ...rest, recipe_count: recipes.length, recipes }, "Collection retrieved successfully")
    );
  } catch (error) {
    console.error("Error fetching collection:", error);
    next(error);
  }
};

export const updateCollection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = getAuthenticatedClient(req.token);
    const { name, description, cover_image_url, is_public } = req.body;

    const { data: existing, error: fetchError } = await client
      .from("collections")
      .select("user_id")
      .eq("id", id)
      .single();

    if (fetchError?.code === "PGRST116" || !existing) {
      return res.status(404).json(formatError("Collection not found", 404));
    }
    if (existing.user_id !== req.userId) {
      return res.status(403).json(formatError("Access denied", 403));
    }

    const updatedData = {};
    if (name !== undefined) updatedData.name = name.trim();
    if (description !== undefined) updatedData.description = description;
    if (cover_image_url !== undefined) updatedData.cover_image_url = cover_image_url;
    if (is_public !== undefined) updatedData.is_public = Boolean(is_public);

    if (Object.keys(updatedData).length === 0) {
      return res.status(400).json(formatError("No valid fields to update", 400));
    }

    const { data, error } = await client
      .from("collections")
      .update(updatedData)
      .eq("id", id)
      .select("id, name, description, cover_image_url, is_public, is_default, created_at, collection_recipes(count)")
      .single();

    if (error) throw error;

    const { collection_recipes, ...rest } = data;
    return res.status(200).json(formatSuccess(
      { ...rest, recipe_count: collection_recipes?.[0]?.count ?? 0 },
      "Collection updated successfully"
    ));
  } catch (error) {
    console.error("Error updating collection:", error);
    next(error);
  }
};

export const deleteCollection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = getAuthenticatedClient(req.token);

    const { data: existing, error: fetchError } = await client
      .from("collections")
      .select("user_id")
      .eq("id", id)
      .single();

    if (fetchError?.code === "PGRST116" || !existing) {
      return res.status(404).json(formatError("Collection not found", 404));
    }
    if (existing.user_id !== req.userId) {
      return res.status(403).json(formatError("Access denied", 403));
    }

    const { error } = await client.from("collections").delete().eq("id", id);
    if (error) throw error;

    return res.status(200).json(formatSuccess(null, "Collection deleted successfully"));
  } catch (error) {
    console.error("Error deleting collection:", error);
    next(error);
  }
};

export const addRecipeToCollection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = getAuthenticatedClient(req.token);
    const { recipe_id } = req.body;

    if (!recipe_id) {
      return res.status(400).json(formatError("recipe_id is required", 400));
    }

    const { data: collection, error: fetchError } = await client
      .from("collections")
      .select("user_id")
      .eq("id", id)
      .single();

    if (fetchError?.code === "PGRST116" || !collection) {
      return res.status(404).json(formatError("Collection not found", 404));
    }
    if (collection.user_id !== req.userId) {
      return res.status(403).json(formatError("Access denied", 403));
    }

    const { data: recipe } = await client
      .from("recipes")
      .select("id")
      .eq("id", recipe_id)
      .maybeSingle();

    if (!recipe) {
      return res.status(404).json(formatError("Recipe not found", 404));
    }

    const { data: existing } = await client
      .from("collection_recipes")
      .select("collection_id")
      .eq("collection_id", id)
      .eq("recipe_id", recipe_id)
      .maybeSingle();

    if (existing) {
      return res.status(409).json(formatError("Recipe already in collection", 409));
    }

    const { error } = await client
      .from("collection_recipes")
      .insert({ collection_id: id, recipe_id });

    if (error) throw error;

    return res.status(201).json(formatSuccess(null, "Recipe added to collection", 201));
  } catch (error) {
    console.error("Error adding recipe to collection:", error);
    next(error);
  }
};

export const removeRecipeFromCollection = async (req, res, next) => {
  try {
    const { id, recipeId } = req.params;
    const client = getAuthenticatedClient(req.token);

    const { data: collection, error: fetchError } = await client
      .from("collections")
      .select("user_id")
      .eq("id", id)
      .single();

    if (fetchError?.code === "PGRST116" || !collection) {
      return res.status(404).json(formatError("Collection not found", 404));
    }
    if (collection.user_id !== req.userId) {
      return res.status(403).json(formatError("Access denied", 403));
    }

    const { error } = await client
      .from("collection_recipes")
      .delete()
      .eq("collection_id", id)
      .eq("recipe_id", recipeId);

    if (error) throw error;

    return res.status(200).json(formatSuccess(null, "Recipe removed from collection"));
  } catch (error) {
    console.error("Error removing recipe from collection:", error);
    next(error);
  }
};
