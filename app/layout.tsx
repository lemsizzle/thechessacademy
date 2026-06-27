import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Chess Academy Quest Board",
  description: "A magical chess class progress board for students, parents, and teachers."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
