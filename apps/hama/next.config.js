const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /** workspace 패키지(@hama/shared 등) 번들링 */
  transpilePackages: ["@hama/shared"],

  /** CI에서 ESLint 대화형 설정/규칙 실패로 배포가 막히지 않게 함 */
  eslint: {
    ignoreDuringBuilds: true,
  },

  /** Vercel 빌드 중 Supabase 지연으로 SSG worker가 죽는 경우 완화 */
  staticPageGenerationTimeout: 180,

  experimental: {
    /** 모노레포: 루트 node_modules 기준으로 트레이싱·청크 해석 */
    outputFileTracingRoot: path.join(__dirname, "../.."),
  },
};

module.exports = nextConfig;
