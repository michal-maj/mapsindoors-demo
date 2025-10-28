# MapsIndoors Demo

This repo contains a minimal Vite + TypeScript web app used to reproduce and diagnose a MapsIndoors map flickering issue. It boots a static HTML page, loads the MapsIndoors JavaScript SDK alongside Mapbox GL JS, and instantiates a locked-down `MapboxV3View` that can be configured entirely through URL query parameters. A helper overlay randomly cycles through meeting-room availability states so the map keeps repainting just like in the problematic scenario.

## Prerequisites

- Node.js 18+ (the project targets the current MapsIndoors SDK baseline)
- `pnpm` (preferred) or `npm` for dependency management
- Valid MapsIndoors `apiKey` and Mapbox `mapboxAccessToken`

## Getting Started

```bash
pnpm install
pnpm dev
```

The dev server defaults to `http://localhost:3000`. Because all runtime configuration is supplied through the URL, open the app with the required parameters, for example:

```
http://localhost:3000/?apiKey=YOUR_MI_KEY&mapboxAccessToken=YOUR_MAPBOX_TOKEN&startZoomLevel=18.4&bearing=-20.5&pitch=1&venue=YOUR_VENUE_ID&floor=10&latitude=YOUR_LATITUDE&longitude=YOUR_LONGITUDE&room=ROOM_LOCATION_ID&interval=1000
```

## Runtime Configuration

The entry point in `src/web-app/createApp.ts` looks at the following query parameters:

| Parameter               | Required | Purpose                                              |
| ----------------------- | -------- | ---------------------------------------------------- |
| `apiKey`                | ✅       | MapsIndoors API key used by the SDK                  |
| `mapboxAccessToken`     | ✅       | Mapbox token passed to the embedded GL map           |
| `venue`                 | ➖       | Preloads a specific venue                            |
| `floor`                 | ➖       | Sets the initial floor level                         |
| `room`                  | ➖       | Seed room ID for the random status overlay           |
| `startZoomLevel`        | ➖       | Initial zoom (defaults to `18.8`)                    |
| `bearing`, `pitch`      | ➖       | Camera orientation overrides                         |
| `latitude`, `longitude` | ➖       | Map center; fallback is `(0,0)`                      |
| `interval`              | ➖       | Overlay refresh interval in ms (defaults to `10000`) |

Missing required parameters abort the boot sequence with a console error so the reproduction stays deterministic.

## Random Room Overlay

`src/web-app/randomRoomOverlay.ts` builds a lightweight GeoJSON layer to toggle meeting room availability between `available`, `booked`, `inUse`, and `scoreZero`. The overlay:

- Fetches geometry for the configured room via `LocationsService`
- Registers Mapbox images for status icons
- Adds fill and symbol layers once the style is ready
- Randomizes the displayed status on an interval to keep the map repainting

This behavior mimics the live dashboard that originally exhibited flickering, making it easier to validate SDK fixes.

## Building

Run `pnpm build` to type-check and produce a production bundle with Vite. The compiled assets are output to `dist/` and can be served as static files behind any HTTP server.
