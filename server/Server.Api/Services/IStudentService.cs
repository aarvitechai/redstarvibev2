using Server.Api.Models.Dto;

namespace Server.Api.Services;

// The result of a write: either the student, or the reason it failed.
// The controller maps each reason to an HTTP status code; the service knows nothing about HTTP.
public enum StudentWriteError { None, NotFound, DuplicateEmail }

public record StudentWriteResult(StudentDto? Student, StudentWriteError Error = StudentWriteError.None)
{
    public bool Succeeded => Error == StudentWriteError.None;
}

// Controllers depend on this interface, not on a concrete class.
// Phase 11 swaps the in-memory version for an EF Core one without touching the controller.
public interface IStudentService
{
    // search: optional, case-insensitive match on name, email or course
    IReadOnlyList<StudentDto> GetAll(string? search = null);
    StudentDto? GetById(int id);
    StudentWriteResult Create(CreateStudentDto input);
    StudentWriteResult Update(int id, UpdateStudentDto input);
    bool Delete(int id);
}
