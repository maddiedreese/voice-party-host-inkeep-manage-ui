import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { AppSidebar } from '@/components/sidebar-nav/sidebar-nav';
import { ThemeProvider } from '@/components/theme-provider';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { RuntimeConfigProvider } from '@/contexts/runtime-config-context';
import {
  DEFAULT_INKEEP_AGENTS_MANAGE_API_URL,
  DEFAULT_INKEEP_AGENTS_RUN_API_URL,
  DEFAULT_SIGNOZ_URL,
} from '@/lib/runtime-config/defaults';
import type { RuntimeConfig } from '@/lib/runtime-config/types';

const jetBrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
});

const inter = Inter({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Inkeep Agents',
  description:
    "Inkeep's multi-agent framework enables multiple specialized AI agents to collaborate and solve complex problems through a graph-based architecture. You can define networks of agents, each with unique instructions, tools, and purposes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const runtimeConfig: RuntimeConfig = {
    INKEEP_AGENTS_MANAGE_API_URL:
      process.env.INKEEP_AGENTS_MANAGE_API_URL || DEFAULT_INKEEP_AGENTS_MANAGE_API_URL,
    INKEEP_AGENTS_RUN_API_URL:
      process.env.INKEEP_AGENTS_RUN_API_URL || DEFAULT_INKEEP_AGENTS_RUN_API_URL,
    INKEEP_AGENTS_RUN_API_BYPASS_SECRET: process.env.INKEEP_AGENTS_RUN_API_BYPASS_SECRET,
    SIGNOZ_URL: process.env.SIGNOZ_URL || DEFAULT_SIGNOZ_URL,
    NANGO_SERVER_URL: process.env.NANGO_SERVER_URL,
    NANGO_CONNECT_BASE_URL: process.env.NANGO_CONNECT_BASE_URL,
  };
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetBrainsMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NuqsAdapter>
            <RuntimeConfigProvider value={runtimeConfig}>
              <SidebarProvider
                style={
                  {
                    '--sidebar-width': 'calc(var(--spacing) * 62)',
                    '--header-height': 'calc(var(--spacing) * 12)',
                  } as React.CSSProperties
                }
              >
                <AppSidebar variant="inset" />
                <SidebarInset>{children}</SidebarInset>
              </SidebarProvider>
              <Toaster />
            </RuntimeConfigProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  );
}
