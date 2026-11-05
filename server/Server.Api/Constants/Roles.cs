namespace Server.Api.Constants;

// plan.md decision: define role names ONCE and reuse them in seeding, token claims and [Authorize(Roles = ...)].
// Role checks are CASE-SENSITIVE, so a typo like "admin" silently denies access. Constants make typos compile errors.
public static class Roles
{
    public const string Admin = "Admin";
    public const string Customer = "Customer";

    public static readonly IReadOnlyList<string> All = [Admin, Customer];
}
