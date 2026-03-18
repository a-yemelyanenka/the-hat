import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { CreateRoomPage } from './components/CreateRoomPage'
import { GameplayPage } from './components/GameplayPage'
import { HomePage } from './components/HomePage'
import { JoinRoomPage } from './components/JoinRoomPage'
import { LobbyPage } from './components/LobbyPage'
import type {
  CreateRoomRequestDto,
  GameplayViewDto,
  JoinRoomRequestDto,
  RoomSnapshotDto,
} from './contracts/theHatContracts'
import { createRoomRealtimeConnection } from './services/roomRealtimeService'
import {
  confirmGuess,
  continueRound,
  createRoom,
  getGameplayView,
  getRoom,
  joinRoom,
  pauseGame,
  rejoinRoom,
  resumeGame,
  RoomServiceError,
  startGame,
  updateRoomSettings,
} from './services/roomsService'
import type {
  CopyState,
  CreateRoomFormState,
  LobbySettingsFormState,
  FieldErrors,
  RealtimeSyncState,
  Route,
  RoomSessionState,
  ValidationProblemDetails,
} from './appModels'
import { defaultFormState } from './appModels'

const STORAGE_KEY = 'the-hat:room-session'
const LOBBY_REFRESH_INTERVAL_MS = 3000
const GAMEPLAY_REFRESH_INTERVAL_MS = 1000

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

