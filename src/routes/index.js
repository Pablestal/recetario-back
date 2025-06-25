import express from "express";
import recipeRoutes from "./recipeRoutes.js";
import tagRoutes from "./tagRoutes.js";
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
      { method: "GET", path: "/tags", description: "Get all tags" },
      {
        method: "GET",
        path: "/tags/:language",
        description: "Get all tags by language",
      },
    ],
  });
});

// Mount recipe routes
router.use("/recipes", recipeRoutes);

// Mount tag routes
router.use("/tags", tagRoutes);

// Handle not found routes - must be at the end
router.use(notFoundHandler);

export default router;
