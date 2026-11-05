using Server.Api.Models.Dto;

namespace Server.Api.Services;

// Phase 2 data source: fixed, read-only data. Registered as a singleton because it holds no per-request state.
public class InMemoryStudentService : IStudentService
{
    private static readonly IReadOnlyList<StudentDto> Students =
    [
        new(1, "Asha Verma", "asha@example.com", "Computer Science", 3, true),
        new(2, "Ravi Kumar", "ravi@example.com", "Mechanical", 2, true),
        new(3, "Meera Shah", "meera@example.com", "Electronics", 4, false),
        new(4, "Arjun Singh", "arjun@example.com", "Computer Science", 1, true),
    ];

    public IReadOnlyList<StudentDto> GetAll() => Students;

    public StudentDto? GetById(int id) => Students.FirstOrDefault(s => s.Id == id);
}
