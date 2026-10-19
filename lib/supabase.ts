import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const webStorage = {
	getItem: (key: string) =>
		Promise.resolve(typeof window === 'undefined' ? null : window.localStorage.getItem(key)),
	setItem: (key: string, value: string) => {
		if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
		return Promise.resolve();
	},
	removeItem: (key: string) => {
		if (typeof window !== 'undefined') window.localStorage.removeItem(key);
		return Promise.resolve();
	},
};

const ExpoSecureStoreAdapter = {
getItem: (key: string) => SecureStore.getItemAsync(key),
setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const storage = Platform.OS === 'web' ? webStorage : ExpoSecureStoreAdapter;

// These are public client credentials, not secrets. Access is enforced by
// Supabase Row Level Security. Keep fallbacks so release builds do not crash
// when EAS environment variables are unavailable.
const DEFAULT_SUPABASE_URL = 'https://dmahiovxwmlvjydutjyw.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_TvQikBUZ4Dz_bZ-OVrQ7nw_xcQWuCmX';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
auth: {
 storage,
autoRefreshToken: true,
persistSession: true,
detectSessionInUrl: false,
},
});
