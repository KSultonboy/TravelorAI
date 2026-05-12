export interface ExploreCoordinate {
  latitude: number;
  longitude: number;
}

export interface ExploreRegion extends ExploreCoordinate {
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface ExploreMapViewport {
  center: ExploreCoordinate;
  bounds: {
    northEast: ExploreCoordinate;
    southWest: ExploreCoordinate;
  };
  zoom: number;
}

export interface ExploreMapMarker {
  id: string;
  title: string;
  subtitle?: string;
  coordinate: ExploreCoordinate;
  color: string;
  emoji?: string;
  iconName?: string;
  badgeLabel?: string;
  active?: boolean;
  onPress?: () => void;
}

export interface ExploreMapProps {
  initialRegion: ExploreRegion;
  markers: ExploreMapMarker[];
  selectedMarkerId?: string | null;
  focusedMarkerId?: string | null;
  autoFitOnLoad?: boolean;
  recenterToInitialRegionSignal?: number;
  recenterToUserLocationSignal?: number;
  onFocusReset?: () => void;
  routeCoordinates?: ExploreCoordinate[];
  completedRouteCoordinates?: ExploreCoordinate[];
  userLocation?: ExploreCoordinate | null;
  mapTheme?: 'light' | 'dark';
  enabled?: boolean;
  disabledReason?: string;
  onViewportChanged?: (viewport: ExploreMapViewport) => void;
}
