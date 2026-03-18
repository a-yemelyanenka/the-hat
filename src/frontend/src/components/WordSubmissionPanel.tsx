import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { RoomSnapshotDto } from '../contracts/theHatContracts'
import { getPlayerWords, RoomServiceError, submitWords } from '../services/roomsService'
import './WordSubmissionPanel.css'

type WordSubmissionPanelProps = {
  room: RoomSnapshotDto
  currentPlayerId: string
  onRoomUpdated: (room: RoomSnapshotDto) => void
}

function buildInitialDraft(words: string[], requiredCount: number): string[] {
  if (words.length > 0) {
    return [...words]
  }

  return Array.from({ length: Math.max(requiredCount, 1) }, () => '')
}

export function WordSubmissionPanel({ room, currentPlayerId, onRoomUpdated }: WordSubmissionPanelProps) {
  const [savedWords, setSavedWords] = useState<string[]>([])
  const [draftWords, setDraftWords] = useState<string[]>(() => buildInitialDraft([], room.settings.wordsPerPlayer))
  const [requiredCount, setRequiredCount] = useState(room.settings.wordsPerPlayer)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const currentPlayer = room.players.find((player) => player.playerId === currentPlayerId) ?? null
  const hasCurrentPlayer = currentPlayer !== null
  const currentPlayerIsActive = currentPlayer?.isActive ?? false
  const canEditWords = room.phase === 'lobby' && currentPlayer?.isActive === true

  useEffect(() => {
    let isDisposed = false

    const loadWords = async () => {
      setIsLoading(true)
      setLoadError('')
      setSubmitError('')
      setSubmitSuccess('')

      try {
        const response = await getPlayerWords(room.roomId, currentPlayerId)
        if (isDisposed) {
          return
        }

        const nextWords = response.words.map((word) => word.text)
        setSavedWords(nextWords)
        setDraftWords(buildInitialDraft(nextWords, response.requiredCount))
        setRequiredCount(response.requiredCount)
      } catch (error) {
        if (isDisposed) {
          return
        }

        if (error instanceof RoomServiceError) {
          setLoadError(error.validationProblem ? Object.values(error.validationProblem.errors ?? {}).flat()[0] ?? error.message : error.message)
        } else {
          setLoadError('Loading your submitted words failed. Try again in a moment.')
        }
      } finally {
        if (!isDisposed) {
          setIsLoading(false)
        }
      }
    }

    if (room.phase !== 'lobby') {
      setIsLoading(false)
      setLoadError('')
      return () => {
        isDisposed = true
      }
    }

    if (!hasCurrentPlayer) {
      setIsLoading(false)
      setLoadError('Your player session is no longer available in this room.')
      return () => {
        isDisposed = true
      }
    }

    if (!currentPlayerIsActive) {
      setIsLoading(true)
      setLoadError('')
      setSubmitError('')
      setSubmitSuccess('')
      return () => {
        isDisposed = true
      }
    }

    void loadWords()

    return () => {
      isDisposed = true
    }
  }, [room.phase, room.roomId, currentPlayerId, hasCurrentPlayer, currentPlayerIsActive])

  useEffect(() => {
    setRequiredCount(room.settings.wordsPerPlayer)
    setDraftWords((current) => {
      if (current.length >= room.settings.wordsPerPlayer) {
        return current
      }

      return [...current, ...Array.from({ length: room.settings.wordsPerPlayer - current.length }, () => '')]
    })
  }, [room.settings.wordsPerPlayer])

  const filledCount = useMemo(
    () => draftWords.filter((word) => word.trim().length > 0).length,
    [draftWords],
  )
  const remainingCount = requiredCount - filledCount
  const isDirty = useMemo(() => {
    const normalizedDraft = draftWords.map((word) => word.trim())
    const normalizedSaved = savedWords.map((word) => word.trim())

    return JSON.stringify(normalizedDraft) !== JSON.stringify(normalizedSaved)
  }, [draftWords, savedWords])

  const updateWordAtIndex = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value
    setDraftWords((current) => current.map((word, currentIndex) => (currentIndex === index ? nextValue : word)))
    setSubmitError('')
    setSubmitSuccess('')
  }

  const addWordField = () => {
    setDraftWords((current) => [...current, ''])
    setSubmitError('')
    setSubmitSuccess('')
  }

  const removeWordField = (index: number) => {
    setDraftWords((current) => {
      if (current.length === 1) {
        return current
      }

      return current.filter((_, currentIndex) => currentIndex !== index)
    })
    setSubmitError('')
    setSubmitSuccess('')
  }

  const restoreSavedWords = () => {
    setDraftWords(buildInitialDraft(savedWords, requiredCount))
    setSubmitError('')
    setSubmitSuccess('')
  }

  const handleSubmit = async () => {
    if (!canEditWords) {
      setSubmitError('Reconnecting your player session. Please wait a moment and try again.')
      setSubmitSuccess('')
      return
    }

    const normalizedWords = draftWords.map((word) => word.trim())

    if (normalizedWords.length !== requiredCount) {
      setSubmitError(`Exactly ${requiredCount} words are required before you can save.`)
      setSubmitSuccess('')
      return
    }

    if (normalizedWords.some((word) => word.length === 0)) {
      setSubmitError('Each word must contain visible text before you save.')
      setSubmitSuccess('')
      return
    }

    setIsSaving(true)
    setSubmitError('')
    setSubmitSuccess('')

    try {
      const updatedRoom = await submitWords(room.roomId, {
        playerId: currentPlayerId,
        words: normalizedWords,
      })

      setSavedWords(normalizedWords)
      setDraftWords([...normalizedWords])
      onRoomUpdated(updatedRoom)
      setSubmitSuccess('Your words are saved for the lobby.')
    } catch (error) {
      if (error instanceof RoomServiceError) {
        setSubmitError(error.validationProblem ? Object.values(error.validationProblem.errors ?? {}).flat()[0] ?? error.message : error.message)
      } else {
        setSubmitError('Saving your words failed. Try again in a moment.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  if (room.phase !== 'lobby') {
    return null
  }

  return (
    <article className="panel word-panel">
      <div className="word-panel-header">
        <div>
          <h2>Your words</h2>
          <p className="status-note">Only your own entries are shown here. The lobby never reveals the full word pool.</p>
        </div>
        <span className={`status-pill ${remainingCount === 0 ? 'success' : remainingCount > 0 ? 'warning' : 'error'}`}>
          {remainingCount === 0 ? 'Ready to save' : remainingCount > 0 ? `${remainingCount} left` : `${Math.abs(remainingCount)} over`}
        </span>
      </div>

      <dl className="summary-list word-summary-list">
        <div>
          <dt>Required</dt>
          <dd>{requiredCount}</dd>
        </div>
        <div>
          <dt>Filled</dt>
          <dd>{filledCount}</dd>
        </div>
        <div>
          <dt>Saved</dt>
          <dd>{savedWords.length}</dd>
        </div>
      </dl>

      {isLoading ? <p className="status-note">Loading your saved words…</p> : null}
      {loadError ? <p className="banner banner-error compact-banner">{loadError}</p> : null}
      {!isLoading && room.phase === 'lobby' && currentPlayer && !currentPlayer.isActive ? (
        <p className="status-note">Reconnecting your player session…</p>
      ) : null}

      {!isLoading && !loadError ? (
        <>
          <div className="word-entry-list">
            {draftWords.map((word, index) => (
              <div key={`${index}-${draftWords.length}`} className="word-entry-row">
                <label className="form-field word-entry-field">
                  <span>Word {index + 1}</span>
                  <input
                    type="text"
                    value={word}
                    maxLength={80}
                    placeholder="Enter a word or short phrase"
                    disabled={!canEditWords || isSaving}
                    onChange={(event) => updateWordAtIndex(index, event)}
                  />
                </label>
                <button
                  className="button button-secondary word-entry-button"
                  type="button"
                  disabled={draftWords.length === 1 || isSaving || !canEditWords}
                  onClick={() => removeWordField(index)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {submitError ? <p className="banner banner-error compact-banner">{submitError}</p> : null}
          {submitSuccess ? <p className="banner banner-success compact-banner">{submitSuccess}</p> : null}

          <div className="word-panel-actions">
            <button className="button button-secondary" type="button" disabled={isSaving || !canEditWords} onClick={addWordField}>
              Add word
            </button>
            <button className="button button-secondary" type="button" disabled={!isDirty || isSaving || !canEditWords} onClick={restoreSavedWords}>
              Reset
            </button>
            <button className="button button-primary" type="button" disabled={isSaving || !isDirty || !canEditWords} onClick={() => void handleSubmit()}>
              {isSaving ? 'Saving words…' : 'Save words'}
            </button>
          </div>
        </>
      ) : null}
    </article>
  )
}
