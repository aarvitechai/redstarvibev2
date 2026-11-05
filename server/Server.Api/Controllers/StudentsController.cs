using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Server.Api.Models;
using Server.Api.Models.Dto;
using Server.Api.Services;

namespace Server.Api.Controllers;

[ApiController]
[Route("api/[controller]")] // -> /api/students
public class StudentsController(IStudentService students) : ControllerBase // primary-constructor DI
{
    // GET /api/students?search=comp
    // Validation attributes work on query parameters too: a search term over 100 chars gets a 400.
    [HttpGet]
    [ProducesResponseType<ApiResponse<IReadOnlyList<StudentDto>>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status400BadRequest)]
    public ActionResult<ApiResponse<IReadOnlyList<StudentDto>>> GetAll([FromQuery, StringLength(100)] string? search = null) =>
        Ok(ApiResponse<IReadOnlyList<StudentDto>>.Ok(students.GetAll(search)));

    // GET /api/students/2  -> 200, or 404 with the envelope
    [HttpGet("{id:int}")]
    [ProducesResponseType<ApiResponse<StudentDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<StudentDto>>(StatusCodes.Status404NotFound)]
    public ActionResult<ApiResponse<StudentDto>> GetById(int id)
    {
        var student = students.GetById(id);
        return student is null
            ? NotFound(ApiResponse<StudentDto>.Fail($"Student {id} not found"))
            : Ok(ApiResponse<StudentDto>.Ok(student));
    }

    // POST /api/students  -> 201 Created + Location header, 400 invalid, 409 duplicate email
    [HttpPost]
    [ProducesResponseType<ApiResponse<StudentDto>>(StatusCodes.Status201Created)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiResponse<StudentDto>>(StatusCodes.Status409Conflict)]
    public ActionResult<ApiResponse<StudentDto>> Create(CreateStudentDto input)
    {
        var result = students.Create(input);
        if (!result.Succeeded) return ToErrorResponse(result.Error, input.Email);

        return CreatedAtAction(nameof(GetById), new { id = result.Student!.Id }, ApiResponse<StudentDto>.Ok(result.Student));
    }

    // PUT /api/students/2  -> 200, 400, 404, 409
    [HttpPut("{id:int}")]
    [ProducesResponseType<ApiResponse<StudentDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiResponse<StudentDto>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<StudentDto>>(StatusCodes.Status409Conflict)]
    public ActionResult<ApiResponse<StudentDto>> Update(int id, UpdateStudentDto input)
    {
        var result = students.Update(id, input);
        return result.Succeeded
            ? Ok(ApiResponse<StudentDto>.Ok(result.Student!))
            : ToErrorResponse(result.Error, input.Email, id);
    }

    // DELETE /api/students/2  -> 204 No Content, or 404
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public IActionResult Delete(int id) =>
        students.Delete(id)
            ? NoContent()
            : NotFound(ApiResponse<object>.Fail($"Student {id} not found"));

    private ActionResult ToErrorResponse(StudentWriteError error, string email, int? id = null) => error switch
    {
        StudentWriteError.NotFound => NotFound(ApiResponse<StudentDto>.Fail($"Student {id} not found")),
        StudentWriteError.DuplicateEmail => Conflict(ApiResponse<StudentDto>.Fail($"Email '{email}' is already in use")),
        _ => throw new InvalidOperationException($"Unhandled error {error}"),
    };
}
