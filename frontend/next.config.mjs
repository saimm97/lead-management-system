/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.NODE_ENV === "production" ? { output: "standalone" } : {}),
  async redirects() {
    return [{ source: "/", destination: "/login", permanent: false }];
  },
  // Prevent stale webpack chunks (missing ./958.js, routes-manifest.json) in dev
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
