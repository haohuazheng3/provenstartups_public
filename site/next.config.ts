import type { NextConfig } from "next";
import { RETIRED_REDIRECTS } from "./src/lib/retired-blog";

const nextConfig: NextConfig = {
  // 构建时把提交号写死进产物:GitHub Actions 预构建后上传的部署,运行时不一定有
  // VERCEL_GIT_COMMIT_SHA,/api/health 的 commit 字段靠它兜底(部署验收全靠这个字段)
  env: {
    BUILD_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "",
  },
  async redirects() {
    return [
      {
        source: "/login",
        destination: "/sign-in",
        permanent: false,
      },
      {
        source: "/blog/saas-metrics/churn-rate-benchmarks",
        destination: "/blog/saas-metrics/saas-metrics-founders-track",
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
