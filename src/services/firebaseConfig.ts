export interface FirebaseEnvConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

/**
 * Membaca konfigurasi Firebase Web SDK murni dari environment variables.
 * Tidak menyimpan atau menghasilkan konfigurasi Firebase palsu di source code.
 */
export function getFirebaseEnvConfig(): Partial<FirebaseEnvConfig> {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || undefined,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || undefined,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || undefined,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
    appId: import.meta.env.VITE_FIREBASE_APP_ID || undefined,
  };
}

export function isFirebaseEnvConfigured(): boolean {
  const cfg = getFirebaseEnvConfig();
  return Boolean(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId);
}
