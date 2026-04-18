import supabase, { getAuthenticatedClient, supabaseAdmin } from "../config/db.js";
import {
  formatSuccess,
  formatError,
  formatPagination,
} from "../utils/responseFormatter.js";

// ─── Profile ──────────────────────────────────────────────────────────────────

export const getUserProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = req.token ? getAuthenticatedClient(req.token) : supabase;

    const { data: user, error } = await client
      .from("users")
      .select("id, name, username, avatar_url, location, bio")
      .eq("id", id)
      .single();

    if (error?.code === "PGRST116" || !user) {
      return res.status(404).json(formatError("User not found", 404));
    }
    if (error) throw error;

    const isOwner = req.userId === id;

    const [{ count: publicRecipeCount }, { count: totalRecipeCount }, { count: followersCount }, { count: followingCount }] =
      await Promise.all([
        client
          .from("recipes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", id)
          .eq("is_public", true),
        isOwner
          ? client.from("recipes").select("*", { count: "exact", head: true }).eq("user_id", id)
          : Promise.resolve({ count: null }),
        client
          .from("user_followers")
          .select("*", { count: "exact", head: true })
          .eq("following_id", id),
        client
          .from("user_followers")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", id),
      ]);

    const responseData = {
      ...user,
      recipe_count: isOwner ? totalRecipeCount : publicRecipeCount,
      followers_count: followersCount,
      following_count: followingCount,
    };

    if (isOwner) {
      responseData.public_recipe_count = publicRecipeCount;
    }

    return res.status(200).json(formatSuccess(responseData, "User profile retrieved successfully"));
  } catch (error) {
    console.error("Error fetching user profile:", error);
    next(error);
  }
};

export const getUserProfileByUsername = async (req, res, next) => {
  try {
    const { username } = req.params;
    const client = req.token ? getAuthenticatedClient(req.token) : supabase;

    const { data: user, error } = await client
      .from("users")
      .select("id, name, username, avatar_url, location, bio")
      .eq("username", username.toLowerCase())
      .single();

    if (error?.code === "PGRST116" || !user) {
      return res.status(404).json(formatError("User not found", 404));
    }
    if (error) throw error;

    const isOwner = req.userId === user.id;

    const [{ count: publicRecipeCount }, { count: totalRecipeCount }, { count: followersCount }, { count: followingCount }] =
      await Promise.all([
        client.from("recipes").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("is_public", true),
        isOwner
          ? client.from("recipes").select("*", { count: "exact", head: true }).eq("user_id", user.id)
          : Promise.resolve({ count: null }),
        client.from("user_followers").select("*", { count: "exact", head: true }).eq("following_id", user.id),
        client.from("user_followers").select("*", { count: "exact", head: true }).eq("follower_id", user.id),
      ]);

    const responseData = {
      ...user,
      recipe_count: isOwner ? totalRecipeCount : publicRecipeCount,
      followers_count: followersCount,
      following_count: followingCount,
    };

    if (isOwner) {
      responseData.public_recipe_count = publicRecipeCount;
    }

    return res.status(200).json(formatSuccess(responseData, "User profile retrieved successfully"));
  } catch (error) {
    console.error("Error fetching user profile by username:", error);
    next(error);
  }
};

export const updateMyProfile = async (req, res, next) => {
  try {
    const client = getAuthenticatedClient(req.token);
    const { name, username, avatar_url, location, bio } = req.body;
    const updatedData = {};

    if (name !== undefined) updatedData.name = name.trim();
    if (username !== undefined) updatedData.username = username.trim().toLowerCase();
    if (avatar_url !== undefined) updatedData.avatar_url = avatar_url;
    if (location !== undefined) updatedData.location = location;
    if (bio !== undefined) updatedData.bio = bio;

    if (Object.keys(updatedData).length === 0) {
      return res.status(400).json(formatError("No valid fields to update", 400));
    }

    const { data, error } = await client
      .from("users")
      .update(updatedData)
      .eq("id", req.userId)
      .select("id, name, username, avatar_url, location, bio")
      .single();

    if (error) throw error;

    return res.status(200).json(formatSuccess(data, "Profile updated successfully"));
  } catch (error) {
    console.error("Error updating profile:", error);
    next(error);
  }
};

export const getMyCollections = async (req, res, next) => {
  req.params.id = req.userId;
  return getUserCollections(req, res, next);
};

// ─── User recipes / collections ───────────────────────────────────────────────

