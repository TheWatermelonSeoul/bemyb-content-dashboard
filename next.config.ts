import type { NextConfig } from "next";

// GITHUB_PAGES=true 로 빌드하면 GitHub Pages용 정적 사이트(out/)를 만든다
const pages = process.env.GITHUB_PAGES === "true";
const repo = "bemyb-content-dashboard";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: pages ? `/${repo}` : "",
};

export default nextConfig;
