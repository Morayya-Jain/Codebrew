import { Scene } from 'phaser';

export class BootScene extends Scene {
    constructor() {
        super('BootScene');
    }

    create(): void {
        this.generatePlayerFrames();
        this.generateLandmarkIcons();
        this.scene.start('TitleScene');
    }

    private generatePlayerFrames(): void {
        // Generate 4 individual frame textures for the player walk cycle
        for (let i = 0; i < 4; i++) {
            const gfx = this.add.graphics();
            const bobY = (i % 2 === 0) ? 0 : -3;
            const legOffset = (i % 2 === 0) ? 4 : -4;

            // Shadow
            gfx.fillStyle(0x000000, 0.2);
            gfx.fillEllipse(32, 58, 24, 8);

            // Body (poncho/cloak)
            gfx.fillStyle(0xc47a4a);
            gfx.fillRoundedRect(20, 22 + bobY, 24, 24, 4);

            // Decorative stripe on body
            gfx.fillStyle(0xe8c170, 0.6);
            gfx.fillRect(22, 30 + bobY, 20, 3);
            gfx.fillRect(22, 36 + bobY, 20, 3);

            // Head
            gfx.fillStyle(0x8b6b4a);
            gfx.fillCircle(32, 16 + bobY, 11);

            // Hair
            gfx.fillStyle(0x1a1a1a);
            gfx.fillCircle(32, 12 + bobY, 10);
            gfx.fillRect(22, 12 + bobY, 20, 6);

            // Headband
            gfx.fillStyle(0xd4513a);
            gfx.fillRect(22, 14 + bobY, 20, 3);

            // Face features
            gfx.fillStyle(0x1a1a1a);
            gfx.fillCircle(28, 17 + bobY, 1.5);
            gfx.fillCircle(36, 17 + bobY, 1.5);

            // Legs
            gfx.fillStyle(0x6b4a30);
            gfx.fillRoundedRect(25 + legOffset, 44 + bobY, 6, 14, 2);
            gfx.fillRoundedRect(33 - legOffset, 44 + bobY, 6, 14, 2);

            // Feet
            gfx.fillStyle(0x4a3220);
            gfx.fillEllipse(28 + legOffset, 57 + bobY, 7, 4);
            gfx.fillEllipse(36 - legOffset, 57 + bobY, 7, 4);

            gfx.generateTexture(`player-frame-${i}`, 64, 64);
            gfx.destroy();
        }
    }

    private generateLandmarkIcons(): void {
        const landmarks: ReadonlyArray<{ id: string; color: number }> = [
            { id: 'campfire', color: 0xe8651a },
            { id: 'waterhole', color: 0x1a8fe8 },
            { id: 'rock-art', color: 0xc44b2a },
            { id: 'meeting-place', color: 0x8b5e3c },
            { id: 'bush-tucker', color: 0x4a8c3f },
            { id: 'songline', color: 0x9b59b6 },
        ];

        landmarks.forEach(({ id, color }) => {
            const gfx = this.add.graphics();

            // Outer glow ring
            gfx.fillStyle(color, 0.15);
            gfx.fillCircle(48, 48, 46);

            // Middle ring
            gfx.fillStyle(color, 0.3);
            gfx.fillCircle(48, 48, 36);

            // Main circle
            gfx.fillStyle(color, 0.85);
            gfx.fillCircle(48, 48, 26);

            // Aboriginal dot-art inspired pattern
            gfx.fillStyle(0xffffff, 0.4);
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
                const dx = Math.cos(angle) * 16;
                const dy = Math.sin(angle) * 16;
                gfx.fillCircle(48 + dx, 48 + dy, 3);
            }

            // Center dot
            gfx.fillStyle(0xffffff, 0.7);
            gfx.fillCircle(48, 48, 5);

            gfx.generateTexture(`landmark-${id}`, 96, 96);
            gfx.destroy();
        });
    }
}
