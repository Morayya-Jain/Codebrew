import { Scene } from 'phaser';
import { StoryCard } from '../ui/StoryCard';
import { DialogCard } from '../ui/DialogCard';
import { TeaserCard } from '../ui/TeaserCard';
import { CompletionCard } from '../ui/CompletionCard';
import { MiniMap } from '../ui/MiniMap';
import { SettingsMenu } from '../ui/SettingsMenu';
import type { LandmarkData, NpcData, Region } from '../types';
import { REGION_LABELS } from '../types';
import type { GameScene } from './GameScene';
import { TreasureHuntSession } from '../systems/TreasureHuntSession';
import type { ClueUpdatePayload } from '../systems/TreasureHuntSession';

interface UISceneData {
    region?: Region;
}

interface TeaserPayload {
    id: string;
    name: string;
    teaserLine: string;
}

interface CompletionPayload {
    region: Region;
    visited: LandmarkData[];
}

export class UIScene extends Scene {
    private storyCard!: StoryCard;
    private dialogCard!: DialogCard;
    private teaserCard!: TeaserCard;
    private completionCard!: CompletionCard;
    private miniMap!: MiniMap;
    private progressText!: Phaser.GameObjects.Text;
    private hintText!: Phaser.GameObjects.Text;
    private clueBannerBg!: Phaser.GameObjects.Graphics;
    private clueBannerText!: Phaser.GameObjects.Text;
    private clueBannerLabel!: Phaser.GameObjects.Text;
    private discoveredIds: Set<string> = new Set();
    private readonly totalLandmarks = TreasureHuntSession.LANDMARK_COUNT;
    private currentClueIndex_ = 0;
    private progressDotsGfx!: Phaser.GameObjects.Graphics;
    private settingsMenu_: SettingsMenu | null = null;
    private softPromptEl_: HTMLElement | null = null;
    private region_: Region = 'victoria';

    constructor() {
        super('UIScene');
    }

    init(data: UISceneData = {}): void {
        this.region_ = data.region ?? 'victoria';
        this.discoveredIds = new Set();
        this.currentClueIndex_ = 0;
    }

