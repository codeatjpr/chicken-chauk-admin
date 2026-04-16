import { axiosInstance } from '@/lib/axiosInstance'
import type { ApiSuccess } from '@/types/api'

export type SearchInsights = {
  popular: { query: string; searches: number }[]
  noResults: { query: string; searches: number }[]
}

function assertData<T>(res: ApiSuccess<T>, label: string): T {
  if (!res.success || res.data === undefined) {
    throw new Error(res.message ?? label)
  }
  return res.data
}

export async function getSearchInsights(city: string, days = 7): Promise<SearchInsights> {
  const { data } = await axiosInstance.get<ApiSuccess<SearchInsights>>('/admin/search-insights', {
    params: { city, days },
  })
  return assertData(data, 'Failed to load search insights')
}
