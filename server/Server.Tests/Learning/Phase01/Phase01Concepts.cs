namespace Server.Tests.Learning.Phase01;

// Phase 1 (C#): the backend equivalents of the modern-JS ideas.
//
//   JS                         C#
//   const / let                readonly field, const / var (var is type inference, NOT JS var)
//   arrow fn  (a,b) => a+b     lambda    (a, b) => a + b ; expression-bodied members
//   destructuring              tuple / positional record deconstruction
//   spread  [...a, x]          collection expression  [.. a, x] ; record `with { }`
//   map / filter / find        Select / Where / FirstOrDefault (LINQ)
//   reduce                     Aggregate / Sum
//   some / every               Any / All
//   sort (mutates)             List.Sort (mutates)  vs  OrderBy (returns new)
//   truthy / falsy             no such thing: conditions must be bool
//   ?? and ?.                  ?? and ?. (same meaning)
//   Promise / async-await      Task / async-await ; Promise.all = Task.WhenAll

public enum Category { Main, Side, Drink }

// A positional record: immutable, value equality, deconstruction, `with` copies. Ideal for DTOs.
public record Product(int Id, string Name, decimal Price, Category Category, bool InStock);

public static class Basics
{
    public static int Add(int a, int b) => a + b;              // expression-bodied ("arrow") method
    public static readonly Func<int, int> Square = x => x * x; // a lambda stored in a delegate

    // Deconstruction: the C# version of `const { name, price } = product`
    public static string Describe(Product product)
    {
        var (_, name, price, _, _) = product;
        return $"{name} costs {price:0.00}";
    }

    // Tuples: return several values, then destructure them at the call site
    public static (int Min, int Max) Range(IEnumerable<int> nums) => (nums.Min(), nums.Max());

    // params = rest parameters
    public static int Sum(params int[] nums) => nums.Sum();

    // Spread for objects: `with` creates a NEW record and changes only what you list
    public static Product Discount(Product p, decimal percent) =>
        p with { Price = Math.Round(p.Price * (1 - percent / 100m), 2) };
}

public static class Linq
{
    public static readonly IReadOnlyList<Product> Products =
    [
        new(1, "Burger", 8.5m, Category.Main, true),
        new(2, "Fries", 3.0m, Category.Side, true),
        new(3, "Salad", 6.25m, Category.Main, false),
        new(4, "Cola", 2.0m, Category.Drink, true),
    ];

    public static List<string> Names(IEnumerable<Product> items) => items.Select(p => p.Name).ToList();         // map
    public static List<Product> InStock(IEnumerable<Product> items) => items.Where(p => p.InStock).ToList();    // filter
    public static Product? FindById(IEnumerable<Product> items, int id) => items.FirstOrDefault(p => p.Id == id); // find
    public static decimal Total(IEnumerable<Product> items) => items.Sum(p => p.Price);                         // reduce (sum)
    public static decimal TotalWithAggregate(IEnumerable<Product> items) =>
        items.Aggregate(0m, (total, p) => total + p.Price);                                                     // reduce (general)
    public static Dictionary<Category, List<Product>> GroupByCategory(IEnumerable<Product> items) =>
        items.GroupBy(p => p.Category).ToDictionary(g => g.Key, g => g.ToList());
    public static bool HasOutOfStock(IEnumerable<Product> items) => items.Any(p => !p.InStock);                // some
    public static bool AllPriced(IEnumerable<Product> items) => items.All(p => p.Price > 0);                   // every

    // List<T>.Sort MUTATES the list (like JS sort). OrderBy returns a NEW sequence.
    public static void SortInPlaceWrong(List<Product> items) => items.Sort((a, b) => a.Price.CompareTo(b.Price));
    public static List<Product> SortByPrice(IEnumerable<Product> items) => items.OrderBy(p => p.Price).ToList();

    // LINQ is LAZY (like an Observable): the query runs only when you enumerate it (ToList, foreach, Count...)
    public static IEnumerable<string> CheapMainsInStockQuery(IEnumerable<Product> items) =>
        items.Where(p => p.InStock && p.Category == Category.Main)
             .OrderBy(p => p.Price)
             .Select(p => p.Name);
}

public static class Values
{
    // No truthy/falsy: `if (count)` does not compile. You must write the condition explicitly.
    public static bool HasItems(int count) => count > 0;

    // ?? and ?. work exactly like in JS
    public record Address(string? City);
    public record Person(string Name, Address? Address);
    public static string GetCity(Person? p) => p?.Address?.City ?? "unknown";

    // ?? only replaces null. An int can't be null unless it is `int?`, so there is no `0 || 1` trap.
    public static int QtyOrDefault(int? qty) => qty ?? 1;

    // Records compare by VALUE; classes compare by REFERENCE (like JS objects).
    public class PlainUser(string name) { public string Name { get; } = name; }
    public static bool RecordsEqual() => new Address("Pune") == new Address("Pune");                 // true
    public static bool ClassesEqual() => ReferenceEquals(new PlainUser("A"), new PlainUser("A"));     // false

    // `with` is shallow too: a nested record must be copied explicitly
    public static Person UpdateCity(Person p, string city) =>
        p with { Address = (p.Address ?? new Address(null)) with { City = city } };
}

public static class AsyncDemo
{
    private static readonly Dictionary<int, string> FakeDb = new() { [1] = "Asha", [2] = "Ravi" };

    public static async Task<string> FetchUserAsync(int id, CancellationToken ct = default)
    {
        await Task.Delay(10, ct); // pass the CancellationToken down: the C# version of AbortController
        return FakeDb.TryGetValue(id, out var name) ? name : throw new KeyNotFoundException($"User {id} not found");
    }

    public static async Task<string> GetUserNameAsync(int id)
    {
        try { return await FetchUserAsync(id); }
        catch (KeyNotFoundException) { return "Guest"; }
    }

    // Promise.all  ->  Task.WhenAll (it throws if any task fails)
    public static Task<string[]> LoadParallelAsync(IEnumerable<int> ids) =>
        Task.WhenAll(ids.Select(id => FetchUserAsync(id)));

    // Promise.allSettled  ->  wait for all, then inspect each task's status
    public static async Task<List<string>> LoadWhatYouCanAsync(IEnumerable<int> ids)
    {
        var tasks = ids.Select(id => FetchUserAsync(id)).ToList();
        try { await Task.WhenAll(tasks); } catch { /* inspect each task below */ }
        return tasks.Where(t => t.IsCompletedSuccessfully).Select(t => t.Result).ToList();
    }
}
