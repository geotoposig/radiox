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
