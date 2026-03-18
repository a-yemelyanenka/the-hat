export type PlayerOrderMode = 'random' | 'manual'
export type RoomPhase = 'lobby' | 'inProgress' | 'paused' | 'completed'
export type RoundRule = 'explainNoSynonyms' | 'gesturesOnly' | 'oneWordOnly'

export interface RoomSettingsDto {
  wordsPerPlayer: number
  turnDurationSeconds: number
  playerOrderMode: PlayerOrderMode
}

export interface PlayerSubmissionProgressDto {
  playerId: string
  submittedCount: number
  requiredCount: number
  isComplete: boolean
}

export interface LobbyReadinessDto {
  canStart: boolean
  blockingReasons: string[]
}

export interface PlayerDto {
  playerId: string
  displayName: string
  isHost: boolean
  isActive: boolean
  orderIndex: number
  score: number
}

export interface WordSubmissionDto {
  wordId: string
  text: string
  submittedByPlayerId: string
}

export interface PlayerWordSubmissionDto {
  playerId: string
  requiredCount: number
  words: WordSubmissionDto[]
}

export interface RoundStateDto {
  roundNumber: number
  rule: RoundRule
  remainingWordIds: string[]
  guessedWordIds: string[]
  isCompleted: boolean
}

export interface TurnStateDto {
  turnNumber: number
  explainerPlayerId: string
  guesserPlayerId: string
  activeWordId: string | null
  startedAtUtc: string
  expiredAtUtc: string | null
  completedAtUtc: string | null
}

export interface RoomSnapshotDto {
  roomId: string
  inviteCode: string
  phase: RoomPhase
  hostPlayerId: string
  settings: RoomSettingsDto
  players: PlayerDto[]
  submissionProgress: PlayerSubmissionProgressDto[]
  lobbyReadiness: LobbyReadinessDto
  words: WordSubmissionDto[]
  rounds: RoundStateDto[]
  currentRoundNumber: number | null
  currentTurn: TurnStateDto | null
  createdAtUtc: string
  updatedAtUtc: string
}

export interface CreateRoomRequestDto {
  hostDisplayName: string
  settings: RoomSettingsDto
}

export interface CreateRoomResponseDto {
  room: RoomSnapshotDto
}

export interface JoinRoomRequestDto {
  displayName: string
}

export interface RejoinRoomRequestDto {
  displayName: string
}

export interface UpdateRoomSettingsRequestDto {
  hostPlayerId: string
  settings: RoomSettingsDto
  orderedPlayerIds?: string[] | null
}

export interface SubmitWordsRequestDto {
  playerId: string
  words: string[]
}

export interface StartGameRequestDto {
  hostPlayerId: string
}

export interface RoomEventDto {
  roomId: string
  occurredAtUtc: string
}

export interface PlayerJoinedEventDto extends RoomEventDto {
  player: PlayerDto
}

export interface PlayerRejoinedEventDto extends RoomEventDto {
  playerId: string
}

export interface PlayerLeftEventDto extends RoomEventDto {
  playerId: string
  isActive: boolean
}

export interface RoomSettingsChangedEventDto extends RoomEventDto {
  settings: RoomSettingsDto
  orderedPlayerIds?: string[] | null
}

export interface WordSubmissionUpdatedEventDto extends RoomEventDto {
  playerId: string
  submittedCount: number
  requiredCount: number
}

export interface GameStartedEventDto extends RoomEventDto {
  roundNumber: number
  currentTurn: TurnStateDto
}

export interface TurnStartedEventDto extends RoomEventDto {
  roundNumber: number
  turn: TurnStateDto
}

export interface WordGuessedEventDto extends RoomEventDto {
  roundNumber: number
  wordId: string
  explainerPlayerId: string
  guesserPlayerId: string
  scores: PlayerDto[]
}

export interface TurnExpiredEventDto extends RoomEventDto {
  roundNumber: number
  returnedWordId: string
  nextTurn: TurnStateDto
}

export interface RoundCompletedEventDto extends RoomEventDto {
  roundNumber: number
  scores: PlayerDto[]
}

export interface GameCompletedEventDto extends RoomEventDto {
  finalScores: PlayerDto[]
}
