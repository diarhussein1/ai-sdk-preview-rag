import "./globals.css";
import type { Metadata } from "next";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "AI Assistant",
  description: "Ask questions, get answers from your documents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <Toaster 
          position="top-center" 
          toastOptions={{
            style: {
              background: 'var(--perplexity-bg)',
              border: '1px solid var(--perplexity-gray-200)',
              color: 'var(--perplexity-text-primary)',
            },
          }}
        />
      </body>
    </html>
  );
}

