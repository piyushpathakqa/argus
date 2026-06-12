/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the target app deterministic and self-contained — no telemetry noise in CI.
  reactStrictMode: true,
};

export default nextConfig;
