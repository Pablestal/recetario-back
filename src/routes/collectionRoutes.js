import express from "express";
import { verifyAuth, optionalAuth } from "../middleware/auth.js";
import {
  createCollection,
  getCollection,
  updateCollection,
  deleteCollection,
  addRecipeToCollection,
  removeRecipeFromCollection,
} from "../controllers/collectionController.js";

const router = express.Router();

router.post("/", verifyAuth, createCollection);
router.get("/:id", optionalAuth, getCollection);
router.put("/:id", verifyAuth, updateCollection);
router.patch("/:id", verifyAuth, updateCollection);
router.delete("/:id", verifyAuth, deleteCollection);
router.post("/:id/recipes", verifyAuth, addRecipeToCollection);
router.delete("/:id/recipes/:recipeId", verifyAuth, removeRecipeFromCollection);

export default router;
