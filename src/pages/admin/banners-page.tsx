import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Pencil, Plus, PowerOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ImageUploadField } from "@/components/forms/image-upload-field";
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
  type BannerLayoutPreset,
  type BannerLinkType,
  type BannerRow,
} from "@/services/discovery-banners.service";

const LINK_TYPES: BannerLinkType[] = ["STATIC", "VENDOR", "PRODUCT", "COUPON", "EXTERNAL"];

/** Stored on the row for backwards compatibility; storefront uses 3:1 for the hero on all breakpoints. */
const HOME_HERO_DEFAULTS = {
  placement: "HERO_CAROUSEL" as const,
  layoutPreset: "RATIO_16_9" as BannerLayoutPreset,
  pageScope: "HOME" as const,
};

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
  const [createImageMobile, setCreateImageMobile] = useState<File | null>(null);
  const [createImageDesktop, setCreateImageDesktop] = useState<File | null>(null);
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editImageMobile, setEditImageMobile] = useState<File | null>(null);
  const [editImageDesktop, setEditImageDesktop] = useState<File | null>(null);
  const [isClickable, setIsClickable] = useState(true);

  const [createConfirmOpen, setCreateConfirmOpen] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<BannerRow | null>(null);

  const listQ = useQuery({
    queryKey: ["admin-banners", page],
    queryFn: () => listBanners(page, limit),
  });

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
    setCreateImageMobile(null);
    setCreateImageDesktop(null);
    setEditImage(null);
    setIsClickable(true);
  }

  function openEdit(row: BannerRow) {
    setEditRow(row);
    setTitle(row.title);
    setLinkType(row.linkType as BannerLinkType);
    setLinkId(row.linkId ?? "");
    setExternalUrl(row.externalUrl ?? "");
    setCity(row.city ?? "");
    setSortOrder(String(row.sortOrder));
    setStartsAtLocal(localFromIso(row.startsAt));
    setEndsAtLocal(localFromIso(row.endsAt));
    setIsActive(row.isActive);
    setIsClickable(row.isClickable);
    setCreateImage(null);
    setCreateImageMobile(null);
    setCreateImageDesktop(null);
    setEditImage(null);
    setEditImageMobile(null);
    setEditImageDesktop(null);
    setSheetMode("edit");
  }

  function closeSheet() {
    setSheetMode(null);
    setEditRow(null);
    setCreateImage(null);
    setCreateImageMobile(null);
    setCreateImageDesktop(null);
    setEditImage(null);
    setEditImageMobile(null);
    setEditImageDesktop(null);
  }

  const createMut = useMutation({
    mutationFn: () => {
      if (!createImage) throw new Error("Choose an image");
      const cms = { ...HOME_HERO_DEFAULTS, isClickable };
      if (linkType === "STATIC") {
        return createBannerMultipart(
          { title: title.trim(), linkType: "STATIC", sortOrder: 0, isActive: true, ...cms },
          createImage,
          { imageMobile: createImageMobile ?? undefined, imageDesktop: createImageDesktop ?? undefined },
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
          ...cms,
        },
        createImage,
        { imageMobile: createImageMobile ?? undefined, imageDesktop: createImageDesktop ?? undefined },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      toast.success("Hero slide created");
      closeSheet();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Create failed")),
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      const cms = { ...HOME_HERO_DEFAULTS, isClickable, categoryId: null as string | null };
      if (linkType === "STATIC") {
        const updated = await updateBanner(editRow!.id, {
          title: title.trim(),
          linkType: "STATIC",
          linkId: null,
          externalUrl: null,
          ...cms,
        });
        if (editImage) await replaceBannerImage(editRow!.id, editImage, "main");
        if (editImageMobile) await replaceBannerImage(editRow!.id, editImageMobile, "mobile");
        if (editImageDesktop) await replaceBannerImage(editRow!.id, editImageDesktop, "desktop");
        return updated;
      }
      const updated = await updateBanner(editRow!.id, {
        title: title.trim(),
        linkType,
        linkId: linkType === "EXTERNAL" ? null : linkId.trim() || null,
        externalUrl: linkType === "EXTERNAL" ? externalUrl.trim() || null : null,
        city: city.trim() || null,
        sortOrder: Number(sortOrder) || 0,
        startsAt: startsAtLocal ? (toIsoFromLocal(startsAtLocal) ?? null) : null,
        endsAt: endsAtLocal ? (toIsoFromLocal(endsAtLocal) ?? null) : null,
        isActive,
        ...cms,
      });
      if (editImage) await replaceBannerImage(editRow!.id, editImage, "main");
      if (editImageMobile) await replaceBannerImage(editRow!.id, editImageMobile, "mobile");
      if (editImageDesktop) await replaceBannerImage(editRow!.id, editImageDesktop, "desktop");
      return updated;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      toast.success("Hero slide updated");
      closeSheet();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Update failed")),
  });

  const deactivateMut = useMutation({
    mutationFn: deactivateBanner,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      toast.success("Hero slide deactivated");
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Deactivate failed")),
  });

  async function onReplaceImage(
    row: BannerRow,
    file: File | null,
    slot: "main" | "mobile" | "desktop" = "main",
  ) {
    if (!file) return;
    try {
      await replaceBannerImage(row.id, file, slot);
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
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Home hero carousel</h1>
          <p className="text-muted-foreground text-sm">
            Shown only on the customer home page. The on-screen frame is{" "}
            <strong className="text-foreground font-medium">3:1</strong> on phones and desktop. Upload optional{" "}
            <strong className="text-foreground font-medium">mobile</strong> and{" "}
            <strong className="text-foreground font-medium">desktop</strong> images at that ratio for different crops;
            the main image is a fallback if either is missing.
          </p>
        </div>
        <Button type="button" onClick={openCreate} className="gap-2">
          <Plus className="size-4" aria-hidden />
          New slide
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Slides</CardTitle>
          <CardDescription>
            {pr ? `${pr.total} total. ` : ""}
            Only home hero slides appear on the customer site; older placement types may remain in this list until you
            deactivate them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listQ.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">No hero slides yet.</p>
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
                          <p className="max-w-40 truncate text-xs">
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
                              onClick={() => setDeactivateTarget(row)}>
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
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{sheetMode === "create" ? "New hero slide" : "Edit hero slide"}</SheetTitle>
            <SheetDescription>
              {sheetMode === "create"
                ? linkType === "STATIC"
                  ? "Static slide: image + title only (no link, city, or schedule)."
                  : "Image is required. Link type drives which field is used."
                : editRow?.id}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-4">
            {sheetMode === "create" ? (
              <div className="space-y-2">
                <ImageUploadField
                  label="Main image (required)"
                  file={createImage}
                  onFileChange={setCreateImage}
                  accept="image/jpeg,image/png,image/webp"
                  previewClassName="w-full object-cover"
                  hint="Required — used as fallback if mobile/desktop are omitted."
                />
                <ImageUploadField
                  label="Mobile image (optional)"
                  file={createImageMobile}
                  onFileChange={setCreateImageMobile}
                  accept="image/jpeg,image/png,image/webp"
                  previewClassName="w-full object-cover"
                  hint="Target aspect 3:1 (e.g. 1200×400). Shown below the md breakpoint when set."
                />
                <ImageUploadField
                  label="Desktop image (optional)"
                  file={createImageDesktop}
                  onFileChange={setCreateImageDesktop}
                  accept="image/jpeg,image/png,image/webp"
                  previewClassName="w-full object-cover"
                  hint="Target aspect 3:1 (e.g. 2560×853). Shown from md and up when set (same ratio as mobile)."
                />
              </div>
            ) : (
              <div className="space-y-2">
                <ImageUploadField
                  label="Replace main image (optional)"
                  file={editImage}
                  onFileChange={setEditImage}
                  currentImageUrl={editRow?.imageUrl}
                  accept="image/jpeg,image/png,image/webp"
                  previewClassName="w-full object-cover"
                  hint="Default/callback asset."
                />
                <ImageUploadField
                  label="Replace mobile image (optional)"
                  file={editImageMobile}
                  onFileChange={setEditImageMobile}
                  currentImageUrl={editRow?.imageUrlMobile ?? undefined}
                  accept="image/jpeg,image/png,image/webp"
                  previewClassName="w-full object-cover"
                  hint="Target aspect 3:1."
                />
                <ImageUploadField
                  label="Replace desktop image (optional)"
                  file={editImageDesktop}
                  onFileChange={setEditImageDesktop}
                  currentImageUrl={editRow?.imageUrlDesktop ?? undefined}
                  accept="image/jpeg,image/png,image/webp"
                  previewClassName="w-full object-cover"
                  hint="Target aspect 3:1."
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isClickable} onChange={(e) => setIsClickable(e.target.checked)} />
              Clickable (if off, image is view-only; no link)
            </label>
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
                  onClick={() => setCreateConfirmOpen(true)}>
                  Create
                </Button>
              ) : (
                <Button type="button" disabled={updateMut.isPending || !titleOk} onClick={() => setSaveConfirmOpen(true)}>
                  Save
                </Button>
              )}
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={createConfirmOpen} onOpenChange={setCreateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create this hero slide?</AlertDialogTitle>
            <AlertDialogDescription>
              Title <strong>{title.trim()}</strong> · link {linkType}
              {linkType !== "STATIC" ? ` · sort ${sortOrder}` : ""}. This uploads the image and publishes on the home
              hero only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              disabled={createMut.isPending}
              onClick={() => {
                setCreateConfirmOpen(false);
                createMut.mutate();
              }}>
              Confirm create
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save hero slide changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Updates <strong>{title.trim()}</strong>
              {editImage ? " and replaces the image." : "."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              disabled={updateMut.isPending}
              onClick={() => {
                setSaveConfirmOpen(false);
                updateMut.mutate();
              }}>
              Confirm save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate hero slide?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deactivateTarget?.title}</strong> will no longer appear on the home carousel. You can add a new
              slide later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deactivateMut.isPending}
              onClick={() => {
                if (!deactivateTarget) return;
                const id = deactivateTarget.id;
                setDeactivateTarget(null);
                deactivateMut.mutate(id);
              }}>
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
