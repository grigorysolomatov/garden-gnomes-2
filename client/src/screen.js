import { sleep } from './tools/time.js';
import { Context } from './tools/context.js';

const steps = {
    setup: ctx => {
	const {engine, width, height, nrows, ncols} = ctx;

	const step = 0.9*width/ncols;

	const [I, RC, XY] = engine.grid(nrows, ncols, 0.5*width, 0.52*height, step);
	Object.assign(ctx, {I, RC, XY, step});
    },
    board: ctx => {
	const {engine, I, RC, XY, nrows, ncols, step} = ctx;

	const makeTile = (x, y, key) => {
	    const sprite = engine.sprite(x, y, key).setDisplaySize(0.95*step, 0.95*step);
	    sprite.base = {scale: sprite.scale};
	    return sprite;
	};
	
	const grid = key => I.map(i => makeTile(...XY[i], key));

	const tiles = grid('dirt').forEach(sprite => sprite.setAlpha(0));
	const clicks = grid('click').forEach(sprite => sprite.setAlpha(0).setDepth(1));
	const selects = grid('select').forEach(sprite => sprite.setAlpha(0).setDepth(1));

	ctx.board = {
	    create: async () => {
		await tiles
		    .map(async (sprite, i) => {
			const [row, col] = RC[i];
			const [r, c] = [row - Math.floor((nrows-1)/2), col - Math.floor((ncols-1)/2)];
			await sleep(100*(Math.abs(r)+Math.abs(c)))
			await sprite.tween({
			    alpha: 1,
			    angle: 360,
			    scale: {from: 0, to: sprite.base.scale},
			});		
		    })
		    .into(ctx => Promise.all(ctx.values()));
	    },
	    choose: async (filter=()=>false) => {
		clicks.forEach(sprite => sprite.tween({alpha: 0}));
		const [row, col] = await RC
		      .filter(([row, col], i) => filter(row, col))
		      .map((_, i) => clicks[i].setInteractive())
		      .forEach(click => click.tween({
			  alpha: 1,
			  scale: {
			      from: 1.5*click.base.scale,
			      to: click.base.scale,
			  }}))
		      .map(async (click, i) => await click.event('pointerup', () => RC[i]))
		      .into(ctx => Promise.race(ctx.values()));	    
		clicks.forEach(clicks => clicks.disableInteractive().tween({alpha: 0}));
		return [row, col];
	    },
	    select: (row, col) => selects.forEach((sprite, _, i) => {
		const current = i === row*ncols + col;
		sprite.tween({
		    scale: {
			from: sprite.base.scale*(1 + 0.5*current),
			to: sprite.base.scale,
		    },
		    alpha: 1*current,
		});
	    }),
	    replace: async (row, col, key) => {
		const oldSprite = tiles[row*ncols + col];
		const newSprite = makeTile(oldSprite.x, oldSprite.y, key);
		tiles[row*ncols + col] = newSprite;

		newSprite.tween({
		    scale: {from: 1.2*newSprite.base.scale, to: newSprite.base.scale},
		    alpha: {from: 0, to: 1},
		})
		await oldSprite.tween({alpha: 0}); oldSprite.destroy();
	    },
	};
    },
    wallets: ctx => {
	const {engine, XY, nrows, ncols, step} = ctx;

	const [row, col] = [Math.floor((nrows-1)/2), Math.floor((ncols-1)/2)];
	const y = XY[0][1] - 1.2*step;
	const [x0, x1] = [XY[row-1][0], XY[row+1][0]];

	const frame = engine.sprite(0.5*(x0+x1), y, 'wallet').setAlpha(0);
	frame.setDisplaySize(frame.width*step/frame.height, step);
	
	const wallets = [	    				
	    engine.tracker(x0, y, {fill: '#fe183d'}),
	    engine.tracker(x1, y, {fill: '#09aaf4'}),
	];

	ctx.wallet = {
	    create: async () => {
		await frame.tween({
		    scale: {from: 1.2*frame.scale, to: frame.scale},
		    alpha: {from: 0, to: 1},
		});		
		const [red, blue] = wallets;
		// red.update(0);
		// await blue.update(0);
	    },
	    get: idx => wallets[idx],	    
	};
    },
    entities: ctx =>  {
	const {engine, create, I, XY, ncols, step} = ctx;
	const entities = I.map(i => null);

	ctx.entity = {
	    create: async (row, col, key, animate=true) => {
		const i = row*ncols + col;
		const sprite = engine.sprite(...XY[i], key).setDepth(100 + row); entities[i] = sprite;
		const size = 1.1*step;
		sprite.setDisplaySize(sprite.width*size/sprite.height, size).setOrigin(0.5, 0.9);
		sprite.base = {
		    scale: sprite.scale,
		    originX: sprite.originX,
		    originY: sprite.originY,
		};
		if (animate) {
		    await sprite.tween({scale: {from: 0, to: sprite.base.scale}});
		}
	    },
	    move: async (p0, p1) => {
		const toI = ([row, col]) => row*ncols + col;
		const [i0, i1] = [toI(p0), toI(p1)];
		const sprite = entities[i0];
		[entities[i0], entities[i1]] = [null, sprite];
		const [x, y] = XY[i1];
		const sign = Math.sign(Math.random() - 0.5);
		sprite.tween({
		    t: {from: 0, to: 1},
		    duration: 0.5*engine.defaults.tween.duration,
		    yoyo: true,
		    onUpdate: (tween, target) => {
			const {t} = target;
			sprite.setOrigin(0.5, sprite.base.originY + t);
			sprite.setAngle(-sign*10*t);
		    },
		});
		
		sprite.setDepth(200 + p1[0]);
		await sprite.tween({x, y});
		sprite.setDepth(100 + p1[0]);
	    },
	    destroy: async (row, col) => {
		const sprite0 = entities[row*ncols + col];
		entities[row*ncols + col] = null;
		await sprite0?.tween({alpha: 0, scale: 1.3*sprite0.scale});
		sprite0?.destroy();
	    },
	};
    },
    options: ctx => {
	const {engine, XY, width, height, nrows, ncols, step} = ctx;

	const garbage = {
	    content: [],
	    empty: () => {
		const {content} = garbage;
		content.forEach(
		    sprite => sprite
			.disableInteractive()
			.tween({alpha: 0, onComplete: () => sprite.destroy()}));
		content.splice(0, garbage.length);
		return garbage;
	    },
	    add: sprites => {
		const {content} = garbage;
		content.push(...sprites);
		return garbage;
	    },
	};	
	const [x, y] = [0.5*width, XY[nrows*ncols-1][1] + 1.5*step];
	const choose = async options => {
	    const ncols = Object.keys(options).length;
	    const [_, __, XY] = engine.grid(1, ncols, x, y, step);
	    const buttons = new Context(options)
		  .map((option, _, i) => {
		      const sprite = engine.sprite(...XY[i], option).setDisplaySize(0.9*step, 0.9*step);
		      // sprite.base = {scale: sprite.scale};
		      return sprite;
		  })
		  .onto(buttons => garbage.add(buttons.values()));
	    const choice = await buttons
		  .forEach(sprite => sprite.setInteractive().tween({
		      alpha: {from: 0, to: 1},
		      scale: {from: 1.2*sprite.scale, to: sprite.scale},
		  }))
		  .map(async (sprite, key) => await sprite.event('pointerup', () => key))
		  .into(ctx => Promise.race(ctx.values()));
	    buttons.forEach(async (sprite, key) => {
		await sprite.tween({alpha: 0, scale: sprite.scale + 0.5*(key === choice)});
		sprite.destroy();
	    });	    
	    return choice;
	};	
	const prices = prices => {
	    const ncols = Object.keys(prices).length;
	    const [_, __, XY] = engine.grid(1, ncols, x, y + step, step);
	    const texts = new Context(prices)
		  .map((price, _, i) => engine.text(...XY[i], price).setOrigin(0.5))
		  .onto(texts => garbage.add(texts.values()))
		  .forEach(text => text.tween({
		      scale: {from: 1.5*text.scale, to: text.scale},
		      alpha: {from: 0, to: 1},
		  }));
	};

	ctx.option = {
	    choose: async (options={}, costs=[]) => {
		garbage.empty();
		prices(costs);
		const choice = await choose(options);
		return choice;
	    },
	};
    },
};
export const getScreen = ctx => {
    const screen = new Context(ctx).onto(...Object.values(steps));
    return screen;
    // return screen.narrow('board', 'entity', 'option', 'wallet');
};
