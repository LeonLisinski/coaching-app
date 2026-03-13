import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "UnitLift — Coaching Platform",
  description: "UnitLift is a coaching platform for personal trainers to manage clients, check-ins, workout plans, nutrition, chat, and progress tracking in one place.",
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: "UnitLift App — Coaching Platform for Personal Trainers",
    description: "A coaching platform for personal trainers to manage clients, check-ins, workouts, nutrition, chat, and progress tracking in one place.",
    type: "website",
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

