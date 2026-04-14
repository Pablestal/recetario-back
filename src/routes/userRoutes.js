import express from "express";
import { verifyAuth, optionalAuth } from "../middleware/auth.js";
import {
  getUserProfile,
  getUserProfileByUsername,
  updateMyProfile,
  getUserRecipes,
  getUserCollections,
  getMyCollections,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  isFollowing,
} from "../controllers/userController.js";
import { getMyFavorites } from "../controllers/favoriteController.js";

const router = express.Router();

// ── "me" routes must come before /:id to avoid param collision ──
router.get("/me/favorites", verifyAuth, getMyFavorites);
router.get("/me/collections", verifyAuth, getMyCollections);
router.put("/me", verifyAuth, updateMyProfile);

// ── Public profile ──
router.get("/username/:username", optionalAuth, getUserProfileByUsername);
router.get("/:id", optionalAuth, getUserProfile);
router.get("/:id/recipes", optionalAuth, getUserRecipes);
router.get("/:id/collections", optionalAuth, getUserCollections);

// ── Followers ──
router.post("/:id/follow", verifyAuth, followUser);
router.delete("/:id/follow", verifyAuth, unfollowUser);
router.get("/:id/followers", getFollowers);
router.get("/:id/following", getFollowing);
router.get("/:id/is-following", verifyAuth, isFollowing);

export default router;