    create(): void {
        this.storyCard = new StoryCard();
        this.dialogCard = new DialogCard();
        this.teaserCard = new TeaserCard();
        this.completionCard = new CompletionCard();
        const { width, height } = this.cameras.main;
        const gameScene = this.scene.get('GameScene') as GameScene;

        // Region label in the top-left corner. Tiny, low-contrast — mostly
        // so visitors can double-check which country they're walking.
        this.add.text(20, 20, REGION_LABELS[this.region_], {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '14px',
            color: '#8a7a6a',
            fontStyle: 'italic',
        }).setAlpha(0.7).setScrollFactor(0);

        // Progress tracker (top right) — "n / 10 Clues Followed"
        this.progressText = this.add.text(width - 20, 20, '', {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '16px',
            color: '#e8c170',
            align: 'right',
        }).setOrigin(1, 0).setAlpha(0.7).setScrollFactor(0);

        this.progressDotsGfx = this.add.graphics().setScrollFactor(0);

        // Clue banner — top-center parchment-style panel showing the current
        // treasure hunt clue. Hidden until the first clueUpdate event fires.
        this.clueBannerBg = this.add.graphics().setScrollFactor(0);
        this.clueBannerLabel = this.add.text(width / 2, 26, '', {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '13px',
            color: '#c4805a',
            align: 'center',
            fontStyle: 'italic',
        }).setOrigin(0.5, 0).setScrollFactor(0);
        this.clueBannerText = this.add.text(width / 2, 46, '', {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '17px',
            color: '#f5e6d3',
            align: 'center',
            wordWrap: { width: 640 },
        }).setOrigin(0.5, 0).setScrollFactor(0);
        this.setClueBannerAlpha(0);

        // HUD hint text (bottom center)
        this.hintText = this.add.text(width / 2, height - 28,
            'WASD / Arrow Keys to move  ·  Shift to sprint  ·  [ E ] read  ·  [ Tab ] map',
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

        // Settings menu (Escape toggles)
        this.settingsMenu_ = new SettingsMenu();
        this.softPromptEl_ = document.getElementById('soft-prompt-overlay');

        // Settings menu toggles on P (moved off ESC so ESC can navigate home).
        this.input.keyboard?.on('keydown-P', () => {
            if (this.settingsMenu_?.isVisible()) {
                this.settingsMenu_.hide();
            } else {
                this.settingsMenu_?.show();
            }
        });

        // Tab toggles the minimap between compact and expanded layouts.
        // M is already owned by GameScene for audio mute, so we use Tab.
        // preventDefault is called only on the toggle path so DOM modals
        // (SettingsMenu form controls) keep native Tab focus navigation.
        this.input.keyboard?.on('keydown-TAB', (e: KeyboardEvent) => {
            if (this.settingsMenu_?.isVisible()) return;
            if (this.isAnyModalOpen_()) return;
            e.preventDefault?.();
            this.miniMap?.toggle();
        });

        // ESC returns to the region picker when no modal is open. DOM modals
        // (StoryCard, DialogCard, TeaserCard, CompletionCard, SettingsMenu)
        // each own their own window-level ESC handler, so we no-op here if
        // any of them are visible. If the minimap is expanded, collapse it
        // first — Esc is the natural "back out" gesture.
        this.input.keyboard?.on('keydown-ESC', () => {
            if (this.isAnyModalOpen_()) return;
            if (this.miniMap?.isExpanded) {
                this.miniMap.collapse();
                return;
            }
            const gs = this.scene.get('GameScene');
            gs?.events.emit('escHome');
        });

        // Apply settings changes to the runtime (volume -> audio mute toggle).
        this.settingsMenu_?.onChange((state) => {
            const gs = this.scene.get('GameScene') as GameScene;
            const audio = gs?.getAmbientAudio?.();
            if (audio) {
                audio.setMuted(state.volume <= 5);
            }
        });

        // Soft idle prompt - GameScene fires 'idleSoftPrompt' at 60s idle.
        gameScene.events.on('idleSoftPrompt', () => {
            this.softPromptEl_?.classList.add('visible');
            this.softPromptEl_?.setAttribute('aria-hidden', 'false');
            const hide = (): void => {
                this.softPromptEl_?.classList.remove('visible');
                this.softPromptEl_?.setAttribute('aria-hidden', 'true');
                window.removeEventListener('keydown', hide);
                window.removeEventListener('pointerdown', hide);
            };
            window.addEventListener('keydown', hide, { once: true });
            window.addEventListener('pointerdown', hide, { once: true });
        });

        // Tear narrative UI down cleanly on scene shutdown.
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.settingsMenu_?.hide();
            this.settingsMenu_ = null;
            this.softPromptEl_?.classList.remove('visible');
            this.teaserCard?.hide();
            this.completionCard?.hide();
        });

        this.refreshProgressUi_();

        // Story card — shown when the player reads the current clue target.
        this.events.on('openStoryCard', (data: LandmarkData) => {
            this.discoveredIds = new Set([...this.discoveredIds, data.id]);
            this.storyCard.show(data, () => this.closeStoryCard());
        });

        // Teaser card — shown when the player reaches a non-target landmark
        // that's still in the random 10 selection.
        this.events.on('openTeaserCard', (payload: TeaserPayload) => {
            this.teaserCard.show(payload, () => this.closeTeaserCard_());
        });

        // Clue updates drive both the parchment banner and the progress dots.
        this.events.on('clueUpdate', (payload: ClueUpdatePayload) => {
            this.currentClueIndex_ = payload.index;
            if (payload.isComplete) {
                this.setClueBannerAlpha(0);
            } else {
                this.showClueBanner_(payload);
            }
            this.refreshProgressUi_();
        });

