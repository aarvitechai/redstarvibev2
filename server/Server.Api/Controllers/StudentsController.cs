using Microsoft.AspNetCore.Mvc;
using Server.Api.Models;
using Server.Api.Models.Dto;
using Server.Api.Services;

namespace Server.Api.Controllers;

[ApiController]
[Route("api/[controller]")] // -> /api/students
public class StudentsController(IStudentService students) : ControllerBase // primary-constructor DI
{
    // GET /api/students
    [HttpGet]
    [ProducesResponseType<ApiResponse<IReadOnlyList<StudentDto>>>(StatusCodes.Status200OK)]
    public ActionResult<ApiResponse<IReadOnlyList<StudentDto>>> GetAll() =>
        Ok(ApiResponse<IReadOnlyList<StudentDto>>.Ok(students.GetAll()));

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
}
