using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Server.Api.Constants;
using Server.Api.Models;
using Server.Api.Models.Dto;
using Server.Api.Services;

namespace Server.Api.Controllers;

// Project 6: the admin product API. Every action needs the Admin role.
// (The React and Angular admin screens come in Phase 14.5; until then, try it in Scalar or Server.Api.http.)
[ApiController]
[Route("api/admin/products")]
[Authorize(Roles = Roles.Admin)]
public class AdminProductsController(IProductAdminService products, IProductImageStore images) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<ApiResponse<PagedResult<AdminProductDto>>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<PagedResult<AdminProductDto>>>> Find(
        [FromQuery] PageRequest paging, [FromQuery, StringLength(100)] string? search, CancellationToken ct) =>
        Ok(ApiResponse<PagedResult<AdminProductDto>>.Ok(await products.FindAsync(search, paging, ct)));

    [HttpGet("{id:int}")]
    [ProducesResponseType<ApiResponse<AdminProductDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<AdminProductDto>>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<AdminProductDto>>> Get(int id, CancellationToken ct) =>
        await products.GetAsync(id, ct) is { } p ? Ok(ApiResponse<AdminProductDto>.Ok(p)) : NotFound(ApiResponse<AdminProductDto>.Fail($"Product {id} not found"));

    [HttpPost]
    [ProducesResponseType<ApiResponse<AdminProductDto>>(StatusCodes.Status201Created)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<AdminProductDto>>> Create(SaveProductDto input, CancellationToken ct)
    {
        var result = await products.CreateAsync(input, ct);
        return result.Succeeded
            ? CreatedAtAction(nameof(Get), new { id = result.Product!.Id }, ApiResponse<AdminProductDto>.Ok(result.Product))
            : ToError(result.Error, 0);
    }

    // PUT /api/admin/products/4  { ..., "rowVersion": "AAAAAAAAB9E=" }  -> 200 | 400 | 404 | 409 (someone else saved first)
    [HttpPut("{id:int}")]
    [ProducesResponseType<ApiResponse<AdminProductDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ApiResponse<AdminProductDto>>> Update(int id, SaveProductDto input, CancellationToken ct)
    {
        var result = await products.UpdateAsync(id, input, ct);
        return result.Succeeded ? Ok(ApiResponse<AdminProductDto>.Ok(result.Product!)) : ToError(result.Error, id);
    }

    // DELETE = SOFT delete (IsActive = false). The product disappears from the shop but stays in the database.
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct) =>
        await products.DeactivateAsync(id, ct) ? NoContent() : NotFound(ApiResponse<object>.Fail($"Product {id} not found"));

    // POST /api/admin/products/4/image  (multipart/form-data, field "file")
    // RequestSizeLimit rejects a huge body BEFORE it's read into memory; ImageRules checks the content.
    [HttpPost("{id:int}/image")]
    [RequestSizeLimit(ImageRules.MaxBytes + 64 * 1024)] // the file plus a little multipart overhead
    [Consumes("multipart/form-data")]
    [ProducesResponseType<ApiResponse<AdminProductDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<AdminProductDto>>> UploadImage(int id, IFormFile? file, CancellationToken ct)
    {
        if (file is null) return BadRequest(ApiResponse<object>.FieldFail("file", "Choose an image to upload."));

        // Read the first bytes to check what the file REALLY is, whatever its name or Content-Type claim
        var header = new byte[12];
        await using (var peek = file.OpenReadStream())
        {
            var read = await peek.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, ct);
            var check = ImageRules.Check(header.AsSpan(0, read), file.Length);
            if (!check.Ok) return BadRequest(ApiResponse<object>.FieldFail("file", check.Error!));

            if (await products.GetAsync(id, ct) is null) return NotFound(ApiResponse<object>.Fail($"Product {id} not found"));

            await using var content = file.OpenReadStream();
            var url = await images.SaveAsync(content, check.Extension!, ct);
            var (result, oldUrl) = await products.SetImageAsync(id, url, ct);
            images.Delete(oldUrl); // replace: don't leave orphaned files on disk
            return Ok(ApiResponse<AdminProductDto>.Ok(result.Product!));
        }
    }

    private ActionResult ToError(ProductWriteError error, int id) => error switch
    {
        ProductWriteError.NotFound => NotFound(ApiResponse<object>.Fail($"Product {id} not found")),
        ProductWriteError.UnknownCategory => BadRequest(ApiResponse<object>.FieldFail("categoryId", "That category doesn't exist.")),
        ProductWriteError.RowVersionRequired => BadRequest(ApiResponse<object>.FieldFail("rowVersion", "Reload the product before saving (rowVersion is missing or invalid).")),
        ProductWriteError.Concurrency => Conflict(ApiResponse<object>.Fail("Someone else changed this product while you were editing. Reload it and apply your changes again.")),
        _ => throw new InvalidOperationException($"Unhandled error {error}"),
    };
}
