import { useCallback, useState } from 'react'
import type { CopyState } from '../appModels'

export function useClipboard(resetDelayMs = 2000) {
  const [copyState, setCopyState] = useState<CopyState>('idle')

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setCopyState('copied')
      } catch {
        setCopyState('failed')
      }

      setTimeout(() => setCopyState('idle'), resetDelayMs)
    },
    [resetDelayMs],
  )

  const reset = useCallback(() => setCopyState('idle'), [])

  return { copyState, copy, reset }
}
