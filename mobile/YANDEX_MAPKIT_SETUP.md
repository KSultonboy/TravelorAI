# Yandex MapKit API key setup

Do not commit the real API key.

1. Create or update `mobile/.env`:

```env
YANDEX_MAPKIT_API_KEY=your_yandex_mapkit_key_here
EXPO_PUBLIC_YANDEX_MAPKIT_ENABLED=true
```

For Explore transportation enrichment, the backend also needs an HTTP-capable Yandex key:

```env
# backend/.env
YANDEX_SEARCH_API_KEY=your_yandex_places_or_search_key_here
```

If the key is only connected to `MapKit Mobile SDK`, backend HTTP search can return `403`.
Connect a Yandex Maps HTTP search/places API in Yandex Developer Dashboard for the backend proxy.

2. For local Android release builds, you can also set the same key in one of these places:

```properties
# android/gradle.properties or ~/.gradle/gradle.properties
YANDEX_MAPKIT_API_KEY=your_yandex_mapkit_key_here
```

or as an environment variable:

```powershell
$env:YANDEX_MAPKIT_API_KEY="your_yandex_mapkit_key_here"
```

3. The Android build exposes the key as:

- `BuildConfig.YANDEX_MAPKIT_API_KEY`
- `@string/yandex_mapkit_api_key`
- Android manifest metadata: `com.yandex.maps.apikey`

4. Current Explore integration keeps Mapbox as the map renderer. Yandex is used only as a backend data source for transport markers.
