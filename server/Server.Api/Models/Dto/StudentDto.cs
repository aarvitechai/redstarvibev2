namespace Server.Api.Models.Dto;

// A DTO is the public contract the API sends. Phase 11 adds entities; DTOs stay separate from them.
public record StudentDto(int Id, string Name, string Email, string Course, int Year, bool IsActive);
