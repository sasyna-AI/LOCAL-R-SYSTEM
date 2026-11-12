import type { StudyAreaPoint } from "./proposal-types";

type GeocodingResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
};

let lastGeocodeRequest = 0;

export async function searchStudyAreas(query: string): Promise<StudyAreaPoint[]> {
  const cleanQuery = query.trim().slice(0, 200);
  if (cleanQuery.length < 3) throw new Error("Enter a specific hospital, town, or study area first.");
  const hostname = window.location.hostname.toLowerCase();
  if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    throw new Error("Map lookup is available only from the local SASYNA app.");
  }
  const delay = Math.max(0, 1100 - (Date.now() - lastGeocodeRequest));
  if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
  lastGeocodeRequest = Date.now();
  const url = new URL("/__nominatim/search", window.location.origin);
  url.searchParams.set("q", cleanQuery);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "3");
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Map location search returned HTTP ${response.status}.`);
  const results = (await response.json()) as GeocodingResult[];
  return results
    .map((result) => ({
      latitude: Number(result.lat),
      longitude: Number(result.lon),
      label: result.display_name?.trim() || "",
    }))
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && point.label);
}

function tileCoordinate(latitude: number, longitude: number, zoom: number) {
  const count = 2 ** zoom;
  const radians = (latitude * Math.PI) / 180;
  return {
    x: ((longitude + 180) / 360) * count,
    y: ((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * count,
  };
}

function loadTile(zoom: number, x: number, y: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("A map tile could not be loaded. Check your internet connection and try again."));
    image.src = `/__osmtiles/${zoom}/${x}/${y}.png`;
  });
}

export async function createStudyAreaMap(point: StudyAreaPoint, zoom = 14): Promise<Blob> {
  const width = 768;
  const height = 512;
  const tileSize = 256;
  const center = tileCoordinate(point.latitude, point.longitude, zoom);
  const centerPixelX = center.x * tileSize;
  const centerPixelY = center.y * tileSize;
  const left = centerPixelX - width / 2;
  const top = centerPixelY - height / 2;
  const firstTileX = Math.floor(left / tileSize);
  const firstTileY = Math.floor(top / tileSize);
  const lastTileX = Math.floor((left + width - 1) / tileSize);
  const lastTileY = Math.floor((top + height - 1) / tileSize);
  const tileCount = (lastTileX - firstTileX + 1) * (lastTileY - firstTileY + 1);
  if (tileCount > 16) throw new Error("Map area is too large to render safely.");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot create a map image.");
  context.fillStyle = "#f3f1e9";
  context.fillRect(0, 0, width, height);

  const tiles: { x: number; y: number; image: HTMLImageElement }[] = [];
  for (let y = firstTileY; y <= lastTileY; y += 1) {
    for (let x = firstTileX; x <= lastTileX; x += 1) {
      const wrappedX = ((x % 2 ** zoom) + 2 ** zoom) % 2 ** zoom;
      const tile = await loadTile(zoom, wrappedX, y);
      tiles.push({ x, y, image: tile });
    }
  }
  for (const tile of tiles) {
    const x = Math.round(tile.x * tileSize - left);
    const y = Math.round(tile.y * tileSize - top);
    context.drawImage(tile.image, x, y, tileSize, tileSize);
  }

  const markerX = centerPixelX - left;
  const markerY = centerPixelY - top;
  context.beginPath();
  context.arc(markerX, markerY, 10, 0, Math.PI * 2);
  context.fillStyle = "#a32020";
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = "#ffffff";
  context.stroke();

  context.fillStyle = "rgba(255,255,255,0.92)";
  context.fillRect(12, 12, width - 24, 46);
  context.fillStyle = "#111111";
  context.font = "bold 18px Arial";
  context.fillText("Study area", 22, 32);
  context.font = "13px Arial";
  const label = point.label.length > 100 ? `${point.label.slice(0, 97)}…` : point.label;
  context.fillText(label, 22, 50);
  context.fillStyle = "rgba(255,255,255,0.92)";
  context.fillRect(width - 206, height - 28, 194, 18);
  context.fillStyle = "#111111";
  context.font = "12px Arial";
  context.fillText("© OpenStreetMap contributors", width - 200, height - 15);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The study-area map could not be encoded."));
    }, "image/png");
  });
}
