import type {
  CreateRoomRequestDto,
  CreateRoomResponseDto,
} from '../contracts/theHatContracts'
import type { ValidationProblemDetails } from '../appModels'

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

export async function createRoom(request: CreateRoomRequestDto): Promise<CreateRoomResponseDto> {
  if (!API_BASE_URL) {
    throw new RoomServiceError('VITE_API_BASE_URL is not configured.')
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
  } catch {
    throw new RoomServiceError('Could not reach the backend. Check that the API is running.')
  }

  const contentType = response.headers.get('content-type') ?? ''
  const hasJsonBody = contentType.includes('application/json')
  const responseBody = hasJsonBody ? ((await response.json()) as unknown) : null

  if (!response.ok) {
    if (response.status === 400) {
      throw new RoomServiceError('Validation failed.', {
        statusCode: response.status,
        validationProblem: responseBody as ValidationProblemDetails,
      })
    }

    throw new RoomServiceError('Room creation failed. Try again in a moment.', {
      statusCode: response.status,
    })
  }

  return responseBody as CreateRoomResponseDto
}
