using Microsoft.AspNetCore.Mvc;
using TheHat.Backend.Contracts;
using TheHat.Backend.Domain;

namespace TheHat.Backend.Api.Controllers;

[ApiController]
[Route("api/rooms")]
public sealed class RoomsController(
    IRoomCreationService roomCreationService,
    IRoomJoinService roomJoinService) : ControllerBase
{
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
            foreach (var error in exception.Errors)
            {
                foreach (var message in error.Value)
                {
                    ModelState.AddModelError(error.Key, message);
                }
            }

            return ValidationProblem(ModelState);
        }

        var response = new CreateRoomResponseDto(room.ToDto());
        return Created($"/api/rooms/{room.RoomId}", response);
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
            foreach (var error in exception.Errors)
            {
                foreach (var message in error.Value)
                {
                    ModelState.AddModelError(error.Key, message);
                }
            }

            return ValidationProblem(ModelState);
        }

        return Ok(room.ToDto());
    }
}