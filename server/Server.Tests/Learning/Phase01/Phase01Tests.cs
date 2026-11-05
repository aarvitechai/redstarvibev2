namespace Server.Tests.Learning.Phase01;

public class Phase01BasicsTests
{
    [Fact]
    public void Lambdas_Deconstruction_Params_With()
    {
        Assert.Equal(5, Basics.Add(2, 3));
        Assert.Equal(16, Basics.Square(4));
        Assert.Equal("Burger costs 8.50", Basics.Describe(Linq.Products[0]));

        var (min, max) = Basics.Range([3, 9, 1]);
        Assert.Equal((1, 9), (min, max));
        Assert.Equal(6, Basics.Sum(1, 2, 3));

        var original = Linq.Products[0];
        var discounted = Basics.Discount(original, 10);
        Assert.Equal(7.65m, discounted.Price);
        Assert.Equal(8.5m, original.Price); // the original record is unchanged
    }
}

public class Phase01LinqTests
{
    private readonly IReadOnlyList<Product> _p = Linq.Products;

    [Fact]
    public void Select_Where_FirstOrDefault()
    {
        Assert.Equal(["Burger", "Fries", "Salad", "Cola"], Linq.Names(_p));
        Assert.Equal(3, Linq.InStock(_p).Count);
        Assert.Null(Linq.FindById(_p, 99));
    }

    [Fact]
    public void Sum_Aggregate_Any_All_GroupBy()
    {
        Assert.Equal(19.75m, Linq.Total(_p));
        Assert.Equal(Linq.Total(_p), Linq.TotalWithAggregate(_p));
        Assert.True(Linq.HasOutOfStock(_p));
        Assert.True(Linq.AllPriced(_p));
        Assert.Equal(2, Linq.GroupByCategory(_p)[Category.Main].Count);
    }

    [Fact]
    public void OrderBy_ReturnsNew_ButListSort_Mutates()
    {
        var list = _p.ToList();
        var sorted = Linq.SortByPrice(list);
        Assert.Equal([4, 2, 3, 1], sorted.Select(x => x.Id));
        Assert.Equal([1, 2, 3, 4], list.Select(x => x.Id)); // untouched

        Linq.SortInPlaceWrong(list);
        Assert.Equal([4, 2, 3, 1], list.Select(x => x.Id)); // mutated!
    }

    [Fact]
    public void Linq_IsLazy_UntilEnumerated()
    {
        var source = _p.ToList();
        var query = Linq.CheapMainsInStockQuery(source); // nothing has run yet
        source.Add(new Product(5, "Wrap", 5m, Category.Main, true));
        Assert.Equal(["Wrap", "Burger"], query.ToList()); // it runs now and sees "Wrap"
    }
}

public class Phase01ValuesTests
{
    [Fact]
    public void NullOperators_And_Equality()
    {
        Assert.False(Values.HasItems(0));
        Assert.Equal("unknown", Values.GetCity(null));
        Assert.Equal("unknown", Values.GetCity(new Values.Person("A", null)));
        Assert.Equal(0, Values.QtyOrDefault(0)); // 0 stays 0
        Assert.Equal(1, Values.QtyOrDefault(null));
        Assert.True(Values.RecordsEqual());
        Assert.False(Values.ClassesEqual());
    }

    [Fact]
    public void NestedWith_CopiesEachLevel()
    {
        var p = new Values.Person("A", new Values.Address("Pune"));
        var next = Values.UpdateCity(p, "Delhi");
        Assert.Equal("Pune", p.Address!.City);
        Assert.Equal("Delhi", next.Address!.City);
    }
}

public class Phase01AsyncTests
{
    [Fact]
    public async Task AwaitAndTryCatch()
    {
        Assert.Equal("Asha", await AsyncDemo.GetUserNameAsync(1));
        Assert.Equal("Guest", await AsyncDemo.GetUserNameAsync(99));
    }

    [Fact]
    public async Task WhenAll_AndAllSettledStyle()
    {
        Assert.Equal(["Asha", "Ravi"], await AsyncDemo.LoadParallelAsync([1, 2]));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => AsyncDemo.LoadParallelAsync([1, 99]));
        Assert.Equal(["Asha", "Ravi"], await AsyncDemo.LoadWhatYouCanAsync([1, 99, 2]));
    }

    [Fact]
    public async Task CancellationToken_CancelsWork()
    {
        using var cts = new CancellationTokenSource();
        cts.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => AsyncDemo.FetchUserAsync(1, cts.Token));
    }
}

public class Phase01PracticeTests
{
    private readonly IReadOnlyList<User> _users = UserListOps.InitialUsers;

    [Fact]
    public void Add_ReturnsNewList_WithServerAssignedId()
    {
        var next = UserListOps.Add(_users, new NewUser("Meera", "m@example.com"));
        Assert.NotSame(_users, next);
        Assert.Equal(3, next.Count);
        Assert.Equal(new User(3, "Meera", "m@example.com", true), next[2]); // record value equality
        Assert.Equal(2, _users.Count);
    }

    [Fact]
    public void Update_ReplacesOnlyTheMatchingItem()
    {
        var next = UserListOps.UpdateName(_users, 1, "Asha K");
        Assert.Equal("Asha K", next[0].Name);
        Assert.Same(_users[1], next[1]); // the untouched item keeps its reference
        Assert.Equal("Asha", _users[0].Name);
    }

    [Fact]
    public void Remove_And_Toggle()
    {
        Assert.Equal([2], UserListOps.Remove(_users, 1).Select(u => u.Id));
        Assert.Equal(2, UserListOps.CountActive(UserListOps.ToggleActive(_users, 2)));
        Assert.Equal(1, UserListOps.CountActive(_users));
    }
}
