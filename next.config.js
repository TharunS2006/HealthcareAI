/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    images: { unoptimized: true },
    reactStrictMode: true,
    // When this build was made — the footer's "Last Updated". Fixed at build, so
    // the prerendered HTML and the browser agree, and it tells the truth.
    env: { NEXT_PUBLIC_BUILD_DATE: new Date().toISOString().slice(0, 10) },
    swcMinify: true,
};

module.exports = nextConfig;

