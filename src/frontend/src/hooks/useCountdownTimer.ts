import { useEffect, useState } from 'react'

/**
 * Returns the remaining seconds until `endsAtUtc`, updating every second.
 * Only this hook's consumers re-render on each tick — the rest of the tree is unaffected.
 *
 * Returns `null` when no countdown is active.
 */
export function useCountdownTimer(
  endsAtUtc: string | null | undefined,
  isPaused: boolean,
  remainingWhenPaused: number | null | undefined,
): number | null {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(() =>
    computeRemaining(endsAtUtc, isPaused, remainingWhenPaused ?? null),
  )

  useEffect(() => {
    setRemainingSeconds(computeRemaining(endsAtUtc, isPaused, remainingWhenPaused ?? null))

    if (isPaused || !endsAtUtc) {
      return
    }

    const intervalId = window.setInterval(() => {
      setRemainingSeconds(computeRemaining(endsAtUtc, false, null))
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [endsAtUtc, isPaused, remainingWhenPaused])

  return remainingSeconds
}

function computeRemaining(
  endsAtUtc: string | null | undefined,
  isPaused: boolean,
  remainingWhenPaused: number | null,
): number | null {
  if (!endsAtUtc) {
    return null
  }

  if (isPaused) {
    return remainingWhenPaused
  }

  const endsAtMs = Date.parse(endsAtUtc)
  if (Number.isNaN(endsAtMs)) {
    return null
  }

  return Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000))
}
