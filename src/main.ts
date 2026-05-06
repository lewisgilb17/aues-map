import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "../styles.css";
import venueData from "./data/venues.json";

type LatLng = [lat: number, lng: number];

type VenueKind = "pub" | "food" | "club";

type Venue = {
  name: string;
  address: string;
  capacity: string;
  hours: string;
  coords: LatLng;
  deals: string[];
  kind: VenueKind;
};

type MarkerEntry = {
  popup: maplibregl.Popup;
};

type VenueFeatureProperties = {
  icon: string;
  kind: VenueKind;
  name: string;
};

type AppElements = {
  sheet: HTMLElement;
  sheetHandle: HTMLElement;
  sheetTitleRow: HTMLElement;
  closeSheet: HTMLButtonElement;
  search: HTMLInputElement;
  locateButton: HTMLButtonElement;
  locateLabel: HTMLSpanElement;
  quickList: HTMLDivElement;
  name: HTMLElement;
  hours: HTMLParagraphElement;
  deals: HTMLUListElement;
  directions: HTMLAnchorElement;
};

const venues = venueData as Venue[];

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/bright";
const DEFAULT_CENTER: [number, number] = [138.6015, -34.924];
const VENUE_KINDS: VenueKind[] = ["pub", "food", "club"];
const VENUE_KIND_THEME: Record<
  VenueKind,
  {
    accent: string;
    accentSoft: string;
    glow: string;
    surface: string;
    iconPrimary: string;
    iconSecondary: string;
    iconTertiary: string;
  }
> = {
  pub: {
    accent: "#c47a1d",
    accentSoft: "rgba(196, 122, 29, 0.2)",
    glow: "rgba(245, 196, 97, 0.34)",
    surface: "#fffaf1",
    iconPrimary: "#8d5212",
    iconSecondary: "#f1bb44",
    iconTertiary: "#fff7e4",
  },
  food: {
    accent: "#ce5a2e",
    accentSoft: "rgba(206, 90, 46, 0.2)",
    glow: "rgba(246, 151, 94, 0.32)",
    surface: "#fff7ef",
    iconPrimary: "#ad4125",
    iconSecondary: "#f5cc62",
    iconTertiary: "#e65d45",
  },
  club: {
    accent: "#167f8d",
    accentSoft: "rgba(22, 127, 141, 0.2)",
    glow: "rgba(73, 199, 214, 0.32)",
    surface: "#f3fdff",
    iconPrimary: "#0f6671",
    iconSecondary: "#94e0e8",
    iconTertiary: "#ffffff",
  },
};
const MOBILE_SHEET_BREAKPOINT = 760;
const SHEET_COLLAPSED_PEEK = 72;
const SHEET_SNAP_RATIO = 0.45;
const VENUE_SOURCE_ID = "venues";
const VENUE_LAYER_ID = "venue-pins";

type SheetDragState = {
  pointerId: number | null;
  startY: number;
  startOffset: number;
  currentOffset: number;
  moved: boolean;
  active: boolean;
};

type TouchGuardState = {
  x: number;
  y: number;
  target: EventTarget | null;
};

function getRequiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

const map = new maplibregl.Map({
  attributionControl: false,
  bearing: 0,
  center: DEFAULT_CENTER,
  container: "map",
  pitch: 0,
  style: MAP_STYLE_URL,
  zoom: 14.65,
});

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
if (map.dragRotate) map.dragRotate.disable();
if (map.touchZoomRotate) map.touchZoomRotate.disableRotation();

const elements: AppElements = {
  sheet: getRequiredElement<HTMLElement>("#details-sheet"),
  sheetHandle: getRequiredElement<HTMLElement>(".sheet-handle"),
  sheetTitleRow: getRequiredElement<HTMLElement>(".sheet-title-row"),
  closeSheet: getRequiredElement<HTMLButtonElement>("#close-sheet"),
  search: getRequiredElement<HTMLInputElement>("#venue-search"),
  locateButton: getRequiredElement<HTMLButtonElement>("#locate-button"),
  locateLabel: getRequiredElement<HTMLSpanElement>("#locate-button-label"),
  quickList: getRequiredElement<HTMLDivElement>("#quick-list"),
  name: getRequiredElement<HTMLElement>("#selected-name"),
  hours: getRequiredElement<HTMLParagraphElement>("#selected-hours"),
  deals: getRequiredElement<HTMLUListElement>("#selected-deals"),
  directions: getRequiredElement<HTMLAnchorElement>("#directions-link"),
};

