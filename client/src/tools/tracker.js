import { Context } from './context.js';
import { sleep } from './time.js';

const steps = {
    init: ctx => {
	const {engine, x, y, key, amount=0, settings={}} = ctx;
	const defaults = engine.defaults.counter;
	
	// const icon = engine.sprite(x, y, key);
	// icon.setDisplaySize(icon.width*defaults.height/icon.height, defaults.height);
	// icon.base = {scale: icon.scale};

	const text = engine.text(x, y, amount, settings).setOrigin(0.5).setAlpha(0);
	text.base = {scale: text.scale};

	// icon.x -= 0.2*icon.width;
	// text.x += 0.2*icon.width;
	
	Object.assign(ctx, {text});
    },
    methods: ctx => {
	const {icon, text} = ctx;

	ctx.update = async content => {
	    text.text = content;
	    await text.setAlpha(1).tween({scale: {from: 2*text.base.scale, to: text.base.scale}});
	};
    },
};
export const tracker = (engine, x, y, settings) => {
    return new Context({engine, x, y, settings}).onto(...Object.values(steps));
};
