import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { LocationPinMap } from "@/components/maps/location-pin-map";
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
import { vendorFormPatchFromLocation } from "@/lib/vendor-location-prefill";
import { cn } from "@/lib/utils";
import {
  adminApproveVendorDocument,
  adminPatchVendorOnboardingProfile,
  adminRejectVendorDocument,
  adminSetVendorOnboardingBank,
  adminSetVendorOnboardingTimings,
  adminUploadVendorBanner,
  adminUploadVendorLogo,
  adminUnverifyVendorBank,
  adminVerifyVendorBank,
  getVendorAdminDetail,
  type VendorAdminDetail,
  type VendorDocumentRow,
  type VendorTimingInput,
} from "@/services/vendors-admin.service";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DOC_LABELS: Record<string, string> = {
  FSSAI: "FSSAI",
  GST: "GST",
  PAN: "PAN",
  TRADE_LICENSE: "Trade license",
  BANK_STATEMENT: "Bank statement",
};

type Tab = "overview" | "hours" | "bank" | "documents";

function timingsFromVendor(v: VendorAdminDetail): VendorTimingInput[] {
  const t = v.timings
    .slice()
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .map((x) => ({
      dayOfWeek: x.dayOfWeek,
      openTime: x.openTime,
      closeTime: x.closeTime,
      isClosed: x.isClosed,
    }));
  if (t.length === 7) return t;
  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    const found = v.timings.find((d) => d.dayOfWeek === dayOfWeek);
    return (
      found ?? {
        dayOfWeek,
        openTime: "09:00",
        closeTime: "22:00",
        isClosed: false,
      }
    );
  });
}

export function VendorAdminDetailPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isViewOnly = searchParams.get("view") === "1";

  const detailQ = useQuery({
    queryKey: ["vendor-admin-detail", vendorId],
    queryFn: () => getVendorAdminDetail(vendorId!),
    enabled: !!vendorId,
  });

  if (!vendorId) {
    return <p className="text-muted-foreground text-sm">Invalid vendor.</p>;
  }

  if (detailQ.isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (detailQ.isError || !detailQ.data) {
    return (
      <div className="space-y-4">
        <p className="text-destructive text-sm">Could not load vendor.</p>
        <Button type="button" variant="outline" onClick={() => navigate("/admin/vendors")}>
          Back to vendors
        </Button>
      </div>
    );
  }

  return (
    <VendorAdminDetailLoaded
      key={vendorId}
      vendorId={vendorId}
      vendor={detailQ.data}
      isViewOnly={isViewOnly}
    />
  );
}

