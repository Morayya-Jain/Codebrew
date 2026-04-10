import { Scene } from 'phaser';

export class BootScene extends Scene {
    constructor() {
        super('BootScene');
    }

    create(): void {
        this.generatePlayerFrames();
        this.generateLandmarkIcons();
        this.generateMiniMapBrush();
        this.scene.start('TitleScene');
    }

    private generatePlayerFrames(): void {
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
        const size = 128;
        const cx = size / 2;
        const cy = size / 2;

        this.drawCampfireIcon(cx, cy, size);
        this.drawWaterholeIcon(cx, cy, size);
        this.drawRockArtIcon(cx, cy, size);
        this.drawMeetingPlaceIcon(cx, cy, size);
        this.drawBushTuckerIcon(cx, cy, size);
        this.drawSonglineIcon(cx, cy, size);
        this.drawAncestorTreeIcon(cx, cy, size);
        this.drawGrindingStonesIcon(cx, cy, size);
        this.drawEmuDreamingIcon(cx, cy, size);
        this.drawPossumCloakIcon(cx, cy, size);
    }

    // =========================================================================
    // CAMPFIRE — crossed logs with flames and ember dots
    // =========================================================================
    private drawCampfireIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        // Outer glow
        gfx.fillStyle(0xe8651a, 0.1);
        gfx.fillCircle(cx, cy, 58);

        // Ground shadow
        gfx.fillStyle(0x000000, 0.15);
        gfx.fillEllipse(cx + 4, cy + 14, 60, 28);

        // Ash circle on ground
        gfx.fillStyle(0x2a2018, 0.6);
        gfx.fillEllipse(cx, cy + 8, 56, 26);

        // Crossed logs
        gfx.fillStyle(0x5a3a1a, 0.9);
        // Log 1 (bottom-left to top-right)
        gfx.fillRect(cx - 26, cy + 2, 52, 7);
        // Log 2 (top-left to bottom-right, rotated via two triangles approach)
        gfx.fillRect(cx - 4, cy - 12, 7, 36);

        // Log bark texture
        gfx.fillStyle(0x3a2410, 0.5);
        gfx.fillRect(cx - 20, cy + 4, 8, 3);
        gfx.fillRect(cx + 10, cy + 3, 6, 3);
        gfx.fillRect(cx - 2, cy - 6, 3, 8);

        // Flames — layered triangles
        // Outer flame (red-orange)
        gfx.fillStyle(0xc44010, 0.8);
        gfx.fillTriangle(cx - 14, cy + 2, cx, cy - 30, cx + 14, cy + 2);
        // Mid flame (orange)
        gfx.fillStyle(0xe8651a, 0.85);
        gfx.fillTriangle(cx - 10, cy + 2, cx - 2, cy - 22, cx + 8, cy + 2);
        // Inner flame (yellow)
        gfx.fillStyle(0xf0a030, 0.9);
        gfx.fillTriangle(cx - 5, cy + 2, cx + 2, cy - 14, cx + 7, cy + 2);
        // Core (bright yellow-white)
        gfx.fillStyle(0xf8d070, 0.95);
        gfx.fillTriangle(cx - 2, cy + 2, cx + 1, cy - 8, cx + 4, cy + 2);

        // Side flame wisps
        gfx.fillStyle(0xe8651a, 0.6);
        gfx.fillTriangle(cx + 10, cy + 4, cx + 16, cy - 10, cx + 18, cy + 4);
        gfx.fillTriangle(cx - 12, cy + 4, cx - 16, cy - 8, cx - 8, cy + 4);

        // Ember dots scattered around
        gfx.fillStyle(0xf0a030, 0.7);
        gfx.fillCircle(cx - 18, cy - 8, 1.5);
        gfx.fillCircle(cx + 20, cy - 6, 1.5);
        gfx.fillCircle(cx - 8, cy - 26, 1);
        gfx.fillCircle(cx + 10, cy - 22, 1);
        gfx.fillCircle(cx + 4, cy - 32, 1);
        gfx.fillCircle(cx - 12, cy - 18, 1);

