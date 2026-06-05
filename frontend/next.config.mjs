import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin(
  './i18n/request.js'
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optional: Add remote patterns or other Next.js settings here if needed
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
