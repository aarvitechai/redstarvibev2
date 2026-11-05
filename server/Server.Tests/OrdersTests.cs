using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Server.Api.Auth;
using Server.Api.Controllers;
using Server.Api.Models;
using Server.Api.Models.Dto;
using Server.Api.Models.Entities;

namespace Server.Tests;

// Project 8: every order rule from plan.md, tested against a real (throwaway) SQL Server database
public class OrdersTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private async Task<HttpClient> As(string email, string password)
    {
        var login = await factory.CreateClient().PostAsJsonAsync("/api/auth/login", new LoginDto(email, password));
        var token = (await login.Content.ReadFromJsonAsync<ApiResponse<AuthResultDto>>())!.Data!.AccessToken;
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
    private Task<HttpClient> Asha() => As("asha@redstar.dev", "Customer@123");
    private Task<HttpClient> Admin() => As("admin@redstar.dev", "Admin@123");

    // A second customer, created fresh, so row-level access can be tested
    private async Task<HttpClient> NewCustomer()
    {
        var email = $"c{Guid.NewGuid():N}@example.com";
        await factory.CreateClient().PostAsJsonAsync("/api/auth/register", new RegisterDto("Other Customer", email, "Str0ng!Pass"));
        return await As(email, "Str0ng!Pass");
    }

    private static async Task<T> Data<T>(HttpResponseMessage r) => (await r.Content.ReadFromJsonAsync<ApiResponse<T>>())!.Data!;
    private static async Task<ApiResponse<object>> Body(HttpResponseMessage r) => (await r.Content.ReadFromJsonAsync<ApiResponse<object>>())!;

    private static async Task<OrderDto> Place(HttpClient client, params (int ProductId, int Quantity)[] items)
    {
        var response = await client.PostAsJsonAsync("/api/orders", new PlaceOrderDto([.. items.Select(i => new OrderItemInput(i.ProductId, i.Quantity))]));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await Data<OrderDto>(response);
    }

    // Walk an order through the allowed steps as an admin
    private async Task Complete(HttpClient admin, int orderId)
    {
        foreach (var status in new[] { "Confirmed", "Ready", "Completed" })
        {
            var rowVersion = await factory.WithDbAsync(db => db.OrderHeaders.Where(o => o.Id == orderId).Select(o => o.RowVersion).SingleAsync());
            var r = await admin.PutAsJsonAsync($"/api/orders/{orderId}/status", new { status, rowVersion = Convert.ToBase64String(rowVersion) });
            Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        }
        Assert.Equal(OrderStatus.Completed, await factory.WithDbAsync(db => db.OrderHeaders.Where(o => o.Id == orderId).Select(o => o.Status).SingleAsync()));
    }

    // ---------- placing an order ----------
    [Fact]
    public async Task Place_UsesDatabasePrices_ComputesTheTotal_AndStartsPending()
    {
        var order = await Place(await Asha(), (1, 2), (7, 1)); // Classic Burger 8.50 x2, Lemon Iced Tea 2.50

        Assert.Equal(OrderStatus.Pending, order.Status);
        Assert.Equal(19.50m, order.Total);
        Assert.Equal([("Classic Burger", 8.50m, 2, 17.00m), ("Lemon Iced Tea", 2.50m, 1, 2.50m)],
            order.Lines.Select(l => (l.ProductName, l.UnitPrice, l.Quantity, l.LineTotal)));
        Assert.False(order.CanRate);
    }

    [Fact]
    public async Task Place_IgnoresEverythingButIdsAndQuantities_NoOverPosting()
    {
        var asha = await Asha();
        var response = await asha.PostAsJsonAsync("/api/orders", new
        {
            userId = "someone-else", total = 0.01m, status = "Completed",
            items = new[] { new { productId = 1, quantity = 1, unitPrice = 0.01m, productName = "Free burger" } },
        });

        var order = await Data<OrderDto>(response);
        Assert.Equal((8.50m, OrderStatus.Pending, "Classic Burger"), (order.Total, order.Status, order.Lines[0].ProductName));
        var owner = await factory.WithDbAsync(db => db.OrderHeaders.Where(o => o.Id == order.Id).Select(o => o.User.Email).SingleAsync());
        Assert.Equal("asha@redstar.dev", owner); // from the TOKEN, not the body
    }

    [Fact]
    public async Task Place_MergesDuplicateLines()
    {
        var order = await Place(await Asha(), (4, 1), (4, 2));
        Assert.Equal([(4, 3)], order.Lines.Select(l => (l.ProductId, l.Quantity)));
    }

    [Theory]
    [InlineData(999)]
    public async Task Place_UnknownProduct_Is400_AndNothingIsSaved(int productId)
    {
        var before = await factory.WithDbAsync(db => db.OrderHeaders.CountAsync());
        var response = await (await Asha()).PostAsJsonAsync("/api/orders", new PlaceOrderDto([new(1, 1), new(productId, 1)]));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("no longer available", (await Body(response)).FieldErrors!["items"][0]);
        Assert.Equal(before, await factory.WithDbAsync(db => db.OrderHeaders.CountAsync()));
    }

    [Fact]
    public async Task Place_ASoftDeletedProduct_IsUnavailable()
    {
        var admin = await Admin();
        var created = await Data<AdminProductDto>(await admin.PostAsJsonAsync("/api/admin/products", new SaveProductDto("Discontinued", null, 3m, 3)));
        await admin.DeleteAsync($"/api/admin/products/{created.Id}");

        var response = await (await Asha()).PostAsJsonAsync("/api/orders", new PlaceOrderDto([new(created.Id, 1)]));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Place_Invalid_Is400_EmptyOrBadQuantity()
    {
        var asha = await Asha();
        Assert.Equal(HttpStatusCode.BadRequest, (await asha.PostAsJsonAsync("/api/orders", new PlaceOrderDto([]))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await asha.PostAsJsonAsync("/api/orders", new PlaceOrderDto([new(1, 0)]))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await asha.PostAsJsonAsync("/api/orders", new PlaceOrderDto([new(1, 21)]))).StatusCode);
    }

    [Fact]
    public async Task Place_Anonymous401_Admin403()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().PostAsJsonAsync("/api/orders", new PlaceOrderDto([new(1, 1)]))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await (await Admin()).PostAsJsonAsync("/api/orders", new PlaceOrderDto([new(1, 1)]))).StatusCode);
    }

    // ---------- snapshot pricing ----------
    [Fact]
    public async Task Snapshot_ARepricedProduct_DoesNotChangeAnExistingOrder()
    {
        var asha = await Asha();
        var admin = await Admin();
        var product = await Data<AdminProductDto>(await admin.PostAsJsonAsync("/api/admin/products", new SaveProductDto("Seasonal Soup", null, 5m, 4)));
        var order = await Place(asha, (product.Id, 2));

        await admin.PutAsJsonAsync($"/api/admin/products/{product.Id}", new SaveProductDto("Seasonal Soup (new recipe)", null, 9m, 4, true, product.RowVersion));

        var reloaded = await Data<OrderDto>(await asha.GetAsync($"/api/orders/mine/{order.Id}"));
        Assert.Equal(("Seasonal Soup", 5m, 10m), (reloaded.Lines[0].ProductName, reloaded.Lines[0].UnitPrice, reloaded.Total)); // what was PAID
    }

    // ---------- transactional save ----------
    [Fact]
    public async Task OneSaveChanges_IsOneTransaction_AFailingLineSavesNothing()
    {
        var userId = await factory.WithDbAsync(db => db.Users.Where(u => u.Email == "asha@redstar.dev").Select(u => u.Id).SingleAsync());
        var before = await factory.WithDbAsync(db => db.OrderHeaders.CountAsync());

        // The database's CHECK constraint refuses quantity 99 on the SECOND line...
        var error = await Assert.ThrowsAsync<DbUpdateException>(() => factory.WithDbAsync(async db =>
        {
            db.OrderHeaders.Add(new OrderHeader
            {
                UserId = userId, Total = 1, CreatedAt = DateTimeOffset.UtcNow,
                Details = [new() { ProductId = 1, ProductName = "ok", UnitPrice = 1, Quantity = 1, LineTotal = 1 },
                           new() { ProductId = 2, ProductName = "bad", UnitPrice = 1, Quantity = 99, LineTotal = 99 }],
            });
            return await db.SaveChangesAsync();
        }));

        Assert.Contains("CK_OrderDetails_Quantity", error.InnerException!.Message);
        // ...so the header and the first line were rolled back too: no half order
        Assert.Equal(before, await factory.WithDbAsync(db => db.OrderHeaders.CountAsync()));
    }

    // ---------- row-level access ----------
    [Fact]
    public async Task Customers_OnlyEverSeeTheirOwnOrders()
    {
        var asha = await Asha();
        var other = await NewCustomer();
        var ashasOrder = await Place(asha, (2, 1));
        var othersOrder = await Place(other, (3, 1));

        var mine = await Data<PagedResult<OrderDto>>(await other.GetAsync("/api/orders/mine"));
        Assert.Equal([othersOrder.Id], mine.Items.Select(o => o.Id)); // only their own

        // Guessing another customer's id: 404, not 403 (don't even confirm it exists)
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/orders/mine/{ashasOrder.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await other.PutAsJsonAsync($"/api/orders/{ashasOrder.Id}/details/{ashasOrder.Lines[0].Id}/rating", new RateItemDto(1))).StatusCode);
    }

    // ---------- admin: list and status flow ----------
    [Fact]
    public async Task Admin_SeesEveryOrder_WithTheCustomer_AndCanFilterByStatus()
    {
        var order = await Place(await NewCustomer(), (5, 1));
        var admin = await Admin();

        var pending = await Data<PagedResult<AdminOrderDto>>(await admin.GetAsync("/api/orders?status=Pending&pageSize=50"));
        var row = Assert.Single(pending.Items, o => o.Id == order.Id);
        Assert.Equal(("Other Customer", 10.50m, 1), (row.CustomerName, row.Total, row.ItemCount));
        Assert.Equal(["Confirmed", "Cancelled"], row.AllowedNextStatuses);

        Assert.Equal(HttpStatusCode.Forbidden, (await (await Asha()).GetAsync("/api/orders")).StatusCode);
    }

    [Fact]
    public async Task StatusFlow_FollowsThePlan_AndRefusesInvalidJumps()
    {
        var order = await Place(await Asha(), (6, 1));
        var admin = await Admin();
        async Task<HttpResponseMessage> Move(string status) =>
            await admin.PutAsJsonAsync($"/api/orders/{order.Id}/status", new { status,
                rowVersion = Convert.ToBase64String(await factory.WithDbAsync(db => db.OrderHeaders.Where(o => o.Id == order.Id).Select(o => o.RowVersion).SingleAsync())) });

        var skip = await Move("Completed"); // Pending -> Completed is not allowed
        Assert.Equal(HttpStatusCode.BadRequest, skip.StatusCode);
        Assert.Equal(["An order can't go from Pending to Completed."], (await Body(skip)).FieldErrors!["status"]);

        foreach (var step in new[] { "Confirmed", "Ready", "Completed" }) Assert.Equal(HttpStatusCode.OK, (await Move(step)).StatusCode);

        Assert.Equal(HttpStatusCode.BadRequest, (await Move("Cancelled")).StatusCode); // Completed is final
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync($"/api/orders/{order.Id}/status", new { status = "Shipped", rowVersion = "AA==" })).StatusCode); // not a status
    }

    [Fact]
    public async Task StatusChange_WithAStaleRowVersion_Is409()
    {
        var order = await Place(await Asha(), (8, 1));
        var admin = await Admin();
        var stale = order.RowVersion;

        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/orders/{order.Id}/status", new { status = "Confirmed", rowVersion = stale })).StatusCode);
        var second = await admin.PutAsJsonAsync($"/api/orders/{order.Id}/status", new { status = "Cancelled", rowVersion = stale });

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Equal(OrderStatus.Confirmed, await factory.WithDbAsync(db => db.OrderHeaders.Where(o => o.Id == order.Id).Select(o => o.Status).SingleAsync()));
    }

    [Fact]
    public async Task Customers_CannotChangeStatus()
    {
        var asha = await Asha();
        var order = await Place(asha, (9, 1));
        Assert.Equal(HttpStatusCode.Forbidden, (await asha.PutAsJsonAsync($"/api/orders/{order.Id}/status", new { status = "Completed", rowVersion = order.RowVersion })).StatusCode);
    }

    // ---------- ratings ----------
    [Fact]
    public async Task Rating_OnlyAfterCompleted_OnlyLinesOfThatOrder_1To5()
    {
        var asha = await Asha();
        var order = await Place(asha, (10, 1), (11, 2));
        var other = await Place(asha, (1, 1));
        var url = $"/api/orders/{order.Id}/details/{order.Lines[0].Id}/rating";

        var early = await asha.PutAsJsonAsync(url, new RateItemDto(5));
        Assert.Equal(HttpStatusCode.BadRequest, early.StatusCode);
        Assert.Equal(["You can rate items once the order is completed."], (await Body(early)).Errors);

        await Complete(await Admin(), order.Id);

        var rated = await Data<OrderDto>(await asha.PutAsJsonAsync(url, new RateItemDto(5)));
        Assert.True(rated.CanRate);
        Assert.Equal([5, null], rated.Lines.Select(l => l.Rating));

        Assert.Equal(HttpStatusCode.BadRequest, (await asha.PutAsJsonAsync(url, new RateItemDto(6))).StatusCode);
        // A line that belongs to a DIFFERENT order of mine, under this order's URL: 404
        Assert.Equal(HttpStatusCode.NotFound, (await asha.PutAsJsonAsync($"/api/orders/{order.Id}/details/{other.Lines[0].Id}/rating", new RateItemDto(4))).StatusCode);
    }

    [Fact]
    public async Task MyOrders_AreNewestFirst_AndPaged()
    {
        var customer = await NewCustomer();
        var first = await Place(customer, (1, 1));
        var second = await Place(customer, (2, 1));

        var page = await Data<PagedResult<OrderDto>>(await customer.GetAsync("/api/orders/mine?pageSize=1"));
        Assert.Equal([second.Id], page.Items.Select(o => o.Id));
        Assert.Equal((2, 2, true), (page.TotalCount, page.TotalPages, page.HasNext));
        Assert.NotEqual(first.Id, second.Id);
    }
}
