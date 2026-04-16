import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getApiErrorMessage } from '@/lib/api-error'
import { adminResetPassword } from '@/services/admin-auth.service'

const schema = z
  .object({
    password: z.string().min(8, 'At least 8 characters'),
    confirm: z.string().min(1, 'Confirm your password'),
  })
  .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] })

type FormValues = z.infer<typeof schema>

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  })

  async function onSubmit(values: FormValues) {
    if (!token) {
      toast.error('Missing reset token in URL.')
      return
    }
    try {
      await adminResetPassword(token, values.password)
      toast.success('Password updated. You can sign in.')
      navigate('/admin/login', { replace: true })
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Reset failed'))
    }
  }

  return (
    <div className="bg-muted/30 flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>New password</CardTitle>
          <CardDescription>Choose a strong password for your admin account.</CardDescription>
        </CardHeader>
        <CardContent>
          {!token && (
            <p className="text-destructive mb-4 text-sm">
              This link is invalid. Open the link from your email again.
            </p>
          )}
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((v) => void onSubmit(v))}
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} />
              {form.formState.errors.password && (
                <p className="text-destructive text-xs">{form.formState.errors.password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" autoComplete="new-password" {...form.register('confirm')} />
              {form.formState.errors.confirm && (
                <p className="text-destructive text-xs">{form.formState.errors.confirm.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting || !token}>
              {form.formState.isSubmitting ? 'Saving…' : 'Update password'}
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              <Link to="/admin/login" className="text-primary underline-offset-4 hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
