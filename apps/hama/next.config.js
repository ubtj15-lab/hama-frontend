const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /** workspace 패키지(@hama/shared 등) 번들링 */
  transpilePackages: ["@hama/shared"],

  experimental: {
    /** 모노레포: 루트 node_modules 기준으로 트레이싱·청크 해석 */
    outputFileTracingRoot: path.join(__dirname, "../.."),
  },
};

module.exports = nextConfig;
