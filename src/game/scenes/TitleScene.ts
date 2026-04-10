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

        // Title
        const title = this.add.text(centerX, height / 2 - 80, 'Walking Through\nCountry', {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '56px',
            color: '#e8c170',
            align: 'center',
            lineSpacing: 8,
            fontStyle: 'bold',
        }).setOrigin(0.5);
        title.setAlpha(0);

        // Subtitle
        const subtitle = this.add.text(centerX, height / 2 + 20, 'An exploration of Aboriginal Australian culture', {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '20px',
            color: '#a0886a',
            align: 'center',
            fontStyle: 'italic',
        }).setOrigin(0.5);
        subtitle.setAlpha(0);

        // Region text
        const region = this.add.text(centerX, height / 2 + 55, 'Kulin Nation  \u2022  Victoria', {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '16px',
            color: '#8a7a6a',
            align: 'center',
        }).setOrigin(0.5);
        region.setAlpha(0);

        // Start prompt
        const startText = this.add.text(centerX, height / 2 + 130, 'Press any key or click to begin', {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '18px',
            color: '#e8c170',
            align: 'center',
        }).setOrigin(0.5);
        startText.setAlpha(0);

        // Acknowledgement
        const ack = this.add.text(centerX, height - 40,
            'We acknowledge the Traditional Owners of the land and pay respect to Elders past, present, and emerging.', {
                fontFamily: '"Crimson Text", Georgia, serif',
                fontSize: '13px',
                color: '#6a5a4a',
                align: 'center',
                wordWrap: { width: width - 80 },
            }).setOrigin(0.5);
        ack.setAlpha(0);

        // Animate elements in
        this.tweens.add({ targets: title, alpha: 1, duration: 1200, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: subtitle, alpha: 0.9, duration: 1000, delay: 600, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: region, alpha: 0.7, duration: 1000, delay: 900, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: ack, alpha: 0.8, duration: 1000, delay: 1200, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: startText, alpha: 1, duration: 800, delay: 1800, ease: 'Quad.easeOut' });

        // Pulsing start text
        this.tweens.add({
            targets: startText,
            alpha: 0.4,
            duration: 1200,
            delay: 2600,
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

        // Start on input (delayed to prevent accidental skip)
        this.time.delayedCall(2000, () => {
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
            this.scene.start('PreloadScene');
        });
    }
}
