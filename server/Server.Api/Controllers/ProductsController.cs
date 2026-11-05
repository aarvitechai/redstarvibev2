using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Server.Api.Models;
using Server.Api.Models.Dto;
using Server.Api.Services;

namespace Server.Api.Controllers;

[ApiController]
[Route("api/[controller]")] // -> /api/products
public class ProductsController(IProductCatalog catalog) : ControllerBase
{
    // GET /api/products?category=pizza&search=paneer&sort=priceDesc&page=1&pageSize=12
    // Phase 11: PAGED, from SQL Server. CancellationToken: if the browser gives up (navigates away), the
    // SQL query is cancelled too, instead of running to completion for nobody.
    [HttpGet]
    [ProducesResponseType<ApiResponse<PagedResult<ProductDto>>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<PagedResult<ProductDto>>>> Find(
        [FromQuery] PageRequest paging, // not called "page": see the Phase 10 binding gotcha
        [FromQuery, StringLength(50)] string? category,
        [FromQuery, StringLength(100)] string? search,
        CancellationToken ct,
        [FromQuery] ProductSort sort = ProductSort.Name) =>
        Ok(ApiResponse<PagedResult<ProductDto>>.Ok(await catalog.FindAsync(new ProductQuery(category, search, sort), paging, ct)));

    // GET /api/products/4  -> 200, or 404 (also for an inactive product: the query filter hides it)
    [HttpGet("{id:int}")]
    [ProducesResponseType<ApiResponse<ProductDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<ProductDto>>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<ProductDto>>> GetById(int id, CancellationToken ct) =>
        await catalog.GetByIdAsync(id, ct) is { } product
            ? Ok(ApiResponse<ProductDto>.Ok(product))
            : NotFound(ApiResponse<ProductDto>.Fail($"Product {id} not found"));
}

[ApiController]
[Route("api/[controller]")] // -> /api/categories
public class CategoriesController(IProductCatalog catalog) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<ApiResponse<IReadOnlyList<CategoryDto>>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<CategoryDto>>>> GetAll(CancellationToken ct) =>
        Ok(ApiResponse<IReadOnlyList<CategoryDto>>.Ok(await catalog.GetCategoriesAsync(ct)));
}
