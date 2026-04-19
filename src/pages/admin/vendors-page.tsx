import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import {
  approveVendor,
  listAllVendors,
  listPendingVendors,
  rejectVendor,
  reinstateVendor,
  suspendVendor,
  type VendorAdminRow,
} from "@/services/vendors-admin.service";

type ReasonMode = "reject" | "suspend" | null;

function isPendingVendor(v: VendorAdminRow) {
  return !v.isActive && !v.approvedAt && !v.suspendedAt;
}

export function VendorsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"pending" | "all">("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [suspendedOnly, setSuspendedOnly] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"any" | "true" | "false">("any");

  const [reasonMode, setReasonMode] = useState<ReasonMode>(null);
  const [reasonVendor, setReasonVendor] = useState<VendorAdminRow | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [reasonSubmitOpen, setReasonSubmitOpen] = useState(false);

  const [approveTarget, setApproveTarget] = useState<VendorAdminRow | null>(null);
  const [reinstateTarget, setReinstateTarget] = useState<VendorAdminRow | null>(null);

  const pendingQ = useQuery({
    queryKey: ["vendors-pending", page],
    queryFn: () => listPendingVendors(page, limit),
    enabled: tab === "pending",
  });

  const allQ = useQuery({
    queryKey: ["vendors-all", page, search, city, suspendedOnly, activeFilter],
    queryFn: () =>
      listAllVendors({
        page,
        limit,
        search: search.trim() || undefined,
        city: city.trim() || undefined,
        ...(suspendedOnly
          ? { suspendedOnly: true }
          : activeFilter !== "any"
            ? { isActive: activeFilter === "true" }
            : {}),
      }),
    enabled: tab === "all",
  });

  const data = tab === "pending" ? pendingQ.data : allQ.data;
  const loading = tab === "pending" ? pendingQ.isLoading : allQ.isLoading;
  const listError = tab === "pending" ? pendingQ.isError : allQ.isError;
  const listErrorMsg =
    tab === "pending"
      ? getApiErrorMessage(pendingQ.error, "Request failed")
      : getApiErrorMessage(allQ.error, "Request failed");
  const refetchList = tab === "pending" ? pendingQ.refetch : allQ.refetch;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["vendors-pending"] });
    void queryClient.invalidateQueries({ queryKey: ["vendors-all"] });
  };

  const approveMut = useMutation({
    mutationFn: approveVendor,
    onSuccess: () => {
      invalidate();
      toast.success("Vendor approved");
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Approve failed")),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectVendor(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success("Vendor rejected");
      closeReason();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Reject failed")),
  });

  const suspendMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => suspendVendor(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success("Vendor suspended");
      closeReason();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Suspend failed")),
  });

  const reinstateMut = useMutation({
    mutationFn: reinstateVendor,
    onSuccess: () => {
      invalidate();
      toast.success("Vendor reinstated");
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Reinstate failed")),
  });

  function closeReason() {
    setReasonMode(null);
    setReasonVendor(null);
    setReasonText("");
  }

  function submitReason() {
    if (!reasonVendor || !reasonMode) return;
    const r = reasonText.trim();
    if (r.length < 10) {
      toast.error("Reason must be at least 10 characters.");
      return;
    }
    if (reasonMode === "reject") rejectMut.mutate({ id: reasonVendor.id, reason: r });
    else suspendMut.mutate({ id: reasonVendor.id, reason: r });
  }

  function queueReasonSubmit() {
    if (!reasonVendor || !reasonMode) return;
    const r = reasonText.trim();
    if (r.length < 10) {
      toast.error("Reason must be at least 10 characters.");
      return;
    }
    setReasonSubmitOpen(true);
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Vendors</h1>
          <p className="text-muted-foreground text-sm">Approve new shops, suspend, or reinstate.</p>
        </div>
        <Link
          to="/admin/vendors/create"
          className={cn(buttonVariants({ size: "sm" }), "inline-flex gap-2")}>
          <UserPlus className="size-4 shrink-0" aria-hidden />
          Onboard vendor
        </Link>
      </div>

      <div className="flex gap-2 border-b pb-2">
        <Button
          type="button"
          variant={tab === "pending" ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            setTab("pending");
            setPage(1);
          }}>
          Pending approval
        </Button>
        <Button
          type="button"
          variant={tab === "all" ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            setTab("all");
            setPage(1);
          }}>
          All vendors
        </Button>
      </div>

      {tab === "all" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Input
              placeholder="Search name, phone, owner…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="max-w-xs"
            />
            <Input
              placeholder="City"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setPage(1);
              }}
              className="w-40"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={suspendedOnly}
                onChange={(e) => {
                  setSuspendedOnly(e.target.checked);
                  setPage(1);
                }}
              />
              Suspended only
            </label>
            {!suspendedOnly && (
              <select
                className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
                value={activeFilter}
                onChange={(e) => {
                  setActiveFilter(e.target.value as "any" | "true" | "false");
                  setPage(1);
                }}>
                <option value="any">Active: any</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{tab === "pending" ? "Pending vendors" : "Vendor directory"}</CardTitle>
          <CardDescription>{data ? `${data.total} total` : loading ? "Loading…" : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          {listError ? (
            <div className="border-destructive/30 bg-destructive/5 space-y-2 rounded-lg border p-4 text-sm">
              <p className="text-destructive font-medium">Could not load vendors.</p>
              <p className="text-muted-foreground">{listErrorMsg}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void refetchList()}>
                Retry
              </Button>
            </div>
          ) : loading ? (
            <Skeleton className="h-48 w-full" />
          ) : items.length === 0 ? (
            <div className="text-muted-foreground space-y-1 text-sm">
              <p>No vendors in this view.</p>
              {tab === "pending" ? (
                <p>
                  If you expected shops here, try{" "}
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => {
                      setTab("all");
                      setPage(1);
                    }}>
                    All vendors
                  </button>{" "}
                  — pending only lists shops that are not yet approved.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-border border-b">
                      <th className="pb-2 font-medium">Shop</th>
                      <th className="pb-2 font-medium">City</th>
                      <th className="pb-2 font-medium">Phone</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((v) => (
                      <tr key={v.id} className="border-border/80 border-b">
                        <td className="py-2 pr-4">
                          <div className="font-medium">{v.name}</div>
                          <div className="text-muted-foreground text-xs">{v.ownerName}</div>
                        </td>
                        <td className="py-2 pr-4">{v.city}</td>
                        <td className="py-2 pr-4">{v.phone}</td>
                        <td className="py-2 pr-4">
                          {v.suspendedAt ? (
                            <Badge variant="destructive">Suspended</Badge>
                          ) : v.isActive ? (
                            <Badge>Active</Badge>
                          ) : isPendingVendor(v) ? (
                            <Badge variant="secondary">Pending</Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Link
                              to={`/admin/vendors/${v.id}?view=1`}
                              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                              Detail
                            </Link>
                            <Link
                              to={`/admin/vendors/${v.id}`}
                              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                              Edit
                            </Link>
                            {v.isActive && !v.suspendedAt ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setReasonMode("suspend");
                                  setReasonVendor(v);
                                  setReasonText("");
                                }}>
                                Suspend
                              </Button>
                            ) : null}
                            {isPendingVendor(v) && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={approveMut.isPending}
                                  onClick={() => setApproveTarget(v)}>
                                  Approve
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setReasonMode("reject");
                                    setReasonVendor(v);
                                    setReasonText("");
                                  }}>
                                  Reject
                                </Button>
                              </>
                            )}
                            {v.suspendedAt && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={reinstateMut.isPending}
                                onClick={() => setReinstateTarget(v)}>
                                Reinstate
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data && data.totalPages > 1 && (
                <div className="text-muted-foreground mt-4 flex items-center justify-between text-sm">
                  <span>
                    Page {data.page} of {data.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!data.hasPrev}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!data.hasNext}
                      onClick={() => setPage((p) => p + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve vendor?</AlertDialogTitle>
            <AlertDialogDescription>
              Approve <strong>{approveTarget?.name}</strong> in {approveTarget?.city}? They will be able to operate as
              an active shop.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={approveMut.isPending}
              onClick={() => {
                if (!approveTarget) return;
                const id = approveTarget.id;
                setApproveTarget(null);
                approveMut.mutate(id);
              }}>
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!reinstateTarget} onOpenChange={(o) => !o && setReinstateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reinstate vendor?</AlertDialogTitle>
            <AlertDialogDescription>
              Restore <strong>{reinstateTarget?.name}</strong> ({reinstateTarget?.city}) to active status?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={reinstateMut.isPending}
              onClick={() => {
                if (!reinstateTarget) return;
                const id = reinstateTarget.id;
                setReinstateTarget(null);
                reinstateMut.mutate(id);
              }}>
              Reinstate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reasonSubmitOpen} onOpenChange={setReasonSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{reasonMode === "reject" ? "Reject this vendor?" : "Suspend this vendor?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {reasonVendor ? (
                <>
                  <strong>{reasonVendor.name}</strong> — the vendor will see your reason after you confirm.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              className={reasonMode === "suspend" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
              disabled={rejectMut.isPending || suspendMut.isPending}
              onClick={() => {
                setReasonSubmitOpen(false);
                submitReason();
              }}>
              {reasonMode === "reject" ? "Confirm reject" : "Confirm suspend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={!!reasonMode} onOpenChange={(o) => !o && closeReason()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{reasonMode === "reject" ? "Reject vendor" : "Suspend vendor"}</SheetTitle>
            <SheetDescription>Provide a clear reason (min. 10 characters). {reasonVendor?.name}</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-4">
            <Label htmlFor="reason">Reason</Label>
            <textarea
              id="reason"
              className="border-input bg-background min-h-24 w-full rounded-lg border px-2.5 py-2 text-sm"
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
            />
          </div>
          <SheetFooter className="flex-row gap-2 px-4 pb-4">
            <Button type="button" variant="outline" onClick={closeReason}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={rejectMut.isPending || suspendMut.isPending}
              variant={reasonMode === "suspend" ? "destructive" : "default"}
              onClick={() => queueReasonSubmit()}>
              Continue
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
