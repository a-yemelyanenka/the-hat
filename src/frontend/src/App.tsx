import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { CreateRoomPage } from './components/CreateRoomPage'
import { HomePage } from './components/HomePage'
import { LobbyPage } from './components/LobbyPage'
import type {
  CreateRoomRequestDto,
  CreateRoomResponseDto,
} from './contracts/theHatContracts'
import { createRoom, RoomServiceError } from './services/roomsService'
import type {
  CopyState,
  CreateRoomFormState,
  FieldErrors,
  Route,
  ValidationProblemDetails,
} from './appModels'
import { defaultFormState } from './appModels'
const STORAGE_KEY = 'the-hat:last-created-room'

function getRoute(pathname: string): Route {
  if (pathname === '/create-room') {
    return { name: 'create-room' }
  }

  const lobbyMatch = pathname.match(/^\/rooms\/([^/]+)\/lobby\/?$/)
  if (lobbyMatch) {
    return { name: 'lobby', roomId: lobbyMatch[1] }
  }

  return { name: 'home' }
}

function loadStoredRoom(): CreateRoomResponseDto | null {
  const stored = window.sessionStorage.getItem(STORAGE_KEY)

  if (!stored) {
    return null
  }

  try {
    return JSON.parse(stored) as CreateRoomResponseDto
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
}

function App() {
  const [route, setRoute] = useState<Route>(() => getRoute(window.location.pathname))
  const [formState, setFormState] = useState<CreateRoomFormState>(defaultFormState)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdRoom, setCreatedRoom] = useState<CreateRoomResponseDto | null>(() => loadStoredRoom())
  const [copyState, setCopyState] = useState<CopyState>('idle')

  useEffect(() => {
    const handlePopState = () => {
      setRoute(getRoute(window.location.pathname))
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (createdRoom) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(createdRoom))
      return
    }

    window.sessionStorage.removeItem(STORAGE_KEY)
  }, [createdRoom])

  const lobbyRoom = useMemo(() => {
    if (route.name !== 'lobby' || !createdRoom) {
      return null
    }

    return createdRoom.room.roomId === route.roomId ? createdRoom : null
  }, [createdRoom, route])

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
      setCreatedRoom(result)
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

  const copyInviteLink = async () => {
    if (!lobbyRoom) {
      return
    }

    try {
      await navigator.clipboard.writeText(lobbyRoom.inviteLink)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
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

  if (route.name === 'lobby') {
    return (
      <LobbyPage
        room={lobbyRoom}
        copyState={copyState}
        onCopyInviteLink={copyInviteLink}
        onCreateRoom={() => navigate('/create-room')}
      />
    )
  }

  return <HomePage onCreateRoom={() => navigate('/create-room')} />
}

export default App
