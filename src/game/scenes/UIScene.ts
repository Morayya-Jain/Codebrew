import { Scene } from 'phaser';
import { StoryCard } from '../ui/StoryCard';
import { DialogCard } from '../ui/DialogCard';
import { MiniMap } from '../ui/MiniMap';
import { ElderDialogue } from '../ui/ElderDialogue';
import { ChapterTitleCard } from '../ui/ChapterTitleCard';
import { ChapterPicker } from '../ui/ChapterPicker';
import { FarewellScreen } from '../ui/FarewellScreen';
import { SettingsMenu } from '../ui/SettingsMenu';
import type { ChapterData, ChaptersFile, LandmarkData, NpcData, SeasonPresetData } from '../types';
import type { GameScene } from './GameScene';
import { CHAPTER_EVENTS, type ChapterSystem } from '../systems/ChapterSystem';

export class UIScene extends Scene {
    private storyCard!: StoryCard;
    private dialogCard!: DialogCard;
    private miniMap!: MiniMap;
    private progressText!: Phaser.GameObjects.Text;
    private hintText!: Phaser.GameObjects.Text;
    private discoveredIds: Set<string> = new Set();
    private totalLandmarks = 20;
    private progressDotsGfx!: Phaser.GameObjects.Graphics;
    private elderDialogue_: ElderDialogue | null = null;
    private chapterTitleCard_: ChapterTitleCard | null = null;
    private chapterPicker_: ChapterPicker | null = null;
    private farewellScreen_: FarewellScreen | null = null;
    private settingsMenu_: SettingsMenu | null = null;
    private softPromptEl_: HTMLElement | null = null;
    private chapterSystem_: ChapterSystem | null = null;

    constructor() {
        super('UIScene');
    }