let selectedVenue = venues[0];
const markers = new Map<string, MarkerEntry>();
let locationWatchId: number | null = null;
let userMarker: maplibregl.Marker | null = null;
let lastUserLatLng: LatLng | null = null;
let nearestVenue: Venue | null = null;
let isFollowingUser = false;
let isFollowMapMove = false;
let suppressSheetClick = false;
let touchGuardState: TouchGuardState | null = null;

const sheetDragState: SheetDragState = {
  pointerId: null,
  startY: 0,
  startOffset: 0,
  currentOffset: 0,
  moved: false,
  active: false,
};

function toLngLat(coords: LatLng): [number, number] {
  return [coords[1], coords[0]];
}

function getVenueBounds(list: Venue[]): maplibregl.LngLatBounds {
  const bounds = new maplibregl.LngLatBounds();
  list.forEach((venue) => bounds.extend(toLngLat(venue.coords)));
  return bounds;
}

function getMapPadding(): { top: number; bottom: number; left: number; right: number } {
  if (window.innerWidth >= 760) {
    return { top: 118, bottom: 72, left: 36, right: 430 };
  }

  return { top: 206, bottom: 286, left: 36, right: 36 };
}

function isDesktopSheetLayout(): boolean {
  return window.innerWidth >= MOBILE_SHEET_BREAKPOINT;
}

function isSheetCollapsed(): boolean {
  return elements.sheet.classList.contains("collapsed");
}

function canScrollInTouchDirection(element: HTMLElement, delta: number, axis: "x" | "y"): boolean {
  const scrollPosition = axis === "x" ? element.scrollLeft : element.scrollTop;
  const scrollSize = axis === "x" ? element.scrollWidth : element.scrollHeight;
  const clientSize = axis === "x" ? element.clientWidth : element.clientHeight;
  const maxScroll = Math.max(scrollSize - clientSize, 0);

  if (maxScroll <= 1) return false;
  if (delta > 0) return scrollPosition > 0;
  if (delta < 0) return scrollPosition < maxScroll - 1;
  return true;
}

function shouldAllowNativeTouchMove(target: Element, deltaX: number, deltaY: number): boolean {
  const quickList = target.closest<HTMLElement>(".quick-list");
  if (quickList) {
    return Math.abs(deltaX) > Math.abs(deltaY) && canScrollInTouchDirection(quickList, deltaX, "x");
  }

  const sheet = target.closest<HTMLElement>("#details-sheet");
  if (
    sheet &&
    !sheet.classList.contains("collapsed") &&
    !target.closest(".sheet-handle, .sheet-title-row, #close-sheet")
  ) {
    return Math.abs(deltaY) > Math.abs(deltaX) && canScrollInTouchDirection(sheet, deltaY, "y");
  }

  return false;
}

function handleViewportTouchStart(event: TouchEvent): void {
  if (isDesktopSheetLayout() || event.touches.length !== 1) return;

  const touch = event.touches[0];
  touchGuardState = {
    x: touch.clientX,
    y: touch.clientY,
    target: event.target,
  };
}

function handleViewportTouchMove(event: TouchEvent): void {
  if (isDesktopSheetLayout() || event.touches.length !== 1 || !event.cancelable) return;

  const touch = event.touches[0];
  const state = touchGuardState ?? { x: touch.clientX, y: touch.clientY, target: event.target };
  const target = state.target instanceof Element ? state.target : event.target instanceof Element ? event.target : null;

  if (!target || !shouldAllowNativeTouchMove(target, touch.clientX - state.x, touch.clientY - state.y)) {
    event.preventDefault();
  }
}

function resetViewportTouchGuard(): void {
  touchGuardState = null;
}

function getSheetCollapsedOffset(): number {
  return Math.max(elements.sheet.offsetHeight - SHEET_COLLAPSED_PEEK, 0);
}

function updateSheetLinkedLayout(offset = isSheetCollapsed() ? getSheetCollapsedOffset() : 0): void {
  const visibleHeight = isDesktopSheetLayout() ? 0 : Math.max(elements.sheet.offsetHeight - offset, SHEET_COLLAPSED_PEEK);
  document.documentElement.style.setProperty("--sheet-visible-height", `${visibleHeight}px`);
}

function setSheetCollapsed(collapsed: boolean): void {
  elements.sheet.classList.toggle("collapsed", collapsed);
  elements.closeSheet.setAttribute("aria-label", collapsed ? "Expand details" : "Minimise details");
  if (sheetDragState.pointerId === null) {
    elements.sheet.style.removeProperty("transform");
  }
  updateSheetLinkedLayout(collapsed ? getSheetCollapsedOffset() : 0);
}

function resetSheetDragState(): void {
  sheetDragState.pointerId = null;
  sheetDragState.startY = 0;
  sheetDragState.startOffset = 0;
  sheetDragState.currentOffset = 0;
  sheetDragState.moved = false;
  sheetDragState.active = false;
  document.documentElement.classList.remove("sheet-linking-dragging");
}

