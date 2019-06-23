var time = 0;

var DistortPipeline = new Phaser.Class({
    Extends: Phaser.Renderer.WebGL.Pipelines.TextureTintPipeline,
    initialize:
    function DistortPipeline (game)
    {
        Phaser.Renderer.WebGL.Pipelines.TextureTintPipeline.call(this, {
            game: game,
            renderer: game.renderer,
            fragShader: `
            precision mediump float;
            uniform float     time;
            uniform vec2      resolution;
            uniform sampler2D uMainSampler;
            varying vec2 outTexCoord;
            void main( void ) {
                vec2 uv = outTexCoord;
                // uv.y *= -1.0;
                uv.y += (sin((uv.x + (time * 0.5)) * 10.0) * 0.1) + (sin((uv.x + (time * 0.2)) * 32.0) * 0.01);
                vec4 texColor = texture2D(uMainSampler, uv);
                gl_FragColor = texColor;
            }`
        });
    }
});

var LSDPipeline = new Phaser.Class({
    Extends: Phaser.Renderer.WebGL.Pipelines.TextureTintPipeline,
    initialize:
    function LSDPipeline (game)
    {
        Phaser.Renderer.WebGL.Pipelines.TextureTintPipeline.call(this, {
            game: game,
            renderer: game.renderer,
            fragShader: `
            precision mediump float;

            uniform sampler2D uMainSampler;
            uniform vec2 uResolution;
            uniform float uTime;

            varying vec2 outTexCoord;
            varying vec4 outTint;

            vec4 plasma()
            {
                // vec2 pixelPos = gl_FragCoord.xy / uResolution * 15.0;
                vec2 pixelPos = gl_FragCoord.xy / uResolution * 20.0;
                float freq = 0.8;
                float value =
                    sin(uTime + pixelPos.x * freq) +
                    sin(uTime + pixelPos.y * freq) +
                    sin(uTime + (pixelPos.x + pixelPos.y) * freq) +
                    cos(uTime + sqrt(length(pixelPos - 0.5)) * freq * 2.0);

                return vec4(
                    cos(value),
                    sin(value),
                    sin(value * 3.14 * 2.0),
                    cos(value)
                );
            }
            void main() 
            {
                vec4 texel = texture2D(uMainSampler, outTexCoord);
                texel *= vec4(outTint.rgb * outTint.a, outTint.a);
                gl_FragColor = texel * plasma();
            }
            `
        });
    }
});

const defaultAmbientColor = 0x666666;
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 1000 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

var player;
var polices;
var police_number = 0;
var drugs;
var new_drugs_apply_effect_with_this_very_long_variable = false;
var laser;
var platforms;
var cursors;
var score = 0;
var gameOver = false;
var scoreText;
var turn_left = false;
var digging = false;
var lights;

var game = new Phaser.Game(config);

const specialDrugsList = [
    {
        sprite: 'mdma',
        effect: () => {
            player.speed += 120;
            setTimeout(() => {
                player.speed -= 120;
                lights.setAmbientColor(defaultAmbientColor);
            }, 10000);
            lights.setAmbientColor(0x0066cc);
            console.log("MDMA taken");
        },
        score: 30,
    },
    {
        sprite: 'lsd',
        effect: function() {
            console.log("LSD taken");
            player.effect = 'lsd';

            player.body.setAllowGravity(false);
            this.backgroundlayer.setPipeline("lsd");
            setTimeout(() => {
                player.effect = undefined;
                player.body.setAllowGravity(true);
                this.backgroundlayer.resetPipeline();
            }, 8000);
        },
        score: 40,
    },
    {
        sprite: 'cannabis',
        effect: () => {
            player.effect = 'cannabis';
            player.speed -= 100;
            setTimeout(() => {
                player.effect = undefined;
                player.speed += 100
                lights.setAmbientColor(defaultAmbientColor);
            }, 10000)
            lights.setAmbientColor(0x33ff99);

            console.log("CANNABIS taken");
        },
        score: 20,
    },
    {
        sprite: 'cactus',
        effect: () => {
            // this.add.image(800, 600, 'god');
        },
        score: 120,
    },
    {
        sprite: 'amanite',
        effect: function() {
            console.log("AMANITE TUE MOUCHE taken")

            player.setPipeline("distort");
            drugs.children.entries.forEach((drug) => {
                drug.setPipeline("distort");
            });
            new_drugs_apply_effect_with_this_very_long_variable = true;
            setTimeout(() => {
                player.resetPipeline();
                drugs.children.entries.forEach((drug) => {
                    drug.resetPipeline();
                });
                new_drugs_apply_effect_with_this_very_long_variable = false;
            }, 8000);
        },
        score: -50,
    },
    {
        sprite: 'cocain',
        effect: () => {
            player.speed += 100;
            setTimeout(() => {
                player.speed -= 100;
                lights.setAmbientColor(0x999999);
            }, 3000)
            lights.setAmbientColor(0xe6f2ff);
            player.setVelocityY(-450);
            console.log("COCAïN taken");
        },
        score: 60,
    },
];

