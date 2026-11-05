using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Time.Testing;
using Server.Api.Models;
using Server.Api.Models.Dto;
using Server.Api.Services;

namespace Server.Tests;

public class ContactServiceTests
{
    [Fact]
    public void Create_UsesTheInjectedClock_AndTrims_AndNullsAnEmptyPhone()
    {
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero));
        var service = new InMemoryContactService(clock);

        var result = service.Create(new SaveContactDto("  Neha  ", " neha@example.com ", "   "));

        // ids 1-3 are the seeded demo contacts
        Assert.Equal(new ContactDto(4, "Neha", "neha@example.com", null, false, clock.GetUtcNow()), result.Contact);
    }

    [Fact]
    public void GetAll_FavouritesFirst_ThenByName()
    {
        var service = new InMemoryContactService(TimeProvider.System); // seeded: Asha (fav), Ravi, Meera
        Assert.Equal(["Asha Verma", "Meera Shah", "Ravi Kumar"], service.GetAll().Select(c => c.Name));

        service.SetFavourite(2, true); // Ravi
        Assert.Equal(["Asha Verma", "Ravi Kumar", "Meera Shah"], service.GetAll().Select(c => c.Name));
    }

    [Fact]
    public void Update_KeepsIdAndCreatedAt()
    {
        var service = new InMemoryContactService(TimeProvider.System);
        var before = service.GetAll().Single(c => c.Id == 2);

        var after = service.Update(2, new SaveContactDto("Ravi K", "ravi@example.com", "12345678", true)).Contact!;

        Assert.Equal(before.Id, after.Id);
        Assert.Equal(before.CreatedAt, after.CreatedAt);
        Assert.Equal(("Ravi K", "12345678", true), (after.Name, after.Phone, after.IsFavourite));
    }
}

public class ContactsEndpointTests(ApiFactory factory)
    : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task GetAll_ReturnsSeededContacts()
    {
        var body = await _client.GetFromJsonAsync<ApiResponse<List<ContactDto>>>("/api/contacts");
        Assert.True(body!.Data!.Count >= 3);
    }

    [Fact]
    public async Task Create_Valid_Returns201()
    {
        var response = await _client.PostAsJsonAsync("/api/contacts", new SaveContactDto("Neha Patel", "neha@example.com", "+91 99999 11111"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<ContactDto>>();
        Assert.Equal($"/api/contacts/{body!.Data!.Id}", response.Headers.Location!.OriginalString);
    }

    [Fact]
    public async Task Create_Invalid_Returns400_WithFieldErrorsAndFriendlyMessages()
    {
        var response = await _client.PostAsJsonAsync("/api/contacts", new { name = "", email = "nope", phone = "abc" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        // An empty name breaks [Required] AND [StringLength]: both are returned, and the forms show the first one
        Assert.Equal("Name is required.", body!.FieldErrors!["name"][0]);
        Assert.Equal(["Enter a valid email address."], body.FieldErrors["email"]);
        Assert.Equal([ContactRules.PhoneMessage], body.FieldErrors["phone"]);
    }

    [Fact]
    public async Task Create_WrongJsonType_Returns400_OnThatField()
    {
        var content = new StringContent("""{ "name": "Valid Name", "email": "t@example.com", "isFavourite": "yes" }""",
            System.Text.Encoding.UTF8, "application/json");

        var response = await _client.PostAsync("/api/contacts", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        Assert.True(body!.FieldErrors!.ContainsKey("isFavourite"));
    }

    [Fact]
    public async Task Create_DuplicateEmail_Returns409_AsAnEmailFieldError()
    {
        var response = await _client.PostAsJsonAsync("/api/contacts", new SaveContactDto("Someone", "ASHA@example.com", null));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        Assert.Equal(["Email 'ASHA@example.com' is already in use."], body!.FieldErrors!["email"]);
    }

    [Fact]
    public async Task Favourite_Update_Delete_RoundTrip()
    {
        var created = (await (await _client.PostAsJsonAsync("/api/contacts", new SaveContactDto("Temp", "temp@example.com", null)))
            .Content.ReadFromJsonAsync<ApiResponse<ContactDto>>())!.Data!;

        var fav = await _client.PutAsJsonAsync($"/api/contacts/{created.Id}/favourite", new SetFavouriteDto(true));
        Assert.True((await fav.Content.ReadFromJsonAsync<ApiResponse<ContactDto>>())!.Data!.IsFavourite);

        var upd = await _client.PutAsJsonAsync($"/api/contacts/{created.Id}", new SaveContactDto("Temp 2", "temp@example.com", null, true));
        Assert.Equal("Temp 2", (await upd.Content.ReadFromJsonAsync<ApiResponse<ContactDto>>())!.Data!.Name);

        Assert.Equal(HttpStatusCode.NoContent, (await _client.DeleteAsync($"/api/contacts/{created.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.DeleteAsync($"/api/contacts/{created.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.PutAsJsonAsync($"/api/contacts/{created.Id}/favourite", new SetFavouriteDto(true))).StatusCode);
    }
}
