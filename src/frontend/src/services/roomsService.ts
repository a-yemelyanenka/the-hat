import type {
  ConfirmGuessRequestDto,
  ContinueRoundRequestDto,
  CreateRoomRequestDto,
  CreateRoomResponseDto,
  EndTurnRequestDto,
  GameplayViewDto,
  JoinRoomRequestDto,
  PauseGameRequestDto,
  PlayerWordSubmissionDto,
  RejoinRoomRequestDto,
  ResumeGameRequestDto,
  RoomSnapshotDto,
  StartGameRequestDto,
  StartTurnRequestDto,
  SubmitWordsRequestDto,
  UpdateRoomSettingsRequestDto,
} from '../contracts/theHatContracts'
import type { ValidationProblemDetails } from '../appModels'
import i18n from '../i18n'

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

export function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new RoomServiceError(i18n.t('serviceErrors.apiBaseUrlMissing'))
  }

  return API_BASE_URL
}

export async function createRoom(request: CreateRoomRequestDto): Promise<CreateRoomResponseDto> {
  return sendJsonRequest<CreateRoomResponseDto>(getApiBaseUrl(), '/api/rooms', {
    method: 'POST',
    body: request,
    defaultErrorMessage: i18n.t('serviceErrors.createRoomFailed'),
  })
}

export async function joinRoom(inviteCode: string, request: JoinRoomRequestDto): Promise<RoomSnapshotDto> {
  return sendJsonRequest<RoomSnapshotDto>(getApiBaseUrl(), `/api/rooms/invite/${encodeURIComponent(inviteCode)}/join`, {
    method: 'POST',
    body: request,
    defaultErrorMessage: i18n.t('serviceErrors.joinRoomFailed'),
    notFoundMessage: i18n.t('serviceErrors.invalidInvite'),
  })
}

export async function rejoinRoom(inviteCode: string, request: RejoinRoomRequestDto): Promise<RoomSnapshotDto> {
  return sendJsonRequest<RoomSnapshotDto>(
    getApiBaseUrl(),
    `/api/rooms/invite/${encodeURIComponent(inviteCode)}/rejoin`,
    {
      method: 'POST',
      body: request,
      defaultErrorMessage: i18n.t('serviceErrors.rejoinRoomFailed'),
      notFoundMessage: i18n.t('serviceErrors.invalidInvite'),
    },
  )
}

export async function getRoom(roomId: string): Promise<RoomSnapshotDto> {
  return sendJsonRequest<RoomSnapshotDto>(getApiBaseUrl(), `/api/rooms/${encodeURIComponent(roomId)}`, {
    method: 'GET',
    defaultErrorMessage: i18n.t('serviceErrors.lobbyRefreshFailed'),
    notFoundMessage: i18n.t('serviceErrors.roomNotFound'),
  })
}

export async function updateRoomSettings(
  roomId: string,
  request: UpdateRoomSettingsRequestDto,
): Promise<RoomSnapshotDto> {
  return sendJsonRequest<RoomSnapshotDto>(getApiBaseUrl(), `/api/rooms/${encodeURIComponent(roomId)}/settings`, {
    method: 'PUT',
    body: request,
    defaultErrorMessage: i18n.t('app.saveSettingsFallback'),
    notFoundMessage: i18n.t('serviceErrors.roomNotFound'),
  })
}

export async function getPlayerWords(roomId: string, playerId: string): Promise<PlayerWordSubmissionDto> {
  return sendJsonRequest<PlayerWordSubmissionDto>(
    getApiBaseUrl(),
    `/api/rooms/${encodeURIComponent(roomId)}/players/${encodeURIComponent(playerId)}/words`,
    {
      method: 'GET',
      defaultErrorMessage: i18n.t('serviceErrors.loadWordsFailed'),
      notFoundMessage: i18n.t('serviceErrors.roomNotFound'),
    },
  )
}

export async function submitWords(roomId: string, request: SubmitWordsRequestDto): Promise<RoomSnapshotDto> {
  return sendJsonRequest<RoomSnapshotDto>(getApiBaseUrl(), `/api/rooms/${encodeURIComponent(roomId)}/words`, {
    method: 'PUT',
    body: request,
    defaultErrorMessage: i18n.t('serviceErrors.saveWordsFailed'),
    notFoundMessage: i18n.t('serviceErrors.roomNotFound'),
  })
}

export async function startGame(roomId: string, request: StartGameRequestDto): Promise<RoomSnapshotDto> {
  return sendJsonRequest<RoomSnapshotDto>(getApiBaseUrl(), `/api/rooms/${encodeURIComponent(roomId)}/start`, {
    method: 'POST',
    body: request,
    defaultErrorMessage: i18n.t('serviceErrors.startGameFailed'),
    notFoundMessage: i18n.t('serviceErrors.roomNotFound'),
  })
}

