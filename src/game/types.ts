export interface LandmarkData {
    id: string;
    name: string;
    shortDescription: string;
    fullStory: string;
    position: { x: number; y: number };
    iconColor: string;
    illustrationColor: string;
}

export interface LandmarksFile {
    landmarks: ReadonlyArray<LandmarkData>;
}

export type ProximityState = 'hidden' | 'far' | 'mid' | 'near';

export interface GameConstants {
    WORLD_WIDTH: number;
    WORLD_HEIGHT: number;
    PLAYER_SPEED: number;
    FAR_THRESHOLD: number;
    MID_THRESHOLD: number;
    NEAR_THRESHOLD: number;
}

export const CONSTANTS: Readonly<GameConstants> = Object.freeze({
    WORLD_WIDTH: 3200,
    WORLD_HEIGHT: 720,
    PLAYER_SPEED: 200,
    FAR_THRESHOLD: 400,
    MID_THRESHOLD: 250,
    NEAR_THRESHOLD: 130,
});
