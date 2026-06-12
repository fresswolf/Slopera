import type { SloperaApi } from '@shared/types'

declare global {
  interface Window {
    slopera: SloperaApi
  }
}

export {}
