import { useContext } from 'react'
import { RoomSessionContext } from '../contexts/roomSessionContextDef'
import type { RoomSessionContextValue } from '../contexts/roomSessionContextDef'

/**
 * Consume room session data from the nearest `RoomSessionProvider`.
 * Throws if called outside a provider.
 */
export function useRoomSessionContext(): RoomSessionContextValue {
  const ctx = useContext(RoomSessionContext)
  if (!ctx) {
    throw new Error('useRoomSessionContext must be used within a RoomSessionProvider')
  }
  return ctx
}