function activateSheetDrag(currentTarget: EventTarget | null): void {
  if (!(currentTarget instanceof HTMLElement) || sheetDragState.pointerId === null) return;

  sheetDragState.active = true;
  elements.sheet.classList.add("dragging");
  document.documentElement.classList.add("sheet-linking-dragging");
  elements.sheet.style.transform = `translateY(${sheetDragState.startOffset}px)`;
  updateSheetLinkedLayout(sheetDragState.startOffset);
  currentTarget.setPointerCapture(sheetDragState.pointerId);
}

function beginSheetDrag(event: PointerEvent): void {
  if (isDesktopSheetLayout()) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (!(event.target instanceof Element) || event.target.closest("#close-sheet")) return;
  if (!(event.currentTarget instanceof HTMLElement)) return;
  if (event.currentTarget !== elements.sheet) {
    event.stopPropagation();
  }
  if (
    event.currentTarget === elements.sheet &&
    event.target.closest("a, button, input, textarea, select, summary, details")
  ) {
    return;
  }

  sheetDragState.pointerId = event.pointerId;
  sheetDragState.startY = event.clientY;
  sheetDragState.startOffset = isSheetCollapsed() ? getSheetCollapsedOffset() : 0;
  sheetDragState.currentOffset = sheetDragState.startOffset;
  sheetDragState.moved = false;
  sheetDragState.active = false;

  if (isSheetCollapsed() || event.currentTarget !== elements.sheet) {
    activateSheetDrag(event.currentTarget);
    event.preventDefault();
  }
}

function moveSheetDrag(event: PointerEvent): void {
  if (sheetDragState.pointerId !== event.pointerId || isDesktopSheetLayout()) return;
  if (event.currentTarget !== elements.sheet) {
    event.stopPropagation();
  }

  if (!sheetDragState.active) {
    if (event.currentTarget !== elements.sheet) return;

    const deltaY = event.clientY - sheetDragState.startY;
    if (elements.sheet.scrollTop > 0 || deltaY <= 6) return;

    activateSheetDrag(event.currentTarget);
  }

  if (!sheetDragState.active) return;

  const collapsedOffset = getSheetCollapsedOffset();
  const nextOffset = Math.min(
    Math.max(sheetDragState.startOffset + event.clientY - sheetDragState.startY, 0),
    collapsedOffset
  );

  sheetDragState.currentOffset = nextOffset;
  sheetDragState.moved ||= Math.abs(nextOffset - sheetDragState.startOffset) > 4;
  elements.sheet.style.transform = `translateY(${nextOffset}px)`;
  updateSheetLinkedLayout(nextOffset);
  event.preventDefault();
}

function finishSheetDrag(event: PointerEvent, cancelled = false): void {
  if (sheetDragState.pointerId !== event.pointerId) return;
  if (event.currentTarget !== elements.sheet) {
    event.stopPropagation();
  }

  if (!sheetDragState.active) {
    resetSheetDragState();
    return;
  }

  if (event.currentTarget instanceof HTMLElement && event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const endOffset = cancelled ? sheetDragState.startOffset : sheetDragState.currentOffset;
  const shouldCollapse = endOffset > getSheetCollapsedOffset() * SHEET_SNAP_RATIO;
  const moved = sheetDragState.moved;

  elements.sheet.classList.remove("dragging");
  resetSheetDragState();
  setSheetCollapsed(shouldCollapse);

  if (moved) {
    suppressSheetClick = true;
    window.setTimeout(() => {
      suppressSheetClick = false;
    }, 0);
  }
}

function fitVenueBounds(list: Venue[], animate = true): void {
  if (list.length === 0) return;

  map.fitBounds(getVenueBounds(list), {
    duration: animate ? 520 : 0,
    maxZoom: 16.2,
    padding: getMapPadding(),
  });
}

function getVenueKind(venue: Venue): VenueKind {
  return venue.kind;
}

function traceRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const rounded = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + rounded, y);
  context.arcTo(x + width, y, x + width, y + height, rounded);
  context.arcTo(x + width, y + height, x, y + height, rounded);
  context.arcTo(x, y + height, x, y, rounded);
  context.arcTo(x, y, x + width, y, rounded);
  context.closePath();
}

function getVenueMarkerIconId(kind: VenueKind, active: boolean): string {
  return `venue-marker-${kind}-${active ? "active" : "inactive"}`;
}

