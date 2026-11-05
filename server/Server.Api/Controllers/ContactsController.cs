using Microsoft.AspNetCore.Mvc;
using Server.Api.Models;
using Server.Api.Models.Dto;
using Server.Api.Services;

namespace Server.Api.Controllers;

[ApiController]
[Route("api/[controller]")] // -> /api/contacts
public class ContactsController(IContactService contacts) : ControllerBase
{
    // GET /api/contacts  (favourites first, then by name)
    [HttpGet]
    [ProducesResponseType<ApiResponse<IReadOnlyList<ContactDto>>>(StatusCodes.Status200OK)]
    public ActionResult<ApiResponse<IReadOnlyList<ContactDto>>> GetAll() =>
        Ok(ApiResponse<IReadOnlyList<ContactDto>>.Ok(contacts.GetAll()));

    // POST /api/contacts  -> 201, 400 (fieldErrors), 409 (fieldErrors.email)
    [HttpPost]
    [ProducesResponseType<ApiResponse<ContactDto>>(StatusCodes.Status201Created)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiResponse<ContactDto>>(StatusCodes.Status409Conflict)]
    public ActionResult<ApiResponse<ContactDto>> Create(SaveContactDto input)
    {
        var result = contacts.Create(input);
        return result.Succeeded
            ? Created($"/api/contacts/{result.Contact!.Id}", ApiResponse<ContactDto>.Ok(result.Contact))
            : ToError(result.Error, input.Email);
    }

    // PUT /api/contacts/2  -> 200, 400, 404, 409
    [HttpPut("{id:int}")]
    [ProducesResponseType<ApiResponse<ContactDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiResponse<ContactDto>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<ContactDto>>(StatusCodes.Status409Conflict)]
    public ActionResult<ApiResponse<ContactDto>> Update(int id, SaveContactDto input)
    {
        var result = contacts.Update(id, input);
        return result.Succeeded ? Ok(ApiResponse<ContactDto>.Ok(result.Contact!)) : ToError(result.Error, input.Email, id);
    }

    // PUT /api/contacts/2/favourite  { "isFavourite": true }
    // A small dedicated endpoint: toggling a star shouldn't need the whole contact (or risk overwriting other edits).
    [HttpPut("{id:int}/favourite")]
    [ProducesResponseType<ApiResponse<ContactDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<ContactDto>>(StatusCodes.Status404NotFound)]
    public ActionResult<ApiResponse<ContactDto>> SetFavourite(int id, SetFavouriteDto input)
    {
        var result = contacts.SetFavourite(id, input.IsFavourite);
        return result.Succeeded ? Ok(ApiResponse<ContactDto>.Ok(result.Contact!)) : ToError(result.Error, "", id);
    }

    // DELETE /api/contacts/2  -> 204, 404
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public IActionResult Delete(int id) =>
        contacts.Delete(id) ? NoContent() : NotFound(ApiResponse<object>.Fail($"Contact {id} not found"));

    private ActionResult ToError(ContactWriteError error, string email, int? id = null) => error switch
    {
        ContactWriteError.NotFound => NotFound(ApiResponse<ContactDto>.Fail($"Contact {id} not found")),
        // 409 + a field error: the form shows this message under the Email input
        ContactWriteError.DuplicateEmail => Conflict(ApiResponse<ContactDto>.FieldFail("email", $"Email '{email.Trim()}' is already in use.")),
        _ => throw new InvalidOperationException($"Unhandled error {error}"),
    };
}
