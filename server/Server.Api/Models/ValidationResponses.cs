using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Server.Api.Models;

// Turns ASP.NET Core's ModelState errors into our ApiResponse envelope.
// ModelState keys look like "Name", "Email" or "$.year" (for JSON type errors), so we normalise them to the
// camelCase names the clients use for their inputs: "name", "email", "year".
public static class ValidationResponses
{
    public static IActionResult InvalidModelState(ActionContext context) =>
        new BadRequestObjectResult(ApiResponse<object>.ValidationFail(ToFieldErrors(context.ModelState)));

    public static IReadOnlyDictionary<string, string[]> ToFieldErrors(ModelStateDictionary modelState) =>
        modelState
            .Where(entry => entry.Value?.Errors.Count > 0)
            .GroupBy(entry => ToFieldName(entry.Key))
            .ToDictionary(
                g => g.Key,
                g => g.SelectMany(entry => entry.Value!.Errors)
                      .Select(e => string.IsNullOrWhiteSpace(e.ErrorMessage) ? "The value is invalid." : e.ErrorMessage)
                      .Distinct()
                      .ToArray());

    private static string ToFieldName(string key)
    {
        var name = key.StartsWith("$.") ? key[2..] : key;
        if (name is "" or "$") return "_";  // an error about the whole body (e.g. malformed JSON)
        return char.ToLowerInvariant(name[0]) + name[1..];
    }
}