function hasDuplicateDisplayNameProblem(problem: ValidationProblemDetails): boolean {
  const messages = Object.entries(problem.errors ?? {}).find(([key]) => key.toLowerCase() === 'displayname')?.[1] ?? []

  return messages.some((message) => message.toLowerCase().includes('already taken'))
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
  const [lobbyRealtimeSyncState, setLobbyRealtimeSyncState] = useState<RealtimeSyncState>('connecting')
  const [lobbySyncError, setLobbySyncError] = useState('')
  const [isSavingLobbySettings, setIsSavingLobbySettings] = useState(false)
  const [lobbySettingsError, setLobbySettingsError] = useState('')
  const [lobbySettingsSuccess, setLobbySettingsSuccess] = useState('')
  const [isStartingGame, setIsStartingGame] = useState(false)
  const [lobbyStartError, setLobbyStartError] = useState('')
  const [gameplayView, setGameplayView] = useState<GameplayViewDto | null>(null)
  const [gameplayError, setGameplayError] = useState('')
  const [isGameplayRefreshing, setIsGameplayRefreshing] = useState(false)
  const [isConfirmingGuess, setIsConfirmingGuess] = useState(false)
  const [isPausingGame, setIsPausingGame] = useState(false)
  const [isResumingGame, setIsResumingGame] = useState(false)
  const [isContinuingRound, setIsContinuingRound] = useState(false)
  const [gameplayActionError, setGameplayActionError] = useState('')

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
  const lobbyPlayerId = lobbySession?.currentPlayerId ?? null
  const isGameplayActive = Boolean(lobbySession && lobbySession.room.phase !== 'lobby')

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

  const loadGameplayView = useCallback(
    async (roomId: string, playerId: string, backgroundRefresh: boolean) => {
      if (!backgroundRefresh) {
        setIsGameplayRefreshing(true)
      }

      try {
        const refreshedGameplayView = await getGameplayView(roomId, playerId)
        setGameplayView(refreshedGameplayView)
        updateRoomSessionSnapshot(refreshedGameplayView.room)
        setGameplayError('')
        return refreshedGameplayView
      } catch (error) {
        if (error instanceof RoomServiceError) {
          setGameplayError(error.message)
        } else {
          setGameplayError('Loading the gameplay view failed. Try again in a moment.')
        }

        return null
      } finally {
        if (!backgroundRefresh) {
          setIsGameplayRefreshing(false)
        }
      }
    },
    [updateRoomSessionSnapshot],
  )

  useEffect(() => {
    if (!lobbyRoomId) {
      setIsLobbyRefreshing(false)
      setLobbyRealtimeSyncState('connecting')
      setLobbySyncError('')
      return
    }

    let isDisposed = false
    let pollingIntervalId: number | null = null

    const stopPolling = () => {
      if (pollingIntervalId !== null) {
        window.clearInterval(pollingIntervalId)
        pollingIntervalId = null
      }
    }

    const refreshLobby = async (backgroundRefresh: boolean) => {
      if (!backgroundRefresh) {
        setIsLobbyRefreshing(true)
      }

      try {
        const refreshedRoom = await getRoom(lobbyRoomId)
        if (isDisposed) {
          return
        }

        updateRoomSessionSnapshot(refreshedRoom)
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

    const startPolling = () => {
      if (pollingIntervalId !== null) {
        return
      }

      void refreshLobby(false)
      pollingIntervalId = window.setInterval(() => {
        void refreshLobby(true)
      }, LOBBY_REFRESH_INTERVAL_MS)
    }

    const handleFallback = (message?: string) => {
      if (isDisposed) {
        return
      }

      setLobbyRealtimeSyncState('fallback')
      setLobbySyncError(message ?? 'Realtime updates are unavailable. Falling back to periodic refresh.')
      startPolling()
    }

    setLobbyRealtimeSyncState('connecting')

    const connectionPromise = createRoomRealtimeConnection({
      roomId: lobbyRoomId,
      onRoomUpdated: (refreshedRoom) => {
        if (isDisposed) {
          return
        }

        updateRoomSessionSnapshot(refreshedRoom)
        setLobbyRealtimeSyncState('connected')
        setLobbySyncError('')
      },
      onReconnecting: () => {
        if (!isDisposed) {
          setLobbyRealtimeSyncState('reconnecting')
        }
      },
      onReconnected: () => {
        if (!isDisposed) {
          setLobbyRealtimeSyncState('connected')
          setLobbySyncError('')
        }
      },
      onClosed: () => {
        handleFallback()
      },
    }).catch((error) => {
      if (error instanceof RoomServiceError) {
        handleFallback(error.message)
        return null
      }

      handleFallback()
      return null
    })

    return () => {
      isDisposed = true
      stopPolling()
      void connectionPromise.then(async (connection) => {
        await connection?.stop()
      })
    }
  }, [lobbyRoomId, updateRoomSessionSnapshot])

  useEffect(() => {
    if (!lobbyRoomId || !lobbyPlayerId || !isGameplayActive) {
      setGameplayView(null)
      setGameplayError('')
      setIsGameplayRefreshing(false)
      return
    }

    let isDisposed = false
    const roomId = lobbyRoomId
    const playerId = lobbyPlayerId

    const refreshGameplay = async (backgroundRefresh: boolean) => {
      const refreshedGameplayView = await loadGameplayView(roomId, playerId, backgroundRefresh)
      if (isDisposed || !refreshedGameplayView) {
        return
      }
    }

    void refreshGameplay(false)

    const intervalId = window.setInterval(() => {
      void refreshGameplay(true)
    }, GAMEPLAY_REFRESH_INTERVAL_MS)

    return () => {
      isDisposed = true
      window.clearInterval(intervalId)
    }
  }, [isGameplayActive, loadGameplayView, lobbyPlayerId, lobbyRoomId])

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
          if (hasDuplicateDisplayNameProblem(error.validationProblem)) {
            try {
              const result = await rejoinRoom(route.inviteCode, payload)
              setRoomSession({
                room: result,
                currentPlayerId: resolveCurrentPlayerId(result, payload.displayName),
              })
              navigate(`/rooms/${result.roomId}/lobby`)
              return
            } catch (rejoinError) {
              if (rejoinError instanceof RoomServiceError) {
                if (rejoinError.validationProblem) {
                  applyJoinValidationProblem(rejoinError.validationProblem)
                  return
                }

                setJoinServerError(rejoinError.message)
                return
              }

              setJoinServerError('Rejoining the room failed. Try again in a moment.')
              return
            }
          }

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

      updateRoomSessionSnapshot(updatedRoom)
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

      updateRoomSessionSnapshot(updatedRoom)
      await loadGameplayView(updatedRoom.roomId, lobbySession.currentPlayerId, false)
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

  const handleConfirmGuess = async (): Promise<void> => {
    if (!lobbySession) {
      return
    }

    setIsConfirmingGuess(true)
    setGameplayActionError('')

    try {
      const updatedRoom = await confirmGuess(lobbySession.room.roomId, {
        playerId: lobbySession.currentPlayerId,
      })

      updateRoomSessionSnapshot(updatedRoom)
      await loadGameplayView(updatedRoom.roomId, lobbySession.currentPlayerId, false)
    } catch (error) {
      if (error instanceof RoomServiceError) {
        setGameplayActionError(error.validationProblem ? getFirstProblemMessage(error.validationProblem) : error.message)
        return
      }

      setGameplayActionError('Confirming the guess failed. Try again in a moment.')
    } finally {
      setIsConfirmingGuess(false)
    }
  }

  const handlePauseGame = async (): Promise<void> => {
    if (!lobbySession) {
      return
    }

    setIsPausingGame(true)
    setGameplayActionError('')

    try {
      const updatedRoom = await pauseGame(lobbySession.room.roomId, {
        hostPlayerId: lobbySession.currentPlayerId,
      })

      updateRoomSessionSnapshot(updatedRoom)
      await loadGameplayView(updatedRoom.roomId, lobbySession.currentPlayerId, false)
    } catch (error) {
      if (error instanceof RoomServiceError) {
        setGameplayActionError(error.validationProblem ? getFirstProblemMessage(error.validationProblem) : error.message)
        return
      }

      setGameplayActionError('Pausing the game failed. Try again in a moment.')
    } finally {
      setIsPausingGame(false)
    }
  }

  const handleResumeGame = async (): Promise<void> => {
    if (!lobbySession) {
      return
    }

    setIsResumingGame(true)
    setGameplayActionError('')

    try {
      const updatedRoom = await resumeGame(lobbySession.room.roomId, {
        hostPlayerId: lobbySession.currentPlayerId,
      })

      updateRoomSessionSnapshot(updatedRoom)
      await loadGameplayView(updatedRoom.roomId, lobbySession.currentPlayerId, false)
    } catch (error) {
      if (error instanceof RoomServiceError) {
        setGameplayActionError(error.validationProblem ? getFirstProblemMessage(error.validationProblem) : error.message)
        return
      }

      setGameplayActionError('Resuming the game failed. Try again in a moment.')
    } finally {
      setIsResumingGame(false)
    }
  }

  const handleContinueRound = async (): Promise<void> => {
    if (!lobbySession) {
      return
    }

    setIsContinuingRound(true)
    setGameplayActionError('')

    try {
      const updatedRoom = await continueRound(lobbySession.room.roomId, {
        hostPlayerId: lobbySession.currentPlayerId,
      })

      updateRoomSessionSnapshot(updatedRoom)
      await loadGameplayView(updatedRoom.roomId, lobbySession.currentPlayerId, false)
    } catch (error) {
      if (error instanceof RoomServiceError) {
        setGameplayActionError(error.validationProblem ? getFirstProblemMessage(error.validationProblem) : error.message)
        return
      }

      setGameplayActionError('Starting the next round failed. Try again in a moment.')
    } finally {
      setIsContinuingRound(false)
    }
  }

  const handleLobbyRoomUpdated = (updatedRoom: RoomSnapshotDto) => {
    updateRoomSessionSnapshot(updatedRoom)
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
    if (isGameplayActive) {
      return (
        <GameplayPage
          session={lobbySession}
          gameplayView={gameplayView}
          syncError={gameplayError || lobbySyncError}
          realtimeSyncState={lobbyRealtimeSyncState}
          isRefreshing={isGameplayRefreshing || isLobbyRefreshing}
          isConfirmingGuess={isConfirmingGuess}
          isPausingGame={isPausingGame}
          isResumingGame={isResumingGame}
          isContinuingRound={isContinuingRound}
          actionError={gameplayActionError}
          onConfirmGuess={handleConfirmGuess}
          onPauseGame={handlePauseGame}
          onResumeGame={handleResumeGame}
          onContinueRound={handleContinueRound}
          onCreateRoom={() => navigate('/create-room')}
          copyState={copyState}
          inviteLink={lobbySession ? buildInviteLink(lobbySession.room.inviteCode) : ''}
          onCopyInviteLink={copyInviteLink}
        />
      )
    }

    return (
      <LobbyPage
        session={lobbySession}
        inviteLink={lobbySession ? buildInviteLink(lobbySession.room.inviteCode) : ''}
        copyState={copyState}
        syncError={lobbySyncError}
        isRefreshing={isLobbyRefreshing}
        realtimeSyncState={lobbyRealtimeSyncState}
        isSavingSettings={isSavingLobbySettings}
        settingsError={lobbySettingsError}
        settingsSuccess={lobbySettingsSuccess}
        isStartingGame={isStartingGame}
        startError={lobbyStartError}
        onCopyInviteLink={copyInviteLink}
        onCreateRoom={() => navigate('/create-room')}
        onSaveSettings={handleSaveLobbySettings}
        onStartGame={handleStartGame}
        onRoomUpdated={handleLobbyRoomUpdated}
      />
    )
  }

  return <HomePage onCreateRoom={() => navigate('/create-room')} />
}

export default App
