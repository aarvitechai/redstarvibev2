using Server.Api.Models;
using Server.Api.Models.Dto;

namespace Server.Api.Services;

public enum DestinationWriteError { None, NotFound, Duplicate }

public record DestinationWriteResult(DestinationDto? Destination, DestinationWriteError Error = DestinationWriteError.None)
{
    public bool Succeeded => Error == DestinationWriteError.None;
}

public record DestinationQuery(string? Search = null, bool? Visited = null);

public interface IDestinationService
{
    PagedResult<DestinationDto> Find(DestinationQuery query, PageRequest page);
    DestinationDto? GetById(int id);
    DestinationWriteResult Create(SaveDestinationDto input);
    DestinationWriteResult Update(int id, SaveDestinationDto input);
    DestinationWriteResult SetVisited(int id, bool isVisited);
    bool Delete(int id);
}

// In memory and thread-safe (singleton). Phase 11 shows the same paging against SQL Server with EF Core.
public class InMemoryDestinationService : IDestinationService
{
    private readonly Lock _gate = new();
    private readonly List<DestinationDto> _items = [];
    private readonly TimeProvider _clock;
    private int _nextId = 1;

    public InMemoryDestinationService(TimeProvider clock)
    {
        _clock = clock;
        (string Name, string Country, string Description, int Rating, bool Visited)[] seed =
        [
            ("Jaipur", "India", "The Pink City: forts, palaces and bazaars.", 5, true),
            ("Kerala Backwaters", "India", "Houseboats on calm lagoons and canals.", 5, false),
            ("Leh", "India", "High-altitude desert, monasteries and passes.", 4, false),
            ("Varanasi", "India", "Ghats on the Ganges at sunrise.", 4, true),
            ("Hampi", "India", "Boulder landscapes and Vijayanagara ruins.", 4, false),
            ("Kyoto", "Japan", "Temples, gardens and old wooden streets.", 5, false),
            ("Lisbon", "Portugal", "Trams, tiles and viewpoints over the Tagus.", 4, true),
            ("Cape Town", "South Africa", "Table Mountain and two oceans.", 5, false),
            ("Reykjavik", "Iceland", "The gateway to glaciers and the northern lights.", 4, false),
            ("Cusco", "Peru", "The Inca capital, on the way to Machu Picchu.", 5, false),
            ("Istanbul", "Turkey", "Where Europe meets Asia across the Bosphorus.", 5, true),
            ("Hanoi", "Vietnam", "Street food, lakes and the Old Quarter.", 4, false),
            ("Queenstown", "New Zealand", "Lakes, mountains and adventure sports.", 4, false),
            ("Marrakesh", "Morocco", "Souks, riads and the Atlas mountains.", 4, false),
        ];
        foreach (var s in seed) Create(new SaveDestinationDto(s.Name, s.Country, s.Description, s.Rating, s.Visited));
    }

    public PagedResult<DestinationDto> Find(DestinationQuery query, PageRequest page)
    {
        lock (_gate)
        {
            IEnumerable<DestinationDto> result = _items;
            var term = query.Search?.Trim();
            if (!string.IsNullOrEmpty(term))
                result = result.Where(d => d.Name.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                                           d.Country.Contains(term, StringComparison.OrdinalIgnoreCase));
            if (query.Visited is { } visited) result = result.Where(d => d.IsVisited == visited);

            // A STABLE order is required for paging: without one, an item could appear on two pages, or on none
            return PagedResult<DestinationDto>.From(result.OrderBy(d => d.Name, StringComparer.OrdinalIgnoreCase).ThenBy(d => d.Id), page);
        }
    }

    public DestinationDto? GetById(int id)
    {
        lock (_gate) return _items.FirstOrDefault(d => d.Id == id);
    }

    public DestinationWriteResult Create(SaveDestinationDto input)
    {
        lock (_gate)
        {
            if (IsDuplicate(input, exceptId: null)) return new(null, DestinationWriteError.Duplicate);
            var d = new DestinationDto(_nextId++, input.Name.Trim(), input.Country.Trim(), input.Description?.Trim() ?? "", input.Rating, input.IsVisited, _clock.GetUtcNow());
            _items.Add(d);
            return new(d);
        }
    }

    public DestinationWriteResult Update(int id, SaveDestinationDto input)
    {
        lock (_gate)
        {
            var index = _items.FindIndex(d => d.Id == id);
            if (index < 0) return new(null, DestinationWriteError.NotFound);
            if (IsDuplicate(input, exceptId: id)) return new(null, DestinationWriteError.Duplicate);
            _items[index] = _items[index] with
            {
                Name = input.Name.Trim(),
                Country = input.Country.Trim(),
                Description = input.Description?.Trim() ?? "",
                Rating = input.Rating,
                IsVisited = input.IsVisited,
            };
            return new(_items[index]);
        }
    }

    public DestinationWriteResult SetVisited(int id, bool isVisited)
    {
        lock (_gate)
        {
            var index = _items.FindIndex(d => d.Id == id);
            if (index < 0) return new(null, DestinationWriteError.NotFound);
            _items[index] = _items[index] with { IsVisited = isVisited };
            return new(_items[index]);
        }
    }

    public bool Delete(int id)
    {
        lock (_gate) return _items.RemoveAll(d => d.Id == id) > 0;
    }

    private bool IsDuplicate(SaveDestinationDto input, int? exceptId) =>
        _items.Any(d => d.Id != exceptId &&
                        string.Equals(d.Name, input.Name.Trim(), StringComparison.OrdinalIgnoreCase) &&
                        string.Equals(d.Country, input.Country.Trim(), StringComparison.OrdinalIgnoreCase));
}
