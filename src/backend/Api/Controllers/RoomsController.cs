using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using TheHat.Backend.Contracts;
using TheHat.Backend.Domain;

namespace TheHat.Backend.Api.Controllers;

[ApiController]
[Route("api/rooms")]
public sealed class RoomsController(
    IRoomCreationService roomCreationService,
    IRoomJoinService roomJoinService,
    IRoomLobbyService roomLobbyService,
    IRoomWordSubmissionService roomWordSubmissionService,
    IRoomGameplayService roomGameplayService,
    IRoomRealtimeNotifier roomRealtimeNotifier) : ControllerBase
{
    [HttpGet("{roomId}")]
    [ProducesResponseType<RoomSnapshotDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RoomSnapshotDto>> GetRoom(
        string roomId,
        CancellationToken cancellationToken)
    {
        try
        {
            var room = await roomLobbyService.GetRoomAsync(roomId, cancellationToken);
            return Ok(room.ToDto());
        }
        catch (RoomNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpGet("{roomId}/gameplay")]
    [ProducesResponseType<GameplayViewDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<GameplayViewDto>> GetGameplay(
        string roomId,
        [FromQuery] string playerId,
        CancellationToken cancellationToken)
    {
        PlayerGameplayState gameplayState;

        try
        {
            gameplayState = await roomGameplayService.GetGameplayViewAsync(roomId, playerId, cancellationToken);
        }
        catch (RoomNotFoundException)
        {
            return NotFound();
        }
        catch (DomainValidationException exception)
        {
            return ValidationProblem(CreateModelState(exception));
        }

        return Ok(gameplayState.ToDto());
    }

    [HttpPost]
    [ProducesResponseType<CreateRoomResponseDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CreateRoomResponseDto>> CreateRoom(
        [FromBody] CreateRoomRequestDto request,
        CancellationToken cancellationToken)
    {
        RoomState room;

        try
        {
            room = await roomCreationService.CreateRoomAsync(
                request.HostDisplayName,
                request.Settings.ToDomain(),
                cancellationToken);
        }
        catch (DomainValidationException exception)
        {
            return ValidationProblem(CreateModelState(exception));
        }

        var response = new CreateRoomResponseDto(room.ToDto());
        await roomRealtimeNotifier.PublishRoomUpdatedAsync(room, cancellationToken);
        return Created($"/api/rooms/{room.RoomId}", response);
    }

    [HttpPut("{roomId}/settings")]
    [ProducesResponseType<RoomSnapshotDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RoomSnapshotDto>> UpdateRoomSettings(
        string roomId,
        [FromBody] UpdateRoomSettingsRequestDto request,
        CancellationToken cancellationToken)
    {
        RoomState room;

        try
        {
            room = await roomLobbyService.UpdateRoomSettingsAsync(
                roomId,
                request.HostPlayerId,
                request.Settings.ToDomain(),
                request.OrderedPlayerIds,
                cancellationToken);
        }
        catch (RoomNotFoundException)
        {
            return NotFound();
        }
        catch (DomainValidationException exception)
        {
            return ValidationProblem(CreateModelState(exception));
        }

        await roomRealtimeNotifier.PublishRoomUpdatedAsync(room, cancellationToken);
        return Ok(room.ToDto());
    }

    [HttpGet("{roomId}/players/{playerId}/words")]
    [ProducesResponseType<PlayerWordSubmissionDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PlayerWordSubmissionDto>> GetPlayerWords(
        string roomId,
        string playerId,
        CancellationToken cancellationToken)
    {
        PlayerWordSubmission submission;

        try
        {
            submission = await roomWordSubmissionService.GetPlayerWordSubmissionAsync(roomId, playerId, cancellationToken);
        }
        catch (RoomNotFoundException)
        {
            return NotFound();
        }
        catch (DomainValidationException exception)
        {
            return ValidationProblem(CreateModelState(exception));
        }

        return Ok(submission.ToDto());
    }

    [HttpPut("{roomId}/words")]
    [ProducesResponseType<RoomSnapshotDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RoomSnapshotDto>> SubmitWords(
        string roomId,
        [FromBody] SubmitWordsRequestDto request,
        CancellationToken cancellationToken)
    {
        RoomState room;

        try
        {
            room = await roomWordSubmissionService.SubmitWordsAsync(
                roomId,
                request.PlayerId,
                request.Words,
                cancellationToken);
        }
        catch (RoomNotFoundException)
        {
            return NotFound();
        }
        catch (DomainValidationException exception)
        {
            return ValidationProblem(CreateModelState(exception));
        }

        await roomRealtimeNotifier.PublishRoomUpdatedAsync(room, cancellationToken);
        return Ok(room.ToDto());
    }

    [HttpPost("{roomId}/start")]
    [ProducesResponseType<RoomSnapshotDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RoomSnapshotDto>> StartGame(
        string roomId,
        [FromBody] StartGameRequestDto request,
        CancellationToken cancellationToken)
    {
        RoomState room;

        try
        {
            room = await roomLobbyService.StartGameAsync(roomId, request.HostPlayerId, cancellationToken);
        }
        catch (RoomNotFoundException)
        {
            return NotFound();
        }
        catch (DomainValidationException exception)
        {
            return ValidationProblem(CreateModelState(exception));
        }

        await roomRealtimeNotifier.PublishRoomUpdatedAsync(room, cancellationToken);
        return Ok(room.ToDto());
    }

    [HttpPost("{roomId}/gameplay/guesses/confirm")]
    [ProducesResponseType<RoomSnapshotDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RoomSnapshotDto>> ConfirmGuess(
        string roomId,
        [FromBody] ConfirmGuessRequestDto request,
        CancellationToken cancellationToken)
    {
        RoomState room;

        try
        {
            room = await roomGameplayService.ConfirmGuessAsync(roomId, request.PlayerId, cancellationToken);
        }
        catch (RoomNotFoundException)
        {
            return NotFound();
        }
        catch (DomainValidationException exception)
        {
            return ValidationProblem(CreateModelState(exception));
        }

        await roomRealtimeNotifier.PublishRoomUpdatedAsync(room, cancellationToken);
        return Ok(room.ToDto());
    }

    [HttpPost("{roomId}/gameplay/end-turn")]
    [ProducesResponseType<RoomSnapshotDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RoomSnapshotDto>> EndTurn(
        string roomId,
        [FromBody] EndTurnRequestDto request,
        CancellationToken cancellationToken)
    {
        RoomState room;

        try
        {
            room = await roomGameplayService.EndTurnAsync(roomId, request.PlayerId, cancellationToken);
        }
        catch (RoomNotFoundException)
        {
            return NotFound();
        }
        catch (DomainValidationException exception)
        {
            return ValidationProblem(CreateModelState(exception));
        }

        await roomRealtimeNotifier.PublishRoomUpdatedAsync(room, cancellationToken);
        return Ok(room.ToDto());
    }

    [HttpPost("{roomId}/gameplay/pause")]
    [ProducesResponseType<RoomSnapshotDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RoomSnapshotDto>> PauseGame(
        string roomId,
        [FromBody] PauseGameRequestDto request,
        CancellationToken cancellationToken)
    {
        RoomState room;

        try
        {
            room = await roomGameplayService.PauseGameAsync(roomId, request.HostPlayerId, cancellationToken);
        }
        catch (RoomNotFoundException)
        {
            return NotFound();
        }
        catch (DomainValidationException exception)
        {
            return ValidationProblem(CreateModelState(exception));
        }

        await roomRealtimeNotifier.PublishRoomUpdatedAsync(room, cancellationToken);
        return Ok(room.ToDto());
    }

    [HttpPost("{roomId}/gameplay/resume")]
    [ProducesResponseType<RoomSnapshotDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RoomSnapshotDto>> ResumeGame(
        string roomId,
        [FromBody] ResumeGameRequestDto request,
        CancellationToken cancellationToken)
    {
        RoomState room;

        try
        {
            room = await roomGameplayService.ResumeGameAsync(roomId, request.HostPlayerId, cancellationToken);
        }
        catch (RoomNotFoundException)
        {
            return NotFound();
        }
        catch (DomainValidationException exception)
        {
            return ValidationProblem(CreateModelState(exception));
        }

        await roomRealtimeNotifier.PublishRoomUpdatedAsync(room, cancellationToken);
        return Ok(room.ToDto());
    }

    [HttpPost("{roomId}/gameplay/continue")]
    [ProducesResponseType<RoomSnapshotDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RoomSnapshotDto>> ContinueRound(
        string roomId,
        [FromBody] ContinueRoundRequestDto request,
        CancellationToken cancellationToken)
    {
        RoomState room;

        try
        {
            room = await roomGameplayService.ContinueToNextRoundAsync(roomId, request.HostPlayerId, cancellationToken);
        }
        catch (RoomNotFoundException)
        {
            return NotFound();
        }
        catch (DomainValidationException exception)
        {
            return ValidationProblem(CreateModelState(exception));
        }

        await roomRealtimeNotifier.PublishRoomUpdatedAsync(room, cancellationToken);
        return Ok(room.ToDto());
    }

    [HttpPost("invite/{inviteCode}/join")]
    [ProducesResponseType<RoomSnapshotDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RoomSnapshotDto>> JoinRoom(
        string inviteCode,
        [FromBody] JoinRoomRequestDto request,
        CancellationToken cancellationToken)
    {
        RoomState room;

        try
        {
            room = await roomJoinService.JoinRoomAsync(inviteCode, request.DisplayName, cancellationToken);
        }
        catch (RoomNotFoundException)
        {
            return NotFound();
        }
        catch (DomainValidationException exception)
        {
            return ValidationProblem(CreateModelState(exception));
        }

        await roomRealtimeNotifier.PublishRoomUpdatedAsync(room, cancellationToken);
        return Ok(room.ToDto());
    }

    [HttpPost("invite/{inviteCode}/rejoin")]
    [ProducesResponseType<RoomSnapshotDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RoomSnapshotDto>> RejoinRoom(
        string inviteCode,
        [FromBody] RejoinRoomRequestDto request,
        CancellationToken cancellationToken)
    {
        RoomState room;

        try
        {
            room = await roomJoinService.RejoinRoomAsync(inviteCode, request.DisplayName, cancellationToken);
        }
        catch (RoomNotFoundException)
        {
            return NotFound();
        }
        catch (DomainValidationException exception)
        {
            return ValidationProblem(CreateModelState(exception));
        }

        await roomRealtimeNotifier.PublishRoomUpdatedAsync(room, cancellationToken);
        return Ok(room.ToDto());
    }

    private ModelStateDictionary CreateModelState(DomainValidationException exception)
    {
        var modelState = new ModelStateDictionary();

        foreach (var error in exception.Errors)
        {
            foreach (var message in error.Value)
            {
                modelState.AddModelError(error.Key, message);
            }
        }

        return modelState;
    }
}