const default_drug = {
    sprite: 'default_pill',
    effect: undefined,
    score: 5,
};

function preload() {
    this.load.image("tiles", "assets/platformertiles.png");
    this.load.tilemapTiledJSON("map", "assets/soir_platform.json");
    this.load.image('lsd', 'assets/lsd.png');
    this.load.image('cannabis', 'assets/cannabis.png');
    this.load.image('mdma', 'assets/redbull.png');
    this.load.image('amanite', 'assets/amanite.png');
    this.load.image('cactus', 'assets/cactus.png');
    this.load.image('cocain', 'assets/cocain.png');
    this.load.image('default_pill', 'assets/default_pill.png');
    this.load.image('god', 'assets/god.png');
    this.load.spritesheet('laser', 'assets/lasoir.png', { frameWidth: 800, frameHeight: 200 });
    this.load.spritesheet('dude', 'assets/SoirMole.png', { frameWidth: 38, frameHeight: 25 });

    this.load.spritesheet('police', 'assets/Policemole.png', { frameWidth: 38, frameHeight: 25 });

    this.lsdPipeline = game.renderer.addPipeline('lsd', new LSDPipeline(game));
    this.lsdPipeline.setFloat2('uResolution', game.config.width, game.config.height);

    this.distortPipeline = game.renderer.addPipeline('distort', new DistortPipeline(game));
    this.distortPipeline.setFloat2('resolution', game.config.width, game.config.height);
}

