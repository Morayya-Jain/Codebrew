import { GameObjects, Scene, Math as PMath } from 'phaser';
import { FloatingLabel } from '../ui/FloatingLabel';
import type { NpcData, ProximityState } from '../types';
import { CONSTANTS } from '../types';

export const NPC_EVENTS = {
    NEAR_ENTER: 'npc-near-enter',
    NEAR_LEAVE: 'npc-near-leave',
} as const;

interface NpcWanderBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

/**
 * Roaming NPC the player can talk to. Modelled on Landmark: a Container
 * holding a sprite + FloatingLabel, with a proximity check in update that
 * emits enter/leave events and drives the label state. Adds a small random
 * walk FSM so the character moves within a home radius when idle, and stops
 * walking whenever the player gets close enough to talk.
 */
export class Npc extends GameObjects.Container {
    readonly data_: NpcData;
    private sprite: GameObjects.Image;
    private label: FloatingLabel;
    private _isNear = false;

    private readonly homeX_: number;
    private readonly homeY_: number;
    private readonly bounds_: NpcWanderBounds;

    private state_: 'idle' | 'walking' = 'idle';
    private wanderTargetX_ = 0;
    private wanderTargetY_ = 0;
    private pauseMs_ = 1500;
    private frameTimer_ = 0;
    private frameIndex_: 0 | 1 = 0;
    private readonly walkSpeed_ = 36;

    constructor(scene: Scene, data: NpcData, spawnX: number, spawnY: number) {
        super(scene, spawnX, spawnY);
        this.data_ = data;

        this.homeX_ = spawnX;
        this.homeY_ = spawnY;
        const radius = Math.max(120, data.homeRadius);
        this.bounds_ = {
            minX: Math.max(200, spawnX - radius),
            maxX: Math.min(CONSTANTS.WORLD_WIDTH - 200, spawnX + radius),
            minY: Math.max(200, spawnY - radius),
            maxY: Math.min(CONSTANTS.WORLD_HEIGHT - 200, spawnY + radius),
        };

        const initialKey = this.resolveTextureKey_(0);
        this.sprite = scene.add.image(0, 0, initialKey);
        this.sprite.setOrigin(0.5, 0.95);
        this.add(this.sprite);

        this.label = new FloatingLabel(
            scene,
            spawnX,
            spawnY - 96,
            data.name,
            data.role,
            '[ E ] Talk',
        );

        // Y-sorted depth, same scheme as trees/player/fauna/landmarks. +0.015
        // keeps the NPC above fauna at the same y, so the player can always
        // walk up to them without the sprite being hidden behind a kangaroo.
        this.setDepth(2 + spawnY * 0.001 + 0.015);
        scene.add.existing(this);
    }

    get isNear(): boolean {
        return this._isNear;
    }

    updateProximity(playerX: number, playerY: number): void {
        const dist = PMath.Distance.Between(playerX, playerY, this.x, this.y);

        let state: ProximityState;
        if (dist > CONSTANTS.FAR_THRESHOLD) state = 'hidden';
        else if (dist > CONSTANTS.MID_THRESHOLD) state = 'far';
        else if (dist > CONSTANTS.NEAR_THRESHOLD) state = 'mid';
        else state = 'near';

        const wasNear = this._isNear;
        this._isNear = state === 'near';

        if (this._isNear && !wasNear) {
            this.scene.events.emit(NPC_EVENTS.NEAR_ENTER, this);
        } else if (!this._isNear && wasNear) {
            this.scene.events.emit(NPC_EVENTS.NEAR_LEAVE, this);
        }

        this.label.x = this.x;
        this.label.y = this.y - 96;
        this.label.setProximityState(state);
    }

    /**
     * Random-walk FSM: pick a target within the home zone, walk to it at
     * walkSpeed_, pause for a random 1.5-5s, repeat. Stops walking whenever
     * the player is within NEAR_THRESHOLD so the NPC holds still for a
     * conversation instead of drifting away.
     */
    updateWander(deltaMs: number, playerX: number, playerY: number): void {
        // Two-frame idle/walk swap.
        this.frameTimer_ += deltaMs;
        if (this.frameTimer_ > 320) {
            this.frameTimer_ = 0;
            this.frameIndex_ = this.frameIndex_ === 0 ? 1 : 0;
            this.sprite.setTexture(this.resolveTextureKey_(this.frameIndex_));
        }

        // Freeze while the player is close enough to interact.
        const playerDist = PMath.Distance.Between(playerX, playerY, this.x, this.y);
        if (playerDist < CONSTANTS.NEAR_THRESHOLD + 20) {
            this.state_ = 'idle';
            this.pauseMs_ = 600;
            return;
        }

        if (this.state_ === 'idle') {
            this.pauseMs_ -= deltaMs;
            if (this.pauseMs_ <= 0) {
                this.pickNewWanderTarget_();
                this.state_ = 'walking';
            }
            return;
        }

        // state_ === 'walking'
        const dx = this.wanderTargetX_ - this.x;
        const dy = this.wanderTargetY_ - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 4) {
            this.state_ = 'idle';
            this.pauseMs_ = 1500 + Math.random() * 3500;
            return;
        }

        const step = this.walkSpeed_ * (deltaMs / 1000);
        const nx = dx / dist;
        const ny = dy / dist;
        this.x += nx * step;
        this.y += ny * step;
        this.sprite.setFlipX(nx < 0);

        // Keep the Y-sort depth accurate as the NPC walks.
        this.setDepth(2 + this.y * 0.001 + 0.015);
    }

    private pickNewWanderTarget_(): void {
        const { minX, maxX, minY, maxY } = this.bounds_;
        // Prefer targets biased toward the home position so they never drift
        // out of their zone over time.
        const tx = this.homeX_ + (Math.random() - 0.5) * (maxX - minX);
        const ty = this.homeY_ + (Math.random() - 0.5) * (maxY - minY);
        this.wanderTargetX_ = PMath.Clamp(tx, minX, maxX);
        this.wanderTargetY_ = PMath.Clamp(ty, minY, maxY);
    }

    private resolveTextureKey_(frame: 0 | 1): string {
        const painted = `painted-npc-${this.data_.id}-${frame}`;
        if (this.scene.textures.exists(painted)) {
            // SpriteFactory uses a 1x1 placeholder when a painted asset is
            // missing on disk, so width > 1 is the real "loaded" signal.
            const src = this.scene.textures.get(painted).source[0];
            if (src && src.width > 1) return painted;
        }
        return `npc-default-${frame}`;
    }

    destroy(fromScene?: boolean): void {
        this.label.destroy();
        super.destroy(fromScene);
    }
}
