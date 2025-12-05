import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mensaje Cifrado',
    short_name: 'Mensaje Cifrado',
    description: 'Juego de mesa multijugador en tiempo real',
    start_url: '/',
    display: 'standalone',
    background_color: '#1a1a1a',
    theme_color: '#1a1a1a',
    orientation: 'any',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
        purpose: 'maskable',
      },
    ],
  }
}
