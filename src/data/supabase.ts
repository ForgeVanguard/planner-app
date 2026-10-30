import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

export const supabaseEnabled = Boolean(url && key);

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(url, key, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === "web",
      },
    })
  : null;
