import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RoomSnapshotDto } from '../contracts/theHatContracts'
import { RoomServiceError } from '../services/roomsService'
import { getFirstProblemMessage } from '../localization'

export type GameplayActionResult = {
  execute: (
    action: () => Promise<RoomSnapshotDto>,
    onSuccess: (room: RoomSnapshotDto) => void,
    fallbackErrorKey: string,
  ) => Promise<void>
  isPending: boolean
  error: string
  clearError: () => void
}

export function useGameplayAction(): GameplayActionResult {
  const { t } = useTranslation()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState('')

  const execute = useCallback(
    async (
      action: () => Promise<RoomSnapshotDto>,
      onSuccess: (room: RoomSnapshotDto) => void,
      fallbackErrorKey: string,
    ) => {
      setIsPending(true)
      setError('')

      try {
        const updatedRoom = await action()
        onSuccess(updatedRoom)
      } catch (err) {
        if (err instanceof RoomServiceError) {
          setError(
            err.validationProblem
              ? getFirstProblemMessage(t, err.validationProblem)
              : err.message,
          )
          return
        }

        setError(t(fallbackErrorKey))
      } finally {
        setIsPending(false)
      }
    },
    [t],
  )

  const clearError = useCallback(() => setError(''), [])

  return { execute, isPending, error, clearError }
}