function drawBeerIcon(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  theme: (typeof VENUE_KIND_THEME)[VenueKind],
): void {
  const glassTopY = centerY - 11;
  const glassBottomY = centerY + 12;
  const topHalfWidth = 9;
  const bottomHalfWidth = 6;

  const traceGlass = (): void => {
    context.beginPath();
    context.moveTo(centerX - topHalfWidth + 2, glassTopY);
    context.lineTo(centerX + topHalfWidth - 2, glassTopY);
    context.quadraticCurveTo(centerX + topHalfWidth, glassTopY, centerX + topHalfWidth, glassTopY + 2.4);
    context.lineTo(centerX + bottomHalfWidth + 0.6, glassBottomY - 2.2);
    context.quadraticCurveTo(centerX + bottomHalfWidth, glassBottomY, centerX + bottomHalfWidth - 2, glassBottomY);
    context.lineTo(centerX - bottomHalfWidth + 2, glassBottomY);
    context.quadraticCurveTo(centerX - bottomHalfWidth, glassBottomY, centerX - bottomHalfWidth - 0.6, glassBottomY - 2.2);
    context.lineTo(centerX - topHalfWidth, glassTopY + 2.4);
    context.quadraticCurveTo(centerX - topHalfWidth, glassTopY, centerX - topHalfWidth + 2, glassTopY);
    context.closePath();
  };

  traceGlass();
  const beerGradient = context.createLinearGradient(0, glassTopY, 0, glassBottomY);
  beerGradient.addColorStop(0, "#ffd96a");
  beerGradient.addColorStop(0.62, theme.iconSecondary);
  beerGradient.addColorStop(1, "#d8831c");
  context.fillStyle = beerGradient;
  context.fill();

  context.save();
  traceGlass();
  context.clip();

  context.fillStyle = theme.iconTertiary;
  context.beginPath();
  context.moveTo(centerX - topHalfWidth, glassTopY);
  context.lineTo(centerX + topHalfWidth, glassTopY);
  context.lineTo(centerX + topHalfWidth, glassTopY + 5.8);
  context.quadraticCurveTo(centerX + 5, glassTopY + 9.2, centerX + 1.8, glassTopY + 6.3);
  context.quadraticCurveTo(centerX - 1.4, glassTopY + 3.8, centerX - 4.5, glassTopY + 7.2);
  context.quadraticCurveTo(centerX - 7, glassTopY + 9.8, centerX - topHalfWidth, glassTopY + 6.2);
  context.closePath();
  context.fill();

  context.strokeStyle = "rgba(255, 255, 255, 0.48)";
  context.lineCap = "round";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(centerX - 4.2, glassTopY + 8.8);
  context.lineTo(centerX - 5.2, glassBottomY - 4.6);
  context.stroke();

  context.fillStyle = "rgba(255, 247, 228, 0.72)";
  context.beginPath();
  context.arc(centerX + 3.8, centerY + 1.2, 1.35, 0, Math.PI * 2);
  context.arc(centerX + 1.1, centerY + 5.8, 1.05, 0, Math.PI * 2);
  context.arc(centerX + 5.3, centerY + 7.4, 0.8, 0, Math.PI * 2);
  context.fill();

  context.restore();

  traceGlass();
  context.lineWidth = 2.3;
  context.strokeStyle = theme.iconPrimary;
  context.stroke();

  context.strokeStyle = "rgba(141, 82, 18, 0.32)";
  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(centerX - 6.2, glassTopY + 5.8);
  context.quadraticCurveTo(centerX - 1.2, glassTopY + 8.8, centerX + 4.2, glassTopY + 6.4);
  context.stroke();
}

function drawPizzaIcon(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  theme: (typeof VENUE_KIND_THEME)[VenueKind],
): void {
  context.fillStyle = theme.iconSecondary;
  context.beginPath();
  context.moveTo(centerX - 9, centerY - 7);
  context.quadraticCurveTo(centerX, centerY - 12.5, centerX + 9, centerY - 7);
  context.lineTo(centerX + 1.5, centerY + 10);
  context.quadraticCurveTo(centerX, centerY + 12.5, centerX - 1.5, centerY + 10);
  context.closePath();
  context.fill();

  context.strokeStyle = theme.iconPrimary;
  context.lineWidth = 2;
  context.stroke();

  context.strokeStyle = "#d59a48";
  context.lineWidth = 4.2;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(centerX - 8.5, centerY - 7);
  context.quadraticCurveTo(centerX, centerY - 11.5, centerX + 8.5, centerY - 7);
  context.stroke();

  context.fillStyle = theme.iconTertiary;
  [
    { x: -3.8, y: -2.7, size: 2.5 },
    { x: 3.8, y: -1.6, size: 2.4 },
    { x: 0.6, y: 4.5, size: 2.2 },
  ].forEach(({ x, y, size }) => {
    context.beginPath();
    context.arc(centerX + x, centerY + y, size, 0, Math.PI * 2);
    context.fill();
  });
}

