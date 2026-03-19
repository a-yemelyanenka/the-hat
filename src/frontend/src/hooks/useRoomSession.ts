import { useCallback, useEffect, useState } from 'react'
import type { RoomSnapshotDto } from '../contracts/theHatContracts'
import type { RoomSessionState } from '../appModels'

const STORAGE_KEY = 'the-hat:room-session'

function extractStoredRoomSnapshot(value: unknown): RoomSnapshotDto | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const directRoom = value as { roomId?: unknown }
  if (typeof directRoom.roomId === 'string') {
    return value as RoomSnapshotDto
  }

  const nestedRoom = value as { room?: { roomId?: unknown } }
  if (nestedRoom.room && typeof nestedRoom.room.roomId === 'string') {
    return nestedRoom.room as RoomSnapshotDto
  }

  return null
}

function extractStoredRoomSession(value: unknown): RoomSessionState | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const sessionValue = value as { room?: unknown; currentPlayerId?: unknown }
  const room = extractStoredRoomSnapshot(sessionValue.room)
  if (room && typeof sessionValue.currentPlayerId === 'string' && sessionValue.currentPlayerId.trim()) {
    return {
      room,
      currentPlayerId: sessionValue.currentPlayerId,
    }
  }

  const fallbackRoom = extractStoredRoomSnapshot(value)
  if (!fallbackRoom) {
    return null
  }

  return {
    room: fallbackRoom,
    currentPlayerId: fallbackRoom.hostPlayerId,
  }
}

function loadStoredRoomSession(): RoomSessionState | null {
  const stored = window.sessionStorage.getItem(STORAGE_KEY)

  if (!stored) {
    return null
  }

  try {
    return extractStoredRoomSession(JSON.parse(stored))
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function buildInviteLink(inviteCode: string): string {
  return `${window.location.origin}/join/${inviteCode}`
}

export function resolveCurrentPlayerId(room: RoomSnapshotDto, displayName: string): string {
  const trimmedDisplayName = displayName.trim()
  const exactMatch = room.players.find((player) => player.displayName === trimmedDisplayName)
  if (exactMatch) {
    return exactMatch.playerId
  }

  const caseInsensitiveMatch = room.players.find(
    (player) => player.displayName.trim().toLocaleUpperCase() === trimmedDisplayName.toLocaleUpperCase(),
  )

  return caseInsensitiveMatch?.playerId ?? room.hostPlayerId
}

export function useRoomSession() {
  const [roomSession, setRoomSession] = useState<RoomSessionState | null>(() => loadStoredRoomSession())

  useEffect(() => {
    if (roomSession) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(roomSession))
      return
    }

    window.sessionStorage.removeItem(STORAGE_KEY)
  }, [roomSession])

  const updateRoomSessionSnapshot = useCallback((updatedRoom: RoomSnapshotDto) => {
    setRoomSession((current) =>
      current && current.room.roomId === updatedRoom.roomId
        ? {
            ...current,
            room: updatedRoom,
          }
        : current,
    )
  }, [])

  return { roomSession, setRoomSession, updateRoomSessionSnapshot }
}
