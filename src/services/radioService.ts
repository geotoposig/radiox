export interface RadioStation {
  changeuuid: string;
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
  votes: string;
  lastchangetime: string;
  codec: string;
  bitrate: number;
  hls: boolean;
  lastcheckok: boolean;
  lastchecktime: string;
  lastcheckoktime: string;
  lastlocalchecktime: string;
  clicktimestamp: string;
  clickcount: number;
  clicktrend: number;
  geo_lat: number | null;
  geo_long: number | null;
}

export type StationsOrder = 'name' | 'url' | 'homepage' | 'favicon' | 'tags' | 'country' | 'state' | 'language' | 'votes' | 'codec' | 'bitrate' | 'lastchangetime' | 'clickcount' | 'clicktrend' | 'changestamp' | 'random';
export type StationsBy = 'byname' | 'bynameexact' | 'bycodec' | 'bycodecexact' | 'bycountry' | 'bycountryexact' | 'bycountrycodeexact' | 'bystate' | 'bystateexact' | 'bylanguage' | 'bylanguageexact' | 'bytag' | 'bytagexact';

const BASE_URL = "https://de1.api.radio-browser.info/json/stations";

export const fetchAllStations = async (): Promise<RadioStation[]> => {
  try {
    const response = await fetch(BASE_URL);
    if (!response.ok) throw new Error('Failed to fetch stations');
    const data = await response.json();
    return data.filter((s: RadioStation) => s.geo_lat !== null && s.geo_long !== null);
  } catch (error) {
    console.error('Error fetching stations:', error);
    return [];
  }
};

export const fetchAllStationsDetailed = async (
  order: StationsOrder = 'votes',
  reverse: boolean = true,
  offset: number = 0,
  limit: number = 1000,
  hideBroken: boolean = true
): Promise<RadioStation[]> => {
  try {
    const params = new URLSearchParams({
      order,
      reverse: reverse.toString(),
      offset: offset.toString(),
      limit: limit.toString(),
      hidebroken: hideBroken.toString()
    });
    const response = await fetch(`${BASE_URL}?${params}`);
    if (!response.ok) throw new Error('Failed to fetch detailed stations');
    const data = await response.json();
    return data.filter((s: RadioStation) => s.geo_lat !== null && s.geo_long !== null);
  } catch (error) {
    console.error('Error fetching detailed stations:', error);
    return [];
  }
};

export const fetchStations = async (by: StationsBy, term: string): Promise<RadioStation[]> => {
  try {
    const response = await fetch(`${BASE_URL}/${by}/${encodeURIComponent(term)}`);
    if (!response.ok) throw new Error('Failed to fetch stations by term');
    const data = await response.json();
    return data.filter((s: RadioStation) => s.geo_lat !== null && s.geo_long !== null);
  } catch (error) {
    console.error('Error fetching stations by term:', error);
    return [];
  }
};

export const fetchCountries = async (): Promise<{ name: string; stationcount: number; countrycode: string }[]> => {
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
