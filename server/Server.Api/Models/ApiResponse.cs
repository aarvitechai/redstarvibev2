namespace Server.Api.Models;

// One response shape for every endpoint (plan.md decision: real HTTP status code AND an envelope).
// Clients read `data` on success. On failure they read `errors` (messages to show),
// and `fieldErrors` (per input, keyed by the camelCase field name) so forms can show each error next to its field.
public record ApiResponse<T>(
    bool Success,
    T? Data,
    IReadOnlyList<string> Errors,
    IReadOnlyDictionary<string, string[]>? FieldErrors = null)
{
    public static ApiResponse<T> Ok(T data) => new(true, data, []);
    public static ApiResponse<T> Fail(params string[] errors) => new(false, default, errors);

    // A failure tied to specific fields, e.g. FieldFail("email", "Email is already in use")
    public static ApiResponse<T> FieldFail(string field, string message) =>
        new(false, default, [message], new Dictionary<string, string[]> { [field] = [message] });

    public static ApiResponse<T> ValidationFail(IReadOnlyDictionary<string, string[]> fieldErrors) =>
        new(false, default, [.. fieldErrors.SelectMany(f => f.Value)], fieldErrors);
}
