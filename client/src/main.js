import { Context } from './tools/context.js';
import { getEngine } from './tools/engine.js';
import { root as online } from './online.js';
import { root as local } from './local.js';
import { root as computer } from './computer.js';
import { root as match3 } from './match3.js';

const root = {
    0: async ctx => {
	const {engine, width, height} = ctx;
	const choice = await engine.menu(0.5*width, 0.5*height, {
	    online: 'Online',
	    local: 'Local',
	    computer: 'Computer',
	    match3: 'Match 3',
	});
	return choice;
    },
    online, local, computer, match3,
};

export const main = async () => {
    let [width, height] = [window.innerWidth, window.innerHeight];
    if (true || width > height) { width = height/1.6; }
    
    const config = {
	width, height,
	backgroundColor: '#111811',
	type: Phaser.WEBGL,
    };
    const defaults = {
	tween: {
	    duration: 500,
	    ease: 'Cubic.easeOut',
	},
	text: {
	    fontFamily: '"Modak", system-ui',
	    fontSize: '32px',
	    fill: '#88cc66',
	},
	menu: {
	    step: 50,
	    delay: 100,
	},
	counter: {
	    height: 50,
	},
    };
    
    // const engine = await new Context({config, defaults}).onto(...setup);
    const engine = await getEngine({config, defaults});
    await engine.fonts('Modak');
    await engine.assets({
	background: 'assets/exported/background.png',
	dirt: 'assets/exported/dirt.png',
	grass: 'assets/exported/grass.png',
	click: 'assets/exported/click.png',
	select: 'assets/exported/select.png',
	flower: 'assets/exported/flower.png',
	'gnome-red': 'assets/exported/gnome-red.png',
	'gnome-blue': 'assets/exported/gnome-blue.png',
	cancel: 'assets/exported/cancel.png',
	plant: 'assets/exported/plant.png',
	shop: 'assets/exported/shop.png',
	stop: 'assets/exported/stop.png',
	jump: 'assets/exported/jump.png',
	spawn: 'assets/exported/spawn.png',
	wallet: 'assets/exported/wallet.png',
	bombard: 'assets/exported/bombard.png',
	bomb: 'assets/exported/bomb.png',
    });
    
    const background = engine
	  .sprite(0.5*width, 0.5*height, 'background')
	  .setDisplaySize(width, height)
	  .setTint(0x888888);    
    
    const title = engine.text(0.5*width, 0.1*height, 'Garden Gnomes').setOrigin(0.5);
    title.tween({alpha: {from: 0, to: 1}});

    await new Context({engine, width, height}).treeMachine(root);
};
