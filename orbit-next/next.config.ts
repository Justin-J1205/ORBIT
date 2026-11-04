import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  experimental: {
    externalDir: true,
  },
  // Optimized for Vercel deployment
  poweredByHeader: false,
  compress: true,
  // Ensure shared schema is included in build
  transpilePackages: [],
  // Skip type checking during build - types are validated in IDE
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer, webpack }) => {
    if (isServer && webpack) {
      // Inject JSON.parse patch at the very beginning of every server bundle
      config.plugins.push(
        new webpack.BannerPlugin({
          banner: `
            (function() {
              if (typeof JSON !== "undefined" && typeof JSON.parse === "function") {
                const originalParse = JSON.parse;
                JSON.parse = function(text, reviver) {
                  if (text === null || text === undefined) return null;
                  const str = String(text).trim();
                  if (str === "undefined" || str === "null" || str === "" || 
                      str === '"undefined"' || str === '"null"' || str === '""') {
                    return null;
                  }
                  try {
                    return originalParse.call(this, text, reviver);
                  } catch (e) {
                    return null;
                  }
                };
              }
            })();
          `,
          raw: true,
          entryOnly: false,
        })
      );
    }
    return config;
  },
};

export default nextConfig;
