import { defineConfig, devices } from "@playwright/test";

const mockSupabaseUrl = "http://127.0.0.1:3999";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3017",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npx next dev -p 3017",
    url: "http://127.0.0.1:3017",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: mockSupabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "mock-service-key",
      KAKAO_REST_API_KEY: "",
      KAKAO_CLIENT_SECRET: "",
    },
  },
});
