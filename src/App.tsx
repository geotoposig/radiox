import React, { useState, useEffect, useRef } from 'react';
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
  Heart
} from 'lucide-react';
import Globe from 'react-globe.gl';
import { fetchAllStations, RadioStation } from './services/radioService';

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
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const globeRef = useRef<any>();

  useEffect(() => {
    const loadStations = async () => {
      setIsLoading(true);
      const data = await fetchAllStations();
      setStations(data);
      setIsLoading(false);
      
      // Load favorites from localStorage
      const savedFavorites = localStorage.getItem('radio-favorites');
      if (savedFavorites) {
        try {
          setFavorites(new Set(JSON.parse(savedFavorites)));
        } catch (e) {
          console.error("Failed to parse favorites", e);
        }
      }
    };
    loadStations();
  }, []);

  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = isAutoRotating;
      globeRef.current.controls().autoRotateSpeed = 0.5;
    }
  }, [isAutoRotating]);

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

  const handleStationClick = (station: any) => {
    setSelectedStation(station);
    setIsPlaying(true);
    setIsAutoRotating(false);
    
    // Center globe on station
    if (globeRef.current) {
      globeRef.current.pointOfView({
        lat: station.geo_lat,
        lng: station.geo_long,
        altitude: 1.5
      }, 1000);
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

  const filteredStations = stations.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.country.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFavorite = !showOnlyFavorites || favorites.has(s.stationuuid);
    return matchesSearch && matchesFavorite;
  });

  return (
    <div className="relative w-full h-screen bg-[#000022] overflow-hidden">
      {/* Audio Element */}
      <audio 
        ref={audioRef} 
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        muted={isMuted}
      />

      {/* Globe Container */}
      <div className="absolute inset-0 z-0">
        <Globe
          ref={globeRef}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          pointsData={stations}
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
      </div>

      {/* Overlay UI */}
      <div className="absolute inset-0 pointer-events-none z-10">
        
        {/* Header */}
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
            <button 
              onClick={playRandomStation}
              className="px-4 py-2 rounded-full glass-panel hover:bg-white/10 transition-all flex items-center gap-2 text-sm font-medium"
            >
              <GlobeIcon className="w-4 h-4 text-green-400" />
              Random Station
            </button>
            <button className="p-2 rounded-full glass-panel hover:bg-white/10 transition-colors">
              <Info className="w-5 h-5" />
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
              <div className="p-4 border-b border-white/10 space-y-4">
                <div className="flex items-center gap-2 p-1 bg-white/5 rounded-lg">
                  <button 
                    onClick={() => setShowOnlyFavorites(false)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${!showOnlyFavorites ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/60'}`}
                  >
                    All Stations
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
                    placeholder="Search stations or countries..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-green-500/50 transition-colors"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-white/40 text-sm gap-4 p-6 text-center">
                    <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                    <div>
                      <p className="font-medium text-white/60">Loading Global Stations</p>
                      <p className="text-xs mt-1">Fetching over 40,000 live streams...</p>
                    </div>
                  </div>
                ) : filteredStations.length === 0 ? (
                  <div className="text-center py-10 text-white/40 text-sm">No stations found</div>
                ) : (
                  filteredStations.map((station) => (
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
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 p-1 glass-panel rounded-r-lg pointer-events-auto transition-all ${sidebarOpen ? 'ml-[344px]' : 'ml-0'}`}
        >
          {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>

        {/* Player Bar */}
        <div className="absolute bottom-6 left-6 right-6 pointer-events-auto">
          <div className="max-w-4xl mx-auto glass-panel rounded-2xl p-4 flex items-center gap-6">
            {/* Station Info */}
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

            {/* Controls */}
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

            {/* Volume & Tools */}
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
                <GlobeIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none z-[-1]" />
    </div>
  );
};

export default App;
