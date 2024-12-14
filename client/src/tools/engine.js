import { Context } from './context.js';
import { sleep } from './time.js';
import { tracker } from './tracker.js';

const steps = {
    init: async ctx => {
	const {config} = ctx;
	const game = new Phaser.Game(config);

	const key = 'MainScene';
	const scene = await new Promise(res => {
	    const scene = new Phaser.Scene({key});
	    scene.create = () => res(scene);
	    game.scene.add(key, scene);
	    game.scene.start(key);
	});
	Object.assign(ctx, {game, scene});
    },
    local: ctx => {
	const {scene, defaults, config} = ctx;
	const {height} = config;

	ctx.assets = async paths => {
	    Object.keys(paths).forEach(key => scene.load.image(key, paths[key]));
	    await new Promise(resolve => { scene.load.on('complete', resolve); scene.load.start(); });	    
	};
	ctx.fonts = async (...families) => {
	    await new Promise(resolve => WebFont.load({google: {families}, active: resolve}));
	};
	
	ctx.tween = async config => {
	    await new Promise(res => scene.tweens.add({
		onComplete: res,
		...defaults.tween,
		...config,
	    }));
	};
	ctx.tune = entity => {
	    entity.event = (key, func=x=>x) => new Promise(res => entity.once(key, (...args) => res(func(...args))));
	    entity.tween = config => ctx.tween({...config, targets: entity});
	    return entity;
	};
	ctx.text = (x, y, str, settings={}) => {
	    const text = scene.add.text(x, y, str, {...defaults.text, ...settings});
	    return ctx.tune(text);
	};
	ctx.sprite = (x, y, key) => {
	    const sprite = scene.add.sprite(x, y, key);
	    return ctx.tune(sprite);
	};	
	ctx.menu = async (x, y, options) => {
	    const {step, tween, delay} = defaults.menu;

	    const shiftY = 0.5*(Object.keys(options).length - 1);	  
	    const items = new Context(options)
		  .map((text, _, i) => ctx.text(x, y + (i-shiftY)*step, text))
		  .map(option => option.setOrigin(0.5).setAlpha(0).setInteractive())
		  .forEach(async (option, _, i) => {
		      await sleep(delay*i);
		      option.tween({alpha: 1, y: {from: height, to: option.y}});
		  });
	    const choice = await items
		  .map(async (option, key) => option.event('pointerup', () => key))
		  .into(ctx => Promise.race(ctx.values()));

	    items.forEach(option => option.tween({alpha: 0, onComplete: () => option.destroy()}));
	    return choice;
	};
	ctx.grid = (nrows, ncols, x, y, step) => {
	    const I = Context.range(nrows*ncols);
	    const RC = I.map(i => {
		const [row, col] = [Math.floor(i / ncols), i % ncols];
		return [row, col];
	    });
	    const XY = RC.map(([row, col]) => {
		const pos = [
		    col*step - 0.5*(ncols-1)*step + x,
		    row*step - 0.5*(nrows-1)*step + y,
		];
		return pos;
	    });
	    return [I, RC, XY];
	};
	ctx.tracker = (...args) => tracker(ctx, ...args);
    },
    online: async ctx => {
	localStorage.clear();
	const socket = io();
	const view = message => Array.isArray(message) ? '[' + message.join(', ') + ']' : message;
	// const view = x => x;
	const server = {	    
	    send: async (channel, message) => {				
		// console.log('client:', view(channel), view(message));
		const response = await new Promise(res => socket.emit(channel, message, res));
		// console.log('server:', view(response));
		return response;
	    },
	    receive: async channel => {
		// console.log('client:', 'receive', view(channel));
		const [message, callback] = await new Promise(res => socket.once(
		    channel,
		    (message, callback) => res([message, callback]),
		));		
		// console.log('server:', view(message));
		return [message, callback];
	    },
	};
	const id = localStorage.getItem('id') || uuidv4(); localStorage.setItem('id', id);
	// const [_ , callback] = await server.receive('getid'); callback(id);
	const response = await server.send('id', id);//  callback(id);
	Object.assign(ctx, {server});
    },
};
export const getEngine = async ({config, defaults}) => {
    const engine = await new Context({config, defaults}).onto(...Object.values(steps));
    return engine;
};
// export const setup = Object.values(steps);
