import supabase from "../config/db.js";

/**
 * Get all tags from the database
 */
export const getAllTags = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching tags:", error);
      return res.status(500).json({ error: "Failed to fetch tags" });
    }

    return res.status(200).json({
      message: "Tags retrieved successfully",
      data: data || [],
    });
  } catch (error) {
    console.error("Error fetching tags:", error);
    next(error);
  }
};

/**
 * Get all tags by language
 * @param {string} req.query.lang - Language code (default: 'en')
 */
export const getAllTagsByLanguage = async (req, res, next) => {
  try {
    const { lang } = req.params;

    // Query with LEFT JOIN to obtain translations with fallback
    const { data, error } = await supabase
      .from("tag_translations")
      .select(
        `
        name,
        language_code,
        tags!inner(id, name, color)
      `
      )
      .eq("language_code", lang)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching tags with translations:", error);
      return res.status(500).json({ error: "Failed to fetch tags" });
    }

    const transformedData =
      data?.map((translation) => ({
        id: translation.tags.id,
        key: translation.tags.key,
        name: translation.name,
        color: translation.tags.color,
      })) || [];

    return res.status(200).json({
      message: "Tags retrieved successfully",
      language: lang,
      data: transformedData,
    });
  } catch (error) {
    console.error("Error fetching tags with translations:", error);
    next(error);
  }
};
