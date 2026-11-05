using Server.Api.Models.Dto;
using Server.Api.Services;

namespace Server.Tests;

// Unit tests: call the service directly (no HTTP), so they're fast and can test the edge cases precisely.
public class InMemoryStudentServiceTests
{
    private readonly InMemoryStudentService _service = new();

    [Fact]
    public void GetAll_ReturnsASnapshot_NotTheInternalList()
    {
        var snapshot = _service.GetAll();
        _service.Create(new CreateStudentDto("Later", "later@example.com", "Civil", 1));

        Assert.Equal(4, snapshot.Count);              // the earlier snapshot is unaffected
        Assert.Equal(5, _service.GetAll().Count);
        Assert.IsNotType<List<StudentDto>>(snapshot); // the caller can't cast it back and change our list
    }

    [Fact]
    public void Create_TrimsInput_AndAssignsNextId()
    {
        var result = _service.Create(new CreateStudentDto("  Neha  ", " neha@example.com ", " Civil ", 1));

        Assert.True(result.Succeeded);
        Assert.Equal(new StudentDto(5, "Neha", "neha@example.com", "Civil", 1, true), result.Student);
    }

    [Fact]
    public void Update_CanKeepItsOwnEmail_ButNotTakeSomeoneElses()
    {
        var keepOwn = _service.Update(1, new UpdateStudentDto("Asha V", "asha@example.com", "CS", 3, true));
        var takeOther = _service.Update(1, new UpdateStudentDto("Asha V", "ravi@example.com", "CS", 3, true));

        Assert.True(keepOwn.Succeeded);
        Assert.Equal(StudentWriteError.DuplicateEmail, takeOther.Error);
    }

    [Fact]
    public async Task ConcurrentCreates_NeverProduceDuplicateIds()
    {
        var tasks = Enumerable.Range(0, 200).Select(i =>
            Task.Run(() => _service.Create(new CreateStudentDto($"User {i}", $"user{i}@example.com", "Load", 1))));

        var results = await Task.WhenAll(tasks);

        Assert.All(results, r => Assert.True(r.Succeeded));
        Assert.Equal(200, results.Select(r => r.Student!.Id).Distinct().Count());
        Assert.Equal(204, _service.GetAll().Count);
    }
}
