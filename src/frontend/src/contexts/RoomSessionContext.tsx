import { useMemo } from 'react'
import type { ReactNode } from 'react'
import type { RoomSnapshotDto } from '../contracts/theHatContracts'
import type { CopyState, RealtimeSyncState, RoomSessionState } from '../appModels'
import { RoomSessionContext } from './roomSessionContextDef'
import type { RoomSessionContextValue } from './roomSessionContextDef'

export type { RoomSessionContextValue } from './roomSessionContextDef'

type RoomSessionProviderProps = {
  session: RoomSessionState | null
  updateRoomSessionSnapshot: (room: RoomSnapshotDto) => void
  inviteLink: string
  copyState: CopyState
  onCopyInviteLink: () => void
  realtimeSyncState: RealtimeSyncState
  syncError: string
  isRefreshing: boolean
  onCreateRoom: () => void
  children: ReactNode
}

/**
 * Wraps descendants with room session data so they can access the current room,
 * player, invite state, sync state, and shared navigation without prop drilling.
 */
export function RoomSessionProvider({
  session,
  updateRoomSessionSnapshot,
  inviteLink,
  copyState,
  onCopyInviteLink,
  realtimeSyncState,
  syncError,
  isRefreshing,
  onCreateRoom,
  children,
}: RoomSessionProviderProps) {
  const value: RoomSessionContextValue = useMemo(
    () => ({
      room: session?.room ?? null,
      currentPlayerId: session?.currentPlayerId ?? '',
      updateRoomSessionSnapshot,
      inviteLink,
      copyState,
      onCopyInviteLink,
      realtimeSyncState,
      syncError,
      isRefreshing,
      onCreateRoom,
    }),
    [
      session,
      updateRoomSessionSnapshot,
      inviteLink,
      copyState,
      onCopyInviteLink,
      realtimeSyncState,
      syncError,
      isRefreshing,
      onCreateRoom,
    ],
  )

  return <RoomSessionContext value={value}>{children}</RoomSessionContext>
}
