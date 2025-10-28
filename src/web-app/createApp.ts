import type mapboxgl from 'mapbox-gl';
import type { MapsIndoorsInstance, MapView } from './@types.js';
import { createRandomRoomOverlay } from './randomRoomOverlay.js';

interface AppConfig {
  venue: string | null;
  floor: string | null;
  room: string | null;
  startZoomLevel: string | null;
  mapboxAccessToken: string | null;
  apiKey: string | null;
  bearing: string | null;
  pitch: string | null;
  latitude: string | null;
  longitude: string | null;
  interval: string | null;
}

const createContainer = (rootElement: HTMLElement) => {
  rootElement.textContent = '';

  const container = document.createElement('div');
  container.style.display = 'block';
  container.style.height = '100vh';
  container.style.width = '100vw';
  container.style.position = 'relative';
  rootElement.append(container);

  return container;
};

const createMapContainer = (rootElement: HTMLElement) => {
  rootElement.textContent = '';

  const mapContainer = document.createElement('div');
  mapContainer.style.height = '100%';
  mapContainer.style.width = '100%';
  rootElement.append(mapContainer);

  return mapContainer;
};

const parseAppConfig = (search: string): AppConfig => {
  const params = new URLSearchParams(search);

  return {
    venue: params.get('venue'),
    floor: params.get('floor'),
    room: params.get('room'),
    startZoomLevel: params.get('startZoomLevel'),
    mapboxAccessToken: params.get('mapboxAccessToken'),
    apiKey: params.get('apiKey'),
    bearing: params.get('bearing'),
    pitch: params.get('pitch'),
    latitude: params.get('latitude'),
    longitude: params.get('longitude'),
    interval: params.get('interval'),
  };
};

const parseNumber = (value: string | null, fallback: number) => {
  if (value === null) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const configureInitialMapViewState = (mapView: MapView) => {
  console.log('configureInitialMapViewState called with hide 3D features');

  const map = mapView.getMap();

  mapView.tilt(0, 2000);
  mapView.hideFeatures([
    mapView.FeatureType.MODEL3D,
    mapView.FeatureType.WALLS3D,
    mapView.FeatureType.EXTRUSION3D,
    mapView.FeatureType.EXTRUDEDBUILDINGS,
  ] as string[]);

  map.dragPan?.disable();
  map.scrollZoom?.disable();
  map.boxZoom?.disable();
  map.keyboard?.disable();
  map.doubleClickZoom?.disable();
  map.touchZoomRotate?.disable();
  map.repaint = false; // render only when needed (style/data changes)
};

const createBuildingChangeController = (
  mapsIndoorsInstance: MapsIndoorsInstance,
  mapViewInstance: MapView,
  config: AppConfig,
) => {
  console.log('createBuildingChangeController called');
  let pendingMapLoadHandler: (() => void) | undefined;
  let mapboxMap: mapboxgl.Map | undefined;

  const configure = async (mapView: MapView) => {
    pendingMapLoadHandler = undefined;
    mapsIndoorsInstance.setFloor(config.floor ?? null);
    configureInitialMapViewState(mapView);

    const map = mapViewInstance.getMap();
    const overlayController = createRandomRoomOverlay(map, parseNumber(config.interval, 10_000));

    if (config.room) {
      try {
        await overlayController?.init(config.room);
        overlayController?.start();
      } catch (error) {
        console.error('Unable to initialize random room overlay', error);
      }
    } else {
      console.warn('No room specified in config; skipping random room overlay initialization');
    }
  };

  const handleBuildingChanged = async () => {
    const mapView = mapsIndoorsInstance.getMapView();
    if (!mapView) {
      return;
    }

    const map = mapView.getMap();

    if (pendingMapLoadHandler && mapboxMap) {
      console.log('Removing previous pending map load handler');
      mapboxMap.off('load', pendingMapLoadHandler);
      pendingMapLoadHandler = undefined;
    }

    mapboxMap = map;

    if (map.isStyleLoaded()) {
      console.log('Map style is loaded');
      configure(mapView);
    } else {
      console.log('Map style is not loaded yet');
      pendingMapLoadHandler = () => {
        console.log('Map style is loaded on load event');
        configure(mapView);
      };
      map.once('load', pendingMapLoadHandler);
    }
  };

  return { handleBuildingChanged };
};

export const createApp = (rootElement: HTMLElement) => {
  const config = parseAppConfig(window.location.search);

  const container = createContainer(rootElement);

  if (!config.apiKey) {
    console.error('MapsIndoors apiKey query param is missing');
    return;
  }

  if (!config.mapboxAccessToken) {
    console.error('mapboxAccessToken query param is missing');
    return;
  }

  if (!window.mapboxgl) {
    console.error('Mapbox GL script is not loaded');
    return;
  }

  if (!window.mapsindoors?.mapView) {
    console.error('MapsIndoors script is not loaded');
    return;
  }

  const mapContainer = createMapContainer(container);

  const mapViewOptions: Record<string, unknown> = {
    accessToken: config.mapboxAccessToken,
    element: mapContainer,
    zoom: parseNumber(config.startZoomLevel, 18.8),
    maxZoom: 22,
    bearing: parseNumber(config.bearing, 0),
    pitch: parseNumber(config.pitch, 0),
    showMapMarkers: true,
    center: {
      lat: parseNumber(config.latitude, 0),
      lng: parseNumber(config.longitude, 0),
    },
    pixelRatio: 1,
    // Perf-friendly knobs
    antialias: false, // no MSAA
    failIfMajorPerformanceCaveat: false,
    fadeDuration: 0, // kill crossfade animations
    crossSourceCollisions: false,
    interactive: false,
  };

  const mapViewInstance = new window.mapsindoors.mapView.MapboxV3View(mapViewOptions);

  const mapsIndoorsOptions: Record<string, unknown> = {
    apiKey: config.apiKey,
    mapView: mapViewInstance,
    venue: config.venue,
  };

  const mapsIndoorsConstructor = window.mapsindoors?.MapsIndoors;
  mapsIndoorsConstructor.setMapsIndoorsApiKey(config.apiKey);

  const instance = new mapsIndoorsConstructor(mapsIndoorsOptions);

  const readyHandler = () => {
    const { handleBuildingChanged } = createBuildingChangeController(
      instance,
      mapViewInstance,
      config,
    );

    void handleBuildingChanged();
    instance.on('building_changed', handleBuildingChanged);
  };

  instance.on('ready', readyHandler);
};
