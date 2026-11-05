using Server.Api.Models.Dto;

namespace Server.Api.Services;

public enum ContactWriteError { None, NotFound, DuplicateEmail }

public record ContactWriteResult(ContactDto? Contact, ContactWriteError Error = ContactWriteError.None)
{
    public bool Succeeded => Error == ContactWriteError.None;
}

public interface IContactService
{
    IReadOnlyList<ContactDto> GetAll();
    ContactWriteResult Create(SaveContactDto input);
    ContactWriteResult Update(int id, SaveContactDto input);
    ContactWriteResult SetFavourite(int id, bool isFavourite);
    bool Delete(int id);
}

// In memory and thread-safe (singleton), like the student service. EF Core replaces it in Phase 11.
// TimeProvider is injected instead of calling DateTimeOffset.UtcNow directly, so tests can control "now".
public class InMemoryContactService(TimeProvider clock) : IContactService
{
    private readonly Lock _gate = new();
    private readonly List<ContactDto> _contacts = [];
    private int _nextId = 1;

    public InMemoryContactService() : this(TimeProvider.System)
    {
        Seed("Asha Verma", "asha@example.com", "+91 98765 43210", isFavourite: true);
        Seed("Ravi Kumar", "ravi@example.com", null, isFavourite: false);
        Seed("Meera Shah", "meera@example.com", "022 2345 6789", isFavourite: false);
    }

    // Favourites first, then by name: the order the UI shows
    public IReadOnlyList<ContactDto> GetAll()
    {
        lock (_gate)
            return [.. _contacts.OrderByDescending(c => c.IsFavourite).ThenBy(c => c.Name, StringComparer.OrdinalIgnoreCase)];
    }

    public ContactWriteResult Create(SaveContactDto input)
    {
        lock (_gate)
        {
            if (EmailTaken(input.Email, exceptId: null)) return new(null, ContactWriteError.DuplicateEmail);
            var contact = new ContactDto(_nextId++, input.Name.Trim(), input.Email.Trim(), Clean(input.Phone), input.IsFavourite, clock.GetUtcNow());
            _contacts.Add(contact);
            return new(contact);
        }
    }

    public ContactWriteResult Update(int id, SaveContactDto input)
    {
        lock (_gate)
        {
            var index = _contacts.FindIndex(c => c.Id == id);
            if (index < 0) return new(null, ContactWriteError.NotFound);
            if (EmailTaken(input.Email, exceptId: id)) return new(null, ContactWriteError.DuplicateEmail);

            // Id and CreatedAt are kept from the stored record: the client can't change them
            var updated = _contacts[index] with
            {
                Name = input.Name.Trim(),
                Email = input.Email.Trim(),
                Phone = Clean(input.Phone),
                IsFavourite = input.IsFavourite,
            };
            _contacts[index] = updated;
            return new(updated);
        }
    }

    public ContactWriteResult SetFavourite(int id, bool isFavourite)
    {
        lock (_gate)
        {
            var index = _contacts.FindIndex(c => c.Id == id);
            if (index < 0) return new(null, ContactWriteError.NotFound);
            _contacts[index] = _contacts[index] with { IsFavourite = isFavourite };
            return new(_contacts[index]);
        }
    }

    public bool Delete(int id)
    {
        lock (_gate) return _contacts.RemoveAll(c => c.Id == id) > 0;
    }

    private void Seed(string name, string email, string? phone, bool isFavourite) =>
        Create(new SaveContactDto(name, email, phone, isFavourite));

    private static string? Clean(string? phone) => string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();

    private bool EmailTaken(string email, int? exceptId) =>
        _contacts.Any(c => c.Id != exceptId && string.Equals(c.Email, email.Trim(), StringComparison.OrdinalIgnoreCase));
}
