import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wealth Management Portal',
    short_name: 'WealthPortal',
    description: 'Track your finances, budget, and wealth in one place.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b1220',
    theme_color: '#0b1220',
    icons: [
      {
        src: '/icon.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
      },
      {
        src: '/apple-icon.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
      },
    ],
  };
}
