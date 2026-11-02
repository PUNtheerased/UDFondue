/** @type {import('next').NextConfig} */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://static.line-scdn.net https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.supabase.co https://drive.google.com https://lh3.googleusercontent.com",
  "connect-src 'self' https://api.line.me https://access.line.me https://liff.line.me https://*.line.me https://*.line-scdn.net https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com https://access.line.me",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests"
].join("; ");

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "drive.google.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" }
    ]
  },
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    const headers = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" }
    ];
    if (isProd) {
      headers.push({ key: "Content-Security-Policy", value: csp });
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains"
      });
    }
    return [{ source: "/:path*", headers }];
  }
};

export default nextConfig;