function drawDiscoBallIcon(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  theme: (typeof VENUE_KIND_THEME)[VenueKind],
): void {
  const radius = 8.5;

  context.strokeStyle = theme.iconPrimary;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(centerX, centerY - 13);
  context.lineTo(centerX, centerY - 9.5);
  context.stroke();

  context.fillStyle = theme.iconSecondary;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.save();
  context.beginPath();
  context.arc(centerX, centerY, radius - 0.3, 0, Math.PI * 2);
  context.clip();

  context.strokeStyle = theme.iconPrimary;
  context.lineWidth = 1.15;
  [-4.5, 0, 4.5].forEach((offset) => {
    context.beginPath();
    context.moveTo(centerX + offset, centerY - radius);
    context.lineTo(centerX + offset, centerY + radius);
    context.stroke();
  });
  [-3.5, 0, 3.5].forEach((offset) => {
    context.beginPath();
    context.moveTo(centerX - radius, centerY + offset);
    context.quadraticCurveTo(centerX, centerY + offset - 2.2, centerX + radius, centerY + offset);
    context.stroke();
  });

  context.restore();

  context.fillStyle = theme.iconTertiary;
  context.beginPath();
  context.arc(centerX - 3.5, centerY - 3.5, 2, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = theme.iconTertiary;
  context.lineWidth = 1.4;
  context.beginPath();
  context.moveTo(centerX + 9.5, centerY - 8.5);
  context.lineTo(centerX + 12.5, centerY - 8.5);
  context.moveTo(centerX + 11, centerY - 10);
  context.lineTo(centerX + 11, centerY - 7);
  context.stroke();
}

function createVenueMarkerImage(kind: VenueKind, active: boolean): ImageData {
  const width = 64;
  const height = 80;
  const pixelRatio = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create venue marker image");
  }

  const theme = VENUE_KIND_THEME[kind];
  const centerX = width / 2;
  const circleY = 25;
  const circleRadius = active ? 20 : 18;

  context.scale(pixelRatio, pixelRatio);
  context.clearRect(0, 0, width, height);

  context.fillStyle = active ? "rgba(30, 40, 54, 0.22)" : "rgba(30, 40, 54, 0.15)";
  context.beginPath();
  context.ellipse(centerX, height - 6, 10, 3.4, 0, 0, Math.PI * 2);
  context.fill();

  if (active) {
    context.fillStyle = theme.glow;
    context.beginPath();
    context.arc(centerX, circleY, circleRadius + 5, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = theme.accentSoft;
  context.beginPath();
  context.moveTo(centerX - 8.5, circleY + 13);
  context.lineTo(centerX, height - 8);
  context.lineTo(centerX + 8.5, circleY + 13);
  context.closePath();
  context.fill();

  const fillGradient = context.createLinearGradient(0, 6, 0, circleY + circleRadius + 6);
  fillGradient.addColorStop(0, "#ffffff");
  fillGradient.addColorStop(1, theme.surface);

  context.fillStyle = fillGradient;
  context.beginPath();
  context.arc(centerX, circleY, circleRadius, 0, Math.PI * 2);
  context.fill();

  context.lineWidth = active ? 4.2 : 3;
  context.strokeStyle = theme.accent;
  context.beginPath();
  context.arc(centerX, circleY, circleRadius - 1.6, 0, Math.PI * 2);
  context.stroke();

  context.lineWidth = 1.5;
  context.strokeStyle = active ? "rgba(255, 255, 255, 0.74)" : "rgba(255, 255, 255, 0.95)";
  context.beginPath();
  context.arc(centerX, circleY, circleRadius - 4.5, 0, Math.PI * 2);
  context.stroke();

  if (kind === "pub") {
    drawBeerIcon(context, centerX, circleY + 1, theme);
  } else if (kind === "food") {
    drawPizzaIcon(context, centerX, circleY + 1, theme);
  } else {
    drawDiscoBallIcon(context, centerX, circleY + 2, theme);
  }

  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function buildVenueFeatureCollection(): GeoJSON.FeatureCollection<GeoJSON.Point, VenueFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: venues.map((venue, index) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: toLngLat(venue.coords),
      },
      properties: {
        icon: getVenueMarkerIconId(getVenueKind(venue), venue.name === selectedVenue.name),
        kind: getVenueKind(venue),
        name: venue.name,
      },
    })),
  };
}

function syncVenueSource(): void {
  const source = map.getSource(VENUE_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) return;
  source.setData(buildVenueFeatureCollection());
}

