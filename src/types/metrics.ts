export type PlatformMetrics = {
  period: { from: string; to: string }
  orders: {
    total: number
    delivered: number
    cancelled: number
    completionRate: number
  }
  revenue: {
    gmv: number
    platformRevenue: number
  }
  users: {
    newCustomers: number
  }
  operations: {
    activeVendors: number
    onlineRiders: number
    pendingPayouts: number
  }
  today?: {
    deliveredOrders: number
    cancelledOrders: number
  }
}

export type RevenueChartPoint = {
  date: string
  revenue: number
  platformFee: number
  orders: number
}

export type TopVendorRow = {
  vendor:
    | {
        id: string
        name: string
        city: string
        rating: number
        logoUrl: string | null
      }
    | undefined
  gmv: number
  orderCount: number
}

export type OrderFunnel = {
  placed: number
  confirmed: number
  delivered: number
  cancelled: number
  refunded: number
  confirmRate: number
  deliveryRate: number
  cancelRate: number
}
