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
    // GET /api/products?category=pizza&search=paneer&sort=priceDesc
    // The same query string the client keeps in its URL, so a shared link reproduces the same results.
    [HttpGet]
    [ProducesResponseType<ApiResponse<IReadOnlyList<ProductDto>>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status400BadRequest)]
    public ActionResult<ApiResponse<IReadOnlyList<ProductDto>>> Find(
        [FromQuery, StringLength(50)] string? category = null,
        [FromQuery, StringLength(100)] string? search = null,
        [FromQuery] ProductSort sort = ProductSort.Name) =>
        Ok(ApiResponse<IReadOnlyList<ProductDto>>.Ok(catalog.Find(new ProductQuery(category, search, sort))));

    // GET /api/products/4  -> 200, or 404
    [HttpGet("{id:int}")]
    [ProducesResponseType<ApiResponse<ProductDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<ProductDto>>(StatusCodes.Status404NotFound)]
    public ActionResult<ApiResponse<ProductDto>> GetById(int id)
    {
        var product = catalog.GetById(id);
        return product is null
            ? NotFound(ApiResponse<ProductDto>.Fail($"Product {id} not found"))
            : Ok(ApiResponse<ProductDto>.Ok(product));
    }
}

[ApiController]
[Route("api/[controller]")] // -> /api/categories
public class CategoriesController(IProductCatalog catalog) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<ApiResponse<IReadOnlyList<CategoryDto>>>(StatusCodes.Status200OK)]
    public ActionResult<ApiResponse<IReadOnlyList<CategoryDto>>> GetAll() =>
        Ok(ApiResponse<IReadOnlyList<CategoryDto>>.Ok(catalog.GetCategories()));
}
