import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { RoomSnapshotDto } from '../contracts/theHatContracts'
import { getFirstProblemMessage } from '../localization'
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
  const { t } = useTranslation()
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
          setLoadError(error.validationProblem ? getFirstProblemMessage(t, error.validationProblem) : error.message)
        } else {
          setLoadError(t('wordSubmission.fallbackLoadError'))
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
      setLoadError(t('wordSubmission.missingSession'))
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
  }, [room.phase, room.roomId, currentPlayerId, hasCurrentPlayer, currentPlayerIsActive, t])

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
      setSubmitError(t('wordSubmission.reconnectBeforeSubmit'))
      setSubmitSuccess('')
      return
    }

    const normalizedWords = draftWords.map((word) => word.trim())

    if (normalizedWords.length !== requiredCount) {
      setSubmitError(t('wordSubmission.exactWordsRequired', { count: requiredCount }))
      setSubmitSuccess('')
      return
    }

    if (normalizedWords.some((word) => word.length === 0)) {
      setSubmitError(t('wordSubmission.everyWordRequired'))
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
      setSubmitSuccess(t('wordSubmission.savedSuccess'))
    } catch (error) {
      if (error instanceof RoomServiceError) {
        setSubmitError(error.validationProblem ? getFirstProblemMessage(t, error.validationProblem) : error.message)
      } else {
        setSubmitError(t('wordSubmission.fallbackSaveError'))
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
          <h2>{t('wordSubmission.title')}</h2>
          <p className="status-note">{t('wordSubmission.secrecyHint')}</p>
        </div>
        <span className={`status-pill ${remainingCount === 0 ? 'success' : remainingCount > 0 ? 'warning' : 'error'}`}>
          {remainingCount === 0
            ? t('wordSubmission.readyToSave')
            : remainingCount > 0
              ? t('wordSubmission.leftCount', { count: remainingCount })
              : t('wordSubmission.overCount', { count: Math.abs(remainingCount) })}
        </span>
      </div>

      <dl className="summary-list word-summary-list">
        <div>
          <dt>{t('common.required')}</dt>
          <dd>{requiredCount}</dd>
        </div>
        <div>
          <dt>{t('common.filled')}</dt>
          <dd>{filledCount}</dd>
        </div>
        <div>
          <dt>{t('common.saved')}</dt>
          <dd>{savedWords.length}</dd>
        </div>
      </dl>

      {isLoading ? <p className="status-note">{t('wordSubmission.loadingSavedWords')}</p> : null}
      {loadError ? <p className="banner banner-error compact-banner">{loadError}</p> : null}
      {!isLoading && room.phase === 'lobby' && currentPlayer && !currentPlayer.isActive ? (
        <p className="status-note">{t('wordSubmission.reconnectingPlayer')}</p>
      ) : null}

      {!isLoading && !loadError ? (
        <>
          <div className="word-entry-list">
            {draftWords.map((word, index) => (
              <div key={`${index}-${draftWords.length}`} className="word-entry-row">
                <label className="form-field word-entry-field">
                  <span>{t('wordSubmission.wordLabel', { index: index + 1 })}</span>
                  <input
                    type="text"
                    value={word}
                    maxLength={80}
                    placeholder={t('wordSubmission.wordPlaceholder')}
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
                  {t('common.remove')}
                </button>
              </div>
            ))}
          </div>

          {submitError ? <p className="banner banner-error compact-banner">{submitError}</p> : null}
          {submitSuccess ? <p className="banner banner-success compact-banner">{submitSuccess}</p> : null}

          <div className="word-panel-actions">
            <button className="button button-secondary" type="button" disabled={isSaving || !canEditWords} onClick={addWordField}>
              {t('common.addWord')}
            </button>
            <button className="button button-secondary" type="button" disabled={!isDirty || isSaving || !canEditWords} onClick={restoreSavedWords}>
              {t('common.reset')}
            </button>
            <button className="button button-primary" type="button" disabled={isSaving || !isDirty || !canEditWords} onClick={() => void handleSubmit()}>
              {isSaving ? t('wordSubmission.saving') : t('common.saveWords')}
            </button>
          </div>
        </>
      ) : null}
    </article>
  )
}
