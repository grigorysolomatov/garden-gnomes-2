import { Context } from './context.js';

export class Engine {
    constructor() {
	this.ctx = {};
    }
    assign(data) {
	Object.assign(this.ctx, data);
	return this;
    }
    newGame(config) {
	const game = new Phaser.Game(config);
	return this.assign({game});
    }
    tuneEntity(entity) {
	entity.event = (key, func=x=>x) => new Promise(res => entity.once(key, (...args) => res(func(...args))));
	entity.tween = config => this.tween({...config, targets: entity});
	return this;
    }
    newText(x, y, str, settings={}) {
	const {scene, defaults} = this.ctx;
	const text = scene.add.text(x, y, str, {...defaults.text, ...settings});
	this.tuneEntity(text);
	return text;
    }
    newSprite(x, y, key) {
	const {scene} = this.ctx;
	const sprite = scene.add.sprite(x, y, key);
	this.tuneEntity(sprite);
	return sprite;
    }
    async newScene(key) {
	const {game} = this.ctx;
	const scene = await new Promise(res => {
	    const scene = new Phaser.Scene({key});
	    scene.create = () => res(scene);
	    game.scene.add(key, scene);
	    game.scene.start(key);
	});
	return this.assign({scene});
    }
    async loadFonts(...families) {
	await new Promise(resolve => WebFont.load({google: {families}, active: resolve}));
    }
    async loadAssets(paths) {
	const {scene} = this.ctx;
	Object.keys(paths).forEach(key => scene.load.image(key, paths[key]));
	await new Promise(resolve => { scene.load.on('complete', resolve); scene.load.start(); });	
    }
    async tween(config) {
	const {scene, defaults} = this.ctx;
	await new Promise(res => scene.tweens.add({
	    onComplete: res,
	    ...defaults.tween,
	    ...config,
	}));
    }
    async newMenu(x, y, options) {
	const {defaults, game} = this.ctx; const {step} = defaults.menu;
	const shiftY = 0.5*(Object.keys(options).length - 1);

	const items = new Context(options)
	      .map((text, _, i) => this.newText(x, y + (i-shiftY)*step, text))
	      .forEach(
		  option => option.setOrigin(0.5).setInteractive(),
		  option => option.tween({scale: {from: 0, to: option.scale}}),
	      );
	
	const choice = await items
	      .map(async (option, key) => await option.event('pointerup', () => key))
	      .convert(ctx => Promise.race(ctx.values()));
	
	items.forEach(option => option.tween({alpha: 0, onComplete: () => option.destroy()}));
	
	return choice;
    }
}
