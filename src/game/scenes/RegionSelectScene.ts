import { Scene } from 'phaser';
import type { Region } from '../types';

interface RegionCardData {
    region: Region;
    title: string;
    subtitle: string;
    description: string;
    accentColor: number;
}

const REGION_CARDS: ReadonlyArray<RegionCardData> = [
    {
        region: 'victoria',
        title: 'Victoria',
        subtitle: 'Kulin Country and the south-west',
        description: 'Eel channels, volcanic crater lakes, rock art in the Grampians, and the living culture of the Kulin Nations.',
        accentColor: 0xe8c170,
    },
    {
        region: 'nsw',
        title: 'New South Wales',
        subtitle: 'From harbour headlands to the western deserts',
        description: 'Engraved sandstone, Blue Mountains songlines, fish traps on the Barwon, and the dry lakes of Mungo.',
        accentColor: 0xc4805a,
    },
];

export class RegionSelectScene extends Scene {
    private cards: Phaser.GameObjects.Container[] = [];
    private selectedIndex = 0;
    private particles: Array<{ x: number; y: number; speed: number; alpha: number; size: number }> = [];
    private particleGraphics!: Phaser.GameObjects.Graphics;
    private inputLocked = true;

    constructor() {
        super('RegionSelectScene');
    }

    create(): void {
        const { width, height } = this.cameras.main;
        const centerX = width / 2;

        this.cards = [];
        this.selectedIndex = 0;
        this.inputLocked = true;

        this.drawBackground(width, height);

        const heading = this.add.text(centerX, 90, 'Choose Your Country', {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '42px',
            color: '#e8c170',
            align: 'center',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        heading.setAlpha(0);

        const sub = this.add.text(centerX, 138,
            'Each path leads to ten landmarks, chosen at random from twenty.', {
                fontFamily: '"Crimson Text", Georgia, serif',
                fontSize: '16px',
                color: '#a0886a',
                align: 'center',
                fontStyle: 'italic',
            }).setOrigin(0.5);
        sub.setAlpha(0);

        // Two cards side-by-side
        const cardW = 440;
        const cardH = 380;
        const gap = 48;
        const totalW = cardW * 2 + gap;
        const startX = centerX - totalW / 2 + cardW / 2;
        const cardY = height / 2 + 40;

        REGION_CARDS.forEach((data, i) => {
            const x = startX + i * (cardW + gap);
            const card = this.buildCard(x, cardY, cardW, cardH, data, i);
            card.setAlpha(0);
            this.cards = [...this.cards, card];
        });

        this.updateCardSelection();

        const hint = this.add.text(centerX, height - 48,
            'Arrow keys or click to choose  ·  Enter to begin', {
                fontFamily: '"Crimson Text", Georgia, serif',
                fontSize: '14px',
                color: '#8a7a6a',
                align: 'center',
                fontStyle: 'italic',
            }).setOrigin(0.5);
        hint.setAlpha(0);

        // Animated fade-in cascade
        this.tweens.add({ targets: heading, alpha: 1, duration: 800, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: sub, alpha: 0.9, duration: 800, delay: 200, ease: 'Quad.easeOut' });
        this.cards.forEach((card, i) => {
            this.tweens.add({
                targets: card,
                alpha: 1,
                duration: 700,
                delay: 400 + i * 150,
                ease: 'Quad.easeOut',
            });
        });
        this.tweens.add({
            targets: hint,
            alpha: 0.9,
            duration: 800,
            delay: 900,
            ease: 'Quad.easeOut',
        });

        // Particle haze for atmospheric continuity with TitleScene
        this.particles = Array.from({ length: 24 }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            speed: 0.2 + Math.random() * 0.5,
            alpha: 0.08 + Math.random() * 0.22,
            size: 1 + Math.random() * 2,
        }));
        this.particleGraphics = this.add.graphics();

        // Unlock input after the cards have finished fading in
        this.time.delayedCall(900, () => {
            this.inputLocked = false;
        });

        // Keyboard navigation
        this.input.keyboard?.on('keydown-LEFT', () => this.moveSelection(-1));
        this.input.keyboard?.on('keydown-RIGHT', () => this.moveSelection(1));
        this.input.keyboard?.on('keydown-A', () => this.moveSelection(-1));
        this.input.keyboard?.on('keydown-D', () => this.moveSelection(1));
        this.input.keyboard?.on('keydown-ENTER', () => this.confirmSelection());
        this.input.keyboard?.on('keydown-SPACE', () => this.confirmSelection());

        this.cameras.main.fadeIn(500, 10, 6, 3);
    }

