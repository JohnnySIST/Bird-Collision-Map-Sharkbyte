import type { Metadata } from "next";
import "./globals.css";
import { GlobalProvider } from "@/context/GlobalContext";

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
        <GlobalProvider>
          {children}
        </GlobalProvider>
      </body>
    </html>
  );
}