        // Full hunt completion — show the final summary card.
        this.events.on('treasureHuntComplete', (payload: CompletionPayload) => {
            this.currentClueIndex_ = this.totalLandmarks;
            this.setClueBannerAlpha(0);
            this.refreshProgressUi_();
            this.completionCard.show(
                payload,
                () => {
                    this.completionCard.hide();
                    const gs = this.scene.get('GameScene');
                    gs.events.emit('huntRestart');
                },
                () => {
                    this.completionCard.hide();
                    const gs = this.scene.get('GameScene');
                    gs.events.emit('huntExit');
                },
            );
        });

        // NPC dialog flow, mirrors the story card lifecycle. NPCs don't
        // contribute to the treasure hunt progress.
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

    private closeTeaserCard_(): void {
        const gameScene = this.scene.get('GameScene');
        gameScene.scene.resume();
        gameScene.events.emit('resume');
    }

    private closeDialogCard_(): void {
        const gameScene = this.scene.get('GameScene');
        gameScene.scene.resume();
        gameScene.events.emit('resume');
    }

    private isAnyModalOpen_(): boolean {
        return !!document.querySelector(
            '#story-card-overlay.visible, #dialog-card-overlay.visible, '
            + '#teaser-card-overlay.visible, #completion-card-overlay.visible, '
            + '#settings-overlay.visible',
        );
    }

    private showClueBanner_(payload: ClueUpdatePayload): void {
        this.clueBannerLabel.setText(`Clue ${payload.index + 1} of ${payload.total}`);
        this.clueBannerText.setText(payload.clueText);

        const { width } = this.cameras.main;
        const padX = 36;
        const padY = 14;
        const textW = Math.max(
            this.clueBannerLabel.width,
            this.clueBannerText.width,
        );
        const boxW = Math.min(width - 60, textW + padX * 2);
        const boxH = this.clueBannerLabel.height + this.clueBannerText.height + padY * 2 + 6;
        const boxX = width / 2 - boxW / 2;
        const boxY = 14;

        this.clueBannerBg.clear();
        this.clueBannerBg.fillStyle(0x1a1210, 0.88);
        this.clueBannerBg.fillRoundedRect(boxX, boxY, boxW, boxH, 12);
        this.clueBannerBg.lineStyle(1.5, 0xe8c170, 0.45);
        this.clueBannerBg.strokeRoundedRect(boxX, boxY, boxW, boxH, 12);
        this.clueBannerBg.lineStyle(1, 0xe8c170, 0.2);
        this.clueBannerBg.strokeRoundedRect(boxX + 4, boxY + 4, boxW - 8, boxH - 8, 9);

        this.clueBannerLabel.setPosition(width / 2, boxY + padY);
        this.clueBannerText.setPosition(
            width / 2,
            boxY + padY + this.clueBannerLabel.height + 4,
        );

        this.setClueBannerAlpha(0);
        this.tweens.add({
            targets: [this.clueBannerBg, this.clueBannerLabel, this.clueBannerText],
            alpha: 1,
            duration: 500,
            ease: 'Quad.easeOut',
        });
    }

    private setClueBannerAlpha(a: number): void {
        this.clueBannerBg.setAlpha(a);
        this.clueBannerLabel.setAlpha(a);
        this.clueBannerText.setAlpha(a);
    }

    private refreshProgressUi_(): void {
        const { width } = this.cameras.main;
        const baseY = 45;
        const total = this.totalLandmarks;
        const count = Math.min(this.currentClueIndex_, total);

        this.progressText.setText(count >= total
            ? 'All Clues Followed!'
            : `${count} / ${total} Clues Followed`);
        this.progressText.setColor(count >= total ? '#4aff4a' : '#e8c170');

        this.progressDotsGfx.clear();
        for (let i = 0; i < total; i++) {
            const x = width - 20 - (total - 1 - i) * 14;
            const found = i < count;
            const isCurrent = i === count && count < total;
            const color = found ? 0xe8c170 : isCurrent ? 0xc4805a : 0x3a2a1a;
            const alpha = found ? 0.9 : isCurrent ? 0.85 : 0.5;
            this.progressDotsGfx.fillStyle(color, alpha);
            this.progressDotsGfx.fillCircle(x, baseY, isCurrent ? 5 : 4);
        }
    }
}
