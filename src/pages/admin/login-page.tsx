import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getApiErrorMessage } from '@/lib/api-error'
import { adminLogin } from '@/services/admin-auth.service'
import { useAdminAuthStore } from '@/stores/admin-auth-store'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean(),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const location = useLocation()
  const accessToken = useAdminAuthStore((s) => s.accessToken)
  const user = useAdminAuthStore((s) => s.user)
  const setSession = useAdminAuthStore((s) => s.setSession)

  const state = location.state as { from?: string } | undefined
  const from =
    state?.from && state.from.startsWith('/admin') ? state.from : '/admin'

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  })

  if (accessToken && user?.role === 'ADMIN') {
    return <Navigate to={from} replace />
  }

  async function onSubmit(values: LoginForm) {
    try {
      const res = await adminLogin(values.email, values.password, values.rememberMe)
      setSession(res.accessToken, res.user)
      toast.success('Signed in')
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Sign in failed'))
    }
  }

  return (
    <div className="bg-muted/30 flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin sign in</CardTitle>
          <CardDescription>Use your admin email and password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((v) => void onSubmit(v))}
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!form.formState.errors.email}
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="text-destructive text-xs">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!form.formState.errors.password}
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <p className="text-destructive text-xs">{form.formState.errors.password.message}</p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 rounded border" {...form.register('rememberMe')} />
              Remember this device
            </label>
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              <Link to="/admin/forgot-password" className="text-primary underline-offset-4 hover:underline">
                Forgot password?
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