    update(): void {
        const { width, height } = this.cameras.main;
        if (!this.particleGraphics) return;
        this.particleGraphics.clear();

        this.particles = this.particles.map(p => {
            const newY = p.y - p.speed;
            return {
                ...p,
                y: newY < -10 ? height + 10 : newY,
                x: p.x + Math.sin(p.y * 0.01) * 0.3,
            };
        });

        this.particles.forEach(p => {
            this.particleGraphics.fillStyle(0xe8c170, p.alpha);
            this.particleGraphics.fillCircle(p.x % width, p.y, p.size);
        });
    }

    private drawBackground(width: number, height: number): void {
        const bg = this.add.graphics();
        for (let y = 0; y < height; y++) {
            const t = y / height;
            const r = Math.floor(15 + t * 20);
            const g = Math.floor(8 + t * 15);
            const b = Math.floor(5 + t * 10);
            bg.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 1);
            bg.fillRect(0, y, width, 1);
        }

        const dots = this.add.graphics();
        dots.fillStyle(0xe8c170, 0.06);
        for (let row = 0; row < height; row += 30) {
            for (let col = 0; col < width; col += 30) {
                const offset = (row / 30) % 2 === 0 ? 15 : 0;
                dots.fillCircle(col + offset, row, 2);
            }
        }
    }

    private buildCard(
        x: number,
        y: number,
        w: number,
        h: number,
        data: RegionCardData,
        index: number,
    ): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);

        const bg = this.add.graphics();
        const border = this.add.graphics();
        container.add(bg);
        container.add(border);

        const title = this.add.text(0, -h / 2 + 56, data.title, {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '40px',
            color: '#e8c170',
            align: 'center',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        container.add(title);

        const subtitle = this.add.text(0, -h / 2 + 108, data.subtitle, {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '16px',
            color: '#a0886a',
            align: 'center',
            fontStyle: 'italic',
        }).setOrigin(0.5);
        container.add(subtitle);

        const description = this.add.text(0, -h / 2 + 160, data.description, {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '17px',
            color: '#d4c5b2',
            align: 'center',
            wordWrap: { width: w - 60 },
            lineSpacing: 6,
        }).setOrigin(0.5, 0);
        container.add(description);

        // Decorative motif — concentric circles in the accent color
        const motif = this.add.graphics();
        const motifY = h / 2 - 80;
        for (let i = 4; i > 0; i--) {
            motif.lineStyle(2, data.accentColor, 0.15 + i * 0.08);
            motif.strokeCircle(0, motifY, i * 10);
        }
        motif.fillStyle(data.accentColor, 0.6);
        motif.fillCircle(0, motifY, 4);
        container.add(motif);

        // Save background refs on the container for selection redraw
        container.setData('bg', bg);
        container.setData('border', border);
        container.setData('w', w);
        container.setData('h', h);
        container.setData('accentColor', data.accentColor);
        container.setData('region', data.region);
        container.setData('index', index);

        // Click-to-select (single press selects and confirms)
        const hitArea = new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h);
        container.setSize(w, h);
        container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
        container.on('pointerover', () => {
            if (this.inputLocked) return;
            this.selectedIndex = index;
            this.updateCardSelection();
        });
        container.on('pointerdown', () => {
            if (this.inputLocked) return;
            this.selectedIndex = index;
            this.updateCardSelection();
            this.confirmSelection();
        });

        return container;
    }

    private updateCardSelection(): void {
        this.cards.forEach((card, i) => {
            const bg = card.getData('bg') as Phaser.GameObjects.Graphics;
            const border = card.getData('border') as Phaser.GameObjects.Graphics;
            const w = card.getData('w') as number;
            const h = card.getData('h') as number;
            const accent = card.getData('accentColor') as number;

            bg.clear();
            border.clear();

            const selected = i === this.selectedIndex;

            bg.fillStyle(0x1a1210, selected ? 0.9 : 0.7);
            bg.fillRoundedRect(-w / 2, -h / 2, w, h, 14);

            border.lineStyle(selected ? 3 : 1.5, accent, selected ? 0.85 : 0.35);
            border.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);

            if (selected) {
                // Inner glow frame
                border.lineStyle(1, accent, 0.3);
                border.strokeRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 10);
            }

            this.tweens.add({
                targets: card,
                scale: selected ? 1.03 : 1,
                duration: 250,
                ease: 'Quad.easeOut',
            });
        });
    }

    private moveSelection(delta: number): void {
        if (this.inputLocked) return;
        const next = (this.selectedIndex + delta + this.cards.length) % this.cards.length;
        if (next === this.selectedIndex) return;
        this.selectedIndex = next;
        this.updateCardSelection();
    }

    private confirmSelection(): void {
        if (this.inputLocked) return;
        this.inputLocked = true;
        const card = this.cards[this.selectedIndex];
        const region = card.getData('region') as Region;

        this.cameras.main.fadeOut(600, 10, 6, 3);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('PreloadScene', { region });
        });
    }
}
