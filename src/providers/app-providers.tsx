import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { BrowserRouter } from 'react-router-dom'
import { AppErrorFallback } from '@/components/system/app-error-fallback'
import { Toaster } from '@/components/ui/sonner'
import { createQueryClient } from '@/lib/query-client'

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient)

  return (
    <ErrorBoundary
      FallbackComponent={AppErrorFallback}
      onReset={() => {
        window.location.assign('/admin')
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <BrowserRouter>
            <div
              id="a11y-live-polite"
              className="sr-only"
              aria-live="polite"
              aria-atomic="true"
            />
            {children}
            <Toaster
              richColors
              position="top-center"
              closeButton
              containerAriaLabel="Notifications"
            />
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
