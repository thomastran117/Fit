import type { Metadata } from "next";
import { SiteHeader } from "@/components/navigation/site-header";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rentify",
  description: "Trusted rentals across homes, rooms, equipment, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Providers>
          <SiteHeader />
          <div className="flex-1">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
