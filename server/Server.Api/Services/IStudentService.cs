using Server.Api.Models.Dto;

namespace Server.Api.Services;

// Controllers depend on this interface, not on a concrete class.
// Phase 11 swaps the in-memory version for an EF Core one without touching the controller.
public interface IStudentService
{
    IReadOnlyList<StudentDto> GetAll();
    StudentDto? GetById(int id);
}
