import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { CreateRoomPage } from './components/CreateRoomPage'
import { HomePage } from './components/HomePage'
import { JoinRoomPage } from './components/JoinRoomPage'
import { LobbyPage } from './components/LobbyPage'
import type {
  CreateRoomRequestDto,
  JoinRoomRequestDto,
  RoomSnapshotDto,
} from './contracts/theHatContracts'
import { createRoom, getRoom, joinRoom, RoomServiceError, startGame, updateRoomSettings } from './services/roomsService'
import type {
  CopyState,
  CreateRoomFormState,
  LobbySettingsFormState,
  FieldErrors,
  Route,
  RoomSessionState,
  ValidationProblemDetails,
} from './appModels'
import { defaultFormState } from './appModels'

const STORAGE_KEY = 'the-hat:room-session'
const LOBBY_REFRESH_INTERVAL_MS = 3000

function getRoute(pathname: string): Route {
  if (pathname === '/create-room') {
    return { name: 'create-room' }
  }

  const joinMatch = pathname.match(/^\/join\/([^/]+)\/?$/)
  if (joinMatch) {
    return { name: 'join-room', inviteCode: joinMatch[1] }
  }

  const lobbyMatch = pathname.match(/^\/rooms\/([^/]+)\/lobby\/?$/)
  if (lobbyMatch) {
    return { name: 'lobby', roomId: lobbyMatch[1] }
  }

  return { name: 'home' }
}

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

function buildInviteLink(inviteCode: string): string {
  return `${window.location.origin}/join/${inviteCode}`
}

