import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'SAAB Sports',
    // Nome curto é o que cabe embaixo do ícone no celular — não passar de ~12 caracteres.
    short_name: 'SAAB',
    description: 'Seus treinos, sua evolução e sua equipe, num lugar só.',
    lang: 'pt-BR',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0a0f',
    theme_color: '#0a0a0f',
    categories: ['health', 'fitness', 'sports'],
    // Atalhos ao segurar o ícone na tela de início
    shortcuts: [
      { name: 'Meus treinos', short_name: 'Treinos', url: '/atleta' },
      { name: 'Painel do treinador', short_name: 'Painel', url: '/dashboard' },
    ],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
