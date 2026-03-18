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
    IRoomLobbyService roomLobbyService) : ControllerBase
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