function initialiseVenuePins(): void {
  VENUE_KINDS.forEach((kind) => {
    [false, true].forEach((active) => {
      const iconId = getVenueMarkerIconId(kind, active);
      if (map.hasImage(iconId)) return;
      map.addImage(iconId, createVenueMarkerImage(kind, active), { pixelRatio: 2 });
    });
  });

  if (!map.getSource(VENUE_SOURCE_ID)) {
    map.addSource(VENUE_SOURCE_ID, {
      type: "geojson",
      data: buildVenueFeatureCollection(),
    });
  }

  if (!map.getLayer(VENUE_LAYER_ID)) {
    map.addLayer({
      id: VENUE_LAYER_ID,
      type: "symbol",
      source: VENUE_SOURCE_ID,
      layout: {
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-image": ["get", "icon"],
      },
    });
  }

  map.on("click", VENUE_LAYER_ID, (event) => {
    const feature = event.features?.[0];
    const name = feature?.properties?.name;
    if (typeof name === "string") {
      selectVenue(name, true);
    }
  });

  map.on("mouseenter", VENUE_LAYER_ID, () => {
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", VENUE_LAYER_ID, () => {
    map.getCanvas().style.cursor = "";
  });
}

function createUserMarkerElement(): HTMLDivElement {
  const element = document.createElement("div");
  element.className = "user-location-pin";
  return element;
}

function setPaint(layerId: string, property: string, value: string | number): void {
  try {
    map.setPaintProperty(layerId, property, value);
  } catch {
    // Some style layers do not support every paint property.
  }
}

function softenBaseMap(): void {
  const style = map.getStyle();
  if (!style?.layers) return;

  style.layers.forEach((layer) => {
    const id = layer.id.toLowerCase();

    if (layer.type === "background") {
      setPaint(layer.id, "background-color", "#eef4f8");
      return;
    }

    if (layer.type === "fill") {
      if (id.includes("water")) {
        setPaint(layer.id, "fill-color", "#cfe8f7");
        setPaint(layer.id, "fill-opacity", 0.94);
        return;
      }

      if (id.includes("park") || id.includes("grass") || id.includes("wood") || id.includes("forest")) {
        setPaint(layer.id, "fill-color", "#dbeccd");
        setPaint(layer.id, "fill-opacity", 0.82);
        return;
      }

      if (id.includes("building")) {
        setPaint(layer.id, "fill-color", "#e4ddd6");
        setPaint(layer.id, "fill-opacity", 0.46);
        setPaint(layer.id, "fill-outline-color", "rgba(209, 202, 194, 0.55)");
        return;
      }

      if (id.includes("landcover") || id.includes("landuse")) {
        setPaint(layer.id, "fill-color", "#f3f3ec");
        setPaint(layer.id, "fill-opacity", 0.66);
      }
    }

    if (layer.type === "line") {
      if (id.includes("motorway") || id.includes("highway")) {
        setPaint(layer.id, "line-color", "#f8d7a6");
        setPaint(layer.id, "line-opacity", 0.8);
        return;
      }

      if (id.includes("rail") || id.includes("transit")) {
        setPaint(layer.id, "line-color", "#bec8d3");
        setPaint(layer.id, "line-opacity", 0.4);
        return;
      }

      if (id.includes("road") || id.includes("street")) {
        setPaint(layer.id, "line-color", "#ffffff");
        setPaint(layer.id, "line-opacity", 0.84);
        return;
      }

      if (id.includes("boundary")) {
        setPaint(layer.id, "line-color", "#c1cad4");
        setPaint(layer.id, "line-opacity", 0.24);
      }
    }

    if (layer.type === "symbol") {
      if (id.includes("poi")) {
        setPaint(layer.id, "icon-opacity", 0.38);
        setPaint(layer.id, "text-opacity", 0.56);
      }

      if (id.includes("place") || id.includes("poi") || id.includes("road")) {
        setPaint(layer.id, "text-color", "#607082");
        setPaint(layer.id, "text-halo-color", "rgba(255, 255, 255, 0.95)");
        setPaint(layer.id, "text-halo-width", 1.7);
      }
    }
  });
}

venues.forEach((venue, index) => {
  const popup = new maplibregl.Popup({
    closeButton: false,
    offset: 30,
  }).setHTML(`<strong>${venue.name}</strong>${venue.hours ? `<br>${venue.hours}` : ""}`);
  markers.set(venue.name, { popup });
});

function renderQuickList(list: Venue[] = venues): void {
  elements.quickList.innerHTML = "";

  list.forEach((venue) => {
    const button = document.createElement("button");
    button.className = `venue-chip${venue.name === selectedVenue.name ? " active" : ""}`;
    button.type = "button";
    button.textContent = venue.name;
    button.addEventListener("click", () => selectVenue(venue.name, true));
    elements.quickList.append(button);
  });
}

