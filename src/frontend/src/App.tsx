import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import './App.css'
import { CreateRoomPage } from './components/CreateRoomPage'
import { GameplayPage } from './components/GameplayPage'
import { HomePage } from './components/HomePage'
import { JoinRoomPage } from './components/JoinRoomPage'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { LobbyPage } from './components/LobbyPage'
import type {
  CreateRoomRequestDto,
  GameplayViewDto,
  JoinRoomRequestDto,
  RoomSnapshotDto,
} from './contracts/theHatContracts'
import { RoomSessionProvider } from './contexts/RoomSessionContext'
import { createRoomRealtimeConnection } from './services/roomRealtimeService'
import {
  confirmGuess,
  continueRound,
  createRoom,
  endTurn,
  getGameplayView,
  getRoom,
  joinRoom,
  pauseGame,
  rejoinRoom,
  resumeGame,
  RoomServiceError,
  startGame,
  startTurn,
  updateRoomSettings,
} from './services/roomsService'
import type {
  CreateRoomFormState,
  LobbySettingsFormState,
  FieldErrors,
  RealtimeSyncState,
  ValidationProblemDetails,
} from './appModels'
import { defaultFormState } from './appModels'
import { getFieldProblemMessage, getFirstProblemMessage as getLocalizedProblemMessage, hasProblemMessageKey } from './localization'
import { useRouter } from './hooks/useRouter'
import { useRoomSession, buildInviteLink, resolveCurrentPlayerId } from './hooks/useRoomSession'
import { useClipboard } from './hooks/useClipboard'
import { useGameplayAction } from './hooks/useGameplayAction'

const LOBBY_REFRESH_INTERVAL_MS = 3000

