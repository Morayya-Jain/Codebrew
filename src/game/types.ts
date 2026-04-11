export type Region = 'victoria' | 'nsw';

export const REGION_LABELS: Readonly<Record<Region, string>> = Object.freeze({
    victoria: 'Victoria',
    nsw: 'New South Wales',
});

export interface LandmarkData {
    id: string;
    name: string;
    shortDescription: string;
    fullStory: string;
    position: { x: number; y: number };
    iconColor: string;
    illustrationColor: string;
    region: Region;
    clueText: string;
    teaserLine: string;
    heroImageFile?: string;
}

export interface LandmarksFile {
    landmarks: ReadonlyArray<LandmarkData>;
}

export interface NpcData {
    id: string;
    name: string;
    role: string;
    greeting: string;
    lines: ReadonlyArray<string>;
    farewell: string;
    spriteKey: string;
    homeRadius: number;
}

export interface NpcsFile {
    npcs: ReadonlyArray<NpcData>;
}

export type ProximityState = 'hidden' | 'far' | 'mid' | 'near';

export interface GameConstants {
    WORLD_WIDTH: number;
    WORLD_HEIGHT: number;
    PLAYER_SPEED: number;
    SPRINT_SPEED: number;
    FAR_THRESHOLD: number;
    MID_THRESHOLD: number;
    NEAR_THRESHOLD: number;
}

export const CONSTANTS: Readonly<GameConstants> = Object.freeze({
    WORLD_WIDTH: 8000,
    WORLD_HEIGHT: 6400,
    PLAYER_SPEED: 300,
    SPRINT_SPEED: 480,
    FAR_THRESHOLD: 400,
    MID_THRESHOLD: 250,
    NEAR_THRESHOLD: 130,
});

// =============================================================================
// Chapter / narrative system (Phase 1)
// =============================================================================
//
// These interfaces describe the data shape for the Elder-guided chapter
// structure that reframes the game as "An Invitation to Country". They are
// loaded from public/assets/chapters.json at runtime and drive ChapterSystem.

export type ChapterPhase =
    | 'attract'
    | 'welcome'
    | 'hub'
    | 'walking'
    | 'story'
    | 'close'
    | 'farewell';

export type WeatherKind = 'clear' | 'mist' | 'heat-shimmer';

export type WaypointRole = 'waypoint' | 'primary';

export interface ElderLine {
    id: string;
    text: string;
    mood?: 'welcome' | 'teach' | 'reflect' | 'farewell';
    pauseGameplay?: boolean;
}

export interface Waypoint {
    id: string;
    landmarkId: string;
    role: WaypointRole;
    elderLinesOnArrival: ElderLine[];
    observationPrompt?: string;
    unlocksJournalEntryIds?: string[];
}

export interface Citation {
    id: string;
    title: string;
    publisher: string;
    url?: string;
}

export interface SeasonPresetData {
    id: string;
    kulinSeason:
        | 'iuk'
        | 'waring'
        | 'guling'
        | 'poorneet'
        | 'kangaroo-apple'
        | 'biderap';
    displayName: string;
    timeOfDay:
        | 'dawn'
        | 'morning'
        | 'midday'
        | 'golden-hour'
        | 'dusk'
        | 'night';
    weather: 'clear' | 'mist' | 'rain' | 'dust' | 'heat-shimmer';
    windIntensity: number;
    ambientBed?: string;
    grassTint?: string;
}

export interface ChapterData {
    id: string;
    order: number;
    title: string;
    subtitle: string;
    seasonPresetId: string;
    welcomeLines: ElderLine[];
    hubLines: ElderLine[];
    waypoints: Waypoint[];
    closeLines: ElderLine[];
    farewellLines: ElderLine[];
    citations: Citation[];
}

export interface ChaptersFile {
    seasonPresets: ReadonlyArray<SeasonPresetData>;
    chapters: ReadonlyArray<ChapterData>;
}

export interface VocabEntry {
    id: string;
    english: string;
    woiwurrung?: string;
    boonwurrung?: string;
    pronunciation?: string;
    note?: string;
    sourceCitationId: string;
}

export interface JournalEntry {
    id: string;
    chapterId: string;
    kind: 'quote' | 'vocab' | 'observation' | 'story' | 'source';
    headline: string;
    body: string;
    vocabEntryId?: string;
    sourceCitationId?: string;
    heroImage?: string;
}