export async function startTurn(roomId: string, request: StartTurnRequestDto): Promise<RoomSnapshotDto> {
  return sendJsonRequest<RoomSnapshotDto>(getApiBaseUrl(), `/api/rooms/${encodeURIComponent(roomId)}/gameplay/start-turn`, {
    method: 'POST',
    body: request,
    defaultErrorMessage: i18n.t('serviceErrors.startTurnFailed'),
    notFoundMessage: i18n.t('serviceErrors.roomNotFound'),
  })
}

export async function getGameplayView(roomId: string, playerId: string): Promise<GameplayViewDto> {
  return sendJsonRequest<GameplayViewDto>(
    getApiBaseUrl(),
    `/api/rooms/${encodeURIComponent(roomId)}/gameplay?playerId=${encodeURIComponent(playerId)}`,
    {
      method: 'GET',
      defaultErrorMessage: i18n.t('serviceErrors.loadGameplayFailed'),
      notFoundMessage: i18n.t('serviceErrors.roomNotFound'),
    },
  )
}

export async function confirmGuess(roomId: string, request: ConfirmGuessRequestDto): Promise<RoomSnapshotDto> {
  return sendJsonRequest<RoomSnapshotDto>(
    getApiBaseUrl(),
    `/api/rooms/${encodeURIComponent(roomId)}/gameplay/guesses/confirm`,
    {
      method: 'POST',
      body: request,
      defaultErrorMessage: i18n.t('serviceErrors.confirmGuessFailed'),
      notFoundMessage: i18n.t('serviceErrors.roomNotFound'),
    },
  )
}

export async function endTurn(roomId: string, request: EndTurnRequestDto): Promise<RoomSnapshotDto> {
  return sendJsonRequest<RoomSnapshotDto>(
    getApiBaseUrl(),
    `/api/rooms/${encodeURIComponent(roomId)}/gameplay/end-turn`,
    {
      method: 'POST',
      body: request,
      defaultErrorMessage: i18n.t('serviceErrors.endTurnFailed'),
      notFoundMessage: i18n.t('serviceErrors.roomNotFound'),
    },
  )
}

export async function pauseGame(roomId: string, request: PauseGameRequestDto): Promise<RoomSnapshotDto> {
  return sendJsonRequest<RoomSnapshotDto>(
    getApiBaseUrl(),
    `/api/rooms/${encodeURIComponent(roomId)}/gameplay/pause`,
    {
      method: 'POST',
      body: request,
      defaultErrorMessage: i18n.t('serviceErrors.pauseGameFailed'),
      notFoundMessage: i18n.t('serviceErrors.roomNotFound'),
    },
  )
}

export async function resumeGame(roomId: string, request: ResumeGameRequestDto): Promise<RoomSnapshotDto> {
  return sendJsonRequest<RoomSnapshotDto>(
    getApiBaseUrl(),
    `/api/rooms/${encodeURIComponent(roomId)}/gameplay/resume`,
    {
      method: 'POST',
      body: request,
      defaultErrorMessage: i18n.t('serviceErrors.resumeGameFailed'),
      notFoundMessage: i18n.t('serviceErrors.roomNotFound'),
    },
  )
}

export async function continueRound(roomId: string, request: ContinueRoundRequestDto): Promise<RoomSnapshotDto> {
  return sendJsonRequest<RoomSnapshotDto>(
    getApiBaseUrl(),
    `/api/rooms/${encodeURIComponent(roomId)}/gameplay/continue`,
    {
      method: 'POST',
      body: request,
      defaultErrorMessage: i18n.t('serviceErrors.continueRoundFailed'),
      notFoundMessage: i18n.t('serviceErrors.roomNotFound'),
    },
  )
}

type JsonRequestOptions = {
  method: 'GET' | 'POST' | 'PUT'
  body?: unknown
  defaultErrorMessage: string
  notFoundMessage?: string
}

function isJsonResponse(contentType: string): boolean {
  const normalizedContentType = contentType.toLowerCase()
  return normalizedContentType.includes('application/json') || normalizedContentType.includes('+json')
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
    throw new RoomServiceError(i18n.t('serviceErrors.backendUnavailable'))
  }

  const contentType = response.headers.get('content-type') ?? ''
  const hasJsonBody = isJsonResponse(contentType)
  const responseBody = hasJsonBody ? ((await response.json()) as unknown) : null

  if (!response.ok) {
    if (response.status === 400) {
      throw new RoomServiceError(i18n.t('serviceErrors.validationFailed'), {
        statusCode: response.status,
        validationProblem: responseBody as ValidationProblemDetails,
      })
    }

    if (response.status === 404) {
      throw new RoomServiceError(options.notFoundMessage ?? i18n.t('serviceErrors.roomNotFoundGeneric'), {
        statusCode: response.status,
      })
    }

    throw new RoomServiceError(options.defaultErrorMessage, {
      statusCode: response.status,
    })
  }

  return responseBody as T
}
