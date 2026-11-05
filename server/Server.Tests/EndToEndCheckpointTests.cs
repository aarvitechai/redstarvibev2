using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Server.Api.Auth;
using Server.Api.Controllers;
using Server.Api.Models;
using Server.Api.Models.Dto;
using Server.Api.Models.Entities;

namespace Server.Tests;

// plan.md, Phase 14 "Checkpoint (end-to-end)", as ONE test against the real pipeline and a real SQL Server database:
//   register -> log in as admin -> create a product with an image -> log in as customer -> add to cart (price it)
//   -> place order -> admin updates the status -> customer rates after Completed
public class EndToEndCheckpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static async Task<T> Data<T>(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"{(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<ApiResponse<T>>())!.Data!;
    }

    private HttpClient WithToken(string token)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    [Fact]
    public async Task TheWholeShop_FromSignUpToRating()
    {
        var anonymous = factory.CreateClient();

        // 1. A new customer registers (and is signed in straight away)
        var signUp = await Data<AuthResultDto>(await anonymous.PostAsJsonAsync("/api/auth/register",
            new RegisterDto("Kavya Rao", "kavya@example.com", "Str0ng!Pass")));
        Assert.Equal(["Customer"], signUp.User.Roles);

        // 2. The admin logs in and creates a product...
        var adminLogin = await Data<AuthResultDto>(await anonymous.PostAsJsonAsync("/api/auth/login", new LoginDto("admin@redstar.dev", "Admin@123")));
        var admin = WithToken(adminLogin.AccessToken);
        var product = await Data<AdminProductDto>(await admin.PostAsJsonAsync("/api/admin/products",
            new SaveProductDto("Masala Dosa", "Crisp rice crepe with spiced potato.", 6.75m, 2)));

        // ...with an image
        var png = new ByteArrayContent([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, .. new byte[64]]);
        png.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        product = await Data<AdminProductDto>(await admin.PostAsync($"/api/admin/products/{product.Id}/image",
            new MultipartFormDataContent { { png, "file", "dosa.png" } }));
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync(product.ImageUrl)).StatusCode);

        // 3. The customer finds it in the public catalogue
        var search = await Data<PagedResult<ProductDto>>(await anonymous.GetAsync("/api/products?search=dosa"));
        var listed = Assert.Single(search.Items);
        Assert.Equal((product.Id, product.ImageUrl), (listed.Id, listed.ImageUrl));

        // 4. The cart is priced by the server, then the order is placed
        var customer = WithToken(signUp.AccessToken);
        var quote = await Data<CartQuoteDto>(await anonymous.PostAsJsonAsync("/api/cart/price",
            new PriceCartDto([new(product.Id, 2), new(7, 1)])));
        Assert.Equal(16.00m, quote.Subtotal); // 6.75 x 2 + 2.50

        var order = await Data<OrderDto>(await customer.PostAsJsonAsync("/api/orders", new PlaceOrderDto([new(product.Id, 2), new(7, 1)])));
        Assert.Equal((OrderStatus.Pending, 16.00m), (order.Status, order.Total));

        // 5. A rating isn't allowed yet
        var dosaLine = order.Lines.Single(l => l.ProductId == product.Id);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await customer.PutAsJsonAsync($"/api/orders/{order.Id}/details/{dosaLine.Id}/rating", new RateItemDto(5))).StatusCode);

        // 6. The admin moves the order along, always sending the LATEST rowVersion
        var rowVersion = order.RowVersion;
        foreach (var status in new[] { OrderStatus.Confirmed, OrderStatus.Ready, OrderStatus.Completed })
        {
            var updated = await Data<AdminOrderDto>(await admin.PutAsJsonAsync($"/api/orders/{order.Id}/status", new UpdateOrderStatusDto(status, rowVersion)));
            Assert.Equal(status, updated.Status);
            rowVersion = updated.RowVersion;
        }

        // 7. Now the customer can rate it
        var rated = await Data<OrderDto>(await customer.PutAsJsonAsync($"/api/orders/{order.Id}/details/{dosaLine.Id}/rating", new RateItemDto(5)));
        Assert.True(rated.CanRate);
        Assert.Equal(5, rated.Lines.Single(l => l.Id == dosaLine.Id).Rating);

        // 8. And sees exactly one order: their own
        var mine = await Data<PagedResult<OrderDto>>(await customer.GetAsync("/api/orders/mine"));
        Assert.Equal([order.Id], mine.Items.Select(o => o.Id));
    }
}
