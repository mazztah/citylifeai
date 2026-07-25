import { API_URL } from "../config";

export interface Player {
  id: number;
  telegram_id: number;
  username: string | null;
  display_name: string;
  level: number;
  xp: number;
  cash: number;
  reputation: number;
  current_city_id: string;
}

export interface Mission {
  id: number;
  template_id: string;
  title: string;
  description: string;
  category: string;
  target_lat: number | null;
  target_lon: number | null;
  target_label: string | null;
  reward_cash: number;
  reward_xp: number;
  status: string;
  story_chapter_id: string | null;
}

export interface StoryChapter {
  id: string;
  order: number;
  title: string;
  intro: string;
  cliffhanger: string;
  unlocked: boolean;
  is_current: boolean;
}

export interface StoryState {
  current_chapter: StoryChapter;
  all_chapters: StoryChapter[];
  flags: Record<string, unknown>;
}

export interface CityState {
  city_id: string;
  development_level: number;
  average_rent_index: number;
  vacancy_rate: number;
  citizen_mood: number;
  traffic_load: number;
  event_pressure: number;
  weather: string;
  season: string;
  last_ticked_at: string;
}

function getTelegramInitData(): string {
  const w = window as any;
  return w?.Telegram?.WebApp?.initData || "";
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`API ${path} fehlgeschlagen: ${resp.status}`);
  return resp.json();
}

async function get<T>(path: string): Promise<T> {
  const resp = await fetch(`${API_URL}${path}`);
  if (!resp.ok) throw new Error(`API ${path} fehlgeschlagen: ${resp.status}`);
  return resp.json();
}

export const api = {
  async login(devTelegramId?: number, devUsername?: string): Promise<Player> {
    const initData = getTelegramInitData();
    return post<Player>("/players/login", {
      init_data: initData,
      dev_telegram_id: initData ? undefined : devTelegramId ?? Math.floor(Math.random() * 1_000_000) + 1000,
      dev_username: devUsername ?? "browser_spieler",
    });
  },
  getActiveMissions(playerId: number): Promise<Mission[]> {
    return get<Mission[]>(`/missions/${playerId}/active`);
  },
  completeMission(playerId: number, missionId: number): Promise<Player> {
    return post<Player>(`/missions/${playerId}/complete`, { mission_id: missionId });
  },
  getStoryState(playerId: number): Promise<StoryState> {
    return get<StoryState>(`/story/${playerId}/current`);
  },
  getCityState(playerId: number): Promise<CityState> {
    return get<CityState>(`/world/${playerId}/state`);
  },
  getLeaderboard(): Promise<any[]> {
    return get<any[]>(`/leaderboard`);
  },
};
