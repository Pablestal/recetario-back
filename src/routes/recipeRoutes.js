import express from "express";
import {
  getAllRecipes,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe,
} from "../controllers/recipeController.js";
import {
  favoriteRecipe,
  unfavoriteRecipe,
  isRecipeFavorited,
} from "../controllers/favoriteController.js";
import { verifyAuth, optionalAuth } from "../middleware/auth.js";

const router = express.Router();

// Recipe routes
router.get("/", optionalAuth, getAllRecipes);
router.get("/:id", optionalAuth, getRecipeById);
router.post("/", verifyAuth, createRecipe);
router.put("/:id", verifyAuth, updateRecipe);
router.delete("/:id", verifyAuth, deleteRecipe);

// Favorites
router.post("/:id/favorite", verifyAuth, favoriteRecipe);
router.delete("/:id/favorite", verifyAuth, unfavoriteRecipe);
router.get("/:id/is-favorited", verifyAuth, isRecipeFavorited);

export default router;
