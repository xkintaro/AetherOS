import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  // All OS services run locally; no persistent server is needed for hosting.
  output: "export",
  devIndicators: false,
};
export default nextConfig;
