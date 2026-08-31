'use client';

import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';
import { useEffect, useRef } from 'react';

import type { LatLon } from '@/lib/geo';
import { TAX_REFUND_COLOR, UNKNOWN_COLOR } from '@/lib/shop-badge';

import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * 매장 지도. MapLibre **v5** — v6 는 Turbopack 에서 워커 로딩이 실패해 지도가 조용히 안 뜬다
 * (메모리 기록). 좌표는 WGS84(lon,lat)를 API 가 직접 준다.
 *
 * 서버가 이미 가까운 ≤200건만 내려주므로(공간 필터) 클러스터링 없이 개별 마커로 찍는다.
 * 색은 택스리펀 여부 한 곳에서만 온다(지도와 리스트 배지가 갈라지지 않게).
 */

export interface MapPoint {
  id: string;
  lon: number;
  lat: number;
  taxRefund: boolean;
  title: string;
}

const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const KOREA_BOUNDS: [[number, number], [number, number]] = [
  [125.9, 33.1],
  [129.6, 38.6],
];
const FIT_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };
const SOURCE = 'shops';

function toGeoJson(points: MapPoint[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: {
        id: p.id,
        title: p.title,
        color: p.taxRefund ? TAX_REFUND_COLOR : UNKNOWN_COLOR,
      },
    })),
  };
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function ShopsMap({
  points,
  center,
  selectedId,
  onSelect,
}: {
  points: MapPoint[];
  /** 현재 위치(있으면). 지도가 여기를 중심으로 처음 맞춰지고 파란 점을 찍는다. */
  center: LatLon | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loadedRef = useRef(false);
  const fittedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const pointsRef = useRef(points);
  const centerRef = useRef(center);

  useEffect(() => void (onSelectRef.current = onSelect), [onSelect]);
  useEffect(() => void (pointsRef.current = points), [points]);
  useEffect(() => void (centerRef.current = center), [center]);

  /* 지도 생성 — 한 번만. */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      bounds: KOREA_BOUNDS,
      fitBoundsOptions: { padding: FIT_PADDING },
      minZoom: 4,
      maxZoom: 18,
      attributionControl: false,
      // CARTO 글리프에 CJK 가 없어 라벨이 안 보인다. 브라우저 폰트로 그린다.
      localIdeographFontFamily: "'Noto Sans', 'Noto Sans KR', 'Noto Sans JP', sans-serif",
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      map.addSource(SOURCE, { type: 'geojson', data: toGeoJson(pointsRef.current) });

      map.addLayer({
        id: 'shop-selected',
        type: 'circle',
        source: SOURCE,
        filter: ['==', ['get', 'id'], ''],
        paint: {
          'circle-radius': 13,
          'circle-color': 'transparent',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
        },
      });
      map.addLayer({
        id: 'shop-point',
        type: 'circle',
        source: SOURCE,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 5, 15, 9],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.92,
          'circle-stroke-color': '#0b0f19',
          'circle-stroke-width': 1.5,
        },
      });
      map.addLayer({
        id: 'shop-label',
        type: 'symbol',
        source: SOURCE,
        minzoom: 13,
        layout: {
          'text-field': ['get', 'title'],
          'text-size': 11,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-max-width': 9,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#e5e7eb',
          'text-halo-color': '#0b0f19',
          'text-halo-width': 1.2,
        },
      });

      loadedRef.current = true;
      map.getSource<maplibregl.GeoJSONSource>(SOURCE)?.setData(toGeoJson(pointsRef.current));
    });

    for (const layer of ['shop-point', 'shop-label']) {
      map.on('click', layer, (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) onSelectRef.current(id);
      });
      map.on('mouseenter', layer, () => void (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', layer, () => void (map.getCanvas().style.cursor = ''));
    }

    // 0x0 으로 생성되면 줌이 굳는다. 실제 크기를 얻은 뒤 한 번 더 맞춘다.
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box || box.width < 1 || box.height < 1) return;
      map.resize();
      if (fittedRef.current) return;
      fittedRef.current = true;
      const c = centerRef.current;
      if (c) map.easeTo({ center: [c.lon, c.lat], zoom: 12, duration: 0 });
      else map.fitBounds(KOREA_BOUNDS, { padding: FIT_PADDING, duration: 0 });
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
      fittedRef.current = false;
    };
  }, []);

  /* 포인트 갱신. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    map.getSource<maplibregl.GeoJSONSource>(SOURCE)?.setData(
      points.length ? toGeoJson(points) : EMPTY,
    );
  }, [points]);

  /* 현재 위치 마커 + 최초 위치로 이동. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    const el = document.createElement('div');
    el.className = 'kr-user-dot';
    const marker = new maplibregl.Marker({ element: el }).setLngLat([center.lon, center.lat]).addTo(map);
    if (loadedRef.current && !fittedRef.current) {
      fittedRef.current = true;
      map.easeTo({ center: [center.lon, center.lat], zoom: 12, duration: 400 });
    }
    return () => void marker.remove();
  }, [center]);

  /* 선택 강조 + 화면으로 끌어오기. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    map.setFilter('shop-selected', ['==', ['get', 'id'], selectedId ?? '']);
    if (!selectedId) return;
    const hit = pointsRef.current.find((p) => p.id === selectedId);
    if (hit) map.easeTo({ center: [hit.lon, hit.lat], zoom: Math.max(map.getZoom(), 14), duration: 500 });
  }, [selectedId]);

  return <div ref={containerRef} className="size-full" />;
}