    create(): void {
        this.storyCard = new StoryCard();
        this.dialogCard = new DialogCard();
        const { width, height } = this.cameras.main;

        // Progress tracker (top right) — in Phase 1 this shows "Waypoint n of m"
        // for the active chapter, falling back to the original stories counter
        // if no chapter is loaded.
        this.progressText = this.add.text(width - 20, 20, '', {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '16px',
            color: '#e8c170',
            align: 'right',
        }).setOrigin(1, 0).setAlpha(0.7).setScrollFactor(0);

        this.progressDotsGfx = this.add.graphics().setScrollFactor(0);

        // HUD hint text (bottom center)
        this.hintText = this.add.text(width / 2, height - 28,
            'WASD / Arrow Keys to move  ·  Shift to sprint  ·  Walk with the Elder',
            {
                fontFamily: '"Crimson Text", Georgia, serif',
                fontSize: '14px',
                color: '#a0886a',
                align: 'center',
            }
        ).setOrigin(0.5).setAlpha(0.6).setScrollFactor(0);

        this.time.delayedCall(8000, () => {
            this.tweens.add({
                targets: this.hintText,
                alpha: 0.3,
                duration: 1000,
                ease: 'Quad.easeOut',
            });
        });

        // Pick up the chapter system from GameScene. It's constructed during
        // GameScene.create() which runs strictly before UIScene.create() (we
        // are a launched overlay, not the owner), so the reference is valid.
        const gameScene = this.scene.get('GameScene') as GameScene;
        this.chapterSystem_ = gameScene.getChapterSystem();

        // Mount the narrative + museum UI layers. ElderDialogue listens on
        // the chapter system directly; others are driven by GameScene events.
        this.chapterPicker_ = new ChapterPicker();
        this.farewellScreen_ = new FarewellScreen();
        this.settingsMenu_ = new SettingsMenu();
        this.softPromptEl_ = document.getElementById('soft-prompt-overlay');

        if (this.chapterSystem_) {
            this.elderDialogue_ = new ElderDialogue(this, this.chapterSystem_);
            this.chapterTitleCard_ = new ChapterTitleCard(this);
            this.wireChapterEvents_(gameScene);
        }

        // Settings: Escape toggles the settings menu during gameplay. Block
        // the toggle during elder monologues so a held Escape doesn't
        // interrupt the reading flow.
        this.input.keyboard?.on('keydown-ESC', () => {
            if (this.chapterSystem_?.elderVoice?.isSpeaking) return;
            if (this.settingsMenu_?.isVisible()) {
                this.settingsMenu_.hide();
            } else {
                this.settingsMenu_?.show();
            }
        });

        // Apply settings changes to the runtime (volume -> audio mute toggle,
        // reduced motion -> future weather/bloom suppression).
        this.settingsMenu_?.onChange((state) => {
            const gs = this.scene.get('GameScene') as GameScene;
            const audio = gs?.getAmbientAudio?.();
            if (audio) {
                // Simple mute-at-zero behaviour. A full gain ramp would need
                // an API on AmbientAudio; for Phase B we map volume <= 5 to
                // fully muted, > 5 to unmuted.
                audio.setMuted(state.volume <= 5);
            }
        });

        // Soft idle prompt - GameScene fires 'idleSoftPrompt' at 60s idle.
        gameScene.events.on('idleSoftPrompt', () => {
            this.softPromptEl_?.classList.add('visible');
            this.softPromptEl_?.setAttribute('aria-hidden', 'false');
            // Any input hides it (GameScene's IdleKiosk resets timers on
            // the same input, so no need for a separate handler).
            const hide = () => {
                this.softPromptEl_?.classList.remove('visible');
                this.softPromptEl_?.setAttribute('aria-hidden', 'true');
                window.removeEventListener('keydown', hide);
                window.removeEventListener('pointerdown', hide);
            };
            window.addEventListener('keydown', hide, { once: true });
            window.addEventListener('pointerdown', hide, { once: true });
        });

        // Tear down narrative UI cleanly on scene shutdown.
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.elderDialogue_?.destroy();
            this.elderDialogue_ = null;
            this.chapterTitleCard_?.destroy();
            this.chapterTitleCard_ = null;
            this.chapterPicker_?.hide();
            this.chapterPicker_ = null;
            this.farewellScreen_?.hide();
            this.farewellScreen_ = null;
            this.settingsMenu_?.hide();
            this.settingsMenu_ = null;
            this.softPromptEl_?.classList.remove('visible');
        });

        this.refreshProgressUi_();

        // Listen for story card open events from GameScene
        this.events.on('openStoryCard', (data: LandmarkData) => {
            this.discoveredIds = new Set([...this.discoveredIds, data.id]);
            this.refreshProgressUi_();
            this.storyCard.show(data, () => this.closeStoryCard());
        });

        // NPC dialog flow, mirrors the story card lifecycle. NPCs don't
        // contribute to the landmark progress tracker, so there's no
        // refreshProgressUi_ call on open.
        this.events.on('openDialogCard', (data: NpcData) => {
            this.dialogCard.show(data, () => this.closeDialogCard_());
        });

        // Initialize mini-map (bottom-right)
        this.miniMap = new MiniMap(this, width - 236, height - 192, 220, 176, gameScene);

        // Fade in
        this.cameras.main.fadeIn(500, 10, 6, 3);
    }

    update(): void {
        const gameScene = this.scene.get('GameScene') as GameScene;
        if (gameScene && this.miniMap) {
            const pos = gameScene.getPlayerPosition();
            this.miniMap.update(pos.x, pos.y, this.discoveredIds);
        }
    }

    private closeStoryCard(): void {
        const gameScene = this.scene.get('GameScene');
        gameScene.scene.resume();
        gameScene.events.emit('resume');
    }

    private closeDialogCard_(): void {
        const gameScene = this.scene.get('GameScene');
        gameScene.scene.resume();
        gameScene.events.emit('resume');
    }

    private wireChapterEvents_(gameScene: GameScene): void {
        const sys = this.chapterSystem_;
        if (!sys) return;

        sys.on(CHAPTER_EVENTS.CHAPTER_READY, () => {
            this.refreshProgressUi_();
        });
        sys.on(CHAPTER_EVENTS.WAYPOINT_ACTIVE, () => {
            this.refreshProgressUi_();
        });
        sys.on(CHAPTER_EVENTS.WAYPOINT_ARRIVED, () => {
            this.refreshProgressUi_();
        });

        // Chapter picker - GameScene asks UI to show it; UI emits
        // 'chapterSelected' back with the chosen ID.
        gameScene.events.on('showChapterPicker', (data: ChaptersFile) => {
            this.chapterPicker_?.show(data, (chapterId: string) => {
                gameScene.events.emit('chapterSelected', chapterId);
            });
        });

        // Title card on chapter intro
        gameScene.events.on('chapterIntroRequested', (chapter: ChapterData) => {
            this.chapterTitleCard_?.show(chapter, sys.seasonPreset);
        });

        // Chapter complete -> brief card, then FarewellScreen modal with
        // citations + farewell line. window.setTimeout is used here rather
        // than scene.time.delayedCall because the latter's scheduling is
        // tied to the scene's update loop, which can get out of sync across
        // parallel scenes in edge cases (e.g. if another scene pauses).
        gameScene.events.on('chapterComplete', (payload: { chapter: ChapterData; seasonPreset: SeasonPresetData | null }) => {
            this.chapterTitleCard_?.showComplete();
            window.setTimeout(() => {
                this.farewellScreen_?.show(
                    payload.chapter,
                    payload.seasonPreset,
                    () => {
                        gameScene.events.emit('farewellDismissed');
                    },
                );
            }, 3200);
        });
    }

    private refreshProgressUi_(): void {
        const sys = this.chapterSystem_;
        const { width } = this.cameras.main;
        const baseY = 45;

        if (sys && sys.chapter) {
            const total = sys.totalWaypoints;
            const index = Math.min(sys.activeWaypointIndex + 1, total);
            this.progressText.setText(`Waypoint ${index} of ${total}  ·  ${sys.chapter.title}`);
            this.progressText.setColor('#e8c170');

            this.progressDotsGfx.clear();
            for (let i = 0; i < total; i++) {
                const x = width - 20 - (total - 1 - i) * 14;
                const reached = i < sys.activeWaypointIndex
                    || (i === sys.activeWaypointIndex && sys.activeWaypoint
                        && sys.isWaypointArrived(sys.activeWaypoint.id));
                this.progressDotsGfx.fillStyle(reached ? 0xe8c170 : 0x3a2a1a, reached ? 0.9 : 0.5);
                this.progressDotsGfx.fillCircle(x, baseY, 4);
            }
            return;
        }

        // Fallback: old "stories discovered" counter for free-exploration mode.
        const total = this.totalLandmarks;
        const count = this.discoveredIds.size;
        this.progressText.setText(count === total
            ? 'All Stories Discovered!'
            : `${count} / ${total} Stories Discovered`);
        this.progressText.setColor(count === total ? '#4aff4a' : '#e8c170');

        this.progressDotsGfx.clear();
        for (let i = 0; i < total; i++) {
            const x = width - 20 - (total - 1 - i) * 14;
            const discovered = i < count;
            this.progressDotsGfx.fillStyle(discovered ? 0xe8c170 : 0x3a2a1a, discovered ? 0.9 : 0.5);
            this.progressDotsGfx.fillCircle(x, baseY, 4);
        }
    }
}
