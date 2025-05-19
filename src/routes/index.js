import express from "express";
import recipeRoutes from "./recipeRoutes.js";
import { notFoundHandler } from "../middleware/errorHandler.js";

const router = express.Router();

// Main route
router.get("/", (req, res) => {
  res.json({
    info: "Recipe API with Express and Supabase",
    version: "1.0.0",
    endpoints: [
      { method: "GET", path: "/recipes", description: "Get all recipes" },
      { method: "GET", path: "/recipes/:id", description: "Get recipe by ID" },
      { method: "POST", path: "/recipes", description: "Create new recipe" },
      {
        method: "PUT",
        path: "/recipes/:id",
        description: "Update existing recipe",
      },
      { method: "DELETE", path: "/recipes/:id", description: "Delete recipe" },
    ],
  });
});

// Mount recipe routes
router.use("/recipes", recipeRoutes);

// Handle not found routes - must be at the end
router.use(notFoundHandler);

export default router;
