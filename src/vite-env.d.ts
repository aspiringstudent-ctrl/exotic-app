/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_MQTT_URL?: string;
  readonly VITE_MQTT_TOPIC?: string;
  readonly VITE_MQTT_USERNAME?: string;
  readonly VITE_MQTT_PASSWORD?: string;
  readonly VITE_MQTT_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
