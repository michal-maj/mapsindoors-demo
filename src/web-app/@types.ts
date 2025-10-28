import type { DisplayRule, Location } from '@mapsindoors/typescript-interfaces';
import type * as mapboxglType from 'mapbox-gl';

interface FeatureType {
  EXTRUDEDBUILDINGS: string;
  EXTRUSION3D: string;
  MODEL3D: string;
  WALLS3D: string;
}

export interface MapView {
  FeatureType: FeatureType;
  getMap: () => mapboxgl.Map;
  hideFeatures: (featureTypes: string[]) => void;
  tilt: (angle: number, duration?: number) => void;
}

export interface MapsIndoorsInstance {
  getMapView: () => MapView | null;
  off: (event: string, handler?: (...args: unknown[]) => void) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  setFloor: (floor: null | string) => void;
  getDisplayRule(target: string, ignoreOverrides?: boolean): Promise<DisplayRule>;
  setDisplayRule(
    target: string | string[],
    displayRule: {
      visible?: boolean;
      polygonVisible?: boolean;
      polygonFillColor?: string;
      polygonFillOpacity?: number;
      icon?: string;
      iconSize?: { width: number; height: number };
      labelVisible?: boolean;
    },
  ): Promise<void>;
}

declare global {
  interface Window {
    mapboxgl: typeof mapboxglType;
    mapsIndoorsInstance?: MapsIndoorsInstance;

    // For SDK services. NPM package is not available yet
    mapsindoors: {
      [key: string]: unknown;
      mapView?: {
        MapboxV3View: new (options: Record<string, unknown>) => MapView;
      };
      MapsIndoors: {
        new (options: Record<string, unknown>): MapsIndoorsInstance;
        setMapsIndoorsApiKey: (apiKey: string) => void;
        setSolutionId: (solutionId: string) => void;
      };
      services: {
        LocationsService: {
          getLocation: (id: string) => Promise<Location | null>;
        };
      };
    };
  }
}