function create() {
    lights = this.lights;
    this.physics.world.setBoundsCollision(true, true, true, true);
    this.map = this.add.tilemap("map");
    var tileset = this.map.addTilesetImage("platformertiles", "tiles");
    this.backgroundlayer = this.map.createStaticLayer("Background", tileset).setPipeline("Light2D");;
    this.groundLayer = this.map.createStaticLayer("Ground", tileset).setPipeline("Light2D");;

    //Before you can use the collide function you need to set what tiles can collide
    this.groundLayer.setCollisionBetween(0, 800);

    // The player and its settings
    player = this.physics.add.sprite(350, 450, 'dude');

    player.setCollideWorldBounds(true);
    player.onWorldBounds = true;

    player.speed = 240;

    this.lights.enable().setAmbientColor(0x666666);
    this.lights.addLight(-100, 100, 1000).setIntensity(2);

    //  Our player animations, turning, walking left and walking right.
    this.anims.create({
        key: 'left',
        frames: this.anims.generateFrameNumbers('dude', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'right',
        frames: this.anims.generateFrameNumbers('dude', { start: 4, end: 7 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'turn_left',
        frames: [{ key: 'dude', frame: 0 }],
        frameRate: 20
    });

    this.anims.create({
        key: 'turn_right',
        frames: [{ key: 'dude', frame: 4 }],
        frameRate: 20
    });

    this.anims.create({
        key: 'ded',
        frames: [{ key: 'dude', frame: 12 }],
        frameRate: 20
    });

    this.anims.create({
        key: 'digging_start',
        frames: this.anims.generateFrameNumbers('dude', { start: 11, end: 15 }),
        frameRate: 10,
    });

    this.anims.create({
        key: 'digging_end',
        frames: this.anims.generateFrameNumbers('dude', { start: 8, end: 11 }),
        frameRate: 10,
    });

    this.anims.create({
        key: 'police_left',
        frames: this.anims.generateFrameNumbers('police', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'police_right',
        frames: this.anims.generateFrameNumbers('police', { start: 4, end: 7 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'laser_shot',
        frames: this.anims.generateFrameNumbers('laser', { start: 1, end: 3 }),
        frameRate: 1,
    })

    //  Input Events
    cursors = this.input.keyboard.createCursorKeys();
    polices = this.physics.add.group();
    drugs = this.physics.add.group();

    laser = this.physics.add.sprite(400, 485, 'laser');
    laser.body.setAllowGravity(false)
    laser.body.enable = false

    //  The score
    scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '32px', fill: '#fff' });

    this.physics.add.collider(polices, this.groundLayer);
    this.physics.add.overlap(player, polices, endGame, null, this);
    this.physics.add.collider(player, this.groundLayer);

    this.physics.add.overlap(polices, laser, destroy2, null, this)
    this.physics.add.overlap(player, drugs, collectDrug, null, this);
    this.physics.add.overlap(player, laser, endGame, null, this)
    this.physics.add.collider(drugs, this.groundLayer, destroy1, null, this);
}

function update() {
    this.lsdPipeline.setFloat1("uTime", time);
    this.distortPipeline.setFloat1("time", time);
    time += 0.1;

    if (gameOver) {
        player.anims.play('ded');
        player.setVelocityX(0);
        if (cursors.space.isDown) {
            location.reload();
        }
        return;
    }

    if (!digging && player.body) {
        if (player.effect === 'lsd' && cursors.down.isDown) {
            player.setVelocityY(player.speed);
        }
        else if (player.effect === 'lsd' && cursors.up.isDown) {
            player.setVelocityY(-player.speed);
        }
        else if (cursors.down.isDown && player.body.blocked.down) {
            dig(player);
        }
        else if (cursors.left.isDown) {
            player.setVelocityX(-player.speed);
            turn_left = true;

            player.anims.play('left', true);
        }
        else if (cursors.right.isDown) {
            player.setVelocityX(player.speed);
            turn_left = false;

            player.anims.play('right', true);
        }
        else {
            if (player.effect === 'lsd') {
                player.setVelocityY(0);
            }
            player.setVelocityX(0);

            if (turn_left) {
                player.anims.play('turn_left');
            } else {
                player.anims.play('turn_right');
            }
        }
         if (cursors.up.isDown && player.body.blocked.down) {
            player.setVelocityY(-330);
        }
    }

    if (Math.floor(Math.random() * 3000) === 0) {
        shootLaser();
    }

    if (polices.children.entries.length < 2 && Math.floor(Math.random() * 30) === 0) {
        addPolice();
    }

    if (Math.floor(Math.random() * 30) === 0) {
        addDrug();
    }
}

function dig(player) {
    const time_underground = (player.effect === 'cannabis') ? 4000 : 1000;

    player.setVelocityX(0);
    digging = true;
    player.body.enable = false;
    player.anims.play('digging_start', true);
    setTimeout(() => {
        player.anims.play('digging_end', true);
        setTimeout(() => {
            digging = false;
            player.body.enable = true;
        }, 400);
    }, time_underground);
}

function collectDrug(player, drug) {
    if (gameOver) {
        return;
    }
    if (drug.type.effect) {
        drug.type.effect.bind(this)(player);
    }
    drug.destroy();

    score += drug.type.score;
    scoreText.setText('Score: ' + score);
}

function destroy1(elem) {
    elem.destroy();
}

function destroy2(_, elem) {
    elem.destroy();
}

function addDrug() {
    const type = Math.floor(Math.random() * 20) === 0 ? specialDrugsList[Math.floor(Math.random() * specialDrugsList.length)] : default_drug;
    const x = Math.floor(Math.random() * 800);
    let drug = drugs.create(x, 0, type.sprite).setScale(0.5);
    if (new_drugs_apply_effect_with_this_very_long_variable) {
        drug.setPipeline("distort");
    }
    drug.setVelocity(0, 80);
    drug.type = type;
    drug.setAngularVelocity(Math.random() * 500 - 250);
    drug.body.setAllowGravity(false);
}

function addPolice() {
    let width = 20;
    let velocity = 125;
    let animation = 'police_right';

    if (Math.floor(Math.random() * 2) == 0) {
        width = 780;
        animation = 'police_left';
        velocity = -1 * velocity;
    }
    let police = polices.create(width, 525, 'police');
    police.setCollideWorldBounds(true);
    police.body.onWorldBounds = true;
    police.body.world.on('worldbounds', () => police.destroy())
    police.anims.play(animation, true);
    police.setVelocity(velocity, 0);
}

function shootLaser() {
    setTimeout(function () { laser.body.enable = true }, 1000);
    setTimeout(function () { laser.body.enable = false }, 2000);
    laser.anims.play('laser_shot', false);
}

function endGame() {
    this.add.text(240, 200, 'GAME OVER', { fontSize: '60px', fill: '#fff' });
    gameOver = true
}
