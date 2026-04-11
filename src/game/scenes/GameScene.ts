import { Scene } from 'phaser';
import { Player, PLAYER_EVENTS } from '../entities/Player';
import { Landmark, LANDMARK_EVENTS } from '../entities/Landmark';
import { CONSTANTS } from '../types';
import type {
    ChaptersFile,
    ChapterPhase,
    LandmarkData,
    LandmarksFile,
    Waypoint,
    WeatherKind,
} from '../types';
import { PostFxPipeline } from '../fx/PostFxPipeline';
import { timeOfDay } from '../systems/TimeOfDay';
import { AmbientAudio } from '../systems/AmbientAudio';
import { windSystem } from '../systems/WindSystem';
import { ChapterSystem, CHAPTER_EVENTS } from '../systems/ChapterSystem';
import { WeatherSystem } from '../systems/WeatherSystem';
import { applySeasonPreset } from '../systems/SeasonPreset';
import { IdleKiosk, IDLE_KIOSK_EVENTS } from '../systems/IdleKiosk';
import { SpriteFactory } from '../systems/SpriteFactory';
import { ParallaxSystem } from '../systems/ParallaxSystem';

interface AmbientParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    alpha: number;
    size: number;
    life: number;
    maxLife: number;
}

interface BarrierDef {
    x: number;
    y: number;
    width: number;
    height: number;
    isCircle?: boolean;
    radius?: number;
}

export class GameScene extends Scene {
    private player!: Player;
    private landmarks: Landmark[] = [];
    private barriers!: Phaser.Physics.Arcade.StaticGroup;
    private interactKey!: Phaser.Input.Keyboard.Key;
    private isPaused = false;
    private ambientParticles: AmbientParticle[] = [];
    private particleGraphics!: Phaser.GameObjects.Graphics;
    private landmarkPositions: Array<{ x: number; y: number; id: string; iconColor: string }> = [];
    private leadOffsetX_ = 0;
    private leadOffsetY_ = 0;
    private postFx_: PostFxPipeline | null = null;
    private audio_: AmbientAudio | null = null;
    private grassTufts_: Phaser.GameObjects.Image[] = [];
    private riverShimmers_: Phaser.GameObjects.Graphics[] = [];
    private riverShimmerPhase_ = 0;
    private treeSprites_: Phaser.GameObjects.Image[] = [];
    private faunaSprites_: Phaser.GameObjects.Image[] = [];
    private smokeEmitter_: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
    private emberEmitter_: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
    private dustEmitter_: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
    private fireflyEmitter_: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
    private leafEmitter_: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
    private chapterSystem_: ChapterSystem | null = null;
    private chapterStarted_ = false;
    // The landmark whose StoryCard was most recently opened, so the resume
    // handler can decide whether to advance the chapter (only when closing a
    // primary active waypoint's card).
    private lastOpenedLandmarkId_: string | null = null;
    private weatherSystem_: WeatherSystem | null = null;
    private chaptersData_: ChaptersFile | null = null;
    private idleKiosk_: IdleKiosk | null = null;
    private spriteFactory_: SpriteFactory | null = null;
    private parallax_: ParallaxSystem | null = null;

    constructor() {
        super('GameScene');
    }

    // Public accessor so UIScene can subscribe to chapter events.
    getChapterSystem(): ChapterSystem | null {
        return this.chapterSystem_;
    }

    // Public accessor so UIScene's SettingsMenu can toggle audio mute.
    getAmbientAudio(): AmbientAudio | null {
        return this.audio_;
    }

