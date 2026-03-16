import type { Metadata, Viewport } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { getRequestLocale } from "@/lib/i18n/get-locale";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-visual',
}

export const metadata: Metadata = {
  title: "UnitLift — Coaching Platform",
  description: "UnitLift is a coaching platform for personal trainers to manage clients, check-ins, workout plans, nutrition, chat, and progress tracking in one place.",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
    openGraph: {
    title: "UnitLift — Coaching Platform",
    description: "A coaching platform for personal trainers to manage clients, check-ins, workouts, nutrition, chat, and progress tracking in one place.",
    type: "website",
    images: [{ url: '/icon-512.png', width: 512, height: 512 }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale()
  const messages = (await import(`../messages/${locale}.json`)).default

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png" />
        <link rel="shortcut icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="UnitLift" />
      </head>
      <body
        className={`${roboto.variable} ${robotoMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
