# NOTES.md — mistakes and fixes (interview revision)

| Date | Phase | Mistake / Question | Fix / Answer |
| --- | --- | --- | --- |
| 2026-11-05 | 11 | **Integration tests deleted the dev database.** The test factory overrode the connection string with `ConfigureAppConfiguration`, but `Program.cs` read it EAGERLY (top of the file, before the override applied). The tests ran against `RedStarVibeDb`, and the cleanup's `EnsureDeleted()` dropped it. | Read configuration LAZILY (inside `AddDbContext((sp, o) => ...)`). Add a GUARD before any destructive call: refuse unless the database name starts with `RedStarVibeDb_Test_`, checked on the connection the DbContext ACTUALLY uses. Add a regression test. Rule: verify the target BEFORE `EnsureDeleted`/`DROP`, never assume it. The dev DB only held seed data and was recreated with `dotnet ef database update`. |
