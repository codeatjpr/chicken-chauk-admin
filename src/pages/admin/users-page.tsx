import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { getApiErrorMessage } from '@/lib/api-error'
import {
  listAdminUsers,
  reinstateUser,
  suspendUser,
  type AdminUserRow,
} from '@/services/users-admin.service'

const ROLES = ['CUSTOMER', 'VENDOR', 'RIDER', 'ADMIN'] as const

export function UsersPage() {
  const queryClient = useQueryClient()
  const [role, setRole] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const listQ = useQuery({
    queryKey: ['admin-users', page, role, search],
    queryFn: () =>
      listAdminUsers({
        page,
        limit,
        role: role || undefined,
        search: search.trim() || undefined,
      }),
  })

  const suspendMut = useMutation({
    mutationFn: suspendUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('User suspended')
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Suspend failed')),
  })

  const reinstateMut = useMutation({
    mutationFn: reinstateUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('User reinstated')
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Reinstate failed')),
  })

  const items = listQ.data?.items ?? []
  const pr = listQ.data
  const hasPrev = pr ? pr.page > 1 : false
  const hasNext = pr ? pr.page < pr.totalPages : false

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-muted-foreground text-sm">
          Search by phone, name, or email. Admins cannot be suspended from this screen.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <Label htmlFor="u-role">Role</Label>
            <select
              id="u-role"
              className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
              value={role}
              onChange={(e) => {
                setRole(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Any</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[14rem] flex-1 space-y-1">
            <Label htmlFor="u-search">Search</Label>
            <Input
              id="u-search"
              placeholder="Phone, name, email…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardDescription>{pr ? `${pr.total} users` : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {listQ.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">No users match.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-border border-b">
                      <th className="pb-2 font-medium">Joined</th>
                      <th className="pb-2 font-medium">Phone</th>
                      <th className="pb-2 font-medium">Name</th>
                      <th className="pb-2 font-medium">Role</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row: AdminUserRow) => (
                      <tr key={row.id} className="border-border/80 border-b">
                        <td className="text-muted-foreground py-2 pr-4 whitespace-nowrap">
                          {new Date(row.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2 pr-4">{row.phone}</td>
                        <td className="py-2 pr-4">{row.name ?? '—'}</td>
                        <td className="py-2 pr-4">
                          <Badge variant="outline">{row.role}</Badge>
                        </td>
                        <td className="py-2 pr-4">
                          {row.isActive ? (
                            <Badge variant="secondary">Active</Badge>
                          ) : (
                            <Badge variant="destructive">Suspended</Badge>
                          )}
                        </td>
                        <td className="py-2">
                          {row.role !== 'ADMIN' && (
                            <div className="flex gap-1">
                              {row.isActive ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={suspendMut.isPending}
                                  onClick={() => suspendMut.mutate(row.id)}
                                >
                                  Suspend
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={reinstateMut.isPending}
                                  onClick={() => reinstateMut.mutate(row.id)}
                                >
                                  Reinstate
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pr && pr.totalPages > 1 && (
                <div className="text-muted-foreground mt-4 flex items-center justify-between text-sm">
                  <span>
                    Page {pr.page} of {pr.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!hasPrev}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!hasNext}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