function renderDetails(venue: Venue): void {
  elements.name.textContent = venue.name;
  elements.hours.textContent = venue.hours;
  elements.hours.hidden = venue.hours.length === 0;
  elements.deals.innerHTML = "";

  venue.deals.forEach((deal) => {
    const item = document.createElement("li");
    item.textContent = deal;
    elements.deals.append(item);
  });

  const destination = encodeURIComponent(`${venue.name}, ${venue.address}, Adelaide SA`);
  elements.directions.href = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

function refreshMarkers(): void {
  syncVenueSource();
}

function selectVenue(name: string, moveMap = false): void {
  const nextVenue = venues.find((venue) => venue.name === name);
  if (!nextVenue) return;

  selectedVenue = nextVenue;
  renderDetails(selectedVenue);
  refreshMarkers();
  renderQuickList(getFilteredVenues());
  setSheetCollapsed(false);

  const entry = markers.get(selectedVenue.name);
  if (moveMap && entry) {
    disableUserFollow();
    const center = toLngLat(selectedVenue.coords);
    markers.forEach(({ popup }) => popup.remove());
    map.flyTo({
      center,
      duration: 650,
      essential: true,
      pitch: 0,
      zoom: Math.max(map.getZoom(), 16.25),
    });
    entry.popup.setLngLat(center).addTo(map);
  }
}

function getFilteredVenues(): Venue[] {
  const query = elements.search.value.trim().toLowerCase();
  if (!query) return venues;

  return venues.filter((venue) => {
    const text = [venue.name, venue.address, venue.hours, ...venue.deals].join(" ").toLowerCase();
    return text.includes(query);
  });
}

function distanceInMeters(start: LatLng, end: LatLng): number {
  const radius = 6371000;
  const startLat = (start[0] * Math.PI) / 180;
  const endLat = (end[0] * Math.PI) / 180;
  const deltaLat = ((end[0] - start[0]) * Math.PI) / 180;
  const deltaLng = ((end[1] - start[1]) * Math.PI) / 180;
  const halfChord =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return radius * 2 * Math.atan2(Math.sqrt(halfChord), Math.sqrt(1 - halfChord));
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function getNearestVenue(latLng: LatLng): { venue: Venue; distance: number } | null {
  return venues.reduce<{ venue: Venue; distance: number } | null>((nearest, venue) => {
    const distance = distanceInMeters(latLng, venue.coords);
    if (!nearest || distance < nearest.distance) {
      return { venue, distance };
    }
    return nearest;
  }, null);
}

function createAccuracyFeature(latLng: LatLng, radius: number): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  const centerLat = (latLng[0] * Math.PI) / 180;
  const centerLng = (latLng[1] * Math.PI) / 180;
  const angularDistance = radius / 6371000;
  const coordinates: [number, number][] = [];

  for (let index = 0; index <= 72; index += 1) {
    const bearing = (index / 72) * Math.PI * 2;
    const lat = Math.asin(
      Math.sin(centerLat) * Math.cos(angularDistance) +
        Math.cos(centerLat) * Math.sin(angularDistance) * Math.cos(bearing)
    );
    const lng =
      centerLng +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(centerLat),
        Math.cos(angularDistance) - Math.sin(centerLat) * Math.sin(lat)
      );

    coordinates.push([(lng * 180) / Math.PI, (lat * 180) / Math.PI]);
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [coordinates],
        },
      },
    ],
  };
}

function updateUserAccuracyCircle(latLng: LatLng, radius: number): void {
  const data = createAccuracyFeature(latLng, Math.max(radius, 20));

  if (!map.isStyleLoaded()) {
    map.once("load", () => updateUserAccuracyCircle(latLng, radius));
    return;
  }

  const source = map.getSource("user-accuracy") as GeoJSONSource | undefined;
  if (source) {
    source.setData(data);
    return;
  }

  map.addSource("user-accuracy", {
    type: "geojson",
    data,
  });
  map.addLayer({
    id: "user-accuracy-fill",
    type: "fill",
    source: "user-accuracy",
    paint: {
      "fill-color": "#3e8cf5",
      "fill-opacity": 0.12,
    },
  });
  map.addLayer({
    id: "user-accuracy-line",
    type: "line",
    source: "user-accuracy",
    paint: {
      "line-color": "#3e8cf5",
      "line-opacity": 0.5,
      "line-width": 2,
    },
  });
}

function setLocationButtonState(venue: Venue | null): void {
  nearestVenue = venue;
  updateLocationButton();
}

