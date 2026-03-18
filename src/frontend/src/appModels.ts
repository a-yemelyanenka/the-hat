import type { PlayerOrderMode } from './contracts/theHatContracts'

export type Route =
  | { name: 'home' }
  | { name: 'create-room' }
  | { name: 'join-room'; inviteCode: string }
  | { name: 'lobby'; roomId: string }

export type CreateRoomFormState = {
  hostDisplayName: string
  wordsPerPlayer: string
  turnDurationSeconds: string
  playerOrderMode: PlayerOrderMode
}

export type FieldErrors = Partial<Record<keyof CreateRoomFormState, string>>

export type ValidationProblemDetails = {
  title?: string
  errors?: Record<string, string[]>
}

export type CopyState = 'idle' | 'copied' | 'failed'

export const defaultFormState: CreateRoomFormState = {
  hostDisplayName: '',
  wordsPerPlayer: '5',
  turnDurationSeconds: '60',
  playerOrderMode: 'random',
}
