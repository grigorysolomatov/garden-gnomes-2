import { Context } from './tools/context.js';
import { sleep } from './tools/time.js';

const states = {
    verbs: async ctx => {
	const {external} = ctx;
	const {board, entity, option} = external;
	const [nrows, ncols] = board.dims();

	const I = Context.range(nrows*ncols);
	const entities = I.map(i => null);
	const players = external.player.both();
	const meta  = {turn: 1, actions: 3, select: null};
	const wallets = [3, 3];
	
	const verbs = {
	    board: {
		// ...external.board,
		create: () => external.board.create(),
		select: (...row_col) => {
		    meta.select = row_col[0] == null ? null : row_col;
		    external.board.select(...row_col);
		},
	    },
	    wallet: {
		create: async () => {
		    await external.wallet.create()
		    external.wallet.get(0).update(wallets[0]);
		    external.wallet.get(1).update(wallets[1]);
		},
		add: async amount => {
		    wallets[meta.turn] += amount;
		    await external.wallet.get(meta.turn).update(wallets[meta.turn]);
		},
	    },
	    entity: {
		create: async (row, col, key) => {
		    entities[row*ncols + col] = key;
		    await external.entity.create(row, col, key);
		},
		destroy: async (row, col, filter=()=>true) => {
		    const entity = entities[row*ncols + col];
		    if (!filter(entity)) { return; }
		    entities[row*ncols + col] = null;
		    await external.entity.destroy(row, col);
		},
		move: async (p0, p1) => {
		    const [i0, i1] = [p0, p1].map(([row, col]) => row*ncols + col);		    
		    [entities[i0], entities[i1]] = [null, entities[i0]];
		    await external.entity.move(p0, p1);
		},		
		jump: () => {
		    entities.forEach((entity, _, i) => {
			if (entity !== ['gnome-red', 'gnome-blue'][meta.turn]) { return; }
			const [row, col] = [Math.floor(i/ncols), i % ncols];
			verbs.entity.move([row, col], [row, col]);
		    });
		},
	    },
	    player: {
		select: async () => {
		    const target = ['gnome-red', 'gnome-blue'][meta.turn];
		    const filter = (row, col) => entities[row*ncols + col] === target;
		    const choice = await players[meta.turn].choice(filter);
		    return choice;
		},
		act: async (dist, options={}, prices=[]) => {
		    const close = (row, col) => {
			const [p0, p1] = [meta.select, [row, col]];
			const d = Math.max(Math.abs(p0[0] - p1[0]), Math.abs(p0[1] - p1[1]));
			return d <= dist;
		    };
		    const empty = (row, col) => !entities[row*ncols + col];
		    const filter = (row, col) => close(row, col) && empty(row, col);
		    const choice = await players[meta.turn].choice(filter, options, prices);
		    return choice;
		},
		step: async (row, col) => {
		    const selected = verbs.selected(); verbs.board.select();
		    await verbs.entity.move(selected, [row, col]);
		    verbs.board.select(row, col);
		    meta.actions -= 1;
		},
		money: async amount => {
		    wallets[meta.turn] += amount;
		},
	    },
	    pass: () => {
		meta.actions = 3;
		meta.turn = 1 - meta.turn;
		verbs.board.select();
	    },
	    selected: () => meta.select,
	    actions: () => meta.actions,
	    turn: () => meta.turn,
	};	
	Object.assign(ctx, {verbs, nrows, ncols});
	return 'create';
    },
    create: async ctx => {
	const {verbs, nrows, ncols} = ctx;
	
	const [row, col] = [Math.floor((nrows-1)/2), Math.floor((ncols-1)/2)];
	await verbs.board.create();	
	verbs.entity.create(row+1, col-1, 'gnome-red');
	verbs.entity.create(row+1, col+1, 'gnome-red');
	verbs.entity.create(row-1, col-1, 'gnome-blue');
	await verbs.entity.create(row-1, col+1, 'gnome-blue');

	await verbs.wallet.create();
	//verbs.wallet.get(0).update(10);
	//await verbs.wallet.get(1).update(69);
	
	return 'pass';
    },
    select: async ctx => {
	const {verbs} = ctx;

	const [row, col] = await verbs.player.select();
	verbs.board.select(row, col);
	
	return 'loop';
    },
    step: async ctx => {
	const {verbs} = ctx;
	
	const choice = await verbs.player.act(1, {cancel: 'cancel'});
	if (choice === 'cancel') { verbs.board.select(); return 'loop'; }
	
	const [row, col] = choice; const prev = verbs.selected();
	await verbs.player.step(row, col);
	verbs.entity.create(...prev, 'flower');
	
	return 'loop';
    },
    act: async ctx => {
	const {verbs} = ctx;
	
	const choice = await verbs.player.act(1, {
	    shop: 'shop',
	    plant: 'plant',
	    jump: 'jump',
	    pass: 'stop',
	});

	if (typeof choice === 'string') { return choice; }	
	
	const [row, col] = choice;
	await verbs.player.step(row, col);
	
	return 'loop';
    },
    loop: async ctx => {
	const {verbs} = ctx;

	const actions = verbs.actions();
	const selected = verbs.selected();
	
	if (actions <= 0) { return 'pass'; }
	if (actions === 3 && !selected) { return 'select'; }
	if (actions === 3 && selected) { return 'step'; }
	
	return 'act';
    },
    'jump': async ctx => {
	const {verbs} = ctx;
	
	const choice = await verbs.player.act(2, {cancel: 'cancel'});
	if (choice === 'cancel') { return 'loop'; }
	
	const [row, col] = choice;
	await verbs.player.step(row, col);
	
	return 'pass';
    },
    'plant': async ctx => {
	const {verbs} = ctx;
	
	const choice = await verbs.player.act(2, {cancel: 'cancel'});
	if (choice === 'cancel') { return 'loop'; }
	
	const [row, col] = choice;
	verbs.entity.create(row, col, 'flower');
	
	return 'pass';
    },    
    'spawn': async ctx => {
	const {verbs} = ctx;
	
	const choice = await verbs.player.act(2, {cancel: 'cancel'});
	if (choice === 'cancel') { return 'loop'; }
	
	const [row, col] = choice;
	verbs.entity.create(row, col, ['gnome-red', 'gnome-blue'][verbs.turn()]);

	await verbs.wallet.add(-1);
	
	return 'pass';
    },
    'pass': async ctx => {
	const {verbs} = ctx;

	verbs.pass(); // verbs.entity.jump();
	
	return 'loop';
    },
    'bombard': async ctx => {
	const {verbs} = ctx;
	
	const choice = await verbs.player.act(2, {cancel: 'cancel'});
	if (choice === 'cancel') { return 'loop'; }
	
	const [row, col] = choice;
	await verbs.entity.create(row, col, 'bomb');
	
	const pts = [
	    [0, 0],
	    [-1, -1],
	    [-1, 0],
	    [-1, 1],
	    [0, -1],
	    [0, 1],
	    [1, -1],
	    [1, 0],
	    [1, 1],
	];
	pts.forEach(([r, c]) => verbs.entity.destroy(
	    row + r, col + c,
	    entity => ['flower', 'bomb'].includes(entity),
	));

	await verbs.wallet.add(-1);
	
	return 'pass';
    },
    'shop': async ctx => {
	const {verbs} = ctx;

	const choice = await verbs.player.act(0, {
	    bombard: 'bombard',
	    spawn: 'spawn',
	    cancel: 'cancel',
	}, [1, 1, '']);

	if (choice === 'cancel') { return 'loop'; }
	return choice;
    },
};
export const battle = async verbs => {
    await new Context({external: verbs}).stateMachine(states);
};
