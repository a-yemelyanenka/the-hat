using Microsoft.AspNetCore.Http.Extensions;
using Microsoft.AspNetCore.Mvc;
using TheHat.Backend.Contracts;
using TheHat.Backend.Domain;

namespace TheHat.Backend.Api.Controllers;

[ApiController]
[Route("api/rooms")]
public sealed class RoomsController(IRoomCreationService roomCreationService) : ControllerBase
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

        var response = new CreateRoomResponseDto(room.ToDto(), BuildInviteLink(room.InviteCode));
        return Created($"/api/rooms/{room.RoomId}", response);
    }

    private string BuildInviteLink(string inviteCode) => UriHelper.BuildAbsolute(
        Request.Scheme,
        Request.Host,
        Request.PathBase,
        $"/join/{inviteCode}");
}