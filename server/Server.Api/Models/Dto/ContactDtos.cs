using System.ComponentModel.DataAnnotations;

namespace Server.Api.Models.Dto;

// Phase 5: Contact List (Project 2)
public record ContactDto(int Id, string Name, string Email, string? Phone, bool IsFavourite, DateTimeOffset CreatedAt);

// The SAME rules are mirrored on the clients for instant feedback, but THESE are the ones that count:
// anyone can skip the browser and call the API directly with curl.
public static class ContactRules
{
    public const string PhonePattern = @"^[0-9+()\-\s]{7,20}$";
    public const string PhoneMessage = "Phone may contain digits, spaces, + ( ) - and be 7 to 20 characters.";
}

public record SaveContactDto(
    [Required(ErrorMessage = "Name is required.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Name must be 2 to 100 characters.")]
    string Name,

    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Enter a valid email address.")]
    [StringLength(200, ErrorMessage = "Email must be at most 200 characters.")]
    string Email,

    [RegularExpression(ContactRules.PhonePattern, ErrorMessage = ContactRules.PhoneMessage)]
    string? Phone,

    bool IsFavourite = false);

public record SetFavouriteDto(bool IsFavourite);
