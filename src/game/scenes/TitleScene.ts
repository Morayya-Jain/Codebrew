import { Scene } from 'phaser';

export class TitleScene extends Scene {
    private particles: Array<{ x: number; y: number; speed: number; alpha: number; size: number }> = [];
    private particleGraphics!: Phaser.GameObjects.Graphics;

    constructor() {
        super('TitleScene');
    }

    create(): void {
        const { width, height } = this.cameras.main;
        const centerX = width / 2;

        // Background gradient
        const bg = this.add.graphics();
        for (let y = 0; y < height; y++) {
            const t = y / height;
            const r = Math.floor(15 + t * 20);
            const g = Math.floor(8 + t * 15);
            const b = Math.floor(5 + t * 10);
            bg.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 1);
            bg.fillRect(0, y, width, 1);
        }

        // Decorative dot pattern (Aboriginal art inspired)
        const dots = this.add.graphics();
        dots.fillStyle(0xe8c170, 0.08);
        for (let row = 0; row < height; row += 30) {
            for (let col = 0; col < width; col += 30) {
                const offset = (row / 30) % 2 === 0 ? 15 : 0;
                dots.fillCircle(col + offset, row, 2);
            }
        }

        // Concentric circle pattern (central motif)
        const motif = this.add.graphics();
        const rings = [180, 150, 120, 90, 60, 30];
        rings.forEach((radius, i) => {
            motif.lineStyle(2, 0xe8c170, 0.06 + i * 0.02);
            motif.strokeCircle(centerX, height / 2 - 20, radius);

            // Dots on the ring
            motif.fillStyle(0xe8c170, 0.08 + i * 0.03);
            const dotCount = Math.floor(radius * 0.2);
            for (let d = 0; d < dotCount; d++) {
                const angle = (d / dotCount) * Math.PI * 2;
                motif.fillCircle(
                    centerX + Math.cos(angle) * radius,
                    height / 2 - 20 + Math.sin(angle) * radius,
                    2
                );
            }
        });

        // Title - larger, slower fade-in for reverent museum pacing.
        const title = this.add.text(centerX, height / 2 - 110, 'Walking Through\nCountry', {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '58px',
            color: '#e8c170',
            align: 'center',
            lineSpacing: 10,
            fontStyle: 'bold',
        }).setOrigin(0.5);
        title.setAlpha(0);

        // Subtitle - positioned beneath the concentric motif.
        const subtitle = this.add.text(centerX, height / 2 + 20, 'An invitation to Country', {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '22px',
            color: '#a0886a',
            align: 'center',
            fontStyle: 'italic',
        }).setOrigin(0.5);
        subtitle.setAlpha(0);

        // Region text
        const region = this.add.text(centerX, height / 2 + 55, 'Victoria  \u2022  Aboriginal Australia', {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '16px',
            color: '#8a7a6a',
            align: 'center',
        }).setOrigin(0.5);
        region.setAlpha(0);

        // Acknowledgement block - larger type, more weight, sits well above
        // the bottom edge so it reads as the centrepiece it deserves to be.
        const ackHeading = this.add.text(centerX, height - 120,
            'Acknowledgement of Country', {
                fontFamily: '"Crimson Text", Georgia, serif',
                fontSize: '14px',
                color: '#8a7a6a',
                align: 'center',
                fontStyle: 'italic',
            }).setOrigin(0.5);
        ackHeading.setAlpha(0);

        const ack = this.add.text(centerX, height - 86,
            'We acknowledge the Traditional Owners of the land and pay respect\nto Elders past, present, and emerging.', {
                fontFamily: '"Crimson Text", Georgia, serif',
                fontSize: '15px',
                color: '#a8988a',
                align: 'center',
                lineSpacing: 4,
                wordWrap: { width: width - 80 },
            }).setOrigin(0.5);
        ack.setAlpha(0);

        // Start prompt - moved to the bottom, smaller, less insistent.
        const startText = this.add.text(centerX, height - 32, 'Press any key or touch to begin', {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '13px',
            color: '#8a7a6a',
            align: 'center',
            fontStyle: 'italic',
        }).setOrigin(0.5);
        startText.setAlpha(0);

        // Animate elements in with reverent timing. Total fade-in sequence
        // runs to ~4.5s (2000ms title + 2500ms worth of cascading delays).
        this.tweens.add({ targets: title, alpha: 1, duration: 2000, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: subtitle, alpha: 0.9, duration: 1400, delay: 1000, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: region, alpha: 0.7, duration: 1200, delay: 1400, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: ackHeading, alpha: 0.8, duration: 1200, delay: 2200, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: ack, alpha: 0.85, duration: 1400, delay: 2600, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: startText, alpha: 0.9, duration: 1000, delay: 4200, ease: 'Quad.easeOut' });

        // Pulsing start text - slower and gentler than before.
        this.tweens.add({
            targets: startText,
            alpha: 0.35,
            duration: 1800,
            delay: 5200,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
        });

        // Floating particles
        this.particles = Array.from({ length: 30 }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            speed: 0.2 + Math.random() * 0.5,
            alpha: 0.1 + Math.random() * 0.3,
            size: 1 + Math.random() * 2,
        }));
        this.particleGraphics = this.add.graphics();

        // Reverent pacing: 5s input lock so the Acknowledgement of Country
        // has time to fade in fully and be read before the visitor can
        // advance. Museum context favours a slower welcome over quick entry.
        this.time.delayedCall(5000, () => {
            this.input.once('pointerdown', () => this.startGame());
            if (this.input.keyboard) {
                this.input.keyboard.once('keydown', () => this.startGame());
            }
        });
    }

    update(): void {
        const { width, height } = this.cameras.main;
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

    private startGame(): void {
        this.cameras.main.fadeOut(800, 10, 6, 3);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('RegionSelectScene');
        });
    }
}
