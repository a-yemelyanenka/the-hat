import type {
  CreateRoomRequestDto,
  CreateRoomResponseDto,
  JoinRoomRequestDto,
  PlayerWordSubmissionDto,
  RoomSnapshotDto,
  StartGameRequestDto,
  SubmitWordsRequestDto,
  UpdateRoomSettingsRequestDto,
} from '../contracts/theHatContracts'
import type { ValidationProblemDetails } from '../appModels'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')

export class RoomServiceError extends Error {
  public readonly statusCode?: number
  public readonly validationProblem?: ValidationProblemDetails

  public constructor(
    message: string,
    options?: {
      statusCode?: number
      validationProblem?: ValidationProblemDetails
    },
  ) {
    super(message)
    this.name = 'RoomServiceError'
    this.statusCode = options?.statusCode
    this.validationProblem = options?.validationProblem
  }
}

export async function createRoom(request: CreateRoomRequestDto): Promise<CreateRoomResponseDto> {
  return sendJsonRequest<CreateRoomResponseDto>(getApiBaseUrl(), '/api/rooms', {
    method: 'POST',
    body: request,
    defaultErrorMessage: 'Room creation failed. Try again in a moment.',
  })
}

export async function joinRoom(inviteCode: string, request: JoinRoomRequestDto): Promise<RoomSnapshotDto> {
  return sendJsonRequest<RoomSnapshotDto>(getApiBaseUrl(), `/api/rooms/invite/${encodeURIComponent(inviteCode)}/join`, {
    method: 'POST',
    body: request,
    defaultErrorMessage: 'Joining the room failed. Try again in a moment.',
    notFoundMessage: 'This invite link is invalid or the room no longer exists.',
  })
}

export async function getRoom(roomId: string): Promise<RoomSnapshotDto> {
  return sendJsonRequest<RoomSnapshotDto>(getApiBaseUrl(), `/api/rooms/${encodeURIComponent(roomId)}`, {
    method: 'GET',
    defaultErrorMessage: 'The lobby could not be refreshed. Try again in a moment.',
    notFoundMessage: 'This room no longer exists.',
  })
}

export async function updateRoomSettings(
  roomId: string,
  request: UpdateRoomSettingsRequestDto,
): Promise<RoomSnapshotDto> {
  return sendJsonRequest<RoomSnapshotDto>(getApiBaseUrl(), `/api/rooms/${encodeURIComponent(roomId)}/settings`, {
    method: 'PUT',
    body: request,
    defaultErrorMessage: 'Saving lobby settings failed. Try again in a moment.',
    notFoundMessage: 'This room no longer exists.',
  })
}

export async function getPlayerWords(roomId: string, playerId: string): Promise<PlayerWordSubmissionDto> {
  return sendJsonRequest<PlayerWordSubmissionDto>(
    getApiBaseUrl(),
    `/api/rooms/${encodeURIComponent(roomId)}/players/${encodeURIComponent(playerId)}/words`,
    {
      method: 'GET',
      defaultErrorMessage: 'Loading your submitted words failed. Try again in a moment.',
      notFoundMessage: 'This room no longer exists.',
    },
  )
}

export async function submitWords(roomId: string, request: SubmitWordsRequestDto): Promise<RoomSnapshotDto> {
  return sendJsonRequest<RoomSnapshotDto>(getApiBaseUrl(), `/api/rooms/${encodeURIComponent(roomId)}/words`, {
    method: 'PUT',
    body: request,
    defaultErrorMessage: 'Saving your words failed. Try again in a moment.',
    notFoundMessage: 'This room no longer exists.',
  })
}

export async function startGame(roomId: string, request: StartGameRequestDto): Promise<RoomSnapshotDto> {
  return sendJsonRequest<RoomSnapshotDto>(getApiBaseUrl(), `/api/rooms/${encodeURIComponent(roomId)}/start`, {
    method: 'POST',
    body: request,
    defaultErrorMessage: 'Starting the game failed. Try again in a moment.',
    notFoundMessage: 'This room no longer exists.',
  })
}

type JsonRequestOptions = {
  method: 'GET' | 'POST' | 'PUT'
  body?: unknown
  defaultErrorMessage: string
  notFoundMessage?: string
}

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new RoomServiceError('VITE_API_BASE_URL is not configured.')
  }

  return API_BASE_URL
}

async function sendJsonRequest<T>(apiBaseUrl: string, path: string, options: JsonRequestOptions): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method,
      headers: options.body
        ? {
            'Content-Type': 'application/json',
          }
        : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new RoomServiceError('Could not reach the backend. Check that the API is running.')
  }

  const contentType = response.headers.get('content-type') ?? ''
  const hasJsonBody = contentType.includes('application/json')
  const responseBody = hasJsonBody ? ((await response.json()) as unknown) : null

  if (!response.ok) {
    if (response.status === 400) {
      throw new RoomServiceError('Validation failed.', {
        statusCode: response.status,
        validationProblem: responseBody as ValidationProblemDetails,
      })
    }

    if (response.status === 404) {
      throw new RoomServiceError(options.notFoundMessage ?? 'The requested room could not be found.', {
        statusCode: response.status,
      })
    }

    throw new RoomServiceError(options.defaultErrorMessage, {
      statusCode: response.status,
    })
  }

  return responseBody as T
}
