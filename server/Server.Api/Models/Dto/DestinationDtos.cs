using System.ComponentModel.DataAnnotations;

namespace Server.Api.Models.Dto;

// Phase 10: Destination Manager (Project 5), the data behind the RTK Query lessons
public record DestinationDto(int Id, string Name, string Country, string Description, int Rating, bool IsVisited, DateTimeOffset CreatedAt);

public record SaveDestinationDto(
    [Required(ErrorMessage = "Name is required."), StringLength(80, MinimumLength = 2, ErrorMessage = "Name must be 2 to 80 characters.")]
    string Name,
    [Required(ErrorMessage = "Country is required."), StringLength(60, MinimumLength = 2, ErrorMessage = "Country must be 2 to 60 characters.")]
    string Country,
    [StringLength(500, ErrorMessage = "Description must be at most 500 characters.")]
    string? Description,
    [Range(1, 5, ErrorMessage = "Rating must be 1 to 5.")]
    int Rating,
    bool IsVisited = false);

public record SetVisitedDto(bool IsVisited);
