namespace Server.Tests.Learning.Phase01;

// Phase 1 PRACTICE (C#): immutable add / update / remove / toggle.
// On the server you usually let EF Core track entity changes. But for DTOs, value objects,
// and pure business rules, this immutable style is safer and easy to test.

public record User(int Id, string Name, string Email, bool Active = true);

// What the client may send: no Id and no Active flag.
// This is how you prevent over-posting (the server decides those values).
public record NewUser(string Name, string Email);

public static class UserListOps
{
    public static readonly IReadOnlyList<User> InitialUsers =
    [
        new(1, "Asha", "asha@example.com"),
        new(2, "Ravi", "ravi@example.com", Active: false),
    ];

    public static int NextId(IReadOnlyList<User> users) => users.Count == 0 ? 1 : users.Max(u => u.Id) + 1;

    // [.. users, x] is C#'s spread: it builds a NEW list
    public static IReadOnlyList<User> Add(IReadOnlyList<User> users, NewUser input) =>
        [.. users, new User(NextId(users), input.Name, input.Email)];

    // The record `with` expression replaces only the matching item. The Id can't change.
    public static IReadOnlyList<User> UpdateName(IReadOnlyList<User> users, int id, string name) =>
        [.. users.Select(u => u.Id == id ? u with { Name = name } : u)];

    public static IReadOnlyList<User> Remove(IReadOnlyList<User> users, int id) =>
        [.. users.Where(u => u.Id != id)];

    public static IReadOnlyList<User> ToggleActive(IReadOnlyList<User> users, int id) =>
        [.. users.Select(u => u.Id == id ? u with { Active = !u.Active } : u)];

    public static int CountActive(IEnumerable<User> users) => users.Count(u => u.Active);
}
