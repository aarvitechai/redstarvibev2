# Phase 15: the API as a container image. MULTI-STAGE: the big SDK image only BUILDS; the shipped image contains
# just the ASP.NET runtime plus our compiled app (no compiler, no source code, no NuGet cache).
#   docker build -t redstarvibe-api --target api server
#   docker build -t redstarvibe-migrate --target migrate server

# ---------- build ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
# Restore FIRST, from the project files alone: this layer is cached until a package changes,
# so editing C# code doesn't re-download every package
COPY Server.Api/Server.Api.csproj Server.Api/
RUN dotnet restore Server.Api/Server.Api.csproj
COPY Server.Api/ Server.Api/
RUN dotnet publish Server.Api/Server.Api.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

# ---------- migration bundle ----------
# Migrations are a CONTROLLED STEP, not something the API does on every start: with several API instances they would
# race, and a bad migration should stop the RELEASE, not crash-loop the app. An EF "bundle" is one executable that
# applies the pending migrations and exits.
FROM build AS bundle
RUN dotnet tool install --global dotnet-ef --version 10.0.14
ENV PATH="$PATH:/root/.dotnet/tools"
RUN dotnet ef migrations bundle --project Server.Api/Server.Api.csproj --configuration Release --output /efbundle --verbose

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS migrate
COPY --from=bundle /efbundle /efbundle
USER $APP_UID
ENTRYPOINT ["/efbundle"]

# ---------- the API ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS api
WORKDIR /app
# Uploaded images live in a VOLUME (/data/uploads), not inside the container: containers are disposable
RUN mkdir -p /data/uploads && chown "$APP_UID" /data/uploads
COPY --from=build /app/publish .
ENV ASPNETCORE_HTTP_PORTS=8080 \
    Uploads__ProductImagesPath=/data/uploads
EXPOSE 8080
# NOT root: the .NET images ship an unprivileged "app" user. A bug in the app can't take over the container.
USER $APP_UID
ENTRYPOINT ["dotnet", "Server.Api.dll"]
