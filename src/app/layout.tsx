import type { Metadata, Viewport } from 'next'
import { Fraunces, Nunito } from 'next/font/google'

import { DeviceStorageHydrator } from '@/components/public/device-storage-hydrator'
import { Toaster } from '@/components/ui/sonner'
import { getStoreInfo } from '@/lib/data/store'
import './globals.css'

const nunito = Nunito({ variable: '--font-nunito', subsets: ['latin'], display: 'swap' })
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  display: 'swap',
  axes: ['SOFT', 'opsz'],
})

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getStoreInfo()
  return {
    title: { default: settings.name, template: `%s · ${settings.name}` },
    description:
      settings.tagline ?? 'Docinhos artesanais para delivery e encomendas para festas.',
  }
}

export const viewport: Viewport = {
  themeColor: '#fff8f0',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" className={`${nunito.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <DeviceStorageHydrator />
        <Toaster />
      </body>
    </html>
  )
}