function updateLocationButton(): void {
  const label = nearestVenue ? `Nearest: ${nearestVenue.name}` : "Enable location";
  elements.locateButton.classList.toggle("active", nearestVenue !== null);
  elements.locateButton.setAttribute("aria-label", label);
  elements.locateLabel.textContent = label;
}

function disableUserFollow(): void {
  if (!isFollowingUser) return;
  isFollowingUser = false;
  updateLocationButton();
}

function centerMapOnUser(latLng: LatLng): void {
  isFollowMapMove = true;
  map.easeTo({
    center: toLngLat(latLng),
    duration: 520,
    essential: true,
    zoom: Math.max(map.getZoom(), 17),
  });
  map.once("moveend", () => {
    isFollowMapMove = false;
  });
  window.setTimeout(() => {
    isFollowMapMove = false;
  }, 900);
}

function handleUserPosition(position: GeolocationPosition): void {
  const latLng: LatLng = [position.coords.latitude, position.coords.longitude];
  const accuracy = Math.round(position.coords.accuracy || 0);
  lastUserLatLng = latLng;

  if (!userMarker) {
    userMarker = new maplibregl.Marker({
      anchor: "center",
      element: createUserMarkerElement(),
    })
      .setLngLat(toLngLat(latLng))
      .setPopup(new maplibregl.Popup({ closeButton: false, offset: 18 }).setText("You are here"))
      .addTo(map);
  } else {
    userMarker.setLngLat(toLngLat(latLng));
  }

  updateUserAccuracyCircle(latLng, accuracy);

  if (isFollowingUser) {
    centerMapOnUser(latLng);
  }

  const nearest = getNearestVenue(latLng);
  setLocationButtonState(nearest?.venue ?? null);
}

function handleLocationError(): void {
  if (locationWatchId !== null) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  }

  isFollowingUser = false;
  setLocationButtonState(null);
}

function startLocationWatch(): void {
  if (!("geolocation" in navigator)) {
    setLocationButtonState(null);
    return;
  }

  isFollowingUser = true;
  setLocationButtonState(null);

  locationWatchId = navigator.geolocation.watchPosition(handleUserPosition, handleLocationError, {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 12000,
  });
}

function toggleUserLocation(): void {
  if (nearestVenue) {
    selectVenue(nearestVenue.name, true);
    return;
  }

  if (locationWatchId === null) {
    startLocationWatch();
    return;
  }

  isFollowingUser = true;
  updateLocationButton();

  if (lastUserLatLng) {
    centerMapOnUser(lastUserLatLng);
  }
}

elements.search.addEventListener("input", () => {
  const filtered = getFilteredVenues();
  renderQuickList(filtered);
  if (filtered.length > 0) {
    fitVenueBounds(filtered);
  }
});

elements.locateButton.addEventListener("click", toggleUserLocation);

document.addEventListener("touchstart", handleViewportTouchStart, { passive: true });
document.addEventListener("touchmove", handleViewportTouchMove, { capture: true, passive: false });
document.addEventListener("touchend", resetViewportTouchGuard, { passive: true });
document.addEventListener("touchcancel", resetViewportTouchGuard, { passive: true });

for (const dragHandle of [elements.sheet, elements.sheetHandle, elements.sheetTitleRow]) {
  dragHandle.addEventListener("pointerdown", beginSheetDrag);
  dragHandle.addEventListener("pointermove", moveSheetDrag);
  dragHandle.addEventListener("pointerup", (event) => finishSheetDrag(event));
  dragHandle.addEventListener("pointercancel", (event) => finishSheetDrag(event, true));
}

elements.closeSheet.addEventListener("click", (event) => {
  event.stopPropagation();
  setSheetCollapsed(!isSheetCollapsed());
});

elements.sheet.addEventListener("click", () => {
  if (suppressSheetClick) {
    suppressSheetClick = false;
    return;
  }

  if (isSheetCollapsed()) {
    setSheetCollapsed(false);
  }
});

window.addEventListener("resize", () => {
  resetSheetDragState();
  elements.sheet.classList.remove("dragging");
  elements.sheet.style.removeProperty("transform");
  updateSheetLinkedLayout();
});

map.on("dragstart", () => {
  if (!isFollowMapMove) {
    disableUserFollow();
  }
});

map.on("zoomstart", () => {
  if (!isFollowMapMove) {
    disableUserFollow();
  }
});

renderQuickList();
selectVenue("Atlantis");
updateLocationButton();
updateSheetLinkedLayout();
map.once("load", () => {
  softenBaseMap();
  initialiseVenuePins();
  refreshMarkers();
  fitVenueBounds(venues, false);
});