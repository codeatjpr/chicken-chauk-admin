export type ApiSuccess<T> = {
  success: true
  data?: T
  message?: string
  timestamp?: string
}

export type ApiErrorBody = {
  success: false
  statusCode: number
  code: string
  message: string
  errors?: string[]
  timestamp?: string
  path?: string
}
