using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Server.Api.Models;
using Server.Api.Models.Dto;
using Server.Api.Services;

namespace Server.Api.Controllers;

// READS are public; WRITES need a logged-in user (any role).
// [Authorize] on the class + [AllowAnonymous] on the reads makes "protected" the default:
// a new endpoint added later is safe unless someone deliberately opens it.
[ApiController]
[Route("api/[controller]")] // -> /api/destinations
[Authorize]
public class DestinationsController(IDestinationService destinations) : ControllerBase
{
    // GET /api/destinations?page=2&pageSize=6&search=india&visited=false
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType<ApiResponse<PagedResult<DestinationDto>>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status400BadRequest)]
    // GOTCHA: the complex parameter must NOT be called "page". With ?page=2, MVC would treat "page" as a PREFIX,
    // look for page.Page and page.PageSize, find nothing, and silently use the defaults. A test caught this.
    public ActionResult<ApiResponse<PagedResult<DestinationDto>>> Find(
        [FromQuery] PageRequest paging,
        [FromQuery, StringLength(100)] string? search = null,
        [FromQuery] bool? visited = null) =>
        Ok(ApiResponse<PagedResult<DestinationDto>>.Ok(destinations.Find(new DestinationQuery(search, visited), paging)));

    [HttpGet("{id:int}")]
    [AllowAnonymous]
    [ProducesResponseType<ApiResponse<DestinationDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<DestinationDto>>(StatusCodes.Status404NotFound)]
    public ActionResult<ApiResponse<DestinationDto>> GetById(int id) =>
        destinations.GetById(id) is { } d
            ? Ok(ApiResponse<DestinationDto>.Ok(d))
            : NotFound(ApiResponse<DestinationDto>.Fail($"Destination {id} not found"));

    [HttpPost]
    [ProducesResponseType<ApiResponse<DestinationDto>>(StatusCodes.Status201Created)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public ActionResult<ApiResponse<DestinationDto>> Create(SaveDestinationDto input)
    {
        var result = destinations.Create(input);
        return result.Succeeded
            ? CreatedAtAction(nameof(GetById), new { id = result.Destination!.Id }, ApiResponse<DestinationDto>.Ok(result.Destination))
            : ToError(result.Error, input);
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType<ApiResponse<DestinationDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ApiResponse<DestinationDto>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public ActionResult<ApiResponse<DestinationDto>> Update(int id, SaveDestinationDto input)
    {
        var result = destinations.Update(id, input);
        return result.Succeeded ? Ok(ApiResponse<DestinationDto>.Ok(result.Destination!)) : ToError(result.Error, input, id);
    }

    // PUT /api/destinations/3/visited  { "isVisited": true }
    [HttpPut("{id:int}/visited")]
    [ProducesResponseType<ApiResponse<DestinationDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ApiResponse<DestinationDto>>(StatusCodes.Status404NotFound)]
    public ActionResult<ApiResponse<DestinationDto>> SetVisited(int id, SetVisitedDto input)
    {
        var result = destinations.SetVisited(id, input.IsVisited);
        return result.Succeeded ? Ok(ApiResponse<DestinationDto>.Ok(result.Destination!)) : ToError(result.Error, null, id);
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public IActionResult Delete(int id) =>
        destinations.Delete(id) ? NoContent() : NotFound(ApiResponse<object>.Fail($"Destination {id} not found"));

    private ActionResult ToError(DestinationWriteError error, SaveDestinationDto? input, int? id = null) => error switch
    {
        DestinationWriteError.NotFound => NotFound(ApiResponse<DestinationDto>.Fail($"Destination {id} not found")),
        DestinationWriteError.Duplicate => Conflict(ApiResponse<DestinationDto>.FieldFail("name", $"{input!.Name.Trim()}, {input.Country.Trim()} is already in your list.")),
        _ => throw new InvalidOperationException($"Unhandled error {error}"),
    };
}
