import { Physics, Scene } from 'phaser';
import { CONSTANTS } from '../types';

export const PLAYER_EVENTS = {
    STEP: 'player-step',
} as const;

export class Player extends Physics.Arcade.Sprite {
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
    private shiftKey!: Phaser.Input.Keyboard.Key;
    private stepAccum_ = 0;

    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y, 'player-frame-0');

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(true);
        // Y-sorted depth — see Player.update() for the runtime formula.
        this.setDepth(2 + y * 0.001 + 0.01);

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(28, 28);
        body.setOffset(18, 34);

        if (scene.input.keyboard) {
            this.cursors = scene.input.keyboard.createCursorKeys();
            this.wasd = {
                W: scene.input.keyboard.addKey('W'),
                A: scene.input.keyboard.addKey('A'),
                S: scene.input.keyboard.addKey('S'),
                D: scene.input.keyboard.addKey('D'),
            };
            this.shiftKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        }
    }

    update(): void {
        const isSprinting = this.shiftKey?.isDown ?? false;
        const speed = isSprinting ? CONSTANTS.SPRINT_SPEED : CONSTANTS.PLAYER_SPEED;
        let vx = 0;
        let vy = 0;

        const left = this.cursors?.left.isDown || this.wasd?.A.isDown;
        const right = this.cursors?.right.isDown || this.wasd?.D.isDown;
        const up = this.cursors?.up.isDown || this.wasd?.W.isDown;
        const down = this.cursors?.down.isDown || this.wasd?.S.isDown;

        if (left) vx = -speed;
        else if (right) vx = speed;

        if (up) vy = -speed;
        else if (down) vy = speed;

        // Normalize diagonal movement
        if (vx !== 0 && vy !== 0) {
            vx *= 0.707;
            vy *= 0.707;
        }

        this.setVelocity(vx, vy);

        // Y-sorted depth: 2 (base) + y/1000 + 0.01 tiebreak so the player
        // sits just above trees/fauna/landmarks at the same world Y but
        // still under any foreground grass at that Y.
        this.setDepth(2 + this.y * 0.001 + 0.01);

        if (vx < 0) this.setFlipX(true);
        else if (vx > 0) this.setFlipX(false);

        // Play walk or idle animation
        if (vx !== 0 || vy !== 0) {
            if (this.anims.currentAnim?.key !== 'player-walk') {
                this.play('player-walk', true);
            }
            // Emit step events scaled by speed. 500 units of movement => 1 step.
            const deltaMs = this.scene.game.loop.delta;
            this.stepAccum_ += Math.hypot(vx, vy) * (deltaMs / 1000);
            if (this.stepAccum_ >= 115) {
                this.stepAccum_ = 0;
                this.scene.events.emit(PLAYER_EVENTS.STEP);
            }
        } else {
            this.stepAccum_ = 0;
            if (this.anims.currentAnim?.key !== 'player-idle') {
                this.play('player-idle', true);
            }
        }
    }
}
