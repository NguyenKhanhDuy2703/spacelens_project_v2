
export const ENV_CONFIG = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL ,
  API_TIMEOUT: Number(import.meta.env.VITE_API_TIMEOUT) || 10000,
  IS_DEV: import.meta.env.DEV,
  IS_PROD: import.meta.env.PROD,
} as const;

export default ENV_CONFIG;
