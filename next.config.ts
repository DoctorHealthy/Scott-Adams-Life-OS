import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict mode catches subtle bugs early. Keep it on.
  reactStrictMode: true,
  // Ensure the coach knowledge files ship with the serverless function on Vercel
  // (they are read at runtime via fs from /coach-knowledge).
  outputFileTracingIncludes: {
    "/api/coach/daily": ["./coach-knowledge/**/*"],
  },
};

export default nextConfig;
