import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

type AppErrorFallbackProps = {
  error: unknown
  resetErrorBoundary: () => void
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

export function AppErrorFallback({
  error,
  resetErrorBoundary,
}: AppErrorFallbackProps) {
  return (
    <div
      className="bg-background flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center"
      role="alert"
    >
      <AlertTriangle
        className="text-destructive size-12 shrink-0"
        aria-hidden
      />
      <div className="max-w-md space-y-2">
        <h1 className="text-lg font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-muted-foreground text-sm">
          {errorMessage(error) || 'An unexpected error occurred.'}
        </p>
      </div>
      <Button type="button" onClick={() => resetErrorBoundary()}>
        Try again
      </Button>
    </div>
  )
}
