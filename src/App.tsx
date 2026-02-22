import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  Globe as GlobeIcon, 
  Search, 
  Volume2, 
  VolumeX,
  Info,
  ChevronRight,
  ChevronLeft,
  Radio,
  MapPin,
  Heart,
  Map as MapIcon,
  Layers,
  List
} from 'lucide-react';
import Globe from 'react-globe.gl';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { fetchAllStations, RadioStation, fetchCountries, fetchIPTVStations } from './services/radioService';

const App: React.FC = () => {
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [countries, setCountries] = useState<{ name: string; stationcount: number }[]>([]);
  const [selectedStation, setSelectedStation] = useState<RadioStation | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [activeTab, setActiveTab] = useState<'search' | 'countries'>('search');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const globeRef = useRef<any>();
  const mapRef = useRef<L.Map | null>(null);
  const [centerCoords, setCenterCoords] = useState<{ lat: number, lng: number } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const [stationsData, countriesData, iptvData] = await Promise.all([
        fetchAllStations(),
        fetchCountries(),
        fetchIPTVStations()
      ]);
      
      // Merge IPTV stations. Note: IPTV stations might not have coordinates, 
      // so they will only appear in the search/list, not on the map.
      setStations([...stationsData, ...iptvData]);
      setCountries(countriesData);
      setIsLoading(false);
      
      const savedFavorites = localStorage.getItem('radio-favorites');
      if (savedFavorites) {
        try {
          setFavorites(new Set(JSON.parse(savedFavorites)));
        } catch (e) {
          console.error("Failed to parse favorites", e);
        }
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (globeRef.current && viewMode === '3d') {
      globeRef.current.controls().autoRotate = isAutoRotating;
      globeRef.current.controls().autoRotateSpeed = 0.5;
    }
  }, [isAutoRotating, viewMode]);

  useEffect(() => {
    if (selectedStation && audioRef.current) {
      audioRef.current.src = selectedStation.url_resolved || selectedStation.url;
      if (isPlaying) {
        audioRef.current.play().catch(e => {
          console.error("Playback failed", e);
          setIsPlaying(false);
        });
      }
    }
  }, [selectedStation]);

  const togglePlay = () => {
    if (!selectedStation) return;
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play().catch(e => {
        console.error("Playback failed", e);
        setIsPlaying(false);
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleStationClick = (station: RadioStation) => {
    setSelectedStation(station);
    setIsPlaying(true);
    setIsAutoRotating(false);
    
    if (station.geo_lat !== null && station.geo_long !== null) {
      if (viewMode === '3d' && globeRef.current) {
        globeRef.current.pointOfView({
          lat: station.geo_lat,
          lng: station.geo_long,
          altitude: 1.5
        }, 1000);
      } else if (viewMode === '2d' && mapRef.current) {
        mapRef.current.setView([station.geo_lat!, station.geo_long!], 10, { animate: true });
      }
    }
  };

  const playRandomStation = () => {
    if (stations.length === 0) return;
    const randomStation = stations[Math.floor(Math.random() * stations.length)];
    handleStationClick(randomStation);
  };

  const toggleFavorite = (stationUuid: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(stationUuid)) {
        next.delete(stationUuid);
      } else {
        next.add(stationUuid);
      }
      localStorage.setItem('radio-favorites', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const filteredStations = useMemo(() => {
    return stations.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.country.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFavorite = !showOnlyFavorites || favorites.has(s.stationuuid);
      return matchesSearch && matchesFavorite;
    });
  }, [stations, searchQuery, showOnlyFavorites, favorites]);

  const MapController = ({ lat, lng }: { lat: number | null, lng: number | null }) => {
    const map = useMap();
    
    useEffect(() => {
      if (lat !== null && lng !== null) {
        map.setView([lat, lng], map.getZoom());
      }
    }, [lat, lng]);

    useEffect(() => {
      const onMove = () => {
        const center = map.getCenter();
        setCenterCoords({ lat: center.lat, lng: center.lng });
      };
      
      map.on('move', onMove);
      // Initial set
      onMove();
      
      return () => {
        map.off('move', onMove);
      };
    }, [map]);

    return null;
  };

  // Effect to find nearest station when center changes
  useEffect(() => {
    if (viewMode === '2d' && centerCoords && stations.length > 0) {
      // Find nearest station within a certain radius
      let nearest: RadioStation | null = null;
      let minDistance = Infinity;
      
      // Only check stations with coordinates
      const geoStations = stations.filter(s => s.geo_lat !== null && s.geo_long !== null);
      
      for (const station of geoStations) {
        const dLat = station.geo_lat! - centerCoords.lat;
        const dLng = station.geo_long! - centerCoords.lng;
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
        
        if (dist < minDistance) {
          minDistance = dist;
          nearest = station;
        }
      }
      
      // If within a small threshold (e.g., 0.5 degrees), auto-select
      if (nearest && minDistance < 0.3 && nearest.stationuuid !== selectedStation?.stationuuid) {
        setSelectedStation(nearest);
        setIsPlaying(true);
      }
    }
  }, [centerCoords, viewMode, stations]);

  return (
    <div className="relative w-full h-screen bg-[#000022] overflow-hidden">
      <audio 
        ref={audioRef} 
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        muted={isMuted}
      />

      {/* Map Container */}
      <div className="absolute inset-0 z-0">
        {viewMode === '3d' ? (
          <Globe
            ref={globeRef}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
            pointsData={filteredStations.slice(0, 5000)} // Limit for performance on globe
            pointLat="geo_lat"
            pointLng="geo_long"
            pointColor={(d: any) => d.stationuuid === selectedStation?.stationuuid ? '#ff0000' : '#00ff88'}
            pointAltitude={(d: any) => d.stationuuid === selectedStation?.stationuuid ? 0.05 : 0.01}
            pointRadius={(d: any) => d.stationuuid === selectedStation?.stationuuid ? 0.5 : 0.25}
            pointsMerge={true}
            onPointClick={handleStationClick}
            pointLabel={(d: any) => `
              <div class="bg-black/80 p-2 rounded border border-white/20 text-xs">
                <div class="font-bold text-green-400">${d.name}</div>
                <div class="text-white/60">${d.country}</div>
              </div>
            `}
            enablePointerInteraction={true}
            onGlobeClick={() => setIsAutoRotating(false)}
            ringsData={selectedStation ? [selectedStation] : []}
            ringLat="geo_lat"
            ringLng="geo_long"
            ringColor={() => '#ff0000'}
            ringMaxRadius={2.5}
            ringPropagationSpeed={3}
            ringRepeatPeriod={800}
          />
        ) : (
          <MapContainer 
            center={[20, 0]} 
            zoom={3} 
            className="w-full h-full"
            ref={mapRef}
            zoomControl={false}
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            />
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            />
            {filteredStations.slice(0, 5000).map((station) => (
              <Marker 
                key={station.stationuuid} 
                position={[station.geo_lat!, station.geo_long!]}
                eventHandlers={{
                  click: () => handleStationClick(station)
                }}
                icon={L.divIcon({
                  className: 'custom-div-icon',
                  html: `<div class="w-2 h-2 rounded-full border border-white/30 ${selectedStation?.stationuuid === station.stationuuid ? 'bg-red-500 animate-pulse scale-150' : 'bg-green-500'}"></div>`,
                  iconSize: [8, 8],
                  iconAnchor: [4, 4]
                })}
              >
                <Popup className="custom-popup">
                  <div className="p-1 text-black">
                    <div className="font-bold text-sm">{station.name}</div>
                    <div className="text-xs opacity-70">{station.country}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
            <MapController lat={selectedStation?.geo_lat || null} lng={selectedStation?.geo_long || null} />
          </MapContainer>
        )}
      </div>

      {/* Target Circle for 2D Map */}
      {viewMode === '2d' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
          <div className="w-24 h-24 rounded-full border-2 border-green-500/50 flex items-center justify-center">
            <div className="w-1 h-1 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,1)]"></div>
            <div className="absolute inset-0 rounded-full border border-green-500/20 animate-ping"></div>
          </div>
        </div>
      )}

      {/* Overlay UI */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="p-6 flex justify-between items-start pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.5)]">
              <Radio className="text-black w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Global Radio</h1>
              <p className="text-xs text-white/40 uppercase tracking-widest">Live Explorer</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <div className="flex glass-panel rounded-full p-1">
              <button 
                onClick={() => setViewMode('2d')}
                className={`p-2 rounded-full transition-all ${viewMode === '2d' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                title="2D Map"
              >
                <MapIcon className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setViewMode('3d')}
                className={`p-2 rounded-full transition-all ${viewMode === '3d' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                title="3D Globe"
              >
                <GlobeIcon className="w-5 h-5" />
              </button>
            </div>
            <button 
              onClick={playRandomStation}
              className="px-4 py-2 rounded-full glass-panel hover:bg-white/10 transition-all flex items-center gap-2 text-sm font-medium"
            >
              <GlobeIcon className="w-4 h-4 text-green-400" />
              Random
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div 
              initial={{ x: -400 }}
              animate={{ x: 0 }}
              exit={{ x: -400 }}
              className="absolute left-6 top-24 bottom-32 w-80 glass-panel rounded-2xl pointer-events-auto flex flex-col overflow-hidden"
            >
              <div className="flex border-b border-white/10">
                <button 
                  onClick={() => setActiveTab('search')}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'search' ? 'text-green-400 border-b-2 border-green-400' : 'text-white/40 hover:text-white/60'}`}
                >
                  <Search className="w-3 h-3" /> Search
                </button>
                <button 
                  onClick={() => setActiveTab('countries')}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'countries' ? 'text-green-400 border-b-2 border-green-400' : 'text-white/40 hover:text-white/60'}`}
                >
                  <List className="w-3 h-3" /> Countries
                </button>
              </div>

              {activeTab === 'search' ? (
                <div className="p-4 border-b border-white/10 space-y-4">
                  <div className="flex items-center gap-2 p-1 bg-white/5 rounded-lg">
                    <button 
                      onClick={() => setShowOnlyFavorites(false)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${!showOnlyFavorites ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/60'}`}
                    >
                      All
                    </button>
                    <button 
                      onClick={() => setShowOnlyFavorites(true)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${showOnlyFavorites ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/60'}`}
                    >
                      <Heart className={`w-3 h-3 ${showOnlyFavorites ? 'fill-red-500 text-red-500' : ''}`} />
                      Favorites
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input 
                      type="text" 
                      placeholder="Station or country..."
                      className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-green-500/50 transition-colors"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-4 border-b border-white/10">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Browse by Country</p>
                </div>
              )}

              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-white/40 text-sm gap-4 p-6 text-center">
                    <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                    <div>
                      <p className="font-medium text-white/60">Loading Global Stations</p>
                      <p className="text-xs mt-1">Fetching over 40,000 live streams...</p>
                    </div>
                  </div>
                ) : activeTab === 'search' ? (
                  filteredStations.length === 0 ? (
                    <div className="text-center py-10 text-white/40 text-sm">No stations found</div>
                  ) : (
                    filteredStations.slice(0, 100).map((station) => (
                      <button
                        key={station.stationuuid}
                        onClick={() => handleStationClick(station)}
                        className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 group ${
                          selectedStation?.stationuuid === station.stationuuid 
                            ? 'bg-green-500/20 border border-green-500/30' 
                            : 'hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/10">
                          {station.favicon ? (
                            <img src={station.favicon} alt="" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                          ) : (
                            <Radio className="w-5 h-5 text-white/20" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium truncate ${selectedStation?.stationuuid === station.stationuuid ? 'text-green-400' : 'text-white/80'}`}>
                            {station.name}
                          </div>
                          <div className="text-xs text-white/40 truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {station.country}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {favorites.has(station.stationuuid) && (
                            <Heart className="w-3 h-3 fill-red-500 text-red-500" />
                          )}
                          {selectedStation?.stationuuid === station.stationuuid && isPlaying && (
                            <div className="flex gap-0.5 items-end h-3">
                              <div className="w-0.5 bg-green-400 animate-[bounce_1s_infinite]" />
                              <div className="w-0.5 bg-green-400 animate-[bounce_1.2s_infinite]" />
                              <div className="w-0.5 bg-green-400 animate-[bounce_0.8s_infinite]" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))
                  )
                ) : (
                  countries.map((country) => (
                    <button
                      key={country.name}
                      onClick={() => {
                        setSearchQuery(country.name);
                        setActiveTab('search');
                      }}
                      className="w-full text-left p-3 rounded-xl hover:bg-white/5 border border-transparent transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-xs font-bold text-white/40 group-hover:text-green-400 transition-colors">
                          {country.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm text-white/80 group-hover:text-white">{country.name}</span>
                      </div>
                      <span className="text-[10px] bg-white/5 px-2 py-1 rounded text-white/30">{country.stationcount}</span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sidebar Toggle */}
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 p-1 glass-panel rounded-r-lg pointer-events-auto transition-all ${sidebarOpen ? 'ml-[344px]' : 'ml-0'}`}
        >
          {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>

        {/* Player Bar */}
        <div className="absolute bottom-6 left-6 right-6 pointer-events-auto">
          <div className="max-w-4xl mx-auto glass-panel rounded-2xl p-4 flex items-center gap-6">
            <div className="flex items-center gap-4 w-1/3">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex-shrink-0 flex items-center justify-center border border-white/10 overflow-hidden">
                {selectedStation?.favicon ? (
                  <img src={selectedStation.favicon} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Radio className="w-6 h-6 text-white/20" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold truncate text-white/90">
                  {selectedStation ? selectedStation.name : 'Select a station'}
                </h3>
                <p className="text-xs text-white/40 truncate">
                  {selectedStation ? `${selectedStation.state ? selectedStation.state + ', ' : ''}${selectedStation.country}` : 'Explore the globe'}
                </p>
              </div>
              {selectedStation && (
                <button 
                  onClick={() => toggleFavorite(selectedStation.stationuuid)}
                  className={`transition-colors ml-2 ${favorites.has(selectedStation.stationuuid) ? 'text-red-500' : 'text-white/20 hover:text-red-500/50'}`}
                >
                  <Heart className={`w-5 h-5 ${favorites.has(selectedStation.stationuuid) ? 'fill-current' : ''}`} />
                </button>
              )}
            </div>

            <div className="flex-1 flex flex-col items-center gap-2">
              <div className="flex items-center gap-6">
                <button className="text-white/40 hover:text-white transition-colors">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button 
                  onClick={togglePlay}
                  disabled={!selectedStation}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    selectedStation 
                      ? 'bg-white text-black hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.3)]' 
                      : 'bg-white/10 text-white/20 cursor-not-allowed'
                  }`}
                >
                  {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
                </button>
                <button className="text-white/40 hover:text-white transition-colors">
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="w-1/3 flex items-center justify-end gap-4">
              <div className="flex items-center gap-3 group">
                <button 
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01"
                  value={volume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setVolume(val);
                    if (audioRef.current) audioRef.current.volume = val;
                  }}
                  className="w-24 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
                />
              </div>
              <button className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
                <Layers className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
