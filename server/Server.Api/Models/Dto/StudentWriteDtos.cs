using System.ComponentModel.DataAnnotations;

namespace Server.Api.Models.Dto;

// Input DTOs: only the fields a client is ALLOWED to send. No Id, so over-posting an Id is impossible.
// [ApiController] validates these attributes automatically and returns 400 before the action runs.
public record CreateStudentDto(
    [Required, StringLength(100, MinimumLength = 2)] string Name,
    [Required, EmailAddress, StringLength(200)] string Email,
    [Required, StringLength(100, MinimumLength = 2)] string Course,
    [Range(1, 5)] int Year);

public record UpdateStudentDto(
    [Required, StringLength(100, MinimumLength = 2)] string Name,
    [Required, EmailAddress, StringLength(200)] string Email,
    [Required, StringLength(100, MinimumLength = 2)] string Course,
    [Range(1, 5)] int Year,
    bool IsActive);
