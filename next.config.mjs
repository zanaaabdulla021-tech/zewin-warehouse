/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Excel imports are sent through a server action
  experimental: { serverActions: { bodySizeLimit: "8mb" }, instrumentationHook: true },
};
export default nextConfig;
