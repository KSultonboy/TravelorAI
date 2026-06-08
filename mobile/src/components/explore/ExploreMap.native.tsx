import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { NativeModules, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import YaMap, { Marker, Polyline } from '@metamorph/react-native-yamap';

import type { ExploreCoordinate, ExploreMapMarker, ExploreMapProps, ExploreMapViewport } from './ExploreMap.types';

const YANDEX_MAPKIT_API_KEY =
  process.env.EXPO_PUBLIC_YANDEX_MAPKIT_API_KEY ||
  process.env.YANDEX_MAPKIT_API_KEY ||
  String((Constants.expoConfig?.extra as { yandexMapkitApiKey?: string } | undefined)?.yandexMapkitApiKey || '');

const INITIAL_ZOOM = 5.4;
const FOCUSED_ZOOM = 14.5;
const ROUTE_LINE = '#1B7A45';
const COMPLETED_ROUTE_LINE = '#94A3B8';

let yandexInitPromise: Promise<void> | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isValidCoordinate(coordinate?: ExploreCoordinate | null): coordinate is ExploreCoordinate {
  if (!coordinate) return false;
  const { latitude, longitude } = coordinate;
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function toPoint(coordinate: ExploreCoordinate) {
  return { lat: coordinate.latitude, lon: coordinate.longitude };
}

function deltaToZoom(latitudeDelta: number) {
  if (!Number.isFinite(latitudeDelta) || latitudeDelta <= 0) return INITIAL_ZOOM;
  return clamp(Math.log2(360 / latitudeDelta), 2, 17);
}

function viewportFromVisibleRegion(region: any, fallbackCenter: ExploreCoordinate, zoom: number): ExploreMapViewport {
  const points = [region?.bottomLeft, region?.bottomRight, region?.topLeft, region?.topRight]
    .map((point) => ({
      latitude: Number(point?.lat),
      longitude: Number(point?.lon),
    }))
    .filter(isValidCoordinate);

  if (points.length < 4) {
    const latSpan = clamp(360 / Math.pow(2, zoom), 0.002, 120);
    const lngSpan = clamp(latSpan * 1.18, 0.002, 160);
    return {
      center: fallbackCenter,
      zoom,
      bounds: {
        northEast: {
          latitude: clamp(fallbackCenter.latitude + latSpan / 2, -90, 90),
          longitude: clamp(fallbackCenter.longitude + lngSpan / 2, -180, 180),
        },
        southWest: {
          latitude: clamp(fallbackCenter.latitude - latSpan / 2, -90, 90),
          longitude: clamp(fallbackCenter.longitude - lngSpan / 2, -180, 180),
        },
      },
    };
  }

  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  return {
    center: fallbackCenter,
    zoom,
    bounds: {
      northEast: { latitude: Math.max(...lats), longitude: Math.max(...lngs) },
      southWest: { latitude: Math.min(...lats), longitude: Math.min(...lngs) },
    },
  };
}

function MarkerBubble({ marker, active, focused }: { marker: ExploreMapMarker; active: boolean; focused: boolean }) {
  const size = focused ? 52 : active ? 48 : 42;
  const color = marker.color || '#1B7A45';

  return (
    <View style={[styles.markerShell, { transform: [{ scale: focused ? 1.08 : 1 }] }]}>
      <View
        style={[
          styles.markerPin,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
        ]}
      >
        <Ionicons name={(marker.iconName as any) || 'location-outline'} size={focused ? 24 : 21} color="#FFFFFF" />
      </View>
      <View style={[styles.markerTail, { borderTopColor: color }]} />
      {marker.badgeLabel ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{marker.badgeLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

function FallbackCard({ message }: { message: string }) {
  return (
    <View style={styles.fallback}>
      <Ionicons name="map-outline" size={34} color="#1B7A45" />
      <Text style={styles.fallbackTitle}>Yandex MapKit xarita mavjud emas</Text>
      <Text style={styles.fallbackText}>{message}</Text>
    </View>
  );
}

export default function ExploreMap({
  initialRegion,
  markers,
  selectedMarkerId,
  focusedMarkerId,
  autoFitOnLoad = true,
  recenterToInitialRegionSignal = 0,
  recenterToUserLocationSignal = 0,
  onFocusReset,
  routeCoordinates,
  completedRouteCoordinates,
  userLocation,
  mapTheme = 'light',
  enabled = true,
  disabledReason,
  onViewportChanged,
}: ExploreMapProps) {
  const mapRef = useRef<YaMap>(null);
  const [mapkitReady, setMapkitReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const lastInitialSignalRef = useRef(recenterToInitialRegionSignal);
  const lastUserSignalRef = useRef(recenterToUserLocationSignal);
  const lastCameraRef = useRef({ center: { latitude: initialRegion.latitude, longitude: initialRegion.longitude }, zoom: INITIAL_ZOOM });

  const initialCenter = useMemo(
    () => ({ latitude: initialRegion.latitude, longitude: initialRegion.longitude }),
    [initialRegion.latitude, initialRegion.longitude]
  );
  const initialZoom = useMemo(() => deltaToZoom(initialRegion.latitudeDelta), [initialRegion.latitudeDelta]);

  const mainRoute = useMemo(
    () => (routeCoordinates || []).filter(isValidCoordinate).map(toPoint),
    [routeCoordinates]
  );
  const completedRoute = useMemo(
    () => (completedRouteCoordinates || []).filter(isValidCoordinate).map(toPoint),
    [completedRouteCoordinates]
  );
  const validMarkers = useMemo(
    () => markers.filter((marker) => isValidCoordinate(marker.coordinate)),
    [markers]
  );

  const focusCoordinate = useMemo(() => {
    const marker = validMarkers.find((item) => item.id === focusedMarkerId || item.id === selectedMarkerId);
    return marker?.coordinate || null;
  }, [focusedMarkerId, selectedMarkerId, validMarkers]);

  const moveCamera = useCallback((coordinate: ExploreCoordinate, zoomLevel = FOCUSED_ZOOM) => {
    if (!isValidCoordinate(coordinate)) return;
    mapRef.current?.setCenter(
      { ...toPoint(coordinate), zoom: zoomLevel },
      zoomLevel,
      0,
      0,
      500
    );
  }, []);

  const fitAllMarkers = useCallback(() => {
    if (validMarkers.length > 1) {
      mapRef.current?.fitMarkers(validMarkers.map((marker) => toPoint(marker.coordinate)));
      return;
    }
    if (validMarkers.length === 1) {
      moveCamera(validMarkers[0].coordinate, FOCUSED_ZOOM);
      return;
    }
    moveCamera(initialCenter, initialZoom);
  }, [initialCenter, initialZoom, moveCamera, validMarkers]);

  useEffect(() => {
    let alive = true;
    if (!YANDEX_MAPKIT_API_KEY) return () => {
      alive = false;
    };
    if (!yandexInitPromise) {
      yandexInitPromise = YaMap.init(YANDEX_MAPKIT_API_KEY);
    }
    yandexInitPromise
      .then(() => {
        if (alive) setMapkitReady(true);
      })
      .catch((error) => {
        if (alive) setInitError(error?.message || 'Yandex MapKit init failed');
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !autoFitOnLoad) return;
    const timeout = setTimeout(fitAllMarkers, 250);
    return () => clearTimeout(timeout);
  }, [autoFitOnLoad, fitAllMarkers, mapReady]);

  useEffect(() => {
    if (!mapReady || !focusCoordinate) return;
    moveCamera(focusCoordinate, FOCUSED_ZOOM);
  }, [focusCoordinate, mapReady, moveCamera]);

  useEffect(() => {
    if (!mapReady || mainRoute.length < 2) return;
    const timeout = setTimeout(() => {
      mapRef.current?.fitMarkers(mainRoute);
    }, 180);
    return () => clearTimeout(timeout);
  }, [mainRoute, mapReady]);

  useEffect(() => {
    if (!mapReady || recenterToInitialRegionSignal === lastInitialSignalRef.current) return;
    lastInitialSignalRef.current = recenterToInitialRegionSignal;
    onFocusReset?.();
    moveCamera(initialCenter, initialZoom);
  }, [initialCenter, initialZoom, mapReady, moveCamera, onFocusReset, recenterToInitialRegionSignal]);

  useEffect(() => {
    if (!mapReady || recenterToUserLocationSignal === lastUserSignalRef.current) return;
    lastUserSignalRef.current = recenterToUserLocationSignal;
    if (userLocation) moveCamera(userLocation, FOCUSED_ZOOM);
  }, [mapReady, moveCamera, recenterToUserLocationSignal, userLocation]);

  const handleCameraChanged = useCallback(
    (event: any) => {
      const point = event?.nativeEvent?.point;
      const zoom = Number(event?.nativeEvent?.zoom || INITIAL_ZOOM);
      const center = {
        latitude: Number(point?.lat),
        longitude: Number(point?.lon),
      };
      if (!isValidCoordinate(center)) return;
      lastCameraRef.current = { center, zoom };
      mapRef.current?.getVisibleRegion((region: any) => {
        onViewportChanged?.(viewportFromVisibleRegion(region, center, zoom));
      });
    },
    [onViewportChanged]
  );

  if (!enabled) {
    return <FallbackCard message={disabledReason || 'Xarita vaqtincha ochirilgan.'} />;
  }

  if (!NativeModules.yamap && !NativeModules.RNYamapModule && !NativeModules.YamapModule) {
    return <FallbackCard message="Yandex MapKit native code bu dev build ichida yoq. Android dev buildni qayta rebuild qiling." />;
  }

  if (!YANDEX_MAPKIT_API_KEY) {
    return <FallbackCard message="EXPO_PUBLIC_YANDEX_MAPKIT_API_KEY .env ichida topilmadi." />;
  }

  if (initError) {
    return <FallbackCard message={initError} />;
  }

  if (!mapkitReady) {
    return <FallbackCard message="Yandex MapKit tayyorlanmoqda. Bir necha soniya kuting." />;
  }

  return (
    <View style={styles.container}>
      <YaMap
        ref={mapRef}
        style={styles.map}
        initialRegion={{ ...toPoint(initialCenter), zoom: initialZoom, azimuth: 0, tilt: 0 }}
        showUserPosition={Boolean(userLocation)}
        nightMode={mapTheme === 'dark'}
        onMapLoaded={() => setMapReady(true)}
        onCameraPositionChangeEnd={handleCameraChanged}
        logoPosition={{ horizontal: 'left', vertical: 'bottom' }}
        logoPadding={{ horizontal: 12, vertical: 12 }}
      >
        {completedRoute.length >= 2 ? (
          <Polyline
            points={completedRoute}
            strokeColor={COMPLETED_ROUTE_LINE}
            strokeWidth={4}
            dashLength={8}
            gapLength={7}
            zIndex={1}
          />
        ) : null}

        {mainRoute.length >= 2 ? (
          <Polyline points={mainRoute} strokeColor={ROUTE_LINE} strokeWidth={5} outlineColor="#FFFFFF" outlineWidth={1} zIndex={2} />
        ) : null}

        {userLocation && isValidCoordinate(userLocation) ? (
          <Marker point={toPoint(userLocation)} zIndex={90}>
            <View style={styles.userDotOuter}>
              <View style={styles.userDotInner} />
            </View>
          </Marker>
        ) : null}

        {validMarkers.map((marker) => {
          const active = marker.active || marker.id === selectedMarkerId;
          const focused = marker.id === focusedMarkerId;

          return (
            <Marker key={marker.id} point={toPoint(marker.coordinate)} onPress={marker.onPress} zIndex={focused ? 80 : active ? 70 : 50}>
              <TouchableOpacity activeOpacity={0.84} onPress={marker.onPress}>
                <MarkerBubble marker={marker} active={Boolean(active)} focused={Boolean(focused)} />
              </TouchableOpacity>
            </Marker>
          );
        })}
      </YaMap>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#E8F3EA',
  },
  map: {
    flex: 1,
  },
  fallback: {
    flex: 1,
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    backgroundColor: '#E8F3EA',
  },
  fallbackTitle: {
    marginTop: 12,
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    color: '#10261A',
  },
  fallbackText: {
    marginTop: 8,
    maxWidth: 280,
    textAlign: 'center',
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    lineHeight: 20,
    color: '#4F6358',
  },
  markerShell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 7,
  },
  markerPin: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#062B1C',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 6,
  },
  markerTail: {
    marginTop: -4,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 11,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  badge: {
    position: 'absolute',
    right: -9,
    top: -7,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FACC15',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 9,
    color: '#173923',
  },
  userDotOuter: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.35)',
  },
  userDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
