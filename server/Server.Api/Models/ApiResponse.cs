namespace Server.Api.Models;

// One response shape for every endpoint (plan.md decision: real HTTP status code AND an envelope).
// Clients always read `data` on success and `errors` on failure.
public record ApiResponse<T>(bool Success, T? Data, IReadOnlyList<string> Errors)
{
    public static ApiResponse<T> Ok(T data) => new(true, data, []);
    public static ApiResponse<T> Fail(params string[] errors) => new(false, default, errors);
}
