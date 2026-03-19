import { createContext } from 'react'
import type { RoomSnapshotDto } from '../contracts/theHatContracts'
import type { CopyState, RealtimeSyncState } from '../appModels'

/** Values provided to descendant components through RoomSessionContext. */
export type RoomSessionContextValue = {
  /** The current room snapshot, or null when no session is active. */
  room: RoomSnapshotDto | null
  /** The player ID for the current user, or empty string when unknown. */
  currentPlayerId: string
  /** Push an updated room snapshot into the session. */
  updateRoomSessionSnapshot: (room: RoomSnapshotDto) => void

  /** Full invite link for the current room. */
  inviteLink: string
  /** Current clipboard copy state. */
  copyState: CopyState
  /** Copy the invite link to clipboard. */
  onCopyInviteLink: () => void

  /** Realtime / fallback sync state. */
  realtimeSyncState: RealtimeSyncState
  /** Sync error message, if any. */
  syncError: string
  /** Whether the room data is being refreshed. */
  isRefreshing: boolean

  /** Navigate to the create-room screen. */
  onCreateRoom: () => void
}

export const RoomSessionContext = createContext<RoomSessionContextValue | undefined>(undefined)
