/**
 * 레거시: 루트에 `app/`이 남아 있어 `npx next dev`를 여기서 실행하면 이 설정이 쓰입니다.
 * 메인 HAMA 앱은 `apps/hama`입니다. 로컬 개발은 저장소 루트에서:
 *   npm run dev
 * (workspace로 `apps/hama`만 띄움)
 */
/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true };
module.exports = nextConfig;