        // Dot-art ring
        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 12; a++) {
            const angle = (a / 12) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-campfire', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // WATERHOLE — isometric oval with depth, ripples, bank
    // =========================================================================
    private drawWaterholeIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        // Outer glow
        gfx.fillStyle(0x1a8fe8, 0.08);
        gfx.fillCircle(cx, cy, 58);

        // Ground/bank shadow
        gfx.fillStyle(0x000000, 0.12);
        gfx.fillEllipse(cx + 3, cy + 6, 72, 44);

        // Outer bank (earth)
        gfx.fillStyle(0x4a3a28, 0.7);
        gfx.fillEllipse(cx, cy + 2, 68, 42);

        // Inner bank ring
        gfx.fillStyle(0x3a2a18, 0.6);
        gfx.fillEllipse(cx, cy + 2, 58, 36);

        // Deep water (dark)
        gfx.fillStyle(0x0a3a5a, 0.85);
        gfx.fillEllipse(cx, cy + 2, 50, 30);

        // Mid water
        gfx.fillStyle(0x1a5a8a, 0.7);
        gfx.fillEllipse(cx - 2, cy, 42, 24);

        // Shallow water / reflection highlight
        gfx.fillStyle(0x2a7aaa, 0.5);
        gfx.fillEllipse(cx - 6, cy - 3, 26, 14);

        // Light reflection spot
        gfx.fillStyle(0x8ac8e8, 0.4);
        gfx.fillEllipse(cx - 10, cy - 5, 12, 6);

        // Ripple arcs
        gfx.lineStyle(1, 0x4a9aba, 0.3);
        gfx.beginPath();
        gfx.arc(cx + 6, cy + 4, 14, -0.5, 1.2);
        gfx.strokePath();

        gfx.lineStyle(1, 0x4a9aba, 0.2);
        gfx.beginPath();
        gfx.arc(cx + 8, cy + 4, 20, -0.3, 0.8);
        gfx.strokePath();

        // Small reeds/plants at edges
        gfx.fillStyle(0x3a6a2a, 0.6);
        gfx.fillEllipse(cx + 28, cy - 4, 6, 10);
        gfx.fillEllipse(cx + 24, cy - 8, 5, 8);
        gfx.fillEllipse(cx - 26, cy + 8, 5, 9);

        // Dot-art ring
        gfx.fillStyle(0x8ac8e8, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-waterhole', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // ROCK ART — tilted rock face with ochre markings
    // =========================================================================
    private drawRockArtIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        // Glow
        gfx.fillStyle(0xc44b2a, 0.08);
        gfx.fillCircle(cx, cy, 58);

        // Shadow
        gfx.fillStyle(0x000000, 0.15);
        gfx.fillEllipse(cx + 5, cy + 20, 56, 18);

        // Rock face — tilted slab (parallelogram via triangles)
        // Back face (darker)
        gfx.fillStyle(0x4a3a30, 0.8);
        gfx.fillTriangle(cx - 24, cy - 28, cx + 28, cy - 32, cx + 32, cy + 16);
        gfx.fillTriangle(cx - 24, cy - 28, cx + 32, cy + 16, cx - 20, cy + 20);

        // Front face (lighter)
        gfx.fillStyle(0x6a5a48, 0.85);
        gfx.fillTriangle(cx - 24, cy - 28, cx + 28, cy - 32, cx + 26, cy + 12);
        gfx.fillTriangle(cx - 24, cy - 28, cx + 26, cy + 12, cx - 22, cy + 16);

        // Rock surface highlight
        gfx.fillStyle(0x7a6a58, 0.4);
        gfx.fillTriangle(cx - 18, cy - 22, cx + 14, cy - 26, cx + 12, cy - 4);
        gfx.fillTriangle(cx - 18, cy - 22, cx + 12, cy - 4, cx - 16, cy + 0);

        // Ochre paintings on rock
        // Hand stencil (simplified)
        gfx.fillStyle(0xc44b2a, 0.8);
        gfx.fillCircle(cx - 4, cy - 10, 5);
        // Fingers
        gfx.fillStyle(0xc44b2a, 0.7);
        gfx.fillRect(cx - 8, cy - 20, 2, 8);
        gfx.fillRect(cx - 5, cy - 22, 2, 9);
        gfx.fillRect(cx - 2, cy - 22, 2, 9);
        gfx.fillRect(cx + 1, cy - 20, 2, 8);

        // Wavy lines (serpent/river)
        gfx.lineStyle(2, 0xd4813a, 0.7);
        gfx.beginPath();
        gfx.moveTo(cx + 6, cy - 6);
        gfx.lineTo(cx + 12, cy - 2);
        gfx.lineTo(cx + 8, cy + 2);
        gfx.lineTo(cx + 14, cy + 6);
        gfx.strokePath();

        // Animal track dots
        gfx.fillStyle(0xe8a050, 0.7);
        gfx.fillCircle(cx - 10, cy + 4, 2);
        gfx.fillCircle(cx - 6, cy + 8, 1.5);
        gfx.fillCircle(cx - 2, cy + 6, 1.5);

        // Concentric circles (sacred site symbol)
        gfx.lineStyle(1.5, 0xc44b2a, 0.6);
        gfx.strokeCircle(cx + 16, cy - 14, 4);
        gfx.strokeCircle(cx + 16, cy - 14, 7);

        // Dot-art accent
        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-rock-art', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // MEETING PLACE — circular ground with seated figures/logs
    // =========================================================================
    private drawMeetingPlaceIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        // Glow
        gfx.fillStyle(0x8b5e3c, 0.08);
        gfx.fillCircle(cx, cy, 58);

        // Ground shadow
        gfx.fillStyle(0x000000, 0.12);
        gfx.fillEllipse(cx + 3, cy + 8, 70, 40);

        // Cleared ground area (isometric ellipse)
        gfx.fillStyle(0x4a3a28, 0.7);
        gfx.fillEllipse(cx, cy + 4, 66, 38);

        // Inner cleared area (lighter)
        gfx.fillStyle(0x5a4a38, 0.6);
        gfx.fillEllipse(cx, cy + 4, 50, 28);

        // Center dance area
        gfx.fillStyle(0x3a2a1a, 0.5);
        gfx.fillEllipse(cx, cy + 4, 28, 16);

        // Seated figures/logs around perimeter
        const seats = [
            { angle: 0, dist: 24 }, { angle: Math.PI * 0.33, dist: 22 },
            { angle: Math.PI * 0.67, dist: 24 }, { angle: Math.PI, dist: 22 },
            { angle: Math.PI * 1.33, dist: 24 }, { angle: Math.PI * 1.67, dist: 22 },
        ];
        seats.forEach(({ angle, dist }) => {
            const sx = cx + Math.cos(angle) * dist;
            const sy = cy + 4 + Math.sin(angle) * dist * 0.58;
            // Log seat
            gfx.fillStyle(0x5a3a20, 0.7);
            gfx.fillEllipse(sx, sy, 10, 5);
            // Small figure silhouette
            gfx.fillStyle(0x3a2a1a, 0.6);
            gfx.fillCircle(sx, sy - 4, 3);
        });

        // Footprint patterns on ground
        gfx.fillStyle(0x6a5a48, 0.3);
        gfx.fillCircle(cx - 6, cy + 2, 1.5);
        gfx.fillCircle(cx + 4, cy + 6, 1.5);
        gfx.fillCircle(cx - 2, cy + 8, 1.5);

        // Dot-art ring
        gfx.fillStyle(0xe8c170, 0.15);
        for (let a = 0; a < 16; a++) {
            const angle = (a / 16) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 38, cy + 4 + Math.sin(angle) * 22, 1.5);
        }

        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-meeting-place', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // BUSH TUCKER — bushy shrub with berries
    // =========================================================================
    private drawBushTuckerIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        // Glow
        gfx.fillStyle(0x4a8c3f, 0.08);
        gfx.fillCircle(cx, cy, 58);

        // Shadow
        gfx.fillStyle(0x000000, 0.12);
        gfx.fillEllipse(cx + 5, cy + 16, 54, 22);

        // Trunk/stem
        gfx.fillStyle(0x4a3220, 0.8);
        gfx.fillRoundedRect(cx - 3, cy + 4, 6, 18, 2);

        // Bush canopy layers (multiple overlapping circles for organic shape)
        // Back leaves (darker)
        gfx.fillStyle(0x2a4a1a, 0.8);
        gfx.fillCircle(cx - 14, cy - 6, 14);
        gfx.fillCircle(cx + 14, cy - 4, 13);
        gfx.fillCircle(cx, cy - 16, 15);

        // Mid leaves
        gfx.fillStyle(0x3a6a2a, 0.8);
        gfx.fillCircle(cx - 8, cy - 10, 13);
        gfx.fillCircle(cx + 10, cy - 8, 12);
        gfx.fillCircle(cx + 2, cy - 4, 14);

        // Front leaves (lighter, highlight)
        gfx.fillStyle(0x4a8a3a, 0.6);
        gfx.fillCircle(cx - 10, cy - 14, 8);
        gfx.fillCircle(cx + 6, cy - 16, 7);

        // Berries (red/yellow dots)
        gfx.fillStyle(0xc43030, 0.85);
        gfx.fillCircle(cx - 16, cy - 2, 3);
        gfx.fillCircle(cx + 12, cy + 0, 2.5);
        gfx.fillCircle(cx - 4, cy - 20, 2.5);
        gfx.fillCircle(cx + 18, cy - 8, 2);

        gfx.fillStyle(0xe8b030, 0.8);
        gfx.fillCircle(cx - 8, cy - 22, 2);
        gfx.fillCircle(cx + 8, cy + 2, 2.5);
        gfx.fillCircle(cx - 18, cy - 10, 2);

        // Small flowers
        gfx.fillStyle(0xf0e060, 0.7);
        gfx.fillCircle(cx + 16, cy - 14, 2);
        gfx.fillCircle(cx - 12, cy - 18, 1.5);

        // Ground herbs/grass at base
        gfx.fillStyle(0x3a5a2a, 0.5);
        gfx.fillEllipse(cx - 10, cy + 14, 8, 4);
        gfx.fillEllipse(cx + 8, cy + 12, 7, 3);

        // Dot-art ring
        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-bush-tucker', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // SONGLINE — winding path with dot-art trail
    // =========================================================================
    private drawSonglineIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        // Glow
        gfx.fillStyle(0x9b59b6, 0.08);
        gfx.fillCircle(cx, cy, 58);

        // Ground shadow
        gfx.fillStyle(0x000000, 0.1);
        gfx.fillEllipse(cx + 3, cy + 4, 60, 50);

        // Winding path base (earth tone)
        gfx.lineStyle(10, 0x4a3a28, 0.5);
        gfx.beginPath();
        gfx.moveTo(cx - 36, cy + 20);
        gfx.lineTo(cx - 20, cy + 8);
        gfx.lineTo(cx - 8, cy - 4);
        gfx.lineTo(cx + 4, cy - 14);
        gfx.lineTo(cx + 16, cy - 8);
        gfx.lineTo(cx + 28, cy - 18);
        gfx.lineTo(cx + 38, cy - 26);
        gfx.strokePath();

        // Path inner line (lighter)
        gfx.lineStyle(5, 0x6a5a48, 0.4);
        gfx.beginPath();
        gfx.moveTo(cx - 36, cy + 20);
        gfx.lineTo(cx - 20, cy + 8);
        gfx.lineTo(cx - 8, cy - 4);
        gfx.lineTo(cx + 4, cy - 14);
        gfx.lineTo(cx + 16, cy - 8);
        gfx.lineTo(cx + 28, cy - 18);
        gfx.lineTo(cx + 38, cy - 26);
        gfx.strokePath();

        // Dot-art trail along path (the traditional songline depiction)
        const pathPoints = [
            { x: cx - 36, y: cy + 20 }, { x: cx - 20, y: cy + 8 },
            { x: cx - 8, y: cy - 4 }, { x: cx + 4, y: cy - 14 },
            { x: cx + 16, y: cy - 8 }, { x: cx + 28, y: cy - 18 },
            { x: cx + 38, y: cy - 26 },
        ];

        // Main trail dots (purple-tinted)
        gfx.fillStyle(0x9b59b6, 0.7);
        for (let i = 0; i < pathPoints.length - 1; i++) {
            const p1 = pathPoints[i];
            const p2 = pathPoints[i + 1];
            for (let t = 0; t < 1; t += 0.25) {
                const x = p1.x + (p2.x - p1.x) * t;
                const y = p1.y + (p2.y - p1.y) * t;
                gfx.fillCircle(x, y, 2.5);
            }
        }

        // Surrounding spirit dots (smaller, fading outward)
        gfx.fillStyle(0xb07ad0, 0.4);
        for (let i = 0; i < pathPoints.length; i++) {
            const p = pathPoints[i];
            for (let a = 0; a < 4; a++) {
                const angle = (a / 4) * Math.PI * 2 + i * 0.8;
                gfx.fillCircle(p.x + Math.cos(angle) * 10, p.y + Math.sin(angle) * 10, 1.5);
            }
        }

        // Wavy energy lines emanating from path
        gfx.lineStyle(1, 0x9b59b6, 0.3);
        gfx.beginPath();
        gfx.moveTo(cx - 14, cy + 16);
        gfx.lineTo(cx - 18, cy + 24);
        gfx.lineTo(cx - 12, cy + 30);
        gfx.strokePath();

        gfx.beginPath();
        gfx.moveTo(cx + 20, cy - 2);
        gfx.lineTo(cx + 26, cy + 6);
        gfx.lineTo(cx + 22, cy + 14);
        gfx.strokePath();

        // Concentric circles at key points (sacred sites along songline)
        gfx.lineStyle(1, 0xe8c170, 0.4);
        gfx.strokeCircle(cx - 8, cy - 4, 6);
        gfx.strokeCircle(cx - 8, cy - 4, 10);
        gfx.strokeCircle(cx + 16, cy - 8, 5);
        gfx.strokeCircle(cx + 16, cy - 8, 9);

        // Outer dot ring
        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-songline', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // ANCESTOR TREE — tree trunk with scar mark + canopy
    // =========================================================================
    private drawAncestorTreeIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        // Glow
        gfx.fillStyle(0x6b4226, 0.08);
        gfx.fillCircle(cx, cy, 58);

        // Shadow
        gfx.fillStyle(0x000000, 0.15);
        gfx.fillEllipse(cx + 6, cy + 18, 48, 20);

        // Trunk
        gfx.fillStyle(0x4a3018, 0.9);
        gfx.fillRoundedRect(cx - 10, cy - 16, 20, 40, 4);

        // Bark texture lines
        gfx.lineStyle(1, 0x3a2010, 0.5);
        gfx.beginPath();
        gfx.moveTo(cx - 6, cy - 12); gfx.lineTo(cx - 5, cy + 16);
        gfx.strokePath();
        gfx.beginPath();
        gfx.moveTo(cx + 4, cy - 10); gfx.lineTo(cx + 5, cy + 18);
        gfx.strokePath();
        gfx.beginPath();
        gfx.moveTo(cx - 2, cy - 14); gfx.lineTo(cx - 1, cy + 20);
        gfx.strokePath();

        // Scar mark (lighter oval cut into trunk)
        gfx.fillStyle(0x8a7a5a, 0.8);
        gfx.fillEllipse(cx, cy, 10, 18);

        // Inner scar (raw wood color)
        gfx.fillStyle(0xb0a070, 0.7);
        gfx.fillEllipse(cx, cy, 7, 14);

        // Scar edge line
        gfx.lineStyle(1.5, 0x5a4a30, 0.6);
        gfx.strokeEllipse(cx, cy, 10, 18);

        // Canopy above (multiple green circles)
        gfx.fillStyle(0x1a3a16, 0.7);
        gfx.fillCircle(cx - 8, cy - 28, 16);
        gfx.fillCircle(cx + 10, cy - 26, 14);
        gfx.fillCircle(cx + 2, cy - 34, 15);

        // Canopy highlight
        gfx.fillStyle(0x2a5a22, 0.5);
        gfx.fillCircle(cx - 10, cy - 32, 9);
        gfx.fillCircle(cx + 4, cy - 38, 8);

        // Branches visible at trunk-canopy junction
        gfx.fillStyle(0x4a3018, 0.6);
        gfx.fillRect(cx - 16, cy - 18, 12, 3);
        gfx.fillRect(cx + 6, cy - 16, 10, 3);

        // Roots at base
        gfx.fillStyle(0x4a3018, 0.5);
        gfx.fillEllipse(cx - 12, cy + 22, 10, 4);
        gfx.fillEllipse(cx + 10, cy + 20, 8, 3);

        // Dot-art ring
        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-ancestor-tree', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // GRINDING STONES — mortar + pestle + scattered seeds
    // =========================================================================
    private drawGrindingStonesIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        // Glow
        gfx.fillStyle(0x7a7a6a, 0.08);
        gfx.fillCircle(cx, cy, 58);

        // Shadow
        gfx.fillStyle(0x000000, 0.15);
        gfx.fillEllipse(cx + 4, cy + 12, 60, 28);

        // Large flat base stone (mortar)
        gfx.fillStyle(0x5a5a4a, 0.85);
        gfx.fillEllipse(cx, cy + 6, 52, 28);

        // Base stone depth (darker bottom edge)
        gfx.fillStyle(0x3a3a2a, 0.6);
        gfx.fillEllipse(cx, cy + 12, 52, 16);

        // Base stone top surface (lighter)
        gfx.fillStyle(0x6a6a5a, 0.7);
        gfx.fillEllipse(cx, cy + 2, 46, 22);

        // Grinding groove worn into stone
        gfx.fillStyle(0x4a4a3a, 0.6);
        gfx.fillEllipse(cx - 2, cy + 2, 28, 12);

        // Groove highlight (smooth worn surface)
        gfx.fillStyle(0x7a7a6a, 0.4);
        gfx.fillEllipse(cx - 6, cy, 16, 7);

        // Pestle stone (smaller, on top)
        gfx.fillStyle(0x5a5a4a, 0.9);
        gfx.fillEllipse(cx + 8, cy - 6, 20, 10);

        // Pestle highlight
        gfx.fillStyle(0x8a8a7a, 0.5);
        gfx.fillEllipse(cx + 5, cy - 8, 12, 5);

        // Pestle shadow on mortar
        gfx.fillStyle(0x000000, 0.1);
        gfx.fillEllipse(cx + 8, cy, 18, 6);

        // Scattered seeds around
        gfx.fillStyle(0x8a7a4a, 0.7);
        gfx.fillCircle(cx - 28, cy + 2, 1.5);
        gfx.fillCircle(cx - 24, cy - 4, 1);
        gfx.fillCircle(cx + 26, cy + 8, 1.5);
        gfx.fillCircle(cx - 20, cy + 10, 1);
        gfx.fillCircle(cx + 22, cy - 2, 1);

        // Ochre powder traces (reddish)
        gfx.fillStyle(0xc46030, 0.3);
        gfx.fillCircle(cx - 14, cy + 4, 3);
        gfx.fillCircle(cx + 14, cy + 6, 2);

        // Flour/seed dust
        gfx.fillStyle(0xd0c8a0, 0.25);
        gfx.fillEllipse(cx - 4, cy + 16, 16, 6);

        // Dot-art ring
        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-grinding-stones', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // EMU DREAMING — three-toed footprint + trailing prints
    // =========================================================================
    private drawEmuDreamingIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        // Glow
        gfx.fillStyle(0x8b6b3a, 0.08);
        gfx.fillCircle(cx, cy, 58);

        // Ground base
        gfx.fillStyle(0x3a2a1a, 0.3);
        gfx.fillEllipse(cx, cy + 4, 64, 50);

        // Main large footprint — three toes
        const drawEmuFoot = (fx: number, fy: number, scale: number, alpha: number) => {
            // Center pad
            gfx.fillStyle(0x8b6b3a, alpha);
            gfx.fillCircle(fx, fy, 5 * scale);

            // Three toes (forward-pointing, slight splay)
            // Left toe
            gfx.fillStyle(0x8b6b3a, alpha);
            gfx.fillEllipse(fx - 8 * scale, fy - 16 * scale, 5 * scale, 14 * scale);
            // Center toe (longest)
            gfx.fillEllipse(fx, fy - 20 * scale, 5 * scale, 16 * scale);
            // Right toe
            gfx.fillEllipse(fx + 8 * scale, fy - 16 * scale, 5 * scale, 14 * scale);

            // Toe tips (claws)
            gfx.fillStyle(0x6a4a2a, alpha * 0.8);
            gfx.fillCircle(fx - 8 * scale, fy - 22 * scale, 2 * scale);
            gfx.fillCircle(fx, fy - 27 * scale, 2 * scale);
            gfx.fillCircle(fx + 8 * scale, fy - 22 * scale, 2 * scale);
        };

        // Main footprint (large, center)
        drawEmuFoot(cx - 4, cy + 8, 1.6, 0.85);

        // Trailing smaller footprints
        drawEmuFoot(cx + 16, cy - 18, 0.8, 0.5);
        drawEmuFoot(cx - 14, cy - 30, 0.6, 0.35);

        // Dreaming energy dots around main footprint
        gfx.fillStyle(0xb08a50, 0.5);
        for (let a = 0; a < 8; a++) {
            const angle = (a / 8) * Math.PI * 2;
            gfx.fillCircle(cx - 4 + Math.cos(angle) * 28, cy + 8 + Math.sin(angle) * 28, 2);
        }

        // Outer spirit dots
        gfx.fillStyle(0xb08a50, 0.3);
        for (let a = 0; a < 12; a++) {
            const angle = (a / 12) * Math.PI * 2;
            gfx.fillCircle(cx - 4 + Math.cos(angle) * 38, cy + 4 + Math.sin(angle) * 38, 1.5);
        }

        // Dot-art ring
        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-emu-dreaming', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // POSSUM SKIN CLOAK — draped cloak shape with panel markings
    // =========================================================================
    private drawPossumCloakIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        // Glow
        gfx.fillStyle(0x5a4a3a, 0.08);
        gfx.fillCircle(cx, cy, 58);

        // Shadow
        gfx.fillStyle(0x000000, 0.15);
        gfx.fillEllipse(cx + 4, cy + 18, 50, 18);

        // Cloak shape — draped trapezoid (wider at shoulders, narrower at bottom)
        // Back/darker layer
        gfx.fillStyle(0x3a2a1a, 0.8);
        gfx.fillTriangle(cx - 26, cy - 24, cx + 26, cy - 24, cx + 20, cy + 22);
        gfx.fillTriangle(cx - 26, cy - 24, cx + 20, cy + 22, cx - 20, cy + 22);

        // Main cloak surface
        gfx.fillStyle(0x5a4a3a, 0.9);
        gfx.fillTriangle(cx - 24, cy - 22, cx + 24, cy - 22, cx + 18, cy + 20);
        gfx.fillTriangle(cx - 24, cy - 22, cx + 18, cy + 20, cx - 18, cy + 20);

        // Fur texture highlight (top/left = lighter)
        gfx.fillStyle(0x7a6a5a, 0.4);
        gfx.fillTriangle(cx - 20, cy - 18, cx + 10, cy - 18, cx + 4, cy + 2);
        gfx.fillTriangle(cx - 20, cy - 18, cx + 4, cy + 2, cx - 16, cy + 2);

        // Panel dividing lines (etched patterns)
        gfx.lineStyle(1.5, 0x3a2a1a, 0.6);
        // Horizontal panels
        gfx.beginPath();
        gfx.moveTo(cx - 22, cy - 8); gfx.lineTo(cx + 20, cy - 8);
        gfx.strokePath();
        gfx.beginPath();
        gfx.moveTo(cx - 20, cy + 6); gfx.lineTo(cx + 18, cy + 6);
        gfx.strokePath();
        // Vertical panels
        gfx.beginPath();
        gfx.moveTo(cx - 6, cy - 22); gfx.lineTo(cx - 4, cy + 20);
        gfx.strokePath();
        gfx.beginPath();
        gfx.moveTo(cx + 8, cy - 22); gfx.lineTo(cx + 10, cy + 20);
        gfx.strokePath();

        // Decorative dots in panels (clan markings)
        gfx.fillStyle(0xe8c170, 0.5);
        // Top-left panel
        gfx.fillCircle(cx - 14, cy - 16, 2);
        // Top-center panel
        gfx.fillCircle(cx + 2, cy - 16, 2);
        // Mid-left panel
        gfx.fillCircle(cx - 14, cy - 2, 1.5);
        gfx.fillCircle(cx - 12, cy + 2, 1.5);
        // Mid-center panel — concentric circles (totem)
        gfx.lineStyle(1, 0xe8c170, 0.45);
        gfx.strokeCircle(cx + 2, cy - 1, 3);
        gfx.strokeCircle(cx + 2, cy - 1, 6);
        // Bottom panels
        gfx.fillStyle(0xe8c170, 0.4);
        gfx.fillCircle(cx - 12, cy + 12, 1.5);
        gfx.fillCircle(cx + 4, cy + 12, 1.5);
        gfx.fillCircle(cx + 14, cy + 10, 1.5);

        // Shoulder/collar line
        gfx.lineStyle(2, 0x4a3a2a, 0.7);
        gfx.beginPath();
        gfx.moveTo(cx - 24, cy - 22);
        gfx.lineTo(cx, cy - 26);
        gfx.lineTo(cx + 24, cy - 22);
        gfx.strokePath();

        // Outer dot ring
        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-possum-cloak', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // MINI-MAP BRUSH — radial gradient for fog reveal
    // =========================================================================
    private generateMiniMapBrush(): void {
        const gfx = this.add.graphics();
        const brushSize = 40;
        const center = brushSize / 2;

        for (let r = center; r > 0; r -= 1) {
            const alpha = r / center;
            gfx.fillStyle(0xffffff, alpha);
            gfx.fillCircle(center, center, r);
        }

        gfx.generateTexture('minimap-reveal-brush', brushSize, brushSize);
        gfx.destroy();
    }
}
