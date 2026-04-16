import 'axios'

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _authRetry?: boolean
  }
}
