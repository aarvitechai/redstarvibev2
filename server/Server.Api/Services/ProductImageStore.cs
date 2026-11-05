namespace Server.Api.Services;

public record ImageCheck(bool Ok, string? Extension, string? Error);

public interface IProductImageStore
{
    // The folder on disk, and the URL prefix it's served from (by UseStaticFiles in Program.cs)
    string RootPath { get; }
    string RequestPath { get; }
    Task<string> SaveAsync(Stream content, string extension, CancellationToken ct = default);
    void Delete(string? imageUrl);
}

// Uploaded files are UNTRUSTED. The rules:
//  - limit the size (and the request size, in the controller)
//  - check the real content (the "magic bytes"), not the file name or Content-Type, which the client controls
//  - never use the client's file name: generate a random one (no path traversal like "../../web.config")
//  - store outside the code folders, and serve from one fixed URL prefix
public static class ImageRules
{
    public const long MaxBytes = 2 * 1024 * 1024; // 2 MB

    public static ImageCheck Check(ReadOnlySpan<byte> header, long length)
    {
        if (length == 0) return new(false, null, "The file is empty.");
        if (length > MaxBytes) return new(false, null, "The image must be 2 MB or smaller.");
        if (header.StartsWith((ReadOnlySpan<byte>)[0xFF, 0xD8, 0xFF])) return new(true, ".jpg", null);
        if (header.StartsWith((ReadOnlySpan<byte>)[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return new(true, ".png", null);
        if (header.Length >= 12 && header[..4].SequenceEqual("RIFF"u8) && header[8..12].SequenceEqual("WEBP"u8)) return new(true, ".webp", null);
        return new(false, null, "Only JPEG, PNG or WebP images are allowed.");
    }
}

public class FileSystemProductImageStore : IProductImageStore
{
    public string RootPath { get; }
    public string RequestPath => "/images/products";

    public FileSystemProductImageStore(IConfiguration config, IWebHostEnvironment env)
    {
        var configured = config["Uploads:ProductImagesPath"];
        RootPath = string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(env.ContentRootPath, "uploads", "products") // default: outside wwwroot and the source code
            : Path.GetFullPath(configured);
        Directory.CreateDirectory(RootPath);
    }

    public async Task<string> SaveAsync(Stream content, string extension, CancellationToken ct = default)
    {
        var fileName = $"{Guid.NewGuid():N}{extension}"; // OUR name, never the client's
        await using var file = File.Create(Path.Combine(RootPath, fileName));
        await content.CopyToAsync(file, ct);
        return $"{RequestPath}/{fileName}";
    }

    public void Delete(string? imageUrl)
    {
        if (string.IsNullOrEmpty(imageUrl) || !imageUrl.StartsWith(RequestPath + "/")) return;
        var name = Path.GetFileName(imageUrl); // strips any directory part
        var path = Path.Combine(RootPath, name);
        if (File.Exists(path)) File.Delete(path);
    }
}
