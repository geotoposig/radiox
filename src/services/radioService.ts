export interface RadioStation {
  changeid: string;
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  homepage: string;
  favicon: string;
  tags: string;
  country: string;
  countrycode: string;
  state: string;
  language: string;
  votes: number;
  lastchangetime: string;
  codec: string;
  bitrate: number;
  hls: number;
  lastcheckok: number;
  lastchecktime: string;
  lastcheckoktime: string;
  lastlocalchecktime: string;
  clicktimestamp: string;
  clickcount: number;
  clicktrend: number;
  geo_lat: number | null;
  geo_long: number | null;
}

export const fetchIPTVStations = async (): Promise<RadioStation[]> => {
  try {
    // Using a CORS proxy to bypass potential browser restrictions on github.io
    const proxyUrl = 'https://api.allorigins.win/get?url=';
    const targetUrl = encodeURIComponent('https://iptv-org.github.io/iptv/categories/radio.m3u');
    
    const response = await fetch(`${proxyUrl}${targetUrl}`);
    if (!response.ok) throw new Error('Failed to fetch IPTV radio list via proxy');
    
    const json = await response.json();
    const text = json.contents;
    
    if (!text) return [];
    
    const stations: RadioStation[] = [];
    const lines = text.split('\n');
    let currentStation: Partial<RadioStation> = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXTINF:')) {
        const nameMatch = line.match(/,(.*)$/);
        const logoMatch = line.match(/tvg-logo="(.*?)"/);
        const countryMatch = line.match(/group-title="(.*?)"/);
        
        currentStation = {
          stationuuid: `iptv-${Math.random().toString(36).substr(2, 9)}`,
          name: nameMatch ? nameMatch[1].trim() : 'Unknown IPTV Radio',
          favicon: logoMatch ? logoMatch[1] : '',
          country: countryMatch ? countryMatch[1] : 'IPTV',
          geo_lat: null,
          geo_long: null
        };
      } else if (line.startsWith('http')) {
        currentStation.url = line;
        currentStation.url_resolved = line;
        if (currentStation.name) {
          stations.push(currentStation as RadioStation);
        }
        currentStation = {};
      }
    }
    return stations;
  } catch (error) {
    console.error('Error fetching IPTV stations:', error);
    return [];
  }
};

export const fetchCountries = async (): Promise<{ name: string; stationcount: number }[]> => {
  try {
    const response = await fetch(`https://de1.api.radio-browser.info/json/countries`);
    if (!response.ok) throw new Error('Failed to fetch countries');
    const data = await response.json();
    return data.sort((a: any, b: any) => b.stationcount - a.stationcount);
  } catch (error) {
    console.error('Error fetching countries:', error);
    return [];
  }
};

export const fetchStationsByCountry = async (countryCode: string): Promise<RadioStation[]> => {
  try {
    const response = await fetch(`https://de1.api.radio-browser.info/json/stations/bycountrycodeexact/${countryCode}`);
    if (!response.ok) throw new Error('Failed to fetch stations by country');
    const data = await response.json();
    return data.filter((s: RadioStation) => s.geo_lat !== null && s.geo_long !== null);
  } catch (error) {
    console.error('Error fetching stations by country:', error);
    return [];
  }
};

export const fetchAllStations = async (): Promise<RadioStation[]> => {
  try {
    const response = await fetch(`https://de1.api.radio-browser.info/json/stations`);
    if (!response.ok) throw new Error('Failed to fetch stations');
    const data = await response.json();
    return data.filter((s: RadioStation) => s.geo_lat !== null && s.geo_long !== null);
  } catch (error) {
    console.error('Error fetching all radio stations:', error);
    return [];
  }
};

export const fetchTopStations = async (limit = 1000): Promise<RadioStation[]> => {
  try {
    const response = await fetch(`https://de1.api.radio-browser.info/json/stations/topvote/${limit}`);
    if (!response.ok) throw new Error('Failed to fetch stations');
    const data = await response.json();
    // Filter out stations without coordinates
    return data.filter((s: RadioStation) => s.geo_lat !== null && s.geo_long !== null);
  } catch (error) {
    console.error('Error fetching radio stations:', error);
    return [];
  }
};

export const searchStations = async (query: string): Promise<RadioStation[]> => {
  try {
    const response = await fetch(`https://de1.api.radio-browser.info/json/stations/byname/${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search stations');
    const data = await response.json();
    return data.filter((s: RadioStation) => s.geo_lat !== null && s.geo_long !== null);
  } catch (error) {
    console.error('Error searching radio stations:', error);
    return [];
  }
};