function VendorAdminDetailLoaded({
  vendorId,
  vendor: v,
  isViewOnly,
}: {
  vendorId: string;
  vendor: VendorAdminDetail;
  isViewOnly: boolean;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");

  const [name, setName] = useState(v.name);
  const [ownerName, setOwnerName] = useState(v.ownerName);
  const [email, setEmail] = useState(v.email ?? "");
  const [description, setDescription] = useState(v.description ?? "");
  const [addressLine, setAddressLine] = useState(v.addressLine);
  const [city, setCity] = useState(v.city);
  const [pincode, setPincode] = useState(v.pincode);
  const [latitude, setLatitude] = useState(String(v.latitude));
  const [longitude, setLongitude] = useState(String(v.longitude));
  const [prepTime, setPrepTime] = useState(String(v.prepTime));
  const [minOrderAmount, setMinOrderAmount] = useState(String(v.minOrderAmount));
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState(String(v.deliveryRadiusKm));
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  const [timings, setTimings] = useState<VendorTimingInput[]>(() => timingsFromVendor(v));
  const [bankHolder, setBankHolder] = useState(() => v.bankDetails?.accountHolderName ?? "");
  const [bankNumber, setBankNumber] = useState(() => v.bankDetails?.accountNumber ?? "");
  const [bankIfsc, setBankIfsc] = useState(() => v.bankDetails?.ifscCode ?? "");
  const [bankName, setBankName] = useState(() => v.bankDetails?.bankName ?? "");
  const [bankUpi, setBankUpi] = useState(() => v.bankDetails?.upiId ?? "");

  const [rejectDoc, setRejectDoc] = useState<VendorDocumentRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const actionRunRef = useRef<(() => void) | null>(null);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    destructive?: boolean;
  }>({ open: false, title: "", description: "" });

  function requestActionConfirm(opts: {
    title: string;
    description: string;
    destructive?: boolean;
    run: () => void;
  }) {
    actionRunRef.current = opts.run;
    setActionDialog({
      open: true,
      title: opts.title,
      description: opts.description,
      destructive: opts.destructive,
    });
  }

  function flushActionConfirm() {
    const run = actionRunRef.current;
    actionRunRef.current = null;
    setActionDialog((s) => ({ ...s, open: false }));
    run?.();
  }

  const invalidateLists = () => {
    void queryClient.invalidateQueries({ queryKey: ["vendors-pending"] });
    void queryClient.invalidateQueries({ queryKey: ["vendors-all"] });
    void queryClient.invalidateQueries({ queryKey: ["vendor-admin-detail", vendorId] });
  };

  const saveProfileMut = useMutation({
    mutationFn: async () => {
      if (!vendorId) return;
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) throw new Error("Latitude and longitude must be valid numbers.");
      await adminPatchVendorOnboardingProfile(vendorId, {
        name: name.trim(),
        ownerName: ownerName.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
        description: description.trim() || undefined,
        addressLine: addressLine.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
        latitude: lat,
        longitude: lng,
        prepTime: Number(prepTime) || 20,
        minOrderAmount: Number(minOrderAmount) || 0,
        deliveryRadiusKm: Number(deliveryRadiusKm) || 3,
      });
      if (logoFile) await adminUploadVendorLogo(vendorId, logoFile);
      if (bannerFile) await adminUploadVendorBanner(vendorId, bannerFile);
    },
    onSuccess: () => {
      invalidateLists();
      setLogoFile(null);
      setBannerFile(null);
      toast.success("Profile saved");
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Save failed")),
  });

  const saveHoursMut = useMutation({
    mutationFn: async () => {
      if (!vendorId) throw new Error("Missing vendor");
      if (timings.length !== 7) throw new Error("Need 7 days of hours.");
      await adminSetVendorOnboardingTimings(vendorId, timings);
    },
    onSuccess: () => {
      invalidateLists();
      toast.success("Hours saved");
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Save failed")),
  });

  const approveDocMut = useMutation({
    mutationFn: (documentId: string) => adminApproveVendorDocument(vendorId!, documentId),
    onSuccess: () => {
      invalidateLists();
      toast.success("Document approved");
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Approve failed")),
  });

  const rejectDocMut = useMutation({
    mutationFn: ({ documentId, reason }: { documentId: string; reason: string }) =>
      adminRejectVendorDocument(vendorId!, documentId, reason),
    onSuccess: () => {
      invalidateLists();
      setRejectDoc(null);
      setRejectReason("");
      toast.success("Document rejected");
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Reject failed")),
  });

  const verifyBankMut = useMutation({
    mutationFn: () => adminVerifyVendorBank(vendorId!),
    onSuccess: () => {
      invalidateLists();
      toast.success("Bank / UPI marked verified");
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Verify failed")),
  });

  const unverifyBankMut = useMutation({
    mutationFn: () => adminUnverifyVendorBank(vendorId!),
    onSuccess: () => {
      invalidateLists();
      toast.success("Bank verification removed");
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Update failed")),
  });

  const saveBankMut = useMutation({
    mutationFn: async () => {
      if (!vendorId) throw new Error("Missing vendor");
      const upi = bankUpi.trim();
      const hasUpi = upi.length > 0;
      const hasAnyBank = !!(bankHolder.trim() || bankNumber.trim() || bankIfsc.trim() || bankName.trim());
      const hasFullBank = !!(
        bankHolder.trim() &&
        bankNumber.replace(/\s/g, "").length >= 9 &&
        bankIfsc.trim() &&
        bankName.trim()
      );
      if (!hasUpi && !hasFullBank) {
        throw new Error("Enter UPI and/or complete bank fields.");
      }
      if (hasAnyBank && !hasFullBank) {
        throw new Error("If using bank, fill all four bank fields.");
      }
      const ifsc = bankIfsc.trim().toUpperCase();
      if (hasFullBank && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw new Error("Invalid IFSC.");
      if (hasFullBank && !/^\d{9,18}$/.test(bankNumber.replace(/\s/g, ""))) {
        throw new Error("Invalid account number.");
      }
      if (hasUpi && !/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]*$/.test(upi)) {
        throw new Error("Invalid UPI.");
      }
      await adminSetVendorOnboardingBank(vendorId, {
        ...(hasFullBank
          ? {
              accountHolderName: bankHolder.trim(),
              accountNumber: bankNumber.replace(/\s/g, ""),
              ifscCode: ifsc,
              bankName: bankName.trim(),
            }
          : {}),
        ...(hasUpi ? { upiId: upi } : {}),
      });
    },
    onSuccess: () => {
      invalidateLists();
      toast.success("Payout details saved");
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Save failed")),
  });

  function updateTiming(day: number, patch: Partial<VendorTimingInput>) {
    setTimings((prev) => prev.map((t) => (t.dayOfWeek === day ? { ...t, ...patch } : t)));
  }

  const editHref = `/admin/vendors/${vendorId}`;
  const detailHref = `/admin/vendors/${vendorId}?view=1`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/admin/vendors"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex gap-1")}>
            <ArrowLeft className="size-4" aria-hidden />
            Vendors
          </Link>
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{v.name}</h1>
            <p className="text-muted-foreground text-sm">
              {v.city} · {v.phone} · {v.isActive ? "Active" : v.suspendedAt ? "Suspended" : "Inactive"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isViewOnly ? (
            <Link to={editHref} className={cn(buttonVariants({ size: "sm" }))}>
              Edit vendor
            </Link>
          ) : (
            <Link to={detailHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Detail only
            </Link>
          )}
        </div>
      </div>

      {isViewOnly ? (
        <p className="text-muted-foreground bg-muted/40 rounded-lg border px-3 py-2 text-sm">
          Read-only detail (from Vendors list → Detail). Profile, hours, and bank cannot be changed here; you can
          still verify bank and review documents.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1 border-b pb-2">
        {(
          [
            ["overview", "Overview"],
            ["hours", "Hours"],
            ["bank", "Bank / UPI"],
            ["documents", "Documents"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={tab === id ? "default" : "outline"}
            onClick={() => setTab(id)}>
            {label}
          </Button>
        ))}
      </div>

      {tab === "overview" && (
        <Card>
          <CardHeader>
            <CardTitle>Shop profile</CardTitle>
            <CardDescription>
              {isViewOnly
                ? "Read-only snapshot. Phone is tied to login."
                : "Edit details and save. Phone is tied to login and cannot be changed here."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Phone (read-only)</Label>
              <Input value={v.phone} disabled className="bg-muted mt-1" />
            </div>
            <Field label="Shop name" value={name} onChange={setName} className="sm:col-span-2" disabled={isViewOnly} />
            <Field label="Owner name" value={ownerName} onChange={setOwnerName} disabled={isViewOnly} />
            <Field label="Email" value={email} onChange={setEmail} type="email" disabled={isViewOnly} />
            <div className="sm:col-span-2">
              <LocationPinMap
                latitude={latitude}
                longitude={longitude}
                readOnly={isViewOnly}
                initialSelectedSummary={
                  [addressLine, city, pincode].filter((s) => s.trim().length > 0).join(", ") || ""
                }
                onPick={(la, lo) => {
                  setLatitude(la.toFixed(6));
                  setLongitude(lo.toFixed(6));
                }}
                onResolvedPlace={
                  isViewOnly
                    ? undefined
                    : (sel) => {
                        const p = vendorFormPatchFromLocation(sel);
                        if (p.addressLine) setAddressLine(p.addressLine);
                        if (p.city) setCity(p.city);
                        if (p.pincode) setPincode(p.pincode);
                      }
                }
              />
            </div>
            <Field label="Address" value={addressLine} onChange={setAddressLine} className="sm:col-span-2" disabled={isViewOnly} />
            <Field label="City" value={city} onChange={setCity} disabled={isViewOnly} />
            <Field label="PIN" value={pincode} onChange={setPincode} disabled={isViewOnly} />
            <Field label="Prep (min)" value={prepTime} onChange={setPrepTime} disabled={isViewOnly} />
            <Field label="Min order (₹)" value={minOrderAmount} onChange={setMinOrderAmount} disabled={isViewOnly} />
            <Field label="Delivery radius (km)" value={deliveryRadiusKm} onChange={setDeliveryRadiusKm} disabled={isViewOnly} />
            <Field label="Description" value={description} onChange={setDescription} className="sm:col-span-2" disabled={isViewOnly} />
            <ImageUploadField
              label="Logo image"
              file={logoFile}
              onFileChange={setLogoFile}
              currentImageUrl={v.logoUrl}
              className="sm:col-span-2"
              previewClassName="w-full"
              disabled={isViewOnly}
              hint={isViewOnly ? undefined : "Upload a new logo file to replace the existing one."}
              emptyLabel="No logo uploaded"
            />
            <ImageUploadField
              label="Banner image"
              file={bannerFile}
              onFileChange={setBannerFile}
              currentImageUrl={v.bannerUrl}
              className="sm:col-span-2"
              previewClassName="w-full"
              disabled={isViewOnly}
              hint={isViewOnly ? undefined : "Upload a new banner file to replace the existing one."}
              emptyLabel="No banner uploaded"
            />
            {!isViewOnly ? (
              <div className="flex justify-end sm:col-span-2">
                <Button
                  type="button"
                  disabled={saveProfileMut.isPending}
                  onClick={() =>
                    requestActionConfirm({
                      title: "Save profile?",
                      description: "Updates shop details on file and uploads a new logo or banner if you selected files.",
                      run: () => saveProfileMut.mutate(),
                    })
                  }>
                  {saveProfileMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Save profile"}
                </Button>
              </div>
            ) : null}
            <div className="text-muted-foreground border-border/80 border-t pt-4 sm:col-span-2">
              <p className="text-foreground mb-2 text-xs font-medium">Read-only</p>
              <dl className="grid gap-2 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Commission %</dt>
                  <dd>{v.commissionPercent}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Open now (computed)</dt>
                  <dd>{v.isOpen ? "Yes" : "No"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Approved</dt>
                  <dd>{v.approvedAt ? new Date(v.approvedAt).toLocaleString() : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Suspended</dt>
                  <dd>{v.suspendedAt ? new Date(v.suspendedAt).toLocaleString() : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Created</dt>
                  <dd>{new Date(v.createdAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Updated</dt>
                  <dd>{new Date(v.updatedAt).toLocaleString()}</dd>
                </div>
              </dl>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "hours" && (
        <Card>
          <CardHeader>
            <CardTitle>Operating hours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {timings.map((t) => (
              <div
                key={t.dayOfWeek}
                className="flex flex-wrap items-end gap-2 border-b border-border/60 pb-3 last:border-0">
                <span className="text-muted-foreground w-10 text-sm font-medium">{DAY_NAMES[t.dayOfWeek]}</span>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={t.isClosed}
                    disabled={isViewOnly}
                    onChange={(e) => updateTiming(t.dayOfWeek, { isClosed: e.target.checked })}
                  />
                  Closed
                </label>
                {!t.isClosed && (
                  <>
                    <Input
                      className="w-28 font-mono text-sm"
                      value={t.openTime}
                      disabled={isViewOnly}
                      onChange={(e) => updateTiming(t.dayOfWeek, { openTime: e.target.value })}
                    />
                    <Input
                      className="w-28 font-mono text-sm"
                      value={t.closeTime}
                      disabled={isViewOnly}
                      onChange={(e) => updateTiming(t.dayOfWeek, { closeTime: e.target.value })}
                    />
                  </>
                )}
              </div>
            ))}
            {!isViewOnly ? (
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  disabled={saveHoursMut.isPending}
                  onClick={() =>
                    requestActionConfirm({
                      title: "Save operating hours?",
                      description: "Replaces the weekly schedule shown to customers.",
                      run: () => saveHoursMut.mutate(),
                    })
                  }>
                  {saveHoursMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Save hours"}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {tab === "bank" && (
        <Card>
          <CardHeader>
            <CardTitle>Bank & UPI</CardTitle>
            <CardDescription>
              {isViewOnly
                ? "Saved payout details (read-only). Use Verify after you have checked them against your records."
                : "UPI, full bank account, or both. Saving may clear verification if values change."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isViewOnly && v.bankDetails && bankRowHasPayout(v.bankDetails) ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {v.bankDetails.isVerified ? (
                    <Badge className="text-xs">Verified</Badge>
                  ) : (
                    <Badge variant="secondary">Not verified</Badge>
                  )}
                </div>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <BankReadRow label="UPI ID" value={v.bankDetails.upiId ?? "—"} />
                  <BankReadRow label="Account holder" value={v.bankDetails.accountHolderName ?? "—"} />
                  <BankReadRow label="Account number" value={maskBankAccount(v.bankDetails.accountNumber)} />
                  <BankReadRow label="IFSC" value={v.bankDetails.ifscCode ?? "—"} />
                  <BankReadRow label="Bank name" value={v.bankDetails.bankName ?? "—"} className="sm:col-span-2" />
                </dl>
                <div className="flex flex-wrap gap-2">
                  {!v.bankDetails.isVerified ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={verifyBankMut.isPending || unverifyBankMut.isPending}
                      onClick={() =>
                        requestActionConfirm({
                          title: "Verify bank details?",
                          description: "Mark payout details as verified after you have checked them against your records.",
                          run: () => verifyBankMut.mutate(),
                        })
                      }>
                      {verifyBankMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Verify"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={verifyBankMut.isPending || unverifyBankMut.isPending}
                      onClick={() =>
                        requestActionConfirm({
                          title: "Remove bank verification?",
                          description: "Clears the verified flag so you can re-check details later.",
                          destructive: true,
                          run: () => unverifyBankMut.mutate(),
                        })
                      }>
                      {unverifyBankMut.isPending ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        "Remove verification"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ) : null}

            {isViewOnly && (!v.bankDetails || !bankRowHasPayout(v.bankDetails)) ? (
              <p className="text-muted-foreground text-sm">No payout method on file yet.</p>
            ) : null}

            {!isViewOnly ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="UPI ID" value={bankUpi} onChange={setBankUpi} placeholder="shop@paytm" className="sm:col-span-2" />
                <p className="text-muted-foreground sm:col-span-2 text-xs font-medium">Bank (optional if UPI set)</p>
                <Field label="Account holder" value={bankHolder} onChange={setBankHolder} className="sm:col-span-2" />
                <Field label="Account number" value={bankNumber} onChange={setBankNumber} className="sm:col-span-2" />
                <Field label="IFSC" value={bankIfsc} onChange={setBankIfsc} />
                <Field label="Bank name" value={bankName} onChange={setBankName} />
                <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {v.bankDetails && bankRowHasPayout(v.bankDetails) ? (
                      !v.bankDetails.isVerified ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={verifyBankMut.isPending || unverifyBankMut.isPending}
                          onClick={() =>
                            requestActionConfirm({
                              title: "Verify bank details?",
                              description: "Mark payout details as verified after you have checked them against your records.",
                              run: () => verifyBankMut.mutate(),
                            })
                          }>
                          {verifyBankMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Verify"}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={verifyBankMut.isPending || unverifyBankMut.isPending}
                          onClick={() =>
                            requestActionConfirm({
                              title: "Remove bank verification?",
                              description: "Clears the verified flag so you can re-check details later.",
                              destructive: true,
                              run: () => unverifyBankMut.mutate(),
                            })
                          }>
                          {unverifyBankMut.isPending ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                          ) : (
                            "Remove verification"
                          )}
                        </Button>
                      )
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    disabled={saveBankMut.isPending}
                    onClick={() =>
                      requestActionConfirm({
                        title: "Save payout details?",
                        description: "Updates UPI / bank fields. Saving changed values may clear verification.",
                        run: () => saveBankMut.mutate(),
                      })
                    }>
                    {saveBankMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Save payout details"}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {tab === "documents" && (
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              Review uploads. Approve when valid, or reject with a reason (min. 10 characters) for the vendor to see.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {v.documents.length === 0 ? (
              <p className="text-muted-foreground text-sm">No documents on file.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {v.documents.map((d) => (
                  <li key={d.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{DOC_LABELS[d.type] ?? d.type}</span>
                        <DocumentStatusBadge status={d.status} />
                      </div>
                      {d.status === "REJECTED" && d.rejectionReason ? (
                        <p className="text-muted-foreground text-xs">
                          Reason: <span className="text-foreground">{d.rejectionReason}</span>
                        </p>
                      ) : null}
                      {d.verifiedAt ? (
                        <p className="text-muted-foreground text-xs">Verified {new Date(d.verifiedAt).toLocaleString()}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={d.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary text-xs underline">
                        View file
                      </a>
                      {d.status === "PENDING" ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            disabled={approveDocMut.isPending || rejectDocMut.isPending}
                            onClick={() =>
                              requestActionConfirm({
                                title: "Approve document?",
                                description: `Mark ${DOC_LABELS[d.type] ?? d.type} as verified for this vendor.`,
                                run: () => approveDocMut.mutate(d.id),
                              })
                            }>
                            {approveDocMut.isPending ? (
                              <Loader2 className="size-4 animate-spin" aria-hidden />
                            ) : (
                              "Approve"
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={approveDocMut.isPending || rejectDocMut.isPending}
                            onClick={() => {
                              setRejectDoc(d);
                              setRejectReason("");
                            }}>
                            Reject
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={actionDialog.open}
        onOpenChange={(o) => {
          if (!o) {
            actionRunRef.current = null;
            setActionDialog((s) => ({ ...s, open: false }));
          }
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{actionDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{actionDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                actionDialog.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined
              }
              onClick={() => flushActionConfirm()}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet
        open={!!rejectDoc}
        onOpenChange={(open) => {
          if (!open) {
            setRejectDoc(null);
            setRejectReason("");
          }
        }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Reject document</SheetTitle>
            <SheetDescription>
              {rejectDoc ? `${DOC_LABELS[rejectDoc.type] ?? rejectDoc.type} — explain what is wrong (min. 10 characters).` : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-4">
            <Label htmlFor="doc-reject-reason">Reason</Label>
            <textarea
              id="doc-reject-reason"
              className="border-input bg-background min-h-24 w-full rounded-lg border px-2.5 py-2 text-sm"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. FSSAI number not readable — please upload a clearer scan."
            />
          </div>
          <SheetFooter className="flex-row gap-2 px-4 pb-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectDoc(null);
                setRejectReason("");
              }}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={rejectDocMut.isPending || !rejectDoc}
              onClick={() => {
                if (!rejectDoc) return;
                const r = rejectReason.trim();
                if (r.length < 10) {
                  toast.error("Reason must be at least 10 characters.");
                  return;
                }
                const documentId = rejectDoc.id;
                requestActionConfirm({
                  title: "Reject document?",
                  description: `The vendor will see your reason for ${DOC_LABELS[rejectDoc.type] ?? rejectDoc.type}.`,
                  destructive: true,
                  run: () => {
                    rejectDocMut.mutate({ documentId, reason: r });
                    setRejectDoc(null);
                    setRejectReason("");
                  },
                });
              }}>
              {rejectDocMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Continue"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function bankRowHasPayout(b: {
  upiId: string | null;
  accountHolderName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  bankName: string | null;
}): boolean {
  const upi = b.upiId?.trim();
  if (upi) return true;
  return !!(b.accountHolderName && b.accountNumber && b.ifscCode && b.bankName);
}

function maskBankAccount(num: string | null | undefined): string {
  if (!num || !/\d/.test(num)) return "—";
  const d = num.replace(/\s/g, "");
  if (d.length <= 4) return "****";
  return `****${d.slice(-4)}`;
}

function BankReadRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function DocumentStatusBadge({ status }: { status: string }) {
  if (status === "APPROVED") return <Badge className="text-xs">Approved</Badge>;
  if (status === "REJECTED") return <Badge variant="destructive">Rejected</Badge>;
  return (
    <Badge variant="secondary" className="text-xs">
      Pending
    </Badge>
  );
}

function Field({
  label,
  value,
  onChange,
  className,
  type = "text",
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("mt-1", disabled && "bg-muted")}
      />
    </div>
  );
}
