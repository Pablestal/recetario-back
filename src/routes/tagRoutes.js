import express from "express";
import {
  getAllTags,
  getAllTagsByLanguage,
} from "../controllers/tagController.js";

const router = express.Router();

// Tag routes
router.get("/", getAllTags);
router.get("/:lang", getAllTagsByLanguage);

export default router;
