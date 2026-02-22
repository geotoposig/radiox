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
  ChevronDown,
  ChevronUp,
  Radio,
  MapPin,
  Heart,
  Map as MapIcon,
  Layers,
  List,
  DollarSign,
  MessageCircle
} from 'lucide-react';
import Globe from 'react-globe.gl';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { fetchAllStationsDetailed, RadioStation } from './services/radioService';

const App: React.FC = () => {
  const [stations, setStations] = useState<RadioStation[]>([]);
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
  const [activeTab, setActiveTab] = useState<'search' | 'nearby'>('search');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const globeRef = useRef<any>();
  const mapRef = useRef<L.Map | null>(null);
  const [centerCoords, setCenterCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [isManualSelection, setIsManualSelection] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const stationsData = await fetchAllStationsDetailed('votes', true, 0, 5000);
      
      setStations(stationsData);
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
      const newUrl = selectedStation.url_resolved || selectedStation.url;
      
      // Only update src if it's actually different
      if (audioRef.current.src !== newUrl) {
        audioRef.current.src = newUrl;
        
        if (isPlaying) {
          // Cancel any existing play promise if possible (though HTML5 audio doesn't support aborting)
          // We just handle the promise to avoid the "interrupted" error
          const playPromise = audioRef.current.play();
          playPromiseRef.current = playPromise;
          
          playPromise.catch(e => {
            if (e.name !== 'AbortError') {
              console.error("Playback failed", e);
              setIsPlaying(false);
            }
          });
        }
      }
    }
  }, [selectedStation, isPlaying]);

  const togglePlay = () => {
    if (!selectedStation || !audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const playPromise = audioRef.current.play();
      playPromiseRef.current = playPromise;
      
      playPromise.then(() => {
        setIsPlaying(true);
      }).catch(e => {
        console.error("Playback failed", e);
        setIsPlaying(false);
      });
    }
  };

  const handleStationClick = (station: RadioStation) => {
    setIsManualSelection(true);
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
    
    // Reset manual selection flag after animation
    setTimeout(() => setIsManualSelection(false), 1200);
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

  const nearbyStations = useMemo(() => {
    if (!centerCoords) return [];
    return [...filteredStations]
      .filter(s => s.geo_lat !== null && s.geo_long !== null)
      .map(s => {
        const dLat = s.geo_lat! - centerCoords.lat;
        const dLng = s.geo_long! - centerCoords.lng;
        const distance = Math.sqrt(dLat * dLat + dLng * dLng);
        return { ...s, distance };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 50);
  }, [filteredStations, centerCoords]);

  const MapController = ({ lat, lng, setCenterCoords }: { lat: number | null, lng: number | null, setCenterCoords: (coords: { lat: number, lng: number }) => void }) => {
    const map = useMap();
    
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
    }, [map, setCenterCoords]);

    return null;
  };

  // Effect to find nearest station when center changes
  useEffect(() => {
    if (viewMode === '2d' && centerCoords && stations.length > 0 && !isManualSelection) {
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
      
      // If within a small threshold (e.g., 0.25 degrees), auto-select
      if (nearest && minDistance < 0.25 && nearest.stationuuid !== selectedStation?.stationuuid) {
        setSelectedStation(nearest);
        // We don't force play here if it's just scanning, 
        // but the user's previous logic had setIsPlaying(true)
        // Let's keep it but make it feel smoother
        setIsPlaying(true);
      }
    }
  }, [centerCoords, viewMode, stations, selectedStation?.stationuuid, isManualSelection]);

  const handleDonate = () => {
    window.open('https://wa.me/212668090285', '_blank');
  };

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
            pointsData={filteredStations.slice(0, 10000)} // Increased limit for better coverage
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
            preferCanvas={true}
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            />
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            />
            {filteredStations.slice(0, 10000).map((station) => (
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
            <MapController 
              lat={selectedStation?.geo_lat || null} 
              lng={selectedStation?.geo_long || null} 
              setCenterCoords={setCenterCoords}
            />
          </MapContainer>
        )}
      </div>

      {/* Target Circle for 2D Map */}
      {viewMode === '2d' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
          <div className="relative w-32 h-32 rounded-full border border-green-500/30 flex items-center justify-center">
            <div className="w-1 h-1 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,1)]"></div>
            <div className="absolute inset-0 rounded-full border border-green-500/10 animate-ping"></div>
            
            {/* Scanning lines */}
            <div className="absolute inset-0 rounded-full border-t border-green-500/40 animate-[spin_4s_linear_infinite]"></div>
            
            {/* Coordinates display near circle */}
            {centerCoords && (
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-mono text-green-500/60 bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">
                {centerCoords.lat.toFixed(4)}°N, {centerCoords.lng.toFixed(4)}°E
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay UI */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="p-6 flex justify-between items-start pointer-events-auto">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 bg-black/40 backdrop-blur-md p-2 pr-4 rounded-full border border-white/10"
          >
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.5)]">
              <Radio className="text-black w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-none">RadioJilit</h1>
              <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">Live Explorer</p>
            </div>
          </motion.div>
          
          <div className="flex gap-2">
            <div className="flex bg-black/40 backdrop-blur-md rounded-full p-1 border border-white/10">
              <button 
                onClick={() => setViewMode('2d')}
                className={`p-2 rounded-full transition-all ${viewMode === '2d' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                title="2D Map"
              >
                <MapIcon className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('3d')}
                className={`p-2 rounded-full transition-all ${viewMode === '3d' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                title="3D Globe"
              >
                <GlobeIcon className="w-4 h-4" />
              </button>
            </div>
            <button 
              onClick={handleDonate}
              className="px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all flex items-center gap-2 text-xs font-medium text-green-400"
            >
              <DollarSign className="w-3 h-3" />
              Donate
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div 
              initial={isMobile ? { y: 400, x: 0 } : { x: -400, y: 0 }}
              animate={{ x: 0, y: 0 }}
              exit={isMobile ? { y: 400, x: 0 } : { x: -400, y: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute md:left-6 md:top-24 md:bottom-32 md:w-80 w-full left-0 bottom-0 md:h-auto h-[60vh] glass-panel md:rounded-2xl rounded-t-3xl pointer-events-auto flex flex-col overflow-hidden z-20"
            >
              <div className="flex border-b border-white/10">
                <button 
                  onClick={() => setActiveTab('search')}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'search' ? 'text-green-400 border-b-2 border-green-400' : 'text-white/40 hover:text-white/60'}`}
                >
                  <Search className="w-3 h-3" /> Search
                </button>
                <button 
                  onClick={() => setActiveTab('nearby')}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'nearby' ? 'text-green-400 border-b-2 border-green-400' : 'text-white/40 hover:text-white/60'}`}
                >
                  <MapPin className="w-3 h-3" /> On Map
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
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Stations Near Center</p>
                </div>
              )}

              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-white/40 text-sm gap-4 p-6 text-center">
                    <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                    <div>
                      <p className="font-medium text-white/60">Loading RadioJilit</p>
                      <p className="text-xs mt-1">Fetching live streams worldwide...</p>
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
                  nearbyStations.map((station) => (
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
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sidebar Toggle */}
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`absolute z-30 p-1 glass-panel pointer-events-auto transition-all
            md:left-0 md:top-1/2 md:-translate-y-1/2 md:rounded-r-lg
            left-1/2 bottom-0 -translate-x-1/2 rounded-t-lg md:translate-x-0
            ${sidebarOpen 
              ? 'md:ml-[344px] md:mb-0 mb-[60vh]' 
              : 'md:ml-0 mb-0'}`}
        >
          <div className="md:block hidden">
            {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </div>
          <div className="md:hidden block px-4 py-1">
            <div className="w-8 h-1 bg-white/20 rounded-full mx-auto mb-1"></div>
            {sidebarOpen ? <ChevronDown className="w-4 h-4 mx-auto" /> : <ChevronUp className="w-4 h-4 mx-auto" />}
          </div>
        </button>

        {/* Player Bar */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 pointer-events-auto">
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="bg-black/60 backdrop-blur-xl rounded-3xl p-3 flex items-center gap-4 border border-white/10 shadow-2xl"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex-shrink-0 flex items-center justify-center border border-white/10 overflow-hidden relative group">
                {selectedStation?.favicon ? (
                  <img src={selectedStation.favicon} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Radio className="w-6 h-6 text-white/20" />
                )}
                {isPlaying && (
                  <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                    <div className="flex gap-0.5 items-end h-4">
                      <div className="w-1 bg-green-400 animate-[bounce_1s_infinite]" />
                      <div className="w-1 bg-green-400 animate-[bounce_1.2s_infinite]" />
                      <div className="w-1 bg-green-400 animate-[bounce_0.8s_infinite]" />
                    </div>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold truncate text-white text-sm">
                  {selectedStation ? selectedStation.name : 'Select a station'}
                </h3>
                <p className="text-[10px] text-white/40 truncate uppercase tracking-wider">
                  {selectedStation ? `${selectedStation.state ? selectedStation.state + ', ' : ''}${selectedStation.country}` : 'Explore the globe'}
                </p>
              </div>
              {selectedStation && (
                <button 
                  onClick={() => toggleFavorite(selectedStation.stationuuid)}
                  className={`transition-colors p-2 rounded-full hover:bg-white/5 ${favorites.has(selectedStation.stationuuid) ? 'text-red-500' : 'text-white/20 hover:text-red-500/50'}`}
                >
                  <Heart className={`w-4 h-4 ${favorites.has(selectedStation.stationuuid) ? 'fill-current' : ''}`} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 px-2">
              <button 
                onClick={togglePlay}
                disabled={!selectedStation}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  selectedStation 
                    ? 'bg-white text-black hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)]' 
                    : 'bg-white/10 text-white/20 cursor-not-allowed'
                }`}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>
            </div>

            <div className="flex items-center gap-3 pr-2 border-l border-white/10 pl-4">
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className="text-white/40 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
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
                className="w-16 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default App;