function resolveCurrentPlayerId(room: RoomSnapshotDto, displayName: string): string {
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

function getFirstProblemMessage(problem: ValidationProblemDetails): string {
  const firstMessage = Object.values(problem.errors ?? {}).flat()[0]
  return firstMessage ?? problem.title ?? 'The request could not be completed.'
}

function App() {
  const [route, setRoute] = useState<Route>(() => getRoute(window.location.pathname))
  const [formState, setFormState] = useState<CreateRoomFormState>(defaultFormState)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [roomSession, setRoomSession] = useState<RoomSessionState | null>(() => loadStoredRoomSession())
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [joinDisplayName, setJoinDisplayName] = useState('')
  const [joinFieldError, setJoinFieldError] = useState('')
  const [joinServerError, setJoinServerError] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [isLobbyRefreshing, setIsLobbyRefreshing] = useState(false)
  const [lobbySyncError, setLobbySyncError] = useState('')
  const [isSavingLobbySettings, setIsSavingLobbySettings] = useState(false)
  const [lobbySettingsError, setLobbySettingsError] = useState('')
  const [lobbySettingsSuccess, setLobbySettingsSuccess] = useState('')
  const [isStartingGame, setIsStartingGame] = useState(false)
  const [lobbyStartError, setLobbyStartError] = useState('')

  useEffect(() => {
    const handlePopState = () => {
      setRoute(getRoute(window.location.pathname))
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (roomSession) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(roomSession))
      return
    }

    window.sessionStorage.removeItem(STORAGE_KEY)
  }, [roomSession])

  const lobbySession = useMemo(() => {
    if (route.name !== 'lobby' || !roomSession) {
      return null
    }

    return roomSession.room.roomId === route.roomId ? roomSession : null
  }, [roomSession, route])

  const lobbyRoomId = lobbySession?.room.roomId ?? null

  useEffect(() => {
    if (!lobbyRoomId) {
      setIsLobbyRefreshing(false)
      setLobbySyncError('')
      return
    }

    let isDisposed = false

    const refreshLobby = async (backgroundRefresh: boolean) => {
      if (!backgroundRefresh) {
        setIsLobbyRefreshing(true)
      }

      try {
        const refreshedRoom = await getRoom(lobbyRoomId)
        if (isDisposed) {
          return
        }

        setRoomSession((current) => {
          if (!current || current.room.roomId !== refreshedRoom.roomId) {
            return current
          }

          return {
            ...current,
            room: refreshedRoom,
          }
        })
        setLobbySyncError('')
      } catch (error) {
        if (isDisposed) {
          return
        }

        if (error instanceof RoomServiceError) {
          setLobbySyncError(error.message)
        } else {
          setLobbySyncError('The lobby could not be refreshed. Try again in a moment.')
        }
      } finally {
        if (!isDisposed && !backgroundRefresh) {
          setIsLobbyRefreshing(false)
        }
      }
    }

    void refreshLobby(false)
    const intervalId = window.setInterval(() => {
      void refreshLobby(true)
    }, LOBBY_REFRESH_INTERVAL_MS)

    return () => {
      isDisposed = true
      window.clearInterval(intervalId)
    }
  }, [lobbyRoomId])

  const navigate = (nextPath: string) => {
    window.history.pushState({}, '', nextPath)
    setRoute(getRoute(nextPath))
  }

  const updateFormState = (updater: (current: CreateRoomFormState) => CreateRoomFormState) => {
    setFormState(updater)
  }

  const validateForm = (): FieldErrors => {
    const nextErrors: FieldErrors = {}

    if (!formState.hostDisplayName.trim()) {
      nextErrors.hostDisplayName = 'Enter your display name.'
    }

    const wordsPerPlayer = Number(formState.wordsPerPlayer)
    if (!Number.isInteger(wordsPerPlayer) || wordsPerPlayer <= 0) {
      nextErrors.wordsPerPlayer = 'Choose a whole number greater than zero.'
    }

    const turnDurationSeconds = Number(formState.turnDurationSeconds)
    if (!Number.isInteger(turnDurationSeconds) || turnDurationSeconds <= 0) {
      nextErrors.turnDurationSeconds = 'Choose a whole number greater than zero.'
    }

    return nextErrors
  }

  const applyValidationProblem = (problem: ValidationProblemDetails) => {
    const nextErrors: FieldErrors = {}

    for (const [key, messages] of Object.entries(problem.errors ?? {})) {
      const normalizedKey = key.toLowerCase()
      const message = messages[0] ?? 'Invalid value.'

      if (normalizedKey === 'hostdisplayname') {
        nextErrors.hostDisplayName = message
      } else if (normalizedKey === 'settings.wordsperplayer') {
        nextErrors.wordsPerPlayer = message
      } else if (normalizedKey === 'settings.turndurationseconds') {
        nextErrors.turnDurationSeconds = message
      }
    }

    setFieldErrors(nextErrors)
    setServerError(problem.title && Object.keys(nextErrors).length === 0 ? problem.title : '')
  }

  const applyJoinValidationProblem = (problem: ValidationProblemDetails) => {
    const message = Object.entries(problem.errors ?? {}).find(([key]) => key.toLowerCase() === 'displayname')?.[1]?.[0]

    setJoinFieldError(message ?? '')
    setJoinServerError(problem.title && !message ? problem.title : '')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors = validateForm()
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      setServerError('')
      return
    }

    setIsSubmitting(true)
    setFieldErrors({})
    setServerError('')
    setCopyState('idle')

    const payload: CreateRoomRequestDto = {
      hostDisplayName: formState.hostDisplayName.trim(),
      settings: {
        wordsPerPlayer: Number(formState.wordsPerPlayer),
        turnDurationSeconds: Number(formState.turnDurationSeconds),
        playerOrderMode: formState.playerOrderMode,
      },
    }

    try {
      const result = await createRoom(payload)
      setRoomSession({
        room: result.room,
        currentPlayerId: result.room.hostPlayerId,
      })
      navigate(`/rooms/${result.room.roomId}/lobby`)
    } catch (error) {
      if (error instanceof RoomServiceError) {
        if (error.validationProblem) {
          applyValidationProblem(error.validationProblem)
          return
        }

        setServerError(error.message)
        return
      }

      setServerError('Room creation failed. Try again in a moment.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleJoinSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (route.name !== 'join-room') {
      return
    }

    if (!joinDisplayName.trim()) {
      setJoinFieldError('Enter your display name.')
      setJoinServerError('')
      return
    }

    setIsJoining(true)
    setJoinFieldError('')
    setJoinServerError('')
    setCopyState('idle')

    const payload: JoinRoomRequestDto = {
      displayName: joinDisplayName.trim(),
    }

    try {
      const result = await joinRoom(route.inviteCode, payload)
      setRoomSession({
        room: result,
        currentPlayerId: resolveCurrentPlayerId(result, payload.displayName),
      })
      navigate(`/rooms/${result.roomId}/lobby`)
    } catch (error) {
      if (error instanceof RoomServiceError) {
        if (error.validationProblem) {
          applyJoinValidationProblem(error.validationProblem)
          return
        }

        setJoinServerError(error.message)
        return
      }

      setJoinServerError('Joining the room failed. Try again in a moment.')
    } finally {
      setIsJoining(false)
    }
  }

  const copyInviteLink = async () => {
    if (!lobbySession) {
      return
    }

    try {
      await navigator.clipboard.writeText(buildInviteLink(lobbySession.room.inviteCode))
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  const handleSaveLobbySettings = async (
    nextSettings: LobbySettingsFormState,
    orderedPlayerIds?: string[],
  ): Promise<boolean> => {
    if (!lobbySession) {
      return false
    }

    setIsSavingLobbySettings(true)
    setLobbySettingsError('')
    setLobbySettingsSuccess('')
    setLobbyStartError('')

    try {
      const updatedRoom = await updateRoomSettings(lobbySession.room.roomId, {
        hostPlayerId: lobbySession.currentPlayerId,
        settings: {
          wordsPerPlayer: Number(nextSettings.wordsPerPlayer),
          turnDurationSeconds: Number(nextSettings.turnDurationSeconds),
          playerOrderMode: nextSettings.playerOrderMode,
        },
        orderedPlayerIds,
      })

      setRoomSession((current) =>
        current && current.room.roomId === updatedRoom.roomId
          ? {
              ...current,
              room: updatedRoom,
            }
          : current,
      )
      setLobbySettingsSuccess('Lobby settings saved.')
      return true
    } catch (error) {
      if (error instanceof RoomServiceError) {
        setLobbySettingsError(error.validationProblem ? getFirstProblemMessage(error.validationProblem) : error.message)
        return false
      }

      setLobbySettingsError('Saving lobby settings failed. Try again in a moment.')
      return false
    } finally {
      setIsSavingLobbySettings(false)
    }
  }

  const handleStartGame = async (): Promise<void> => {
    if (!lobbySession) {
      return
    }

    setIsStartingGame(true)
    setLobbyStartError('')
    setLobbySettingsSuccess('')

    try {
      const updatedRoom = await startGame(lobbySession.room.roomId, {
        hostPlayerId: lobbySession.currentPlayerId,
      })

      setRoomSession((current) =>
        current && current.room.roomId === updatedRoom.roomId
          ? {
              ...current,
              room: updatedRoom,
            }
          : current,
      )
    } catch (error) {
      if (error instanceof RoomServiceError) {
        setLobbyStartError(error.validationProblem ? getFirstProblemMessage(error.validationProblem) : error.message)
        return
      }

      setLobbyStartError('Starting the game failed. Try again in a moment.')
    } finally {
      setIsStartingGame(false)
    }
  }

  if (route.name === 'create-room') {
    return (
      <CreateRoomPage
        formState={formState}
        fieldErrors={fieldErrors}
        serverError={serverError}
        isSubmitting={isSubmitting}
        onBack={() => navigate('/')}
        onSubmit={handleSubmit}
        onHostDisplayNameChange={(value) => updateFormState((current) => ({ ...current, hostDisplayName: value }))}
        onWordsPerPlayerChange={(value) => updateFormState((current) => ({ ...current, wordsPerPlayer: value }))}
        onTurnDurationSecondsChange={(value) =>
          updateFormState((current) => ({ ...current, turnDurationSeconds: value }))
        }
        onPlayerOrderModeChange={(value) => updateFormState((current) => ({ ...current, playerOrderMode: value }))}
      />
    )
  }

  if (route.name === 'join-room') {
    return (
      <JoinRoomPage
        inviteCode={route.inviteCode}
        displayName={joinDisplayName}
        fieldError={joinFieldError}
        serverError={joinServerError}
        isSubmitting={isJoining}
        onBack={() => navigate('/')}
        onSubmit={handleJoinSubmit}
        onDisplayNameChange={setJoinDisplayName}
      />
    )
  }

  if (route.name === 'lobby') {
    return (
      <LobbyPage
        session={lobbySession}
        inviteLink={lobbySession ? buildInviteLink(lobbySession.room.inviteCode) : ''}
        copyState={copyState}
        syncError={lobbySyncError}
        isRefreshing={isLobbyRefreshing}
        isSavingSettings={isSavingLobbySettings}
        settingsError={lobbySettingsError}
        settingsSuccess={lobbySettingsSuccess}
        isStartingGame={isStartingGame}
        startError={lobbyStartError}
        onCopyInviteLink={copyInviteLink}
        onCreateRoom={() => navigate('/create-room')}
        onSaveSettings={handleSaveLobbySettings}
        onStartGame={handleStartGame}
      />
    )
  }

  return <HomePage onCreateRoom={() => navigate('/create-room')} />
}

export default App
