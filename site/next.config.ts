import type { NextConfig } from "next";
import { RETIRED_REDIRECTS } from "./src/lib/retired-blog";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/login",
        destination: "/sign-in",
        permanent: false,
      },
      {
        source: "/blog/saas-metrics/churn-rate-benchmarks",
        destination: "/blog/saas-metrics/churn-meaning",
        permanent: true,
      },
      // 2026-10-03 博客收缩:同一意图的重复页 308 到保留页(清单与依据见 src/lib/retired-blog.ts)
      ...Object.entries(RETIRED_REDIRECTS).map(([source, destination]) => ({
        source,
        destination,
        permanent: true,
      })),
    ];
  },
};

export default nextConfig;
