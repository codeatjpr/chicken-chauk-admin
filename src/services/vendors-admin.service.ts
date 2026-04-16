import { adminPostFormData } from "@/lib/admin-multipart";
import { axiosInstance } from "@/lib/axiosInstance";
import type { ApiSuccess } from "@/types/api";
import type { PaginatedResult } from "@/types/pagination";

function assertData<T>(res: ApiSuccess<T>, label: string): T {
  if (!res.success || res.data === undefined) {
    throw new Error(res.message ?? label);
  }
  return res.data;
}

export type VendorAdminRow = {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  email: string | null;
  city: string;
  isActive: boolean;
  isOpen?: boolean;
  approvedAt: string | null;
  suspendedAt: string | null;
  createdAt: string;
  documents?: unknown[];
};

export async function listPendingVendors(page = 1, limit = 20): Promise<PaginatedResult<VendorAdminRow>> {
  const { data } = await axiosInstance.get<ApiSuccess<PaginatedResult<VendorAdminRow>>>("/vendors/admin/pending", {
    params: { page, limit },
  });
  return assertData(data, "Failed to load pending vendors");
}

export async function listAllVendors(params: {
  page?: number;
  limit?: number;
  isActive?: boolean;
  suspendedOnly?: boolean;
  city?: string;
  search?: string;
}): Promise<PaginatedResult<VendorAdminRow>> {
  const { data } = await axiosInstance.get<ApiSuccess<PaginatedResult<VendorAdminRow>>>("/vendors/admin/all", {
    params: {
      ...params,
      ...(params.isActive !== undefined && { isActive: params.isActive ? "true" : "false" }),
      ...(params.suspendedOnly !== undefined && {
        suspendedOnly: params.suspendedOnly ? "true" : "false",
      }),
    },
  });
  return assertData(data, "Failed to load vendors");
}

export async function approveVendor(id: string): Promise<void> {
  const { data } = await axiosInstance.patch<ApiSuccess<null>>(`/vendors/admin/${id}/approve`);
  if (!data.success) throw new Error(data.message ?? "Approve failed");
}

export async function rejectVendor(id: string, reason: string): Promise<void> {
  const { data } = await axiosInstance.patch<ApiSuccess<null>>(`/vendors/admin/${id}/reject`, {
    reason,
  });
  if (!data.success) throw new Error(data.message ?? "Reject failed");
}

export async function suspendVendor(id: string, reason: string): Promise<void> {
  const { data } = await axiosInstance.patch<ApiSuccess<null>>(`/vendors/admin/${id}/suspend`, {
    reason,
  });
  if (!data.success) throw new Error(data.message ?? "Suspend failed");
}

export async function reinstateVendor(id: string): Promise<void> {
  const { data } = await axiosInstance.patch<ApiSuccess<null>>(`/vendors/admin/${id}/reinstate`);
  if (!data.success) throw new Error(data.message ?? "Reinstate failed");
}

export type VendorDocumentRow = {
  id: string;
  type: string;
  documentUrl: string;
  status: string;
  rejectionReason: string | null;
  uploadedAt: string;
  verifiedAt: string | null;
};

export type VendorTimingRow = {
  id: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
};

export type VendorBankDetailRow = {
  id: string;
  accountHolderName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  bankName: string | null;
  upiId: string | null;
  isVerified: boolean;
  createdAt: string;
};

export type VendorAdminDetail = {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  email: string | null;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  addressLine: string;
  city: string;
  pincode: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  isOpen: boolean;
  approvedAt: string | null;
  suspendedAt: string | null;
  prepTime: number;
  minOrderAmount: number;
  deliveryRadiusKm: number;
  commissionPercent: number;
  createdAt: string;
  updatedAt: string;
  documents: VendorDocumentRow[];
  timings: VendorTimingRow[];
  bankDetails: VendorBankDetailRow | null;
};

export async function getVendorAdminDetail(id: string): Promise<VendorAdminDetail> {
  const { data } = await axiosInstance.get<ApiSuccess<VendorAdminDetail>>(`/vendors/admin/${id}`);
  return assertData(data, "Failed to load vendor");
}

