import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bird Collision Map",
  description: "An interactive map to visualize bird collisions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