export const getUserRecipes = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = req.token ? getAuthenticatedClient(req.token) : supabase;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const start = (page - 1) * limit;
    const end = page * limit - 1;

    const isOwner = req.userId === id;

    let query = client
      .from("recipes")
      .select(
        `id, name, description, prep_time, servings, difficulty, calories,
         main_image_url, is_public, created_at,
         recipe_tags(tag_id, tags(id, name, color))`,
        { count: "exact" }
      )
      .eq("user_id", id)
      .range(start, end)
      .order("created_at", { ascending: false });

    if (!isOwner) {
      query = query.eq("is_public", true);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    let bookmarkedIds = new Set();
    if (req.userId && data.length > 0) {
      const recipeIds = data.map((r) => r.id);
      const { data: bookmarks } = await client
        .from("collection_recipes")
        .select("recipe_id, collections!inner(user_id)")
        .eq("collections.user_id", req.userId)
        .in("recipe_id", recipeIds);

      if (bookmarks) {
        bookmarkedIds = new Set(bookmarks.map((b) => b.recipe_id));
      }
    }

    const recipes = data.map((r) => ({ ...r, is_bookmarked: bookmarkedIds.has(r.id) }));

    return res.status(200).json(
      formatPagination(recipes, count, page, limit, "User recipes retrieved successfully")
    );
  } catch (error) {
    console.error("Error fetching user recipes:", error);
    next(error);
  }
};

export const getUserCollections = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = req.token ? getAuthenticatedClient(req.token) : supabase;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const start = (page - 1) * limit;
    const end = page * limit - 1;

    const isOwner = req.userId === id;

    let query = client
      .from("collections")
      .select("id, name, description, cover_image_url, is_public, is_default, created_at, collection_recipes(count)", {
        count: "exact",
      })
      .eq("user_id", id)
      .range(start, end)
      .order("created_at", { ascending: false });

    if (!isOwner) {
      query = query.eq("is_public", true);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const collectionIds = data.map((c) => c.id);
    let publicCountMap = {};
    if (collectionIds.length > 0) {
      const { data: publicRows } = await client
        .from("collection_recipes")
        .select("collection_id, recipes!inner(is_public)")
        .in("collection_id", collectionIds)
        .eq("recipes.is_public", true);

      if (publicRows) {
        for (const row of publicRows) {
          publicCountMap[row.collection_id] = (publicCountMap[row.collection_id] || 0) + 1;
        }
      }
    }

    const collections = data.map(({ collection_recipes, ...rest }) => ({
      ...rest,
      recipe_count: collection_recipes?.[0]?.count ?? 0,
      public_recipe_count: publicCountMap[rest.id] ?? 0,
    }));

    return res.status(200).json(
      formatPagination(collections, count, page, limit, "User collections retrieved successfully")
    );
  } catch (error) {
    console.error("Error fetching user collections:", error);
    next(error);
  }
};

// ─── Followers ────────────────────────────────────────────────────────────────

export const followUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = getAuthenticatedClient(req.token);
    const followerId = req.userId;

    if (id === followerId) {
      return res.status(400).json(formatError("You cannot follow yourself", 400));
    }

    const { data: target, error: userError } = await client
      .from("users")
      .select("id")
      .eq("id", id)
      .single();

    if (userError?.code === "PGRST116" || !target) {
      return res.status(404).json(formatError("User not found", 404));
    }

    const { data: existing } = await client
      .from("user_followers")
      .select("follower_id")
      .eq("follower_id", followerId)
      .eq("following_id", id)
      .maybeSingle();

    if (existing) {
      return res.status(409).json(formatError("Already following this user", 409));
    }

    const { error } = await client
      .from("user_followers")
      .insert({ follower_id: followerId, following_id: id });

    if (error) throw error;

    return res.status(201).json(formatSuccess(null, "User followed successfully", 201));
  } catch (error) {
    console.error("Error following user:", error);
    next(error);
  }
};

export const unfollowUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = getAuthenticatedClient(req.token);

    const { error } = await client
      .from("user_followers")
      .delete()
      .eq("follower_id", req.userId)
      .eq("following_id", id);

    if (error) throw error;

    return res.status(200).json(formatSuccess(null, "User unfollowed successfully"));
  } catch (error) {
    console.error("Error unfollowing user:", error);
    next(error);
  }
};

export const getFollowers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = req.token ? getAuthenticatedClient(req.token) : supabase;

    const { data, error } = await client
      .from("user_followers")
      .select("follower:users!follower_id(id, name, username, avatar_url)")
      .eq("following_id", id);

    if (error) throw error;

    const followers = data.map((row) => row.follower);

    return res.status(200).json(formatSuccess(followers, "Followers retrieved successfully"));
  } catch (error) {
    console.error("Error fetching followers:", error);
    next(error);
  }
};

export const getFollowing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = req.token ? getAuthenticatedClient(req.token) : supabase;

    const { data, error } = await client
      .from("user_followers")
      .select("following:users!following_id(id, name, username, avatar_url)")
      .eq("follower_id", id);

    if (error) throw error;

    const following = data.map((row) => row.following);

    return res.status(200).json(formatSuccess(following, "Following retrieved successfully"));
  } catch (error) {
    console.error("Error fetching following:", error);
    next(error);
  }
};

// ─── Account management ───────────────────────────────────────────────────────

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

export const checkEmailAvailability = async (req, res, next) => {
  try {
    const { email } = req.params;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json(formatError("Invalid email format", 400));
    }

    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    const available = !data;
    console.log(`Email check: "${email}" → ${available ? "available" : "taken"}`);
    return res.status(200).json(formatSuccess({ available }, "OK"));
  } catch (error) {
    console.error("Error checking email availability:", error);
    next(error);
  }
};