function App() {
  const { t } = useTranslation()
  const { route, navigate } = useRouter()
  const { roomSession, setRoomSession, updateRoomSessionSnapshot } = useRoomSession()
  const { copyState, copy: copyToClipboard } = useClipboard()

  const [formState, setFormState] = useState<CreateRoomFormState>(defaultFormState)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [joinDisplayName, setJoinDisplayName] = useState('')
  const [joinFieldError, setJoinFieldError] = useState('')
  const [joinServerError, setJoinServerError] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [isLobbyRefreshing, setIsLobbyRefreshing] = useState(false)
  const [lobbyRealtimeSyncState, setLobbyRealtimeSyncState] = useState<RealtimeSyncState>('connecting')
  const [lobbySyncError, setLobbySyncError] = useState('')
  const [lobbySettingsSuccess, setLobbySettingsSuccess] = useState('')
  const [gameplayView, setGameplayView] = useState<GameplayViewDto | null>(null)
  const [gameplayError, setGameplayError] = useState('')
  const [isGameplayRefreshing, setIsGameplayRefreshing] = useState(false)

  const saveLobbyAction = useGameplayAction()
  const startGameAction = useGameplayAction()
  const startTurnAction = useGameplayAction()
  const confirmGuessAction = useGameplayAction()
  const endTurnAction = useGameplayAction()
  const pauseGameAction = useGameplayAction()
  const resumeGameAction = useGameplayAction()
  const continueRoundAction = useGameplayAction()

  const gameplayActionError =
    startTurnAction.error || confirmGuessAction.error || endTurnAction.error ||
    pauseGameAction.error || resumeGameAction.error || continueRoundAction.error

  const renderPage = useCallback(
    (content: ReactElement) => (
      <>
        <div className="app-toolbar">
          <LanguageSwitcher />
        </div>
        {content}
      </>
    ),
    [],
  )

  const lobbySession = useMemo(() => {
    if (route.name !== 'lobby' || !roomSession) {
      return null
    }

    return roomSession.room.roomId === route.roomId ? roomSession : null
  }, [roomSession, route])

  const lobbyRoomId = lobbySession?.room.roomId ?? null
  const lobbyPlayerId = lobbySession?.currentPlayerId ?? null
  const lobbyInviteCode = lobbySession?.room.inviteCode ?? null
  const lobbyPlayerDisplayName =
    lobbySession?.room.players.find((player) => player.playerId === lobbyPlayerId)?.displayName ?? null
  const isGameplayActive = Boolean(lobbySession && lobbySession.room.phase !== 'lobby')

  useEffect(() => {
    if (!lobbyRoomId) {
      setIsLobbyRefreshing(false)
      setLobbyRealtimeSyncState('connecting')
      setLobbySyncError('')
      setGameplayView(null)
      setGameplayError('')
      setIsGameplayRefreshing(false)
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
          setLobbySyncError(t('app.fallbackLobbyRefresh'))
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
      setLobbySyncError(message ?? t('app.realtimeFallback'))
      startPolling()
    }

    setLobbyRealtimeSyncState('connecting')

    const connectionPromise = (async () => {
      if (!isGameplayActive && lobbyInviteCode && lobbyPlayerDisplayName) {
        try {
          const rejoinedRoom = await rejoinRoom(lobbyInviteCode, {
            displayName: lobbyPlayerDisplayName,
          })

          if (!isDisposed) {
            updateRoomSessionSnapshot(rejoinedRoom)
            setLobbySyncError('')
          }
        } catch (error) {
          if (error instanceof RoomServiceError && !isDisposed && error.statusCode !== 400) {
            setLobbySyncError(error.message)
          }
        }
      }

      return createRoomRealtimeConnection({
        roomId: lobbyRoomId,
        playerId: lobbyPlayerId ?? undefined,
        onRoomUpdated: (refreshedRoom) => {
          if (isDisposed) {
            return
          }

          updateRoomSessionSnapshot(refreshedRoom)
          setLobbyRealtimeSyncState('connected')
          setLobbySyncError('')
        },
        onGameplayUpdated: (refreshedGameplayView) => {
          if (isDisposed) {
            return
          }

          setGameplayView(refreshedGameplayView)
          updateRoomSessionSnapshot(refreshedGameplayView.room)
          setGameplayError('')
          setIsGameplayRefreshing(false)
        },
        onReconnecting: () => {
          if (!isDisposed) {
            setLobbyRealtimeSyncState('reconnecting')
            if (isGameplayActive) {
              setIsGameplayRefreshing(true)
            }
          }
        },
        onReconnected: () => {
          if (!isDisposed) {
            setLobbyRealtimeSyncState('connected')
            setLobbySyncError('')
            setGameplayError('')
          }
        },
        onClosed: () => {
          handleFallback()
        },
      })
    })().catch((error) => {
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
  }, [isGameplayActive, lobbyInviteCode, lobbyPlayerDisplayName, lobbyPlayerId, lobbyRoomId, t, updateRoomSessionSnapshot])

  useEffect(() => {
    if (!isGameplayActive) {
      setGameplayView(null)
      setGameplayError('')
      setIsGameplayRefreshing(false)
      return
    }

    setIsGameplayRefreshing(gameplayView === null)
  }, [gameplayView, isGameplayActive])

  useEffect(() => {
    if (!isGameplayActive || !lobbyRoomId || !lobbyPlayerId) {
      return
    }

    let isDisposed = false
    let expiryTimeoutId: number | null = null
    let abortController: AbortController | null = null

    const refreshGameplay = async () => {
      if (!isDisposed) {
        setIsGameplayRefreshing(true)
      }

      abortController?.abort()
      abortController = new AbortController()

      try {
        const refreshedGameplayView = await getGameplayView(lobbyRoomId, lobbyPlayerId)
        if (isDisposed) {
          return
        }

        setGameplayView(refreshedGameplayView)
        updateRoomSessionSnapshot(refreshedGameplayView.room)
        setGameplayError('')
      } catch (error) {
        if (isDisposed || abortController.signal.aborted) {
          return
        }

        if (error instanceof RoomServiceError) {
          setGameplayError(error.validationProblem ? getLocalizedProblemMessage(t, error.validationProblem) : error.message)
        } else {
          setGameplayError(t('app.gameplayLoadFallback'))
        }
      } finally {
        if (!isDisposed) {
          setIsGameplayRefreshing(false)
        }
      }
    }

    if (gameplayView === null) {
      void refreshGameplay()
    }

    if (gameplayView?.room.phase === 'inProgress' && gameplayView.room.currentTurn) {
      const endsAtMilliseconds = Date.parse(gameplayView.room.currentTurn.endsAtUtc)

      if (!Number.isNaN(endsAtMilliseconds)) {
        const delayMilliseconds = Math.max(250, endsAtMilliseconds - Date.now() + 250)
        expiryTimeoutId = window.setTimeout(() => {
          void refreshGameplay()
        }, delayMilliseconds)
      }
    }

    return () => {
      isDisposed = true
      abortController?.abort()

      if (expiryTimeoutId !== null) {
        window.clearTimeout(expiryTimeoutId)
      }
    }
  }, [gameplayView, isGameplayActive, lobbyPlayerId, lobbyRoomId, t, updateRoomSessionSnapshot])

  const updateFormState = (updater: (current: CreateRoomFormState) => CreateRoomFormState) => {
    setFormState(updater)
  }

  const validateForm = (): FieldErrors => {
    const nextErrors: FieldErrors = {}

    if (!formState.hostDisplayName.trim()) {
      nextErrors.hostDisplayName = t('app.enterDisplayName')
    }

    const wordsPerPlayer = Number(formState.wordsPerPlayer)
    if (!Number.isInteger(wordsPerPlayer) || wordsPerPlayer <= 0) {
      nextErrors.wordsPerPlayer = t('app.chooseWholeNumber')
    }

    const turnDurationSeconds = Number(formState.turnDurationSeconds)
    if (!Number.isInteger(turnDurationSeconds) || turnDurationSeconds <= 0) {
      nextErrors.turnDurationSeconds = t('app.chooseWholeNumber')
    }

    return nextErrors
  }

  const applyValidationProblem = (problem: ValidationProblemDetails) => {
    const nextErrors: FieldErrors = {}

    for (const [key, messages] of Object.entries(problem.errors ?? {})) {
      const normalizedKey = key.toLowerCase()
      const message = getFieldProblemMessage(t, problem, key) || messages[0] || t('app.invalidValue')

      if (normalizedKey === 'hostdisplayname') {
        nextErrors.hostDisplayName = message
      } else if (normalizedKey === 'settings.wordsperplayer') {
        nextErrors.wordsPerPlayer = message
      } else if (normalizedKey === 'settings.turndurationseconds') {
        nextErrors.turnDurationSeconds = message
      }
    }

    setFieldErrors(nextErrors)
    setServerError(problem.title && Object.keys(nextErrors).length === 0 ? getLocalizedProblemMessage(t, problem) : '')
  }

  const applyJoinValidationProblem = (problem: ValidationProblemDetails) => {
    const message = getFieldProblemMessage(t, problem, 'displayName')

    setJoinFieldError(message ?? '')
    setJoinServerError(problem.title && !message ? getLocalizedProblemMessage(t, problem) : '')
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

        setServerError(t('app.createRoomFallback'))
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
      setJoinFieldError(t('app.enterDisplayName'))
      setJoinServerError('')
      return
    }

    setIsJoining(true)
    setJoinFieldError('')
    setJoinServerError('')

    const payload: JoinRoomRequestDto = {
      displayName: joinDisplayName.trim(),
    }

    const completeJoin = (result: RoomSnapshotDto) => {
      setRoomSession({
        room: result,
        currentPlayerId: resolveCurrentPlayerId(result, payload.displayName),
      })
      navigate(`/rooms/${result.roomId}/lobby`)
    }

    try {
      const rejoinResult = await rejoinRoom(route.inviteCode, payload)
      completeJoin(rejoinResult)
    } catch (rejoinError) {
      if (rejoinError instanceof RoomServiceError) {
        if (rejoinError.validationProblem && !hasProblemMessageKey(rejoinError.validationProblem, 'displayName', 'backend.join.rejoinCandidateNotFound')) {
          applyJoinValidationProblem(rejoinError.validationProblem)
          return
        }

        if (!rejoinError.validationProblem) {
          setJoinServerError(rejoinError.message)
          return
        }
      }

      try {
        const joinResult = await joinRoom(route.inviteCode, payload)
        completeJoin(joinResult)
      } catch (joinError) {
        if (joinError instanceof RoomServiceError) {
          if (joinError.validationProblem) {
            if (hasProblemMessageKey(joinError.validationProblem, 'displayName', 'backend.join.displayNameTaken')) {
              try {
                const retryRejoinResult = await rejoinRoom(route.inviteCode, payload)
                completeJoin(retryRejoinResult)
                return
              } catch (retryRejoinError) {
                if (retryRejoinError instanceof RoomServiceError) {
                  if (retryRejoinError.validationProblem) {
                    applyJoinValidationProblem(retryRejoinError.validationProblem)
                    return
                  }

                  setJoinServerError(retryRejoinError.message)
                  return
                }

                setJoinServerError(t('app.rejoinFallback'))
                return
              }
            }

            applyJoinValidationProblem(joinError.validationProblem)
            return
          }

          setJoinServerError(joinError.message)
          return
        }

        setJoinServerError(t('app.joinFallback'))
      }
    } finally {
      setIsJoining(false)
    }
  }

  const copyInviteLink = async () => {
    if (!lobbySession) {
      return
    }

    await copyToClipboard(buildInviteLink(lobbySession.room.inviteCode))
  }

  const handleSaveLobbySettings = async (
    nextSettings: LobbySettingsFormState,
    orderedPlayerIds?: string[],
  ): Promise<boolean> => {
    if (!lobbySession) {
      return false
    }

    startGameAction.clearError()
    setLobbySettingsSuccess('')

    let saved = false
    await saveLobbyAction.execute(
      () => updateRoomSettings(lobbySession.room.roomId, {
        hostPlayerId: lobbySession.currentPlayerId,
        settings: {
          wordsPerPlayer: Number(nextSettings.wordsPerPlayer),
          turnDurationSeconds: Number(nextSettings.turnDurationSeconds),
          playerOrderMode: nextSettings.playerOrderMode,
        },
        orderedPlayerIds,
      }),
      (updatedRoom) => {
        updateRoomSessionSnapshot(updatedRoom)
        setLobbySettingsSuccess(t('lobby.settingsSaved'))
        saved = true
      },
      'app.saveSettingsFallback',
    )

    return saved
  }

  const handleStartGame = async (): Promise<void> => {
    if (!lobbySession) return
    setLobbySettingsSuccess('')
    await startGameAction.execute(
      () => startGame(lobbySession.room.roomId, { hostPlayerId: lobbySession.currentPlayerId }),
      updateRoomSessionSnapshot,
      'app.startGameFallback',
    )
  }

  const handleStartTurn = async (): Promise<void> => {
    if (!lobbySession) return
    await startTurnAction.execute(
      () => startTurn(lobbySession.room.roomId, { playerId: lobbySession.currentPlayerId }),
      updateRoomSessionSnapshot,
      'app.startTurnFallback',
    )
  }

  const handleConfirmGuess = async (): Promise<void> => {
    if (!lobbySession) return
    await confirmGuessAction.execute(
      () => confirmGuess(lobbySession.room.roomId, { playerId: lobbySession.currentPlayerId }),
      updateRoomSessionSnapshot,
      'app.confirmGuessFallback',
    )
  }

  const handleEndTurn = async (): Promise<void> => {
    if (!lobbySession) return
    await endTurnAction.execute(
      () => endTurn(lobbySession.room.roomId, { playerId: lobbySession.currentPlayerId }),
      updateRoomSessionSnapshot,
      'app.endTurnFallback',
    )
  }

  const handlePauseGame = async (): Promise<void> => {
    if (!lobbySession) return
    await pauseGameAction.execute(
      () => pauseGame(lobbySession.room.roomId, { hostPlayerId: lobbySession.currentPlayerId }),
      updateRoomSessionSnapshot,
      'app.pauseFallback',
    )
  }

  const handleResumeGame = async (): Promise<void> => {
    if (!lobbySession) return
    await resumeGameAction.execute(
      () => resumeGame(lobbySession.room.roomId, { hostPlayerId: lobbySession.currentPlayerId }),
      updateRoomSessionSnapshot,
      'app.resumeFallback',
    )
  }

  const handleContinueRound = async (): Promise<void> => {
    if (!lobbySession) return
    await continueRoundAction.execute(
      () => continueRound(lobbySession.room.roomId, { hostPlayerId: lobbySession.currentPlayerId }),
      updateRoomSessionSnapshot,
      'app.continueRoundFallback',
    )
  }

  if (route.name === 'create-room') {
    return renderPage(
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
      />,
    )
  }

  if (route.name === 'join-room') {
    return renderPage(
      <JoinRoomPage
        inviteCode={route.inviteCode}
        displayName={joinDisplayName}
        fieldError={joinFieldError}
        serverError={joinServerError}
        isSubmitting={isJoining}
        onBack={() => navigate('/')}
        onSubmit={handleJoinSubmit}
        onDisplayNameChange={setJoinDisplayName}
      />,
    )
  }

  if (route.name === 'lobby') {
    const lobbyInviteLinkValue = lobbySession ? buildInviteLink(lobbySession.room.inviteCode) : ''
    const lobbySyncErrorValue = isGameplayActive ? (gameplayError || lobbySyncError) : lobbySyncError
    const lobbyIsRefreshing = isGameplayActive ? (isGameplayRefreshing || isLobbyRefreshing) : isLobbyRefreshing

    const sessionProvider = (child: ReactElement) => (
      <RoomSessionProvider
        session={lobbySession}
        updateRoomSessionSnapshot={updateRoomSessionSnapshot}
        inviteLink={lobbyInviteLinkValue}
        copyState={copyState}
        onCopyInviteLink={copyInviteLink}
        realtimeSyncState={lobbyRealtimeSyncState}
        syncError={lobbySyncErrorValue}
        isRefreshing={lobbyIsRefreshing}
        onCreateRoom={() => navigate('/create-room')}
      >
        {child}
      </RoomSessionProvider>
    )

    if (isGameplayActive) {
      return renderPage(
        sessionProvider(
          <GameplayPage
            gameplayView={gameplayView}
            pending={{
              isStartingTurn: startTurnAction.isPending,
              isConfirmingGuess: confirmGuessAction.isPending,
              isEndingTurn: endTurnAction.isPending,
              isPausingGame: pauseGameAction.isPending,
              isResumingGame: resumeGameAction.isPending,
              isContinuingRound: continueRoundAction.isPending,
            }}
            actionError={gameplayActionError}
            actions={{
              onStartTurn: handleStartTurn,
              onConfirmGuess: handleConfirmGuess,
              onEndTurn: handleEndTurn,
              onPauseGame: handlePauseGame,
              onResumeGame: handleResumeGame,
              onContinueRound: handleContinueRound,
            }}
            onGoHome={() => navigate('/')}
          />,
        ),
      )
    }

    return renderPage(
      sessionProvider(
        <LobbyPage
          isSavingSettings={saveLobbyAction.isPending}
          settingsError={saveLobbyAction.error}
          settingsSuccess={lobbySettingsSuccess}
          isStartingGame={startGameAction.isPending}
          startError={startGameAction.error}
          onSaveSettings={handleSaveLobbySettings}
          onStartGame={handleStartGame}
        />,
      ),
    )
  }

  return renderPage(<HomePage onCreateRoom={() => navigate('/create-room')} />)
}

export default App
