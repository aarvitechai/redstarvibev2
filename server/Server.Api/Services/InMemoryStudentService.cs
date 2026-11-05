using Server.Api.Models.Dto;

namespace Server.Api.Services;

// Phase 3 data source: in-memory and now WRITABLE. It's a singleton, so ONE instance serves every request
// at the same time. Shared mutable state needs a lock, or two concurrent POSTs could get the same id.
// (EF Core in Phase 11 replaces this; the database then handles concurrency.)
public class InMemoryStudentService : IStudentService
{
    private readonly Lock _gate = new();
    private readonly List<StudentDto> _students =
    [
        new(1, "Asha Verma", "asha@example.com", "Computer Science", 3, true),
        new(2, "Ravi Kumar", "ravi@example.com", "Mechanical", 2, true),
        new(3, "Meera Shah", "meera@example.com", "Electronics", 4, false),
        new(4, "Arjun Singh", "arjun@example.com", "Computer Science", 1, true),
    ];
    private int _nextId = 5;

    // Return a COPY: callers must never be able to change our internal list.
    public IReadOnlyList<StudentDto> GetAll(string? search = null)
    {
        var term = search?.Trim();
        lock (_gate)
        {
            if (string.IsNullOrEmpty(term)) return [.. _students];

            return [.. _students.Where(s =>
                s.Name.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                s.Email.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                s.Course.Contains(term, StringComparison.OrdinalIgnoreCase))];
        }
    }

    public StudentDto? GetById(int id)
    {
        lock (_gate) return _students.FirstOrDefault(s => s.Id == id);
    }

    public StudentWriteResult Create(CreateStudentDto input)
    {
        lock (_gate)
        {
            if (EmailTaken(input.Email, exceptId: null)) return new(null, StudentWriteError.DuplicateEmail);

            // The server decides Id and IsActive, never the client
            var student = new StudentDto(_nextId++, input.Name.Trim(), input.Email.Trim(), input.Course.Trim(), input.Year, true);
            _students.Add(student);
            return new(student);
        }
    }

    public StudentWriteResult Update(int id, UpdateStudentDto input)
    {
        lock (_gate)
        {
            var index = _students.FindIndex(s => s.Id == id);
            if (index < 0) return new(null, StudentWriteError.NotFound);
            if (EmailTaken(input.Email, exceptId: id)) return new(null, StudentWriteError.DuplicateEmail);

            // Records are immutable: build a new one with `with` and swap it in
            var updated = _students[index] with
            {
                Name = input.Name.Trim(),
                Email = input.Email.Trim(),
                Course = input.Course.Trim(),
                Year = input.Year,
                IsActive = input.IsActive,
            };
            _students[index] = updated;
            return new(updated);
        }
    }

    public bool Delete(int id)
    {
        lock (_gate) return _students.RemoveAll(s => s.Id == id) > 0;
    }

    private bool EmailTaken(string email, int? exceptId) =>
        _students.Any(s => s.Id != exceptId && string.Equals(s.Email, email.Trim(), StringComparison.OrdinalIgnoreCase));
}