export const checkUsernameAvailability = async (req, res, next) => {
  try {
    const { username } = req.params;

    if (!USERNAME_REGEX.test(username)) {
      return res.status(400).json(formatError("Invalid username format", 400));
    }

    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("username", username.toLowerCase())
      .maybeSingle();

    const available = !data;
    console.log(`Username check: "${username}" → ${available ? "available" : "taken"}`);
    return res.status(200).json(formatSuccess({ available }, "OK"));
  } catch (error) {
    console.error("Error checking username availability:", error);
    next(error);
  }
};

export const updateUserProfile = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.userId !== id) {
      return res.status(403).json(formatError("Forbidden", 403));
    }

    const { name, username, location, bio } = req.body;
    const updatedData = {};

    if (name !== undefined) {
      const trimmed = name.trim();
      if (trimmed.length < 1 || trimmed.length > 40) {
        return res.status(400).json(formatError("Name must be between 1 and 40 characters", 400));
      }
      updatedData.name = trimmed;
    }

    if (username !== undefined) {
      const trimmed = username.trim();
      if (!USERNAME_REGEX.test(trimmed)) {
        return res.status(400).json(
          formatError("Username must be 3–30 characters and contain only letters, numbers, or underscores", 400)
        );
      }
      const lower = trimmed.toLowerCase();

      const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("username", lower)
        .neq("id", id)
        .maybeSingle();

      if (existing) {
        return res.status(409).json(formatError("Username is already taken", 409));
      }

      updatedData.username = lower;
    }

    if (location !== undefined) {
      if (location.length > 40) {
        return res.status(400).json(formatError("Location must be at most 40 characters", 400));
      }
      updatedData.location = location;
    }

    if (bio !== undefined) {
      if (bio.length > 500) {
        return res.status(400).json(formatError("Bio must be at most 500 characters", 400));
      }
      updatedData.bio = bio;
    }

    if (Object.keys(updatedData).length === 0) {
      return res.status(400).json(formatError("No valid fields to update", 400));
    }

    const client = getAuthenticatedClient(req.token);
    const { data, error } = await client
      .from("users")
      .update(updatedData)
      .eq("id", id)
      .select("id, name, username, avatar_url, location, bio, created_at")
      .single();

    if (error) throw error;

    return res.status(200).json(formatSuccess(data, "Profile updated successfully"));
  } catch (error) {
    console.error("Error updating user profile:", error);
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.userId !== id) {
      return res.status(403).json(formatError("Forbidden", 403));
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json(formatError("currentPassword and newPassword are required", 400));
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json(
        formatError(
          "New password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, and one number",
          400
        )
      );
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(id);
    if (userError || !userData?.user?.email) {
      return res.status(404).json(formatError("User not found", 404));
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userData.user.email,
      password: currentPassword,
    });

    if (signInError) {
      return res.status(401).json(formatError("Current password is incorrect", 401));
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: newPassword,
    });

    if (updateError) throw updateError;

    return res.status(200).json(formatSuccess(null, "Password updated successfully"));
  } catch (error) {
    console.error("Error changing password:", error);
    next(error);
  }
};

export const changeEmail = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.userId !== id) {
      return res.status(403).json(formatError("Forbidden", 403));
    }

    const { currentPassword, newEmail } = req.body;

    if (!currentPassword || !newEmail) {
      return res.status(400).json(formatError("currentPassword and newEmail are required", 400));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json(formatError("Invalid email format", 400));
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(id);
    if (userError || !userData?.user?.email) {
      return res.status(404).json(formatError("User not found", 404));
    }

    if (userData.user.email === newEmail.toLowerCase()) {
      return res.status(400).json(formatError("New email must be different from the current one", 400));
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userData.user.email,
      password: currentPassword,
    });

    if (signInError) {
      return res.status(401).json(formatError("Current password is incorrect", 401));
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      email: newEmail,
    });

    if (updateError) throw updateError;

    return res.status(200).json(formatSuccess(null, "Confirmation email sent to the new address"));
  } catch (error) {
    console.error("Error changing email:", error);
    next(error);
  }
};

export const deleteAccount = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.userId !== id) {
      return res.status(403).json(formatError("Forbidden", 403));
    }

    const client = getAuthenticatedClient(req.token);

    const { error: dbError } = await client.from("users").delete().eq("id", id);
    if (dbError) throw dbError;

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) throw authError;

    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting account:", error);
    next(error);
  }
};

export const isFollowing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = getAuthenticatedClient(req.token);

    const { data } = await client
      .from("user_followers")
      .select("follower_id")
      .eq("follower_id", req.userId)
      .eq("following_id", id)
      .maybeSingle();

    return res.status(200).json(formatSuccess({ isFollowing: !!data }, "OK"));
  } catch (error) {
    console.error("Error checking follow status:", error);
    next(error);
  }
};
