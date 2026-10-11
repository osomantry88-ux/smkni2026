import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Loader2 } from 'lucide-react';

interface LeafletMapProps {
  latitude: number | null;
  longitude: number | null;
  radius: number;
  onLocationChange: (lat: number, lng: number) => void;
}

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

export default function LeafletMap({ latitude, longitude, radius, onLocationChange }: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const defaultLat = latitude ?? -6.2;
    const defaultLng = longitude ?? 106.816;

    const map = L.map(mapRef.current).setView([defaultLat, defaultLng], 15);
    mapInstance.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const icon = L.divIcon({
      className: 'custom-marker',
      html: '<div style="width:24px;height:24px;border-radius:50% 50% 50% 0;background:#059669;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });

    const marker = L.marker([defaultLat, defaultLng], { draggable: true, icon }).addTo(map);
    markerRef.current = marker;

    const circle = L.circle([defaultLat, defaultLng], {
      radius: Math.max(radius, 10),
      color: '#059669',
      fillColor: '#059669',
      fillOpacity: 0.15,
      weight: 2,
    }).addTo(map);
    circleRef.current = circle;

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onLocationChange(pos.lat, pos.lng);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onLocationChange(e.latlng.lat, e.latlng.lng);
    });

    return () => {
      map.remove();
      mapInstance.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !markerRef.current || !circleRef.current) return;
    if (latitude !== null && longitude !== null) {
      const latlng: L.LatLngExpression = [latitude, longitude];
      markerRef.current.setLatLng(latlng);
      circleRef.current.setLatLng(latlng);
      circleRef.current.setRadius(Math.max(radius, 10));
      if (!mapInstance.current.hasLayer(markerRef.current)) return;
      mapInstance.current.panTo(latlng, { animate: true });
    }
  }, [latitude, longitude, radius]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setShowResults(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&countrycodes=id`,
        { headers: { 'Accept-Language': 'id' } }
      );
      if (res.ok) {
        const data: SearchResult[] = await res.json();
        setSearchResults(data);
      }
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }

  function selectResult(result: SearchResult) {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    onLocationChange(lat, lng);
    setShowResults(false);
    setSearchQuery(result.display_name.split(',')[0]);
    if (mapInstance.current) {
      mapInstance.current.setView([lat, lng], 17);
    }
  }

  return (
    <div className="relative">
      {/* Search overlay */}
      <div className="absolute top-3 left-3 z-[1000]" style={{ zIndex: 1000 }}>
        <form onSubmit={handleSearch} className="flex gap-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              placeholder="Cari lokasi..."
              className="w-56 rounded-lg border border-gray-300 bg-white pl-8 pr-3 py-1.5 text-sm shadow-md focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white shadow-md hover:bg-emerald-800 transition disabled:opacity-50"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cari'}
          </button>
        </form>
        {showResults && (searchResults.length > 0 || (!searching && searchQuery)) && (
          <div className="mt-1 w-72 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {searching ? (
              <p className="px-3 py-2 text-sm text-gray-400">Mencari...</p>
            ) : searchResults.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">Tidak ada hasil.</p>
            ) : (
              searchResults.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectResult(r)}
                  className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50 transition border-b border-gray-100 last:border-0"
                >
                  {r.display_name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <div ref={mapRef} className="w-full h-80 rounded-xl border border-gray-200 z-0" />
    </div>
  );
}
