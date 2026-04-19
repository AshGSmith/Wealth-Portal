import type { NextConfig } from "next";

function normalizeAllowedOrigin(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    return new URL(trimmed).host;
  } catch {
    return trimmed.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}

function getAllowedOrigins(): string[] {
  const values = new Set<string>();
  const configuredOrigins = process.env.NEXT_SERVER_ACTIONS_ALLOWED_ORIGINS
    ?.split(',')
    .map(normalizeAllowedOrigin)
    .filter(Boolean) ?? [];

  for (const origin of configuredOrigins) {
    values.add(origin);
  }

  if (process.env.APP_URL) {
    const appOrigin = normalizeAllowedOrigin(process.env.APP_URL);
    if (appOrigin) values.add(appOrigin);
  }

  return [...values];
}

const allowedOrigins = getAllowedOrigins();

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  ...(allowedOrigins.length > 0
    ? {
        experimental: {
          serverActions: {
            allowedOrigins,
          },
        },
      }
    : {}),
};

export default nextConfig;
