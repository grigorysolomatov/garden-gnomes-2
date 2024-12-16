import { sleep } from './tools/time.js';
import { battle } from './battle.js';
import { getScreen } from './screen.js';
import { Context } from './tools/context.js';

const steps = {
    connect: async ctx => {
	const {engine, width, height} = ctx; const {server} = engine;
	
	const msg = engine.text(0.5*width, 0.5*height, 'Finding Opponent').setOrigin(0.5);	
	msg.tween({alpha: {from: 0, to: 1}});
	msg.tween({
	    scale: {from: msg.scale, to: 0.8*msg.scale},
	    yoyo: true,
	    repeat: -1,
	});
	const res = await server.send('unplay', 'all');
	await server.send('play', 'random');
	msg.tween({alpha: 0, onComplete: () => msg.destroy()});
	
	const myNum = Math.random();
	
	await server.send('dialogue', ['send', 'turndecide', myNum]);	
	const theirNum = await server.send('dialogue', ['receive', 'turndecide']);	
	
	ctx.myIdx = 1*(myNum < theirNum);	
    },
    play: async ctx => {
	const {engine, width, height, myIdx} = ctx; const {server} = engine;

	const [nrows, ncols] = [9, 9];
	const screen = getScreen({engine, width, height, nrows, ncols});

	const local = {
	    choice: async (filter, options={}, prices=[]) => {
		const choice = await Promise.race([
		    screen.board.choose(filter),
		    screen.option.choose(options, prices),
		]);
		screen.board.choose();
		screen.option.choose();
		await server.send('dialogue', ['send', 'choice', choice]);
		return choice;
	    },
	};
	const online = {
	    choice: async () => await server.send('dialogue', ['receive', 'choice']),
	};
	
	const verbs = {
	    board: {
		create: async () => await screen.board.create(),
		select: (row, col) => screen.board.select(row, col),
		dims: () => [nrows, ncols],	    
	    },
	    entity: {
		create: async  (row, col, key) => {
		    if (key === 'flower') { screen.board.replace(row, col, 'grass'); }
		    if (key === 'flowerwizard') { screen.board.replace(row, col, 'grass'); }
		    if (key === 'bomb') { screen.board.replace(row, col, 'grass'); }
		    await screen.entity.create(row, col, key);		
		},
		move: async (p0, p1) => await screen.entity.move(p0, p1),
		destroy: async (row, col) => {
		    screen.board.replace(row, col, 'dirt');
		    await screen.entity.destroy(row, col);
		},
	    },
	    player: {
		both: () => myIdx===0 ? [local, online] : [online, local],
	    },
	    wallet: {
		create: async () => await screen.wallet.create(),
		get: idx => screen.wallet.get(idx),
	    },
	};
	await battle(verbs);
	
	await server.send('dialogue', ['end']);	
    },
};

export const root = {
    0: async ctx => {
	await new Context({...ctx}).onto(...Object.values(steps));
	return '..';
    },
}