    create(): void {
        const { WORLD_WIDTH, WORLD_HEIGHT } = CONSTANTS;

        // SpriteFactory resolves procedural vs painted PNG keys per asset.
        // Created before world generation so createTrees/createFauna/createRocks
        // can use it when spawning sprites.
        this.spriteFactory_ = new SpriteFactory(this);
        // Parallax background container - stays empty until a chapter is
        // selected and its painted BG layers are loaded.
        this.parallax_ = new ParallaxSystem(this);

        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

        // Create landscape layers
        this.createGroundBase(WORLD_WIDTH, WORLD_HEIGHT);
        this.createGroundVariation(WORLD_WIDTH, WORLD_HEIGHT);
        this.createHills(WORLD_WIDTH, WORLD_HEIGHT);
        this.createRiver(WORLD_WIDTH, WORLD_HEIGHT);
        this.createPaths();
        this.createAmbientDetails(WORLD_WIDTH, WORLD_HEIGHT);

        // Create collision barrier group
        this.barriers = this.physics.add.staticGroup();

        // Draw terrain features AND create collision bodies
        this.createTrees(WORLD_WIDTH, WORLD_HEIGHT);
        this.createRocks(WORLD_WIDTH, WORLD_HEIGHT);
        this.createRiverCollisions();
        this.createBoundaryFade(WORLD_WIDTH, WORLD_HEIGHT);
        this.createGrassField(WORLD_WIDTH, WORLD_HEIGHT);
        this.createFauna(WORLD_WIDTH, WORLD_HEIGHT);

        // Ambient particles (fireflies/dust) — legacy graphics-based system,
        // kept for backwards compatibility alongside the new emitters.
        this.particleGraphics = this.add.graphics();
        this.particleGraphics.setDepth(8);
        this.initAmbientParticles(WORLD_WIDTH, WORLD_HEIGHT);

        // Create player near center of world
        this.player = new Player(this, 4000, 3400);

        // Register collider AFTER player exists
        this.physics.add.collider(this.player, this.barriers);

        // Setup camera
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.startFollow(this.player, true, 0.18, 0.18);
        this.cameras.main.setBackgroundColor(timeOfDay.palette.letterboxColor);

        // Register and attach the post-FX pipeline (WebGL only; graceful skip on Canvas)
        this.attachPostFxPipeline();

        // Load landmarks and chapters from JSON. Both files loaded in
        // PreloadScene; chapters.json drives the multi-chapter picker flow.
        const landmarksData = this.cache.json.get('landmarks') as LandmarksFile | null;
        this.chaptersData_ = this.cache.json.get('chapters') as ChaptersFile | null;

        // Chapter system is created up-front. It stays empty (no chapter
        // loaded) until the player picks one from the ChapterPicker. If
        // chapters.json is missing, the system remains empty and the game
        // falls back to free-exploration mode (E works on every landmark).
        this.chapterSystem_ = new ChapterSystem();

        // Spawn ALL landmarks every session. The chapter system drives elder
        // dialogue for the 2 active waypoints; landmarks outside the chapter
        // are still visible and readable via E, just without elder guidance.
        if (landmarksData) {
            this.landmarks = landmarksData.landmarks.map(
                (data: LandmarkData) => new Landmark(this, data, 'primary')
            );
            this.landmarkPositions = landmarksData.landmarks.map(d => ({
                x: d.position.x, y: d.position.y, id: d.id, iconColor: d.iconColor,
            }));
        }

        // Chapter flow - phase changes drive player.canMove and a couple of
        // housekeeping hooks. See ChapterSystem for the full state machine.
        this.wireChapterSystem_();

        // Phase 6 particle emitters (smoke, embers, dust, fireflies, wind leaves)
        // — created AFTER landmarks so the smoke/ember emitters can anchor to
        // the real Brambuk position from landmarks.json.
        this.createParticleSystems_();

        // Chapter-driven weather (mist, heat-shimmer). Starts in 'clear' state
        // and only activates once applySeasonPreset_() fires after a chapter
        // is picked.
        this.weatherSystem_ = new WeatherSystem(this);

        // Museum idle detection. Fires staged events that UIScene picks up
        // (soft prompt at 60s) and GameScene handles (reset at 180s).
        this.idleKiosk_ = new IdleKiosk(this);
        this.idleKiosk_.on(IDLE_KIOSK_EVENTS.SOFT_PROMPT, () => {
            this.events.emit('idleSoftPrompt');
        });
        this.idleKiosk_.on(IDLE_KIOSK_EVENTS.RESET, () => {
            this.resetToAttract_();
        });

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.weatherSystem_?.destroy();
            this.weatherSystem_ = null;
            this.idleKiosk_?.destroy();
            this.idleKiosk_ = null;
            this.parallax_?.destroy();
            this.parallax_ = null;
        });

        // Interaction key
        if (this.input.keyboard) {
            this.interactKey = this.input.keyboard.addKey('E');
        }

        // Ambient audio — Web Audio synth, no asset files.
        this.audio_ = new AmbientAudio(this);
        // Register a point source per landmark so nearby ones drive biome bed.
        for (const p of this.landmarkPositions) {
            if (p.id === 'brambuk') this.audio_.addPointSource(p.x, p.y, 'fire');
        }
        // River positional source — sample a handful of midpoints from the meander.
        const riverSamples: Array<readonly [number, number]> = [
            [1200, 2100], [2600, 2800], [4000, 3800], [5400, 4400], [6800, 4900],
        ];
        for (const [rx, ry] of riverSamples) this.audio_.addPointSource(rx, ry, 'water');

        // Start audio + time-of-day cycling on the first user input
        // (autoplay policy compliant, plus the opening scene holds golden hour).
        // Also kick off the chapter flow (title card → welcome → hub → walking).
        const onFirstInput = (): void => {
            this.audio_?.start();
            timeOfDay.start();
            this.startChapterIfReady_();
        };
        this.input.keyboard?.once('keydown', onFirstInput);
        this.input.once('pointerdown', onFirstInput);

        // Mute toggle: M key
        this.input.keyboard?.on('keydown-M', () => {
            this.audio_?.toggleMute();
        });

        // Footsteps: react to Player step events
        this.events.on(PLAYER_EVENTS.STEP, () => {
            this.audio_?.step('dirt');
        });

        // Near-proximity landmark framing: subtle camera zoom when the player
        // steps into a landmark's "near" range, back out on leave. Zoom is held
        // steady at 1.08 during the framing (a single bilinear resample, not
        // oscillated every frame) so it doesn't create the blur the removed
        // breathing did.
        this.events.on(LANDMARK_EVENTS.NEAR_ENTER, (landmark: Landmark) => {
            this.tweens.killTweensOf(this.cameras.main);
            this.tweens.add({
                targets: this.cameras.main,
                zoom: 1.08,
                duration: 900,
                ease: 'Sine.easeInOut',
            });
            // Let the chapter system know — if this landmark is the active
            // waypoint, its elder dialogue queue will fire.
            this.chapterSystem_?.onWaypointNear(landmark.data_.id);
        });
        this.events.on(LANDMARK_EVENTS.NEAR_LEAVE, () => {
            this.tweens.killTweensOf(this.cameras.main);
            this.tweens.add({
                targets: this.cameras.main,
                zoom: 1.0,
                duration: 700,
                ease: 'Sine.easeInOut',
            });
        });

        // Tear audio down when the scene shuts down so we don't leak oscillators.
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.audio_?.destroy();
            this.audio_ = null;
        });

        // Launch UI scene as overlay
        this.scene.launch('UIScene');

        // Listen for resume event - add cooldown to prevent E key retriggering.
        // Also: if the player just closed the active primary waypoint's story
        // card, advance the chapter. Reading a non-primary (or already passed)
        // waypoint's card is fine, it just won't advance.
        this.events.on('resume', () => {
            this.time.delayedCall(200, () => {
                this.isPaused = false;
            });
            const sys = this.chapterSystem_;
            const opened = this.lastOpenedLandmarkId_;
            this.lastOpenedLandmarkId_ = null;
            if (sys?.phase === 'walking' && opened) {
                const wp = sys.activeWaypoint;
                if (wp?.role === 'primary'
                    && wp.landmarkId === opened
                    && sys.isWaypointArrived(wp.id)) {
                    sys.advanceWaypoint();
                }
            }
        });

        // Fade in
        this.cameras.main.fadeIn(800, 10, 6, 3);
    }

    update(_time: number, delta: number): void {
        if (this.isPaused) return;

        this.player.update();
        windSystem.tick(delta);
        timeOfDay.tick(delta);
        // Poll time-of-day → apply interpolated palette to the pipeline.
        // Cheap (just a handful of uniform sets); the pipeline applies them
        // during its next onDraw pass.
        this.postFx_?.applyPalette(timeOfDay.palette);
        this.cameras.main.setBackgroundColor(timeOfDay.palette.letterboxColor);
        this.updateAmbientParticles(delta);
        this.updateGrassWind_();
        this.updateTreesWind_();
        this.updateFauna_(delta);
        this.updateRiverShimmer_(delta);
        this.updateParticleFollow_();
        this.updateWeather_();
        this.updateCameraPolish();
        this.audio_?.update(this.player.x, this.player.y, delta);

        // Update landmark proximity. Use a local binding so TS's control-flow
        // analyser can narrow it after the loop (a class field written from
        // inside a forEach closure gets narrowed to `null` forever, which
        // breaks the `nearest.data_` access downstream).
        let nearestCandidate: Landmark | null = null;
        let nearestDist = Infinity;

        for (const landmark of this.landmarks) {
            landmark.updateProximity(this.player.x, this.player.y);
            if (!landmark.isNear) continue;
            const dist = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                landmark.data_.position.x, landmark.data_.position.y,
            );
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestCandidate = landmark;
            }
        }

        // Handle interaction. E opens the StoryCard only for a primary
        // landmark that the chapter has actually arrived at and whose elder
        // dialogue has finished - so the visitor can't interrupt the Elder
        // mid-sentence, and can't read the primary story out of order.
        if (nearestCandidate && this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
            if (this.canInteractWithLandmark_(nearestCandidate)) {
                this.openStoryCard(nearestCandidate.data_);
            }
        }
    }

    private canInteractWithLandmark_(landmark: Landmark): boolean {
        const sys = this.chapterSystem_;
        // If there's no chapter loaded, free-exploration mode: any landmark.
        if (!sys || !sys.chapter) return true;
        // Don't let the visitor interrupt the Elder mid-sentence.
        if (sys.elderVoice.isSpeaking) return false;
        // Is this landmark one of the chapter's waypoints?
        const chapterWp = sys.chapter.waypoints.find(
            wp => wp.landmarkId === landmark.data_.id,
        );
        if (chapterWp) {
            // Chapter landmark: only readable after arrival (can't skip ahead).
            return sys.isWaypointArrived(chapterWp.id);
        }
        // Non-chapter landmark: always readable. The elder won't comment, but
        // the visitor can still explore the world freely.
        return true;
    }

    // Public getters for UIScene / MiniMap
    getPlayerPosition(): { x: number; y: number } {
        if (!this.player) return { x: 4000, y: 3400 };
        return { x: this.player.x, y: this.player.y };
    }

    getLandmarkPositions(): ReadonlyArray<{ x: number; y: number; id: string; iconColor: string }> {
        return this.landmarkPositions;
    }

    private openStoryCard(data: LandmarkData): void {
        this.isPaused = true;
        this.player.setVelocity(0, 0);
        this.lastOpenedLandmarkId_ = data.id;

        const uiScene = this.scene.get('UIScene');
        uiScene.events.emit('openStoryCard', data);

        this.scene.pause();
    }

    private attachPostFxPipeline(): void {
        const renderer = this.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
        if (!renderer || renderer.type !== Phaser.WEBGL || !renderer.pipelines) {
            return;
        }
        // addPostPipeline is idempotent — internal `postPipelineClasses.has()` guard
        // protects against double-registration when the scene is restarted.
        renderer.pipelines.addPostPipeline('PostFxPipeline', PostFxPipeline);
        this.cameras.main.setPostPipeline('PostFxPipeline');
        const pipe = this.cameras.main.getPostPipeline('PostFxPipeline');
        const instance = Array.isArray(pipe) ? pipe[0] : pipe;
        if (instance instanceof PostFxPipeline) {
            instance.applyPalette(timeOfDay.palette);
            this.postFx_ = instance;
        }
        // React to time-of-day changes in later phases (Phase 6 animates).
        const handlePaletteChange = (): void => {
            this.postFx_?.applyPalette(timeOfDay.palette);
            this.cameras.main.setBackgroundColor(timeOfDay.palette.letterboxColor);
        };
        timeOfDay.on('change', handlePaletteChange);
        // Remove THIS listener only — `off('change')` without a handler would
        // also kill listeners registered by other scenes in later phases.
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            timeOfDay.off('change', handlePaletteChange);
        });
    }

    // =========================================================================
    // CHAPTER / NARRATIVE WIRING
    // =========================================================================

    private wireChapterSystem_(): void {
        const sys = this.chapterSystem_;
        if (!sys) return;

        // Gate player movement by chapter phase.
        sys.on(CHAPTER_EVENTS.PHASE_CHANGED, (phase: ChapterPhase) => {
            const frozenPhases: ReadonlySet<ChapterPhase> = new Set([
                'attract', 'welcome', 'close', 'farewell',
            ]);
            if (this.player) {
                this.player.canMove = !frozenPhases.has(phase);
            }
            // Race-safe: when walking begins, the player may already be
            // standing inside the active waypoint's NEAR range (they walked
            // toward it during the hub monologue, which left them free to
            // roam). NEAR_ENTER only fires on the transition, so we'd miss
            // the arrival entirely. Re-poll proximity once here.
            if (phase === 'walking') {
                this.recheckActiveWaypointProximity_();
            }
        });

        // Waypoint activation - emit an event the UI can listen to for hints.
        // Also re-poll proximity for the new active waypoint, same reason as
        // above (the player might already be standing on the next stop).
        sys.on(CHAPTER_EVENTS.WAYPOINT_ACTIVE, (wp: Waypoint) => {
            this.events.emit('chapterWaypointActive', wp);
            this.recheckActiveWaypointProximity_();
        });

        // When the full chapter completes, let the UI show its final card
        // (ChapterTitleCard "Chapter Complete") and the FarewellScreen modal.
        sys.on(CHAPTER_EVENTS.CHAPTER_COMPLETE, () => {
            this.events.emit('chapterComplete', {
                chapter: sys.chapter,
                seasonPreset: sys.seasonPreset,
            });
        });

        // Farewell dismiss -> reset to attract mode for next visitor.
        this.events.on('farewellDismissed', () => {
            this.resetToAttract_();
        });

        // Player starts frozen until the first input begins the chapter.
        // (canMove default is true; this explicit set keeps welcome aligned
        // with the first-input -> beginWelcome transition below.)
        if (this.player) {
            this.player.canMove = false;
        }
    }

    private recheckActiveWaypointProximity_(): void {
        const sys = this.chapterSystem_;
        if (!sys || sys.phase !== 'walking') return;
        const wp = sys.activeWaypoint;
        if (!wp || sys.isWaypointArrived(wp.id)) return;
        const landmark = this.landmarks.find(l => l.data_.id === wp.landmarkId);
        if (!landmark || !this.player) return;
        landmark.updateProximity(this.player.x, this.player.y);
        if (landmark.isNear) {
            sys.onWaypointNear(landmark.data_.id);
        }
    }

    private startChapterIfReady_(): void {
        if (this.chapterStarted_) return;
        this.chapterStarted_ = true;
        const sys = this.chapterSystem_;
        const data = this.chaptersData_;

        if (!sys || !data || data.chapters.length === 0) {
            // Free exploration fallback - no chapters to drive the flow.
            if (this.player) this.player.canMove = true;
            return;
        }

        if (data.chapters.length === 1) {
            // Single chapter - skip picker, auto-load.
            sys.load(data, data.chapters[0].id);
            this.applySeasonPreset_();
            this.emitChapterStart_();
            return;
        }

        // Multi-chapter - show picker and wait for selection.
        if (this.player) this.player.canMove = false;
        this.events.emit('showChapterPicker', data);
        this.events.once('chapterSelected', (chapterId: string) => {
            sys.load(data, chapterId);
            this.applySeasonPreset_();
            this.emitChapterStart_();
        });
    }

    private applySeasonPreset_(): void {
        const preset = this.chapterSystem_?.seasonPreset;
        const chapter = this.chapterSystem_?.chapter;
        if (!preset) return;
        applySeasonPreset(preset, this.audio_);
        const weather = (preset.weather ?? 'clear') as WeatherKind;
        this.weatherSystem_?.setWeather(weather);
        // Swap parallax painted backgrounds for this chapter if they exist.
        if (chapter) {
            this.parallax_?.switchChapter(chapter.id, CONSTANTS.WORLD_WIDTH, CONSTANTS.WORLD_HEIGHT);
        }
    }

    private emitChapterStart_(): void {
        const chapter = this.chapterSystem_?.chapter;
        if (!chapter) return;
        this.events.emit('chapterIntroRequested', chapter);
        this.time.delayedCall(900, () => this.chapterSystem_?.beginWelcome());
    }

    /**
     * Kiosk reset path. Used by IdleKiosk (180s idle) and FarewellScreen
     * dismiss callback. Fades the camera, stops UIScene and GameScene, then
     * restarts TitleScene for a clean session for the next visitor.
     */
    private resetToAttract_(): void {
        this.idleKiosk_?.setEnabled(false);
        this.chapterSystem_?.elderVoice.stop();
        this.cameras.main.fadeOut(600, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.stop('UIScene');
            this.scene.start('TitleScene');
        });
    }

    private createGrassField(width: number, height: number): void {
        const rng = this.createSeededRandom(311);
        // Scatter ~420 tufts; a fifth sit above player depth so the player walks
        // through them (the near-edge ones feel "physical" — this is the single
        // cheapest way to kill the flat top-down reading of the scene).
        const count = 420;
        for (let i = 0; i < count; i++) {
            const x = rng() * width;
            const y = rng() * height;

            // Avoid placing on paths/river/landmarks by staying clear of the
            // central Brambuk clearing radius.
            const cdx = x - 2200;
            const cdy = y - 3800;
            if (cdx * cdx + cdy * cdy < 180 * 180) continue;

            const tuft = this.add.image(x, y, 'grass-tuft');
            const scale = 0.7 + rng() * 0.75;
            tuft.setOrigin(0.5, 0.9);
            tuft.setScale(scale);
            tuft.setAlpha(0.8 + rng() * 0.15);
            // Foreground tufts share the Y-sort scheme with a slight positive
            // tiebreak so they draw ABOVE the player at the same Y (player
            // walks "through" the grass). Background tufts stay at 1.2 so
            // they're always behind dynamic objects.
            const foreground = rng() < 0.35;
            tuft.setDepth(foreground ? 2 + y * 0.001 + 0.03 : 1.2);
            tuft.setData('windPhase', rng() * Math.PI * 2);
            tuft.setData('baseScaleX', scale);
            this.grassTufts_.push(tuft);
        }

        // Scatter bark flakes under tree clusters — small touches of realism.
        for (let i = 0; i < 110; i++) {
            const x = rng() * width;
            const y = rng() * height;
            const cdx = x - 4000;
            const cdy = y - 3200;
            if (cdx * cdx + cdy * cdy < 180 * 180) continue;
            const flake = this.add.image(x, y, 'bark-flake');
            flake.setOrigin(0.5, 0.8);
            flake.setRotation(rng() * Math.PI * 2);
            flake.setAlpha(0.7);
            flake.setDepth(1.1);
        }
    }

    private updateGrassWind_(): void {
        if (this.grassTufts_.length === 0) return;
        const { value, direction } = windSystem.sample();
        const shearX = Math.cos(direction) * 0.1 * value;
        // Soft sine noise per tuft drives per-blade wobble
        const t = this.time.now / 1000;
        for (let i = 0; i < this.grassTufts_.length; i++) {
            const tuft = this.grassTufts_[i];
            const phase = (tuft.getData('windPhase') as number) ?? 0;
            const base = (tuft.getData('baseScaleX') as number) ?? 1;
            const wobble = Math.sin(t * 2.1 + phase) * 0.06 * value;
            tuft.setScale(base * (1 + wobble), base);
            tuft.rotation = shearX + Math.sin(t + phase) * 0.04 * value;
        }
    }

    private updateRiverShimmer_(deltaMs: number): void {
        this.riverShimmerPhase_ += deltaMs / 1000;
        if (this.riverShimmers_.length === 0) return;
        for (let i = 0; i < this.riverShimmers_.length; i++) {
            const g = this.riverShimmers_[i];
            const a = 0.25 + 0.2 * Math.sin(this.riverShimmerPhase_ * 1.7 + i * 0.6);
            g.setAlpha(Math.max(0.1, Math.min(0.55, a)));
        }
    }

    private createParticleSystems_(): void {
        // Smoke + ember emitters, anchored to the Brambuk cultural centre.
        const fireLandmark = this.landmarkPositions.find(l => l.id === 'brambuk');
        const fireX = fireLandmark?.x ?? 2200;
        const fireY = fireLandmark?.y ?? 3800;

        this.smokeEmitter_ = this.add.particles(fireX, fireY - 10, 'particle-soft', {
            frequency: 130,
            lifespan: 5000,
            speedY: { min: -38, max: -22 },
            speedX: { min: -6, max: 10 },
            scale: { start: 0.9, end: 2.6 },
            alpha: { start: 0.4, end: 0 },
            tint: [0x1a1612, 0x3a2e22, 0x2a2018],
            quantity: 1,
            rotate: { min: 0, max: 360 },
        });
        this.smokeEmitter_.setDepth(7);

        this.emberEmitter_ = this.add.particles(fireX, fireY - 4, 'particle-ember', {
            frequency: 160,
            lifespan: 1400,
            speedY: { min: -100, max: -60 },
            speedX: { min: -20, max: 20 },
            scale: { start: 1, end: 0.2 },
            alpha: { start: 1, end: 0 },
            quantity: 1,
            gravityY: 20,
        });
        this.emberEmitter_.setDepth(7);

        // Dust motes drifting through sunbeams — world-wide, camera-follow.
        this.dustEmitter_ = this.add.particles(0, 0, 'particle-soft', {
            frequency: 110,
            lifespan: 7000,
            speedX: { min: -8, max: 8 },
            speedY: { min: -12, max: -2 },
            scale: { start: 0.25, end: 0.9 },
            alpha: { start: 0, end: 0.22, ease: 'Sine.easeInOut' },
            tint: [0xfff0c0, 0xffd89c, 0xf0c080],
            quantity: 1,
            emitZone: {
                type: 'random',
                source: new Phaser.Geom.Rectangle(-660, -380, 1320, 760),
                quantity: 1,
            } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig,
        });
        this.dustEmitter_.setDepth(7);

        // Fireflies — night only, also camera-relative.
        this.fireflyEmitter_ = this.add.particles(0, 0, 'particle-soft', {
            frequency: 260,
            lifespan: 5200,
            speedX: { min: -12, max: 12 },
            speedY: { min: -10, max: 10 },
            scale: { start: 0.3, end: 0.9 },
            alpha: { start: 0, end: 0.85, ease: 'Sine.easeInOut' },
            tint: [0xc8ff88, 0x88ff88],
            quantity: 1,
            emitZone: {
                type: 'random',
                source: new Phaser.Geom.Rectangle(-660, -380, 1320, 760),
                quantity: 1,
            } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig,
        });
        this.fireflyEmitter_.setDepth(7);
        this.fireflyEmitter_.stop();

        // Wind-swept leaves — idle off, triggered on WindSystem 'gust'.
        this.leafEmitter_ = this.add.particles(0, 0, 'particle-leaf', {
            frequency: -1, // manual only
            lifespan: 2200,
            speedX: { min: 80, max: 160 },
            speedY: { min: -20, max: 20 },
            scale: { start: 0.9, end: 0.5 },
            rotate: { start: 0, end: 360 },
            alpha: { start: 0.9, end: 0 },
            quantity: 2,
            emitZone: {
                type: 'random',
                source: new Phaser.Geom.Rectangle(-700, -400, 1400, 800),
                quantity: 2,
            } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig,
        });
        this.leafEmitter_.setDepth(7);

        // Subscribe to wind gusts — save the handler ref so we only remove
        // THIS scene's listener on shutdown, not other subscribers.
        const gustHandler = (): void => {
            if (!this.leafEmitter_) return;
            this.leafEmitter_.emitParticle(14);
        };
        windSystem.on('gust', gustHandler);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            windSystem.off('gust', gustHandler);
        });
    }

    private updateWeather_(): void {
        if (!this.weatherSystem_) return;
        const cam = this.cameras.main;
        const cx = cam.scrollX + cam.width / 2;
        const cy = cam.scrollY + cam.height / 2;
        this.weatherSystem_.update(cx, cy);
    }

    private updateParticleFollow_(): void {
        if (!this.dustEmitter_ || !this.fireflyEmitter_ || !this.leafEmitter_) return;
        const cam = this.cameras.main;
        const cx = cam.scrollX + cam.width / 2;
        const cy = cam.scrollY + cam.height / 2;
        this.dustEmitter_.setPosition(cx, cy);
        this.fireflyEmitter_.setPosition(cx, cy);
        this.leafEmitter_.setPosition(cx, cy);

        // Fireflies only active at night; dust tapers at night.
        const starfield = timeOfDay.palette.starfieldAlpha;
        if (starfield > 0.4 && !this.fireflyEmitter_.emitting) {
            this.fireflyEmitter_.start();
        } else if (starfield < 0.2 && this.fireflyEmitter_.emitting) {
            this.fireflyEmitter_.stop();
        }
        this.dustEmitter_.frequency = 110 + starfield * 400;
    }

    private updateCameraPolish(): void {
        // NOTE: no breathing zoom. A non-integer setZoom forces bilinear filtering
        // on every sprite in the scene (including the post-FX render target copy)
        // which reads as softness/blur on retina displays. The look-ahead offset
        // only changes scroll, which is pixel-rounded by startFollow(..., true).

        // Look-ahead: camera leads player by up to 60px in movement direction.
        const body = this.player.body as Phaser.Physics.Arcade.Body | null;
        const vx = body?.velocity.x ?? 0;
        const vy = body?.velocity.y ?? 0;
        const len = Math.hypot(vx, vy);
        const targetX = len > 10 ? -(vx / len) * 60 : 0;
        const targetY = len > 10 ? -(vy / len) * 60 : 0;
        this.leadOffsetX_ += (targetX - this.leadOffsetX_) * 0.05;
        this.leadOffsetY_ += (targetY - this.leadOffsetY_) * 0.05;
        this.cameras.main.setFollowOffset(
            Math.round(this.leadOffsetX_),
            Math.round(this.leadOffsetY_),
        );
    }

    // =========================================================================
    // LANDSCAPE RENDERING
    // =========================================================================

    private createGroundBase(width: number, height: number): void {
        // Dense high-detail loam, tiled across the whole world.
        // The 512×512 source tile is generated procedurally in BootScene.
        const loam = this.add.tileSprite(width / 2, height / 2, width, height, 'ground-loam');
        loam.setDepth(0);
        loam.setOrigin(0.5, 0.5);

        // Low-frequency earth-tone variation on top so the tile repeat pattern
        // isn't perceptible. Keep the old ellipse patch system but softer.
        const gfx = this.add.graphics();
        gfx.setDepth(0);

        const rng = this.createSeededRandom(42);
        for (let i = 0; i < 120; i++) {
            const px = rng() * width;
            const py = rng() * height;
            const patchSize = 220 + rng() * 380;
            const colors = [0x443828, 0x302418, 0x3a3020, 0x342818, 0x483c2a];
            const lightness = colors[Math.floor(rng() * colors.length)];
            const alpha = 0.08 + rng() * 0.15;
            gfx.fillStyle(lightness, alpha);
            gfx.fillEllipse(px, py, patchSize, patchSize * (0.5 + rng() * 0.8));
        }
        for (let i = 0; i < 30; i++) {
            const px = rng() * width;
            const py = rng() * height;
            const patchSize = 180 + rng() * 320;
            const isOlive = rng() > 0.5;
            gfx.fillStyle(isOlive ? 0x3a3a22 : 0x4a3028, 0.08 + rng() * 0.1);
            gfx.fillEllipse(px, py, patchSize, patchSize * 0.7);
        }
    }

    private createGroundVariation(width: number, height: number): void {
        // Two additional tileable biome layers alpha-blended over the loam:
        // a grass-blade layer in the wetter mid-world and a leaf-litter layer
        // under tree clusters. Tiling uses a mask graphic for soft-edged patches.

        const rng = this.createSeededRandom(99);

        // --- Grass biome patches (soft-edged via RenderTexture + alpha mask) ---
        const grassRT = this.add.renderTexture(0, 0, width, height);
        grassRT.setDepth(0);
        grassRT.setOrigin(0, 0);
        const grassMask = this.add.graphics();
        grassMask.fillStyle(0xffffff, 1);
        // Scatter 40 fat grass patches across the world
        for (let i = 0; i < 40; i++) {
            const cx = rng() * width;
            const cy = rng() * height;
            const r = 260 + rng() * 380;
            grassMask.fillCircle(cx, cy, r);
        }
        const grassTile = this.add.tileSprite(width / 2, height / 2, width, height, 'ground-grass');
        grassTile.setOrigin(0.5, 0.5);
        grassTile.setMask(grassMask.createGeometryMask());
        grassTile.setDepth(0);
        // Keep the mask graphics invisible — it exists only to clip the tile.
        grassMask.setVisible(false);

        // --- Leaf-litter biome patches, smaller and more clustered ---
        const litterMask = this.add.graphics();
        litterMask.fillStyle(0xffffff, 1);
        for (let i = 0; i < 70; i++) {
            const cx = rng() * width;
            const cy = rng() * height;
            const r = 120 + rng() * 220;
            litterMask.fillCircle(cx, cy, r);
        }
        const litterTile = this.add.tileSprite(width / 2, height / 2, width, height, 'ground-litter');
        litterTile.setOrigin(0.5, 0.5);
        litterTile.setMask(litterMask.createGeometryMask());
        litterTile.setDepth(0);
        litterMask.setVisible(false);

        // --- Darker undergrowth patches for contrast ---
        const gfx = this.add.graphics();
        gfx.setDepth(0);
        for (let i = 0; i < 40; i++) {
            const px = rng() * width;
            const py = rng() * height;
            const patchSize = 60 + rng() * 140;
            gfx.fillStyle(0x1f2e14, 0.22);
            gfx.fillEllipse(px, py, patchSize, patchSize);
        }
    }

    private createHills(width: number, height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(0);

        const rng = this.createSeededRandom(77);

        // 28 hills, dramatically larger and more visible than before.
        // Sun angle derived from TimeOfDay — placeholder Phase 3 uses Golden-hour
        // (sun from upper-left), Phase 6 will animate this.
        const sunAngle = timeOfDay.palette.sunAngle * (Math.PI / 180);
        const litOffsetX = -Math.cos(sunAngle) * 90;
        const litOffsetY = -Math.sin(sunAngle) * 40;

        for (let i = 0; i < 28; i++) {
            const hx = rng() * width;
            const hy = rng() * height;
            const hw = 420 + rng() * 520;
            const hh = hw * (0.42 + rng() * 0.22);

            // Main hill body — a warm dark earth mass so it actually reads.
            gfx.fillStyle(0x2a2218, 0.35);
            gfx.fillEllipse(hx, hy, hw, hh);

            // Shadow under / behind the hill.
            gfx.fillStyle(0x140e08, 0.42);
            gfx.fillEllipse(hx - litOffsetX * 0.6, hy - litOffsetY * 0.6, hw * 0.92, hh * 0.9);

            // Lit face — warmer ochre highlight, offset toward the sun.
            gfx.fillStyle(0x6a5030, 0.22);
            gfx.fillEllipse(hx + litOffsetX, hy + litOffsetY, hw * 0.7, hh * 0.55);

            // Peak highlight — small brighter cap where the light hits most.
            gfx.fillStyle(0x8a6838, 0.18);
            gfx.fillEllipse(hx + litOffsetX * 1.25, hy + litOffsetY * 1.25, hw * 0.35, hh * 0.3);

            // Break the silhouette with a few dark scrub patches on the body.
            const scrubCount = 3 + Math.floor(rng() * 3);
            for (let s = 0; s < scrubCount; s++) {
                const sx = hx + (rng() - 0.5) * hw * 0.6;
                const sy = hy + (rng() - 0.5) * hh * 0.5;
                gfx.fillStyle(0x1a2410, 0.28);
                gfx.fillEllipse(sx, sy, 40 + rng() * 70, 20 + rng() * 40);
            }
        }
    }

    private createRiver(_width: number, _height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(1);

        // River flows across the 8000px world with natural meander
        // Crossings are at specific points for gameplay navigation
        const riverPoints = [
            { x: 0, y: 2400 },
            { x: 400, y: 2480 },
            { x: 800, y: 2560 },
            { x: 1200, y: 2620 },
            { x: 1600, y: 2680 },
            // CROSSING 1: near Mutawintji path area (~1900)
            { x: 2100, y: 2720 },
            { x: 2500, y: 2700 },
            { x: 2900, y: 2660 },
            // CROSSING 2: west of Brambuk (~3200)
            { x: 3400, y: 2600 },
            { x: 3800, y: 2540 },
            // CROSSING 3: near Pilliga (~4100)
            { x: 4300, y: 2480 },
            { x: 4700, y: 2440 },
            { x: 5100, y: 2400 },
            // CROSSING 4: east of center (~5300)
            { x: 5500, y: 2350 },
            { x: 5900, y: 2280 },
            // CROSSING 5: near Blue Mountains (~6200)
            { x: 6400, y: 2200 },
            { x: 6800, y: 2140 },
            // CROSSING 6: far east (~7100)
            { x: 7300, y: 2080 },
            { x: 7600, y: 2020 },
            { x: 8000, y: 1960 },
        ];

        // River banks (drawn first, wider, underneath)
        gfx.lineStyle(56, 0x2a2018, 0.3);
        gfx.beginPath();
        gfx.moveTo(riverPoints[0].x, riverPoints[0].y);
        for (let i = 1; i < riverPoints.length; i++) {
            gfx.lineTo(riverPoints[i].x, riverPoints[i].y);
        }
        gfx.strokePath();

        // Main river water — varying width effect via two overlapping strokes
        gfx.lineStyle(44, 0x1a4a6a, 0.6);
        gfx.beginPath();
        gfx.moveTo(riverPoints[0].x, riverPoints[0].y);
        for (let i = 1; i < riverPoints.length; i++) {
            gfx.lineTo(riverPoints[i].x, riverPoints[i].y);
        }
        gfx.strokePath();

        // Inner lighter water
        gfx.lineStyle(28, 0x2a6a8a, 0.5);
        gfx.beginPath();
        gfx.moveTo(riverPoints[0].x, riverPoints[0].y);
        for (let i = 1; i < riverPoints.length; i++) {
            gfx.lineTo(riverPoints[i].x, riverPoints[i].y);
        }
        gfx.strokePath();

        // Water shimmer: split into 3 alpha-animated layers so the river "moves".
        const shimmerRng = this.createSeededRandom(555);
        const shimmerLayerCount = 3;
        for (let layer = 0; layer < shimmerLayerCount; layer++) {
            const shimmerGfx = this.add.graphics();
            shimmerGfx.setDepth(1.2);
            for (let i = 0; i < riverPoints.length - 1; i++) {
                const p1 = riverPoints[i];
                const p2 = riverPoints[i + 1];
                for (let t = layer / shimmerLayerCount; t < 1; t += 0.25) {
                    const x = p1.x + (p2.x - p1.x) * t + (shimmerRng() - 0.5) * 24;
                    const y = p1.y + (p2.y - p1.y) * t + (shimmerRng() - 0.5) * 18;
                    const dashW = 6 + shimmerRng() * 10;
                    shimmerGfx.fillStyle(0x6aaacc, 0.22);
                    shimmerGfx.fillRect(x - dashW / 2, y, dashW, 2);
                    shimmerGfx.fillStyle(0x4a8aaa, 0.35);
                    shimmerGfx.fillCircle(
                        x + (shimmerRng() - 0.5) * 6,
                        y + (shimmerRng() - 0.5) * 4,
                        1.8,
                    );
                }
            }
            shimmerGfx.setAlpha(0.25 + layer * 0.1);
            this.riverShimmers_.push(shimmerGfx);
        }

        // Crossings — 6 crossing points
        const crossings = [
            { x: 1900, y: 2700 },
            { x: 3200, y: 2630 },
            { x: 4100, y: 2510 },
            { x: 5300, y: 2375 },
            { x: 6200, y: 2248 },
            { x: 7100, y: 2116 },
        ];

        crossings.forEach(({ x, y }) => {
            // Lighter ground at gap
            gfx.fillStyle(0x4a3a28, 0.6);
            gfx.fillEllipse(x, y, 100, 60);

            // Stepping stones with individual highlight
            const stones = [
                { dx: -20, dy: -6, r: 7 },
                { dx: 4, dy: 4, r: 8 },
                { dx: 28, dy: -4, r: 6 },
                { dx: -8, dy: 8, r: 5 },
            ];
            stones.forEach(({ dx, dy, r }) => {
                // Stone shadow
                gfx.fillStyle(0x000000, 0.1);
                gfx.fillCircle(x + dx + 2, y + dy + 2, r);
                // Stone body
                gfx.fillStyle(0x6a5a48, 0.75);
                gfx.fillCircle(x + dx, y + dy, r);
                // Stone highlight (NW)
                gfx.fillStyle(0x8a7a68, 0.4);
                gfx.fillCircle(x + dx - r * 0.25, y + dy - r * 0.25, r * 0.5);
            });

            // Dot art around crossing
            gfx.fillStyle(0xe8c170, 0.15);
            for (let a = 0; a < 10; a++) {
                const angle = (a / 10) * Math.PI * 2;
                gfx.fillCircle(x + Math.cos(angle) * 42, y + Math.sin(angle) * 28, 2);
            }
        });
    }

    private createPaths(): void {
        const gfx = this.add.graphics();
        gfx.setDepth(1);

        // Brambuk cultural centre as the hub
        const center = { x: 2200, y: 3800 };

        // Paths from Brambuk hub to nearby Grampians & western landmarks
        const hubTargets = [
            { x: 2600, y: 3400 },   // Bunjil's Shelter
            { x: 2000, y: 3000 },   // Ngamadjidj
            { x: 1000, y: 4800 },   // Budj Bim
            { x: 3800, y: 3800 },   // Djab Wurrung
        ];
        hubTargets.forEach(target => {
            this.drawDotPath(gfx, center.x, center.y, target.x, target.y);
        });

        // Gunditjmara country connections (SW cluster)
        this.drawDotPath(gfx, 1000, 4800, 1400, 4200);     // Budj Bim -> Mount Eccles
        this.drawDotPath(gfx, 1000, 4800, 800, 5400);      // Budj Bim -> Tyrendarra
        this.drawDotPath(gfx, 1000, 4800, 1600, 5800);     // Budj Bim -> Lake Condah
        this.drawDotPath(gfx, 1600, 5800, 1200, 6000);     // Lake Condah -> Kurtonitj

        // Grampians art shelters (NW cluster)
        this.drawDotPath(gfx, 2600, 3400, 3400, 2800);     // Bunjil's Shelter -> Gulgurn Manja
        this.drawDotPath(gfx, 2000, 3000, 2800, 2400);     // Ngamadjidj -> Billimina
        this.drawDotPath(gfx, 3400, 2800, 2800, 2400);     // Gulgurn Manja -> Billimina

        // Central corridor
        this.drawDotPath(gfx, 3800, 3800, 4200, 2000);     // Djab Wurrung -> Mount William
        this.drawDotPath(gfx, 4200, 2000, 3400, 1200);     // Mount William -> Kow Swamp
        this.drawDotPath(gfx, 3400, 1200, 4600, 800);      // Kow Swamp -> Scarred Trees
        this.drawDotPath(gfx, 3800, 3800, 4400, 4800);     // Djab Wurrung -> Wurdi Youang
        this.drawDotPath(gfx, 4200, 2000, 5200, 2400);     // Mount William -> Mudadgadjiin

        // Gippsland connections (east)
        this.drawDotPath(gfx, 5200, 2400, 5800, 3600);     // Mudadgadjiin -> Tarra-Bulga
        this.drawDotPath(gfx, 5800, 3600, 6800, 3200);     // Tarra-Bulga -> Buchan Caves
        this.drawDotPath(gfx, 5800, 3600, 6200, 4200);     // Tarra-Bulga -> Gippsland Lakes
        this.drawDotPath(gfx, 4400, 4800, 5400, 5400);     // Wurdi Youang -> Point Nepean

        // Central clearing around Brambuk cultural centre
        gfx.fillStyle(0x4a3a28, 0.3);
        gfx.fillCircle(center.x, center.y, 100);
        gfx.fillStyle(0x5a4a38, 0.2);
        gfx.fillCircle(center.x, center.y, 65);

        // Dot-art ring around centre
        gfx.fillStyle(0xe8c170, 0.12);
        for (let a = 0; a < 32; a++) {
            const angle = (a / 32) * Math.PI * 2;
            gfx.fillCircle(center.x + Math.cos(angle) * 85, center.y + Math.sin(angle) * 85, 3);
        }
        for (let a = 0; a < 20; a++) {
            const angle = (a / 20) * Math.PI * 2;
            gfx.fillCircle(center.x + Math.cos(angle) * 110, center.y + Math.sin(angle) * 110, 2);
        }
    }

    private drawDotPath(gfx: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number): void {
        const dist = Phaser.Math.Distance.Between(x1, y1, x2, y2);
        const steps = Math.floor(dist / 45); // Larger step size = fewer draw calls

        // Path ground (worn earth)
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = x1 + (x2 - x1) * t;
            const y = y1 + (y2 - y1) * t;
            const perpOffset = Math.sin(t * Math.PI * 3) * 10;
            const dx = -(y2 - y1) / dist;
            const dy = (x2 - x1) / dist;
            const px = x + dx * perpOffset;
            const py = y + dy * perpOffset;

            gfx.fillStyle(0x3d2e1e, 0.3);
            gfx.fillCircle(px, py, 16);

            // Grass encroachment on edges (every other step)
            if (i % 2 === 0) {
                gfx.fillStyle(0x3a5a2a, 0.2);
                gfx.fillCircle(px + dx * 16, py + dy * 16, 3);
            }
        }

        // Dot-art trail along path (every 3rd step)
        gfx.fillStyle(0xe8c170, 0.18);
        for (let i = 0; i <= steps; i += 3) {
            const t = i / steps;
            const x = x1 + (x2 - x1) * t;
            const y = y1 + (y2 - y1) * t;
            const perpOffset = Math.sin(t * Math.PI * 3) * 10;
            const dx = -(y2 - y1) / dist;
            const dy = (x2 - x1) / dist;

            gfx.fillCircle(x + dx * perpOffset, y + dy * perpOffset, 3);

            // Two surrounding dots instead of four
            gfx.fillStyle(0xe8c170, 0.08);
            const angle1 = t * 2;
            gfx.fillCircle(x + dx * perpOffset + Math.cos(angle1) * 9, y + dy * perpOffset + Math.sin(angle1) * 9, 2);
            gfx.fillCircle(x + dx * perpOffset - Math.cos(angle1) * 9, y + dy * perpOffset - Math.sin(angle1) * 9, 2);
            gfx.fillStyle(0xe8c170, 0.18);
        }
    }

    private createAmbientDetails(width: number, height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(2);

        const rng = this.createSeededRandom(333);

        // Fallen logs
        for (let i = 0; i < 12; i++) {
            const lx = 200 + rng() * (width - 400);
            const ly = 200 + rng() * (height - 400);
            const len = 20 + rng() * 35;
            const angle = rng() * Math.PI;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            // Log shadow
            gfx.fillStyle(0x000000, 0.1);
            gfx.fillEllipse(lx + 4 + cos * len / 2, ly + 4 + sin * len / 2, len, 6);

            // Log body
            gfx.fillStyle(0x4a3220, 0.5);
            const x1 = lx - cos * len / 2;
            const y1 = ly - sin * len / 2;
            const x2 = lx + cos * len / 2;
            const y2 = ly + sin * len / 2;
            // Draw as series of circles along the log
            for (let t = 0; t <= 1; t += 0.15) {
                const tx = x1 + (x2 - x1) * t;
                const ty = y1 + (y2 - y1) * t;
                gfx.fillCircle(tx, ty, 3);
            }

            // Bark highlight
            gfx.fillStyle(0x5a4230, 0.3);
            gfx.fillCircle(lx - cos * len * 0.2, ly - sin * len * 0.2, 2);
        }

        // Small puddles near river area
        for (let i = 0; i < 10; i++) {
            const px = 200 + rng() * (width - 400);
            // Bias puddles toward the river y-range (2000-2800)
            const py = 1800 + rng() * 1200;
            const pw = 8 + rng() * 14;
            const ph = pw * (0.5 + rng() * 0.3);

            // Puddle shadow
            gfx.fillStyle(0x000000, 0.05);
            gfx.fillEllipse(px + 2, py + 2, pw + 2, ph + 2);

            // Puddle water
            gfx.fillStyle(0x2a5a7a, 0.2);
            gfx.fillEllipse(px, py, pw, ph);

            // Reflection highlight
            gfx.fillStyle(0x4a8aaa, 0.15);
            gfx.fillEllipse(px - pw * 0.15, py - ph * 0.15, pw * 0.4, ph * 0.4);
        }
    }

    // =========================================================================
    // COLLISION BARRIERS
    // =========================================================================

    private createTrees(width: number, height: number): void {
        const rng = this.createSeededRandom(123);

        // Landmark positions to avoid (with clearance radius)
        const landmarkZones = [
            { x: 1000, y: 4800 }, { x: 1400, y: 4200 }, { x: 800, y: 5400 },
            { x: 1600, y: 5800 }, { x: 1200, y: 6000 }, { x: 2200, y: 3800 },
            { x: 2600, y: 3400 }, { x: 3400, y: 2800 }, { x: 2000, y: 3000 },
            { x: 2800, y: 2400 }, { x: 5200, y: 2400 }, { x: 3800, y: 3800 },
            { x: 4200, y: 2000 }, { x: 4400, y: 4800 }, { x: 3400, y: 1200 },
            { x: 4600, y: 800 }, { x: 6800, y: 3200 }, { x: 6200, y: 4200 },
            { x: 5800, y: 3600 }, { x: 5400, y: 5400 },
        ];

        const treeVariants = ['tree-redgum', 'tree-yellowbox', 'tree-mannagum', 'tree-snag'] as const;

        const clearance = 180;
        const treeCount = 95;
        let placed = 0;
        let attempts = 0;

        while (placed < treeCount && attempts < treeCount * 4) {
            attempts++;
            const tx = 160 + rng() * (width - 320);
            const ty = 220 + rng() * (height - 380);

            // Check clearance from landmarks
            const tooClose = landmarkZones.some(
                lz => Math.abs(tx - lz.x) < clearance && Math.abs(ty - lz.y) < clearance,
            );
            if (tooClose) continue;

            const variantIdx = rng() < 0.08
                ? 3 // snag (dead tree) 8% of the time
                : Math.floor(rng() * 3);
            const proceduralKey = treeVariants[variantIdx];
            // Upgrade to painted PNG if one was loaded in PreloadScene,
            // otherwise fall back to the procedural BootScene texture.
            const key = this.spriteFactory_?.textureFor(proceduralKey) ?? proceduralKey;
            const scale = 0.7 + rng() * 0.55;
            const flipX = rng() < 0.5;

            const sprite = this.add.image(tx, ty, key);
            sprite.setOrigin(0.5, 0.97); // base of trunk sits at (tx, ty)
            sprite.setScale(scale);
            sprite.setFlipX(flipX);
            // Shared Y-sort scheme: 2 + y/1000 (base, no tiebreak — player
            // naturally sits above trees at the same Y via its +0.01 offset).
            sprite.setDepth(2 + ty * 0.001);
            sprite.setData('windPhase', rng() * Math.PI * 2);
            sprite.setData('baseRot', 0);
            this.treeSprites_.push(sprite);

            // Collision at the trunk base
            const trunkRadius = 14 * scale;
            this.addBarrier({
                x: tx,
                y: ty - trunkRadius * 0.3,
                width: 0,
                height: 0,
                isCircle: true,
                radius: trunkRadius,
            });
            placed++;
        }
    }

    private createFauna(width: number, height: number): void {
        const rng = this.createSeededRandom(881);

        const landmarkZones = [
            { x: 1000, y: 4800 }, { x: 1400, y: 4200 }, { x: 800, y: 5400 },
            { x: 1600, y: 5800 }, { x: 1200, y: 6000 }, { x: 2200, y: 3800 },
            { x: 2600, y: 3400 }, { x: 3400, y: 2800 }, { x: 2000, y: 3000 },
            { x: 2800, y: 2400 }, { x: 5200, y: 2400 }, { x: 3800, y: 3800 },
            { x: 4200, y: 2000 }, { x: 4400, y: 4800 }, { x: 3400, y: 1200 },
            { x: 4600, y: 800 }, { x: 6800, y: 3200 }, { x: 6200, y: 4200 },
            { x: 5800, y: 3600 }, { x: 5400, y: 5400 },
        ];

        const spec: Array<{ key: string; count: number; fleeSpeed: number }> = [
            { key: 'fauna-kangaroo', count: 5, fleeSpeed: 160 },
            { key: 'fauna-emu', count: 3, fleeSpeed: 180 },
            { key: 'fauna-cockatoo', count: 7, fleeSpeed: 80 },
        ];

        for (const s of spec) {
            for (let i = 0; i < s.count; i++) {
                let x = 0, y = 0;
                for (let attempt = 0; attempt < 30; attempt++) {
                    x = 400 + rng() * (width - 800);
                    y = 400 + rng() * (height - 800);
                    const ok = !landmarkZones.some(
                        lz => Math.abs(x - lz.x) < 260 && Math.abs(y - lz.y) < 260,
                    );
                    if (ok) break;
                }
                // Upgrade to painted fauna frame if PNG loaded, else procedural.
                const frameKey = this.spriteFactory_?.textureFor(`${s.key}-0`) ?? `${s.key}-0`;
                const sprite = this.add.image(x, y, frameKey);
                sprite.setOrigin(0.5, 0.95);
                sprite.setDepth(2 + y * 0.001);
                sprite.setData('animKey', s.key);
                sprite.setData('frame', 0);
                sprite.setData('frameTimer', rng() * 1000);
                sprite.setData('homeX', x);
                sprite.setData('homeY', y);
                sprite.setData('fleeSpeed', s.fleeSpeed);
                sprite.setData('state', 'idle');
                sprite.setFlipX(rng() < 0.5);
                this.faunaSprites_.push(sprite);
            }
        }
    }

    private updateTreesWind_(): void {
        if (this.treeSprites_.length === 0) return;
        const { value, isGusting } = windSystem.sample();
        const t = this.time.now / 1000;
        const magnitude = isGusting ? 0.045 : 0.018;
        for (let i = 0; i < this.treeSprites_.length; i++) {
            const tree = this.treeSprites_[i];
            const phase = (tree.getData('windPhase') as number) ?? 0;
            tree.rotation = Math.sin(t * 1.3 + phase) * magnitude * value;
        }
    }

    private updateFauna_(deltaMs: number): void {
        if (this.faunaSprites_.length === 0) return;
        const px = this.player.x;
        const py = this.player.y;
        for (let i = 0; i < this.faunaSprites_.length; i++) {
            const sprite = this.faunaSprites_[i];
            const animKey = sprite.getData('animKey') as string;
            let timer = (sprite.getData('frameTimer') as number) + deltaMs;
            const currentFrame = sprite.getData('frame') as number;
            if (timer > 520) {
                timer = 0;
                const next = currentFrame === 0 ? 1 : 0;
                const nextKey = this.spriteFactory_?.textureFor(`${animKey}-${next}`) ?? `${animKey}-${next}`;
                sprite.setTexture(nextKey);
                sprite.setData('frame', next);
            }
            sprite.setData('frameTimer', timer);

            // Flee when player gets close.
            const dx = sprite.x - px;
            const dy = sprite.y - py;
            const dist = Math.hypot(dx, dy);
            const fleeRadius = 240;
            const state = sprite.getData('state') as string;
            if (dist < fleeRadius && state === 'idle') {
                sprite.setData('state', 'flee');
            }
            if (state === 'flee') {
                const speed = sprite.getData('fleeSpeed') as number;
                if (dist < 1) continue;
                const nx = dx / dist;
                const ny = dy / dist;
                sprite.x += nx * speed * (deltaMs / 1000);
                sprite.y += ny * speed * (deltaMs / 1000);
                sprite.setFlipX(nx < 0);
                sprite.setDepth(sprite.y * 0.001 + 3.5);
                // Resume idle once comfortably far away.
                if (dist > fleeRadius * 1.8) {
                    sprite.setData('state', 'idle');
                    sprite.setData('homeX', sprite.x);
                    sprite.setData('homeY', sprite.y);
                }
                // World bounds clamp
                sprite.x = Math.max(80, Math.min(CONSTANTS.WORLD_WIDTH - 80, sprite.x));
                sprite.y = Math.max(80, Math.min(CONSTANTS.WORLD_HEIGHT - 80, sprite.y));
                sprite.setDepth(2 + sprite.y * 0.001);
            }
        }
    }

    private createRocks(width: number, height: number): void {
        // Sprite path - used when any painted rock PNG is available. Collision
        // bodies are created identically regardless of visual path so the
        // world physics stays the same if PNGs land later.
        const usePainted = this.spriteFactory_?.hasPainted('rock-1')
            || this.spriteFactory_?.hasPainted('rock-2')
            || this.spriteFactory_?.hasPainted('rock-3');
        if (usePainted) {
            this.createRocksSprites_(width, height);
        } else {
            this.createRocksGraphics_(width, height);
        }
    }

    /**
     * Painted-PNG rock path. Spawns `rock-{1..3}` sprites with Y-sorted depth
     * using the same scheme as trees. Called only when SpriteFactory detects
     * at least one painted rock variant.
     */
    private createRocksSprites_(width: number, height: number): void {
        const rng = this.createSeededRandom(456);
        const landmarkZones = [
            { x: 4000, y: 3200 }, { x: 1400, y: 1800 }, { x: 6600, y: 1400 },
            { x: 6400, y: 5000 }, { x: 1600, y: 4800 }, { x: 4000, y: 800 },
            { x: 2800, y: 600 }, { x: 5600, y: 2800 }, { x: 3200, y: 5600 },
            { x: 6800, y: 3800 },
        ];
        const clearance = 140;
        const rockTarget = 30;
        let placed = 0;
        let attempts = 0;

        while (placed < rockTarget && attempts < rockTarget * 4) {
            attempts++;
            const cx = 200 + rng() * (width - 400);
            const cy = 200 + rng() * (height - 400);
            const tooClose = landmarkZones.some(
                lz => Math.abs(cx - lz.x) < clearance && Math.abs(cy - lz.y) < clearance
            );
            if (tooClose) continue;
            placed++;

            const clusterCount = 1 + Math.floor(rng() * 3);
            for (let r = 0; r < clusterCount; r++) {
                const rx = cx + (rng() - 0.5) * 40;
                const ry = cy + (rng() - 0.5) * 30;
                const variant = `rock-${1 + Math.floor(rng() * 3)}`;
                const key = this.spriteFactory_?.textureFor(variant) ?? variant;
                const scale = 0.7 + rng() * 0.5;

                const sprite = this.add.image(rx, ry, key);
                sprite.setOrigin(0.5, 0.85);
                sprite.setScale(scale);
                sprite.setFlipX(rng() < 0.5);
                sprite.setDepth(2 + ry * 0.001);

                // Collision body
                const radius = 22 * scale;
                this.addBarrier({ x: rx, y: ry, width: radius * 2, height: radius * 1.2 });
            }
        }
    }

    /**
     * Procedural Graphics rock path - the original Phase 1 implementation.
     * Kept intact as the fallback when no painted rocks are available.
     */
    private createRocksGraphics_(width: number, height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(3);

        const rng = this.createSeededRandom(456);

        const landmarkZones = [
            { x: 1000, y: 4800 }, { x: 1400, y: 4200 }, { x: 800, y: 5400 },
            { x: 1600, y: 5800 }, { x: 1200, y: 6000 }, { x: 2200, y: 3800 },
            { x: 2600, y: 3400 }, { x: 3400, y: 2800 }, { x: 2000, y: 3000 },
            { x: 2800, y: 2400 }, { x: 5200, y: 2400 }, { x: 3800, y: 3800 },
            { x: 4200, y: 2000 }, { x: 4400, y: 4800 }, { x: 3400, y: 1200 },
            { x: 4600, y: 800 }, { x: 6800, y: 3200 }, { x: 6200, y: 4200 },
            { x: 5800, y: 3600 }, { x: 5400, y: 5400 },
        ];

        const clearance = 140;
        const rockTarget = 30;
        let placedRocks = 0;
        let rockAttempts = 0;

        while (placedRocks < rockTarget && rockAttempts < rockTarget * 4) {
            rockAttempts++;
            const cx = 200 + rng() * (width - 400);
            const cy = 200 + rng() * (height - 400);

            const tooClose = landmarkZones.some(
                lz => Math.abs(cx - lz.x) < clearance && Math.abs(cy - lz.y) < clearance
            );
            if (tooClose) continue;
            placedRocks++;

            const rockCount = 1 + Math.floor(rng() * 3);
            for (let r = 0; r < rockCount; r++) {
                const rx = cx + (rng() - 0.5) * 40;
                const ry = cy + (rng() - 0.5) * 30;
                const rw = 22 + rng() * 18;
                const rh = rw * (0.55 + rng() * 0.25);

                // Rock shadow (SE)
                gfx.fillStyle(0x000000, 0.12);
                gfx.fillEllipse(rx + 6, ry + 6, rw + 4, rh + 4);

                // Rock body
                gfx.fillStyle(0x5a4a38, 0.75);
                gfx.fillEllipse(rx, ry, rw, rh);

                // Light side (NW - upper-left)
                gfx.fillStyle(0x8a7a68, 0.35);
                gfx.fillEllipse(rx - rw * 0.18, ry - rh * 0.18, rw * 0.55, rh * 0.5);

                // Dark side (SE - lower-right)
                gfx.fillStyle(0x3a2a1a, 0.25);
                gfx.fillEllipse(rx + rw * 0.15, ry + rh * 0.15, rw * 0.5, rh * 0.45);

                // Highlight spot
                gfx.fillStyle(0x9a8a78, 0.2);
                gfx.fillCircle(rx - rw * 0.25, ry - rh * 0.25, rw * 0.15);

                // Crack texture lines
                gfx.lineStyle(0.5, 0x3a3028, 0.3);
                gfx.beginPath();
                gfx.moveTo(rx - rw * 0.2, ry);
                gfx.lineTo(rx + rw * 0.15, ry + rh * 0.1);
                gfx.strokePath();

                // Collision body
                this.addBarrier({ x: rx, y: ry, width: rw, height: rh });
            }
        }
    }

    private createRiverCollisions(): void {
        // River collision uses small sub-segments that follow the diagonal path
        // 6 crossing gaps (~140px wide each)
        // Crossings at x: 1900, 3200, 4100, 5300, 6200, 7100

        // River path points (same as visual river)
        const riverPath = [
            { x: 0, y: 2400 }, { x: 400, y: 2480 }, { x: 800, y: 2560 },
            { x: 1200, y: 2620 }, { x: 1600, y: 2680 },
            { x: 2100, y: 2720 }, { x: 2500, y: 2700 }, { x: 2900, y: 2660 },
            { x: 3400, y: 2600 }, { x: 3800, y: 2540 },
            { x: 4300, y: 2480 }, { x: 4700, y: 2440 }, { x: 5100, y: 2400 },
            { x: 5500, y: 2350 }, { x: 5900, y: 2280 },
            { x: 6400, y: 2200 }, { x: 6800, y: 2140 },
            { x: 7300, y: 2080 }, { x: 7600, y: 2020 }, { x: 8000, y: 1960 },
        ];

        // Crossing zones (x-ranges where no collision should exist)
        const crossingGaps = [
            { xMin: 1830, xMax: 1970 },
            { xMin: 3130, xMax: 3270 },
            { xMin: 4030, xMax: 4170 },
            { xMin: 5230, xMax: 5370 },
            { xMin: 6130, xMax: 6270 },
            { xMin: 7030, xMax: 7170 },
        ];

        // Generate small collision segments between each pair of river points
        const segWidth = 200;
        for (let i = 0; i < riverPath.length - 1; i++) {
            const p1 = riverPath[i];
            const p2 = riverPath[i + 1];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const subSteps = Math.max(1, Math.ceil(Math.abs(dx) / segWidth));

            for (let s = 0; s < subSteps; s++) {
                const t1 = s / subSteps;
                const t2 = (s + 1) / subSteps;
                const sx = p1.x + dx * ((t1 + t2) / 2);
                const sy = p1.y + dy * ((t1 + t2) / 2);
                const sw = Math.abs(dx) / subSteps;

                // Skip if this sub-segment overlaps a crossing gap
                const segLeft = sx - sw / 2;
                const segRight = sx + sw / 2;
                const inGap = crossingGaps.some(
                    g => segRight > g.xMin && segLeft < g.xMax
                );
                if (inGap) continue;

                this.addBarrier({ x: sx, y: sy, width: sw + 10, height: 42 });
            }
        }
    }

    private createBoundaryFade(width: number, height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(7);

        const fadeWidth = 200;
        const strips = 10;

        for (let i = 0; i < strips; i++) {
            const t = 1 - (i / strips);
            const alpha = t * t * 0.65; // Opaque at edge, fading to transparent inward
            const stripSize = fadeWidth / strips;

            gfx.fillStyle(0x2a3a22, alpha);

            // Top edge (strip 0 = outermost = most opaque)
            gfx.fillRect(0, i * stripSize, width, stripSize);
            // Bottom edge
            gfx.fillRect(0, height - (i + 1) * stripSize, width, stripSize);
            // Left edge
            gfx.fillRect(i * stripSize, 0, stripSize, height);
            // Right edge
            gfx.fillRect(width - (i + 1) * stripSize, 0, stripSize, height);
        }

        // Very faint dotted boundary line
        gfx.fillStyle(0x4a6a3a, 0.12);
        const dotSpacing = 80;
        // Top
        for (let x = 0; x < width; x += dotSpacing) {
            gfx.fillCircle(x, 2, 1.5);
        }
        // Bottom
        for (let x = 0; x < width; x += dotSpacing) {
            gfx.fillCircle(x, height - 2, 1.5);
        }
        // Left
        for (let y = 0; y < height; y += dotSpacing) {
            gfx.fillCircle(2, y, 1.5);
        }
        // Right
        for (let y = 0; y < height; y += dotSpacing) {
            gfx.fillCircle(width - 2, y, 1.5);
        }
    }

    private addBarrier(def: BarrierDef): void {
        if (def.isCircle && def.radius) {
            const zone = this.add.zone(def.x, def.y, 1, 1);
            this.barriers.add(zone);
            const body = zone.body as Phaser.Physics.Arcade.StaticBody;
            body.setCircle(def.radius);
            body.setOffset(-def.radius, -def.radius);
        } else {
            const zone = this.add.zone(def.x, def.y, def.width, def.height);
            this.barriers.add(zone);
        }
    }

    // =========================================================================
    // AMBIENT PARTICLES
    // =========================================================================

    private initAmbientParticles(width: number, height: number): void {
        this.ambientParticles = Array.from({ length: 80 }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -0.05 - Math.random() * 0.2,
            alpha: 0.1 + Math.random() * 0.35,
            size: 1 + Math.random() * 2,
            life: Math.random() * 3000,
            maxLife: 3000 + Math.random() * 5000,
        }));
    }

    private updateAmbientParticles(delta: number): void {
        const { WORLD_WIDTH, WORLD_HEIGHT } = CONSTANTS;
        this.particleGraphics.clear();

        this.ambientParticles = this.ambientParticles.map(p => {
            const newLife = p.life + delta;
            if (newLife > p.maxLife) {
                return {
                    x: Math.random() * WORLD_WIDTH,
                    y: Math.random() * WORLD_HEIGHT,
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: -0.05 - Math.random() * 0.2,
                    alpha: 0.1 + Math.random() * 0.35,
                    size: 1 + Math.random() * 2,
                    life: 0,
                    maxLife: 3000 + Math.random() * 5000,
                };
            }

            const lifeT = newLife / p.maxLife;
            const fadeAlpha = lifeT < 0.2
                ? lifeT / 0.2
                : lifeT > 0.8
                    ? (1 - lifeT) / 0.2
                    : 1;

            this.particleGraphics.fillStyle(0xe8c170, p.alpha * fadeAlpha);
            this.particleGraphics.fillCircle(
                p.x + p.vx * delta * 0.05,
                p.y + p.vy * delta * 0.05,
                p.size
            );

            return {
                ...p,
                x: p.x + p.vx * delta * 0.05 + Math.sin(newLife * 0.002) * 0.15,
                y: p.y + p.vy * delta * 0.05,
                life: newLife,
            };
        });
    }

    // =========================================================================
    // UTILS
    // =========================================================================

    private createSeededRandom(seed: number): () => number {
        let s = seed;
        return () => {
            s = (s * 16807) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }
}
