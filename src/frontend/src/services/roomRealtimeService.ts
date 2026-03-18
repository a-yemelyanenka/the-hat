import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import type { HubConnection } from '@microsoft/signalr'
import type { RoomSnapshotDto } from '../contracts/theHatContracts'
import { RoomServiceError } from './roomsService'

const ROOM_HUB_PATH = '/hubs/rooms'
const ROOM_UPDATED_EVENT = 'roomUpdated'
const SUBSCRIBE_METHOD = 'SubscribeToRoom'
const UNSUBSCRIBE_METHOD = 'UnsubscribeFromRoom'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')

export type RoomRealtimeConnection = {
  stop: () => Promise<void>
}

type CreateRoomRealtimeConnectionOptions = {
  roomId: string
  playerId?: string
  onRoomUpdated: (room: RoomSnapshotDto) => void
  onReconnecting: () => void
  onReconnected: () => void
  onClosed: () => void
}

export async function createRoomRealtimeConnection(
  options: CreateRoomRealtimeConnectionOptions,
): Promise<RoomRealtimeConnection> {
  const connection = new HubConnectionBuilder()
    .withUrl(`${getApiBaseUrl()}${ROOM_HUB_PATH}`, {
      withCredentials: true,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000])
    .configureLogging(LogLevel.Warning)
    .build()

  connection.on(ROOM_UPDATED_EVENT, (room: RoomSnapshotDto) => {
    options.onRoomUpdated(room)
  })

  connection.onreconnecting(() => {
    options.onReconnecting()
  })

  connection.onreconnected(async () => {
    try {
      await subscribeToRoom(connection, options.roomId, options.playerId)
      options.onReconnected()
    } catch {
      options.onClosed()
    }
  })

  connection.onclose(() => {
    options.onClosed()
  })

  try {
    await connection.start()
    await subscribeToRoom(connection, options.roomId, options.playerId)
  } catch {
    await safeStop(connection)
    throw new RoomServiceError('Realtime updates are unavailable right now.')
  }

  return {
    stop: async () => {
      try {
        await unsubscribeFromRoom(connection, options.roomId)
      } finally {
        await safeStop(connection)
      }
    },
  }
}

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new RoomServiceError('VITE_API_BASE_URL is not configured.')
  }

  return API_BASE_URL
}

async function subscribeToRoom(connection: HubConnection, roomId: string, playerId?: string): Promise<void> {
  await connection.invoke(SUBSCRIBE_METHOD, roomId, playerId ?? null)
}

async function unsubscribeFromRoom(connection: HubConnection, roomId: string): Promise<void> {
  if (connection.state !== 'Connected') {
    return
  }

  try {
    await connection.invoke(UNSUBSCRIBE_METHOD, roomId)
  } catch {
    // Ignore unsubscribe failures during teardown.
  }
}

async function safeStop(connection: HubConnection): Promise<void> {
  if (connection.state === 'Disconnected') {
    return
  }

  try {
    await connection.stop()
  } catch {
    // Ignore connection shutdown failures during cleanup.
  }
}