export async function adminApproveVendorDocument(vendorId: string, documentId: string): Promise<VendorDocumentRow> {
  const { data } = await axiosInstance.patch<ApiSuccess<VendorDocumentRow>>(
    `/vendors/admin/${vendorId}/documents/${documentId}/approve`,
  );
  return assertData(data, "Failed to approve document");
}

export async function adminRejectVendorDocument(
  vendorId: string,
  documentId: string,
  reason: string,
): Promise<VendorDocumentRow> {
  const { data } = await axiosInstance.patch<ApiSuccess<VendorDocumentRow>>(
    `/vendors/admin/${vendorId}/documents/${documentId}/reject`,
    { reason },
  );
  return assertData(data, "Failed to reject document");
}

export async function adminVerifyVendorBank(vendorId: string): Promise<VendorBankDetailRow> {
  const { data } = await axiosInstance.patch<ApiSuccess<VendorBankDetailRow>>(
    `/vendors/admin/${vendorId}/bank-details/verify`,
  );
  return assertData(data, "Failed to verify bank details");
}

export async function adminUnverifyVendorBank(vendorId: string): Promise<VendorBankDetailRow> {
  const { data } = await axiosInstance.patch<ApiSuccess<VendorBankDetailRow>>(
    `/vendors/admin/${vendorId}/bank-details/unverify`,
  );
  return assertData(data, "Failed to remove bank verification");
}

export type AdminCreateVendorBody = {
  name: string;
  ownerName: string;
  phone: string;
  email?: string;
  description?: string;
  addressLine: string;
  city: string;
  pincode: string;
  latitude: number;
  longitude: number;
  prepTime?: number;
  minOrderAmount?: number;
  deliveryRadiusKm?: number;
  password: string;
};

export type VendorCreatedRow = {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  email: string | null;
  city: string;
  isActive: boolean;
};

export async function adminCreateVendorOnboarding(body: AdminCreateVendorBody): Promise<VendorCreatedRow> {
  const { data } = await axiosInstance.post<ApiSuccess<VendorCreatedRow>>("/vendors/admin/onboarding", body);
  return assertData(data, "Failed to create vendor");
}

export type VendorTimingInput = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
};

export async function adminUploadVendorOnboardingDocument(
  vendorId: string,
  docType: string,
  file: File,
): Promise<{ id: string; type: string; documentUrl: string; status: string }> {
  const fd = new FormData();
  fd.append("document", file);
  fd.append("type", docType);
  return adminPostFormData(`/vendors/admin/onboarding/${vendorId}/documents`, fd);
}

export async function adminSetVendorOnboardingTimings(
  vendorId: string,
  timings: VendorTimingInput[],
): Promise<void> {
  const { data } = await axiosInstance.put<ApiSuccess<null>>(`/vendors/admin/onboarding/${vendorId}/timings`, {
    timings,
  });
  if (!data.success) throw new Error(data.message ?? "Failed to save timings");
}

export async function adminSetVendorOnboardingBank(
  vendorId: string,
  body: {
    accountHolderName?: string;
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
    upiId?: string;
  },
): Promise<unknown> {
  const { data } = await axiosInstance.put<ApiSuccess<unknown>>(
    `/vendors/admin/onboarding/${vendorId}/bank-details`,
    body,
  );
  return assertData(data, "Failed to save bank details");
}

export async function adminPatchVendorOnboardingProfile(
  vendorId: string,
  body: Partial<{
    name: string;
    ownerName: string;
    email: string;
    description: string;
    logoUrl: string;
    bannerUrl: string;
    addressLine: string;
    city: string;
    pincode: string;
    latitude: number;
    longitude: number;
    prepTime: number;
    minOrderAmount: number;
    deliveryRadiusKm: number;
  }>,
): Promise<unknown> {
  const { data } = await axiosInstance.put<ApiSuccess<unknown>>(
    `/vendors/admin/onboarding/${vendorId}/profile`,
    body,
  );
  return assertData(data, "Failed to update profile");
}
