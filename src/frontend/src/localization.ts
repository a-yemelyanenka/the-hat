import type { TFunction } from 'i18next'
import type { ValidationProblemDetails } from './appModels'
import type { LocalizedMessageDto } from './contracts/theHatContracts'

function normalizeFieldName(fieldName: string): string {
  return fieldName.trim().toLowerCase()
}

function findProblemEntry<TValue>(
  entries: Record<string, TValue> | undefined,
  fieldName?: string,
): TValue | undefined {
  if (!entries) {
    return undefined
  }

  if (!fieldName) {
    return undefined
  }

  const normalizedFieldName = normalizeFieldName(fieldName)
  return Object.entries(entries).find(([key]) => normalizeFieldName(key) === normalizedFieldName)?.[1]
}

export function translateLocalizedMessage(
  t: TFunction,
  message: LocalizedMessageDto | null | undefined,
  fallback?: string,
): string {
  if (!message) {
    return fallback ?? ''
  }

  return t(message.key, {
    ...(message.parameters ?? {}),
    defaultValue: message.fallback ?? fallback ?? message.key,
  })
}

export function getFirstProblemMessage(t: TFunction, problem: ValidationProblemDetails): string {
  const firstLocalizedMessage = Object.values(problem.messageErrors ?? {}).flat()[0]
  if (firstLocalizedMessage) {
    return translateLocalizedMessage(t, firstLocalizedMessage, problem.title ?? t('app.requestCouldNotBeCompleted'))
  }

  const firstPlainMessage = Object.values(problem.errors ?? {}).flat()[0]
  if (firstPlainMessage) {
    return firstPlainMessage
  }

  if (problem.messageTitle) {
    return translateLocalizedMessage(t, problem.messageTitle, problem.title ?? t('app.requestCouldNotBeCompleted'))
  }

  return problem.title ?? t('app.requestCouldNotBeCompleted')
}

export function getFieldProblemMessage(
  t: TFunction,
  problem: ValidationProblemDetails,
  fieldName: string,
): string {
  const localizedEntry = findProblemEntry(problem.messageErrors, fieldName)?.[0]
  if (localizedEntry) {
    return translateLocalizedMessage(t, localizedEntry)
  }

  const plainEntry = findProblemEntry(problem.errors, fieldName)?.[0]
  if (plainEntry) {
    return plainEntry
  }

  return ''
}

export function hasProblemMessageKey(
  problem: ValidationProblemDetails,
  fieldName: string,
  messageKey: string,
): boolean {
  const localizedMessages = findProblemEntry(problem.messageErrors, fieldName) ?? []
  return localizedMessages.some((message) => message.key === messageKey)
}
