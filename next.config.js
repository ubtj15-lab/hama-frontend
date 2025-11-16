/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['images.unsplash.com'],
    // ngrok 사용 or static export면 아래 켜주면 404 사라짐
    unoptimized: true,
  },
};

module.exports = nextConfig;
