// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "IntraBot",
  description: "Private RAG • Ingest + Chat",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-neutral-50 dark:bg-neutral-900">
        {children}
        <Toaster richColors closeButton expand position="top-right" />
      </body>
    </html>
  );
}

