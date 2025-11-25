import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
) {
  console.error("Error: Missing Supabase environment variables");
  process.exit(1);
}

// Base client for operations that don't require user authentication
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Creates an authenticated Supabase client for a specific user
 * This is necessary for Row-Level Security (RLS) to work correctly
 * @param {string} accessToken - The JWT access token from the authenticated user
 * @returns {Object} Supabase client with user authentication context
 */
export const getAuthenticatedClient = (accessToken) => {
  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Override the default headers to include the user's access token
  supabaseClient.rest.headers = {
    ...supabaseClient.rest.headers,
    Authorization: `Bearer ${accessToken}`,
  };

  return supabaseClient;
};

export default supabase;
