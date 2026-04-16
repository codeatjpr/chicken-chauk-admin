import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Pencil, Plus, PowerOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  createBannerMultipart,
  deactivateBanner,
  listBanners,
  replaceBannerImage,
  updateBanner,
  type BannerLinkType,
  type BannerRow,
} from "@/services/discovery-banners.service";

const LINK_TYPES: BannerLinkType[] = ["STATIC", "VENDOR", "PRODUCT", "COUPON", "EXTERNAL"];

function toIsoFromLocal(dtLocal: string) {
  if (!dtLocal) return undefined;
  const d = new Date(dtLocal);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function localFromIso(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type SheetMode = "create" | "edit" | null;

export function BannersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const limit = 20;
  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [editRow, setEditRow] = useState<BannerRow | null>(null);

  const [title, setTitle] = useState("");
  const [linkType, setLinkType] = useState<BannerLinkType>("EXTERNAL");
  const [linkId, setLinkId] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [city, setCity] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [startsAtLocal, setStartsAtLocal] = useState("");
  const [endsAtLocal, setEndsAtLocal] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [createImage, setCreateImage] = useState<File | null>(null);

  const listQ = useQuery({
    queryKey: ["admin-banners", page],
    queryFn: () => listBanners(page, limit),
  });

  useEffect(() => {
    if (sheetMode !== "edit" || !editRow) return;
    const b = editRow;
    setTitle(b.title);
    setLinkType(b.linkType as BannerLinkType);
    setLinkId(b.linkId ?? "");
    setExternalUrl(b.externalUrl ?? "");
    setCity(b.city ?? "");
    setSortOrder(String(b.sortOrder));
    setStartsAtLocal(localFromIso(b.startsAt));
    setEndsAtLocal(localFromIso(b.endsAt));
    setIsActive(b.isActive);
    setCreateImage(null);
  }, [sheetMode, editRow]);

  function openCreate() {
    setEditRow(null);
    setSheetMode("create");
    setTitle("");
    setLinkType("EXTERNAL");
    setLinkId("");
    setExternalUrl("");
    setCity("");
    setSortOrder("0");
    setStartsAtLocal("");
    setEndsAtLocal("");
    setIsActive(true);
    setCreateImage(null);
  }

  function openEdit(row: BannerRow) {
    setEditRow(row);
    setSheetMode("edit");
  }

  function closeSheet() {
    setSheetMode(null);
    setEditRow(null);
    setCreateImage(null);
  }

  const createMut = useMutation({
    mutationFn: () => {
      if (!createImage) throw new Error("Choose an image");
      if (linkType === "STATIC") {
        return createBannerMultipart(
          { title: title.trim(), linkType: "STATIC", sortOrder: 0, isActive: true },
          createImage,
        );
      }
      return createBannerMultipart(
        {
          title: title.trim(),
          linkType,
          ...(linkType !== "EXTERNAL" && linkId.trim() ? { linkId: linkId.trim() } : {}),
          ...(linkType === "EXTERNAL" && externalUrl.trim() ? { externalUrl: externalUrl.trim() } : {}),
          ...(city.trim() ? { city: city.trim() } : {}),
          sortOrder: Number(sortOrder) || 0,
          startsAt: toIsoFromLocal(startsAtLocal),
          endsAt: toIsoFromLocal(endsAtLocal),
          isActive,
        },
        createImage,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      toast.success("Banner created");
      closeSheet();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Create failed")),
  });

  const updateMut = useMutation({
    mutationFn: () => {
      if (linkType === "STATIC") {
        return updateBanner(editRow!.id, {
          title: title.trim(),
          linkType: "STATIC",
          linkId: null,
          externalUrl: null,
        });
      }
      return updateBanner(editRow!.id, {
        title: title.trim(),
        linkType,
        linkId: linkType === "EXTERNAL" ? null : linkId.trim() || null,
        externalUrl: linkType === "EXTERNAL" ? externalUrl.trim() || null : null,
        city: city.trim() || null,
        sortOrder: Number(sortOrder) || 0,
        startsAt: startsAtLocal ? (toIsoFromLocal(startsAtLocal) ?? null) : null,
        endsAt: endsAtLocal ? (toIsoFromLocal(endsAtLocal) ?? null) : null,
        isActive,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      toast.success("Banner updated");
      closeSheet();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Update failed")),
  });

  const deactivateMut = useMutation({
    mutationFn: deactivateBanner,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      toast.success("Banner deactivated");
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Deactivate failed")),
  });

  async function onReplaceImage(row: BannerRow, file: File | null) {
    if (!file) return;
    try {
      await replaceBannerImage(row.id, file);
      void queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      toast.success("Image replaced");
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Upload failed"));
    }
  }

  const items = listQ.data?.items ?? [];
  const pr = listQ.data;

  const titleOk = title.trim().length >= 2;
  const canSubmitCreate =
    titleOk &&
    !!createImage &&
    (linkType === "STATIC" || (linkType === "EXTERNAL" ? !!externalUrl.trim() : !!linkId.trim()));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Discovery banners</h1>
          <p className="text-muted-foreground text-sm">
            Home carousel. Static = title + image only (no link). Other types use a link target and optional schedule.
          </p>
        </div>
        <Button type="button" onClick={openCreate} className="gap-2">
          <Plus className="size-4" aria-hidden />
          New banner
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Banners</CardTitle>
          <CardDescription>{pr ? `${pr.total} total` : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          {listQ.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">No banners yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-border border-b">
                      <th className="pb-2 font-medium">Preview</th>
                      <th className="pb-2 font-medium">Title</th>
                      <th className="pb-2 font-medium">Link</th>
                      <th className="pb-2 font-medium">City</th>
                      <th className="pb-2 font-medium">Sort</th>
                      <th className="pb-2 font-medium">Active</th>
                      <th className="pb-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={row.id} className="border-border/80 border-b">
                        <td className="py-2 pr-2">
                          <img src={row.imageUrl} alt="" className="h-10 w-24 rounded-md object-cover" />
                        </td>
                        <td className="py-2 pr-4 font-medium">{row.title}</td>
                        <td className="py-2 pr-4">
                          <span className="text-muted-foreground text-xs">{row.linkType}</span>
                          <p className="max-w-[10rem] truncate text-xs">
                            {row.linkType === "STATIC" ? "—" : (row.externalUrl ?? row.linkId ?? "—")}
                          </p>
                        </td>
                        <td className="py-2 pr-4">{row.city ?? "—"}</td>
                        <td className="py-2 pr-4">{row.sortOrder}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={row.isActive ? "secondary" : "outline"}>{row.isActive ? "Yes" : "No"}</Badge>
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <label className="text-muted-foreground hover:text-foreground inline-flex size-8 cursor-pointer items-center justify-center rounded-lg hover:bg-muted">
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="sr-only"
                                onChange={(e) => void onReplaceImage(row, e.target.files?.[0] ?? null)}
                              />
                              <ImagePlus className="size-3.5" />
                            </label>
                            <Button type="button" variant="ghost" size="icon-sm" onClick={() => openEdit(row)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive"
                              onClick={() => {
                                if (window.confirm("Deactivate this banner?")) deactivateMut.mutate(row.id);
                              }}>
                              <PowerOff className="size-3.5" />
                            </Button>
                          </div>
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
                      disabled={!pr.hasPrev}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!pr.hasNext}
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

      <Sheet open={sheetMode !== null} onOpenChange={(o) => !o && closeSheet()}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{sheetMode === "create" ? "New banner" : "Edit banner"}</SheetTitle>
            <SheetDescription>
              {sheetMode === "create"
                ? linkType === "STATIC"
                  ? "Static banner: image + title only (no link, city, or schedule)."
                  : "Image is required. Link type drives which field is used."
                : editRow?.id}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-4">
            {sheetMode === "create" && (
              <div className="space-y-1">
                <Label htmlFor="bn-img">Image</Label>
                <Input
                  id="bn-img"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setCreateImage(e.target.files?.[0] ?? null)}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bn-link">Link type</Label>
              <select
                id="bn-link"
                className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
                value={linkType}
                onChange={(e) => setLinkType(e.target.value as BannerLinkType)}>
                {LINK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === "STATIC" ? "Static (title + image only)" : t}
                  </option>
                ))}
              </select>
            </div>
            {linkType !== "EXTERNAL" && linkType !== "STATIC" && (
              <div className="space-y-1">
                <Label>Target ID (UUID)</Label>
                <Input className="font-mono text-xs" value={linkId} onChange={(e) => setLinkId(e.target.value)} />
              </div>
            )}
            {linkType === "EXTERNAL" && (
              <div className="space-y-1">
                <Label>External URL</Label>
                <Input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://…" />
              </div>
            )}
            {linkType !== "STATIC" && (
              <>
                <div className="space-y-1">
                  <Label>City filter (optional)</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Blank = all cities" />
                </div>
                <div className="space-y-1">
                  <Label>Sort order</Label>
                  <Input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Starts at (local)</Label>
                  <Input
                    type="datetime-local"
                    value={startsAtLocal}
                    onChange={(e) => setStartsAtLocal(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Ends at (local)</Label>
                  <Input type="datetime-local" value={endsAtLocal} onChange={(e) => setEndsAtLocal(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  Active
                </label>
              </>
            )}
            <SheetFooter className="flex-row gap-2 p-0 pt-2">
              <Button type="button" variant="outline" onClick={closeSheet}>
                Cancel
              </Button>
              {sheetMode === "create" ? (
                <Button
                  type="button"
                  disabled={createMut.isPending || !canSubmitCreate}
                  onClick={() => createMut.mutate()}>
                  Create
                </Button>
              ) : (
                <Button type="button" disabled={updateMut.isPending || !titleOk} onClick={() => updateMut.mutate()}>
                  Save
                </Button>
              )}
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
