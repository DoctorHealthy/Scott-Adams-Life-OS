import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict mode catches subtle bugs early. Keep it on.
  reactStrictMode: true,
  // Ensure the coach knowledge files ship with every serverless function that
  // reads them at runtime via fs from /coach-knowledge (all coach routes plus
  // onboarding). Without this, Vercel tree-shakes the files and the routes 500.
  outputFileTracingIncludes: {
    "/api/coach/daily": ["./coach-knowledge/**/*"],
    "/api/coach/weekly": ["./coach-knowledge/**/*"],
    "/api/coach/monthly": ["./coach-knowledge/**/*"],
    "/api/coach/briefing": ["./coach-knowledge/**/*"],
    "/api/coach/ask": ["./coach-knowledge/**/*"],
    "/api/onboarding/propose": ["./coach-knowledge/**/*"],
  },
};

export default nextConfig;
