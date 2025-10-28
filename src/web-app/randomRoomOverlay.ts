// This file is only for simulating random room statuses on the meeting rooms

import type mapboxgl from 'mapbox-gl';

type RoomStatus = 'inUse' | 'booked' | 'scoreZero' | 'available';

type RoomFeature = {
  id: string;
  geometry: GeoJSON.Geometry;
  status: RoomStatus;
};

type RoomWithGeometry = {
  id: string;
  geometry: GeoJSON.Geometry;
};

const OVERLAY_SOURCE_ID = 'meeting-room-availability';
const OVERLAY_FILL_LAYER_ID = `${OVERLAY_SOURCE_ID}-fill`;
const OVERLAY_SYMBOL_LAYER_ID = `${OVERLAY_SOURCE_ID}-symbol`;
const STATUS_ICON_PREFIX = `${OVERLAY_SOURCE_ID}-icon-`;

const statusStyles: Record<RoomStatus, { iconUrl: string; fillColor: string }> = {
  inUse: {
    iconUrl:
      'https://media.mapsindoors.com/4ea2b1501eb34faeabeeff7b/media/Meeting%20room%203%20-%20In%20use.png',
    fillColor: '#ef5675',
  },
  booked: {
    iconUrl:
      'https://media.mapsindoors.com/4ea2b1501eb34faeabeeff7b/media/Meeting%20room%203%20-%20Booked.png',
    fillColor: '#fcd40c',
  },
  scoreZero: {
    iconUrl: 'https://media.mapsindoors.com/4ea2b1501eb34faeabeeff7b/media/score00.png',
    fillColor: '#9fa2a7',
  },
  available: {
    iconUrl:
      'https://media.mapsindoors.com/4ea2b1501eb34faeabeeff7b/media/Meeting%20room%203%20-%20Free.png',
    fillColor: '#17B169',
  },
};

const statusIconId = (status: RoomStatus) => `${STATUS_ICON_PREFIX}${status}`;

const STATUS_POOL: RoomStatus[] = ['available', 'booked', 'inUse', 'scoreZero'];

const pickRandomStatus = (current?: RoomStatus): RoomStatus => {
  const candidatePool = STATUS_POOL.filter((status) => status !== current);
  const pool = candidatePool.length > 0 ? candidatePool : STATUS_POOL;

  if (pool.length === 0) {
    throw new Error('Status pool is empty');
  }

  const nextStatus = pool[Math.floor(Math.random() * pool.length)];

  if (!nextStatus) {
    throw new Error('Unable to determine next room status');
  }

  return nextStatus;
};

const ensureStatusImages = async (map: mapboxgl.Map) => {
  await Promise.all(
    (Object.keys(statusStyles) as Array<keyof typeof statusStyles>).map((status) => {
      const imageId = statusIconId(status);
      if (map.hasImage(imageId)) {
        return Promise.resolve();
      }

      const { iconUrl } = statusStyles[status];

      return new Promise<void>((resolve, reject) => {
        map.loadImage(iconUrl, (error, image) => {
          if (error || !image) {
            reject(error ?? new Error(`Unable to load icon for status ${status}`));
            return;
          }

          if (!map.hasImage(imageId)) {
            map.addImage(imageId, image, { pixelRatio: 2 });
          }

          resolve();
        });
      });
    }),
  );
};

const ensureOverlayLayers = (map: mapboxgl.Map) => {
  if (!map.getLayer(OVERLAY_FILL_LAYER_ID)) {
    map.addLayer({
      id: OVERLAY_FILL_LAYER_ID,
      type: 'fill',
      source: OVERLAY_SOURCE_ID,
      paint: {
        'fill-color': [
          'match',
          ['get', 'status'],
          'inUse',
          statusStyles.inUse.fillColor,
          'booked',
          statusStyles.booked.fillColor,
          'scoreZero',
          statusStyles.scoreZero.fillColor,
          statusStyles.available.fillColor,
        ] as unknown as mapboxgl.Expression,
        'fill-outline-color': '#1f2933',
      },
    });
  }

  if (!map.getLayer(OVERLAY_SYMBOL_LAYER_ID)) {
    map.addLayer({
      id: OVERLAY_SYMBOL_LAYER_ID,
      type: 'symbol',
      source: OVERLAY_SOURCE_ID,
      layout: {
        'icon-image': ['get', 'iconImage'],
        'icon-size': 0.82,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
    });
  }
};

const toFeatureCollection = (features: RoomFeature[]): GeoJSON.FeatureCollection => ({
  type: 'FeatureCollection',
  features: features.map((feature) => ({
    type: 'Feature',
    id: feature.id,
    geometry: feature.geometry,
    properties: {
      roomId: feature.id,
      status: feature.status,
      iconImage: statusIconId(feature.status),
      labelStylePosition: 'center',
    },
  })),
});

const loadRoomGeometry = async (rooms: string[]): Promise<RoomWithGeometry[]> => {
  const locationService = window.mapsindoors?.services?.LocationsService;
  if (!locationService) {
    throw new Error('MapsIndoors location service is not available');
  }

  const results = await Promise.all(
    rooms.map(async (id) => {
      try {
        const location = await locationService.getLocation(id);
        if (!location?.geometry) {
          console.warn(`No geometry found for room ${id}. Skipping in overlay.`);
          return null;
        }

        return {
          id,
          geometry: location.geometry as GeoJSON.Geometry,
        } satisfies RoomWithGeometry;
      } catch (error) {
        console.warn(`Unable to load geometry for room ${id}.`, error);
        return null;
      }
    }),
  );

  return results.filter((entry): entry is RoomWithGeometry => entry !== null);
};

export const createRandomRoomOverlay = (map: mapboxgl.Map, interval?: number) => {
  let features: RoomFeature[] = [];
  let refreshTimer: ReturnType<typeof setInterval> | null = null;

  const applyData = () => {
    if (features.length === 0) {
      return;
    }

    const source = map.getSource(OVERLAY_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    const collection = toFeatureCollection(features);

    if (!source) {
      map.addSource(OVERLAY_SOURCE_ID, {
        type: 'geojson',
        data: collection,
      });
    } else {
      source.setData(collection);
    }
  };

  const randomizeStatuses = () => {
    features = features.map((feature) => ({
      ...feature,
      status: pickRandomStatus(feature.status),
    }));
    applyData();
  };

  const handleStyleData = () => {
    ensureOverlayLayers(map);
    applyData();
  };

  return {
    init: async (roomId: string) => {
      const roomsWithGeometry = await loadRoomGeometry([roomId]);

      if (roomsWithGeometry.length === 0) {
        console.warn('No rooms with geometry available. Overlay will remain empty.');
        return;
      }

      features = roomsWithGeometry.map(({ id, geometry }) => ({
        id,
        geometry,
        status: pickRandomStatus(),
      }));

      await ensureStatusImages(map);
      applyData();
      ensureOverlayLayers(map);
      map.on('styledata', handleStyleData);
    },
    start: () => {
      if (features.length === 0 || refreshTimer) {
        return;
      }

      refreshTimer = setInterval(randomizeStatuses, interval ?? 10_000);
    },
  };
};
