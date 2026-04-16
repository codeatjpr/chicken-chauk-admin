import axios from 'axios'
import { getApiRoot } from '@/lib/api-url'

export const axiosInstance = axios.create({
  baseURL: getApiRoot(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
  withCredentials: true,
})
