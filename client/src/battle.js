import { Context } from './tools/context.js';
import { sleep } from './tools/time.js';
import { mspace } from './tools/mspace.js';

const states = {
    verbs: async ctx => {
	const {external} = ctx;
	const {board, entity, option} = external;
	const [nrows, ncols] = board.dims();

	const I = Context.range(nrows*ncols);
	const entities = I.map(i => null);
	const players = external.player.both();
	const meta  = {turn: 1, actions: 3, select: null};
	const wallets = [0, 0];

	const verbs = {
	    board: {
		create: () => external.board.create(),
		select: (...row_col) => {
		    meta.select = row_col[0] == null ? null : row_col;
		    external.board.select(...row_col);
		},
		selected: () => meta.select,
		contains: (row, col) => row >= 0 && col >= 0 && row < nrows && col < ncols,
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
		get: (row, col) => entities[row*ncols + col],
		current: () => ['gnome-red', 'gnome-blue'][meta.turn],
	    },
	    player: {
		choice: async (filter, options, prices) => {
		    const choice = await players[meta.turn].choice(filter, options, prices);
		    return choice;
		},
		step: async (row, col) => {
		    const selected = verbs.board.selected(); verbs.board.select();
		    await verbs.entity.move(selected, [row, col]);
		    verbs.board.select(row, col);
		    meta.actions -= 1;
		},
	    },
	    pass: () => {
		meta.actions = 3;
		meta.turn = 1 - meta.turn;
		verbs.board.select();
	    },
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

	//verbs.entity.create(1, 1, 'flower');
	//verbs.entity.create(nrows-2, 1, 'flower');
	//verbs.entity.create(1, ncols-2, 'flower');
	//await verbs.entity.create(nrows-2, ncols-2, 'flower');
	//verbs.entity.create(row, col, 'flower');
	
	// verbs.entity.create(row-1, col-1, 'gnome-red');
	// verbs.entity.create(row+1, col-1, 'gnome-red');
	// verbs.entity.create(row-1, col+1, 'gnome-blue');
	// await verbs.entity.create(row+1, col+1, 'gnome-blue');

	verbs.entity.create(row, col-2, 'gnome-red');
	verbs.entity.create(row, col, 'mushroom');
	await verbs.entity.create(row, col+2, 'gnome-blue');

	await verbs.wallet.create();

	return 'pass';
    },
    select: async ctx => {
	const {verbs} = ctx;

	const filter = mspace(
	    ([row, col]) => verbs.entity.get(row, col),
	    (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])),
	    (a, b) => (a !== b)*1)
	      .wrt(1, verbs.entity.current()).only(1, d => d === 0).spread();
	const options = {};
	const choice = await verbs.player.choice(filter, options);
	const [row, col] = choice;
	verbs.board.select(row, col);

	return 'loop';
    },
    step: async ctx => {
	const {verbs} = ctx;

	const filter = mspace(
	    ([row, col]) => verbs.entity.get(row, col),
	    (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])),
	    (a, b) => (a !== b)*1)
	      .wrt(0, verbs.board.selected()).only(0, d => d === 1)
	      .wrt(1, null).only(1, d => d === 0).spread();
	const options = {cancel: 'cancel'};
	const choice = await verbs.player.choice(filter, options);
	if (choice === 'cancel') { verbs.board.select(); return 'loop'; }

	const [row, col] = choice; const prev = verbs.board.selected();
	await verbs.player.step(row, col);
	verbs.entity.create(...prev, 'flower');

	return 'loop';
    },
    loop: async ctx => {
	const {verbs} = ctx;

	const actions = verbs.actions();
	const selected = verbs.board.selected();

	if (actions <= 0) { return 'pass'; }
	if (actions === 3 && !selected) { return 'select'; }
	if (actions === 3 && selected) { return 'step'; }

	return 'act';
    },
    act: async ctx => {
	const {verbs} = ctx;

	const filter = mspace(
	    ([row, col]) => verbs.entity.get(row, col),
	    (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])),
	    (a, b) => (a !== b)*1)
	      .wrt(0, verbs.board.selected()).only(0, d => d === 1)
	      .wrt(1, null).only(1, d => d === 0).spread();
	const options = {
	    makeflower: 'makeflower',
	    jump: 'jump',
	    kick: 'kick',
	    shop: 'shop',
	    pass: 'stop',
	};
	const choice = await verbs.player.choice(filter, options);

	const __HIDE__ = async () => {
	    const choice = await verbs.player.act(1, {
		shop: 'shop',
		plant: 'plant',
		jump: 'jump',
		pass: 'stop',
	    });
	};

	if (typeof choice === 'string') { return choice; }

	const [row, col] = choice;
	await verbs.player.step(row, col);

	return 'loop';
    },
    'makeberry': async ctx => {
	const {verbs} = ctx;

	const filter = mspace(
	    ([row, col]) => verbs.entity.get(row, col),
	    (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])),
	    (a, b) => (a !== b)*1)
	      .wrt(0, verbs.board.selected()).only(0, d => d <= 2)
	      .wrt(1, null).only(1, d => d === 0).spread();
	const options = {cancel: 'cancel'};
	const choice = await verbs.player.choice(filter, options);
	if (choice === 'cancel') { return 'loop'; }

	const [row, col] = choice;
	verbs.entity.create(row, col, 'berry');

	return 'pass';
    },
    'kick': async ctx => {
	const {verbs} = ctx;

	const filter = mspace(
	    ([row, col]) => verbs.entity.get(row, col),
	    (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])),
	    (a, b) => (a !== b)*1)
	      .wrt(0, verbs.board.selected()).only(0, d => d === 1)
	      .wrt(1, 'gnome-red', 'gnome-blue', 'flower', 'mushroom').only(1, d => d === 0).spread();
	const options = {cancel: 'cancel'};
	const choice = await verbs.player.choice(filter, options);
	if (choice === 'cancel') { return 'loop'; }

	const [row, col] = choice;
	const [row0, col0] = verbs.board.selected();
	const [delta_r, delta_c] = [row - row0, col - col0];
	const [row1, col1] = [row + delta_r, col + delta_c];

	await verbs.entity.move([row0, col0], [row0, col0]);
	if (verbs.entity.get(row, col) === 'mushroom') { verbs.wallet.add(1); }
	
	if (!verbs.entity.get(row1, col1) && verbs.board.contains(row1, col1)) {
	    const isgnome = ['gnome-red', 'gnome-blue'].includes(verbs.entity.get(row, col));
	    verbs.entity.move([row, col], [row1, col1]);
	    if (isgnome) { verbs.entity.create(row, col, 'flower'); };	    
	}
	else {
	    verbs.entity.move([row, col], [row, col]);
	}	

	return 'pass';
    },
    'kick2': async ctx => {
	const {verbs} = ctx;
	
	for (let i = 0; i < 2; i++) {
	    const filter = mspace(
		([row, col]) => verbs.entity.get(row, col),
		(a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])),
		(a, b) => (a !== b)*1)
		  .wrt(0, verbs.board.selected()).only(0, d => d === 1)
		  .wrt(1, 'gnome-red', 'gnome-blue', 'flower').only(1, d => d === 0).spread();
	    const options = i ? {pass: 'stop'} : {cancel: 'cancel'};
	    const choice = await verbs.player.choice(filter, options);
	    if (choice === 'cancel') { return 'shop'; }
	    if (choice === 'pass') { break; }

	    const [row, col] = choice;
	    const [row0, col0] = verbs.board.selected();
	    const [delta_r, delta_c] = [row - row0, col - col0];
	    const [row1, col1] = [row + delta_r, col + delta_c];

	    await verbs.entity.move([row0, col0], [row0, col0]);
	    
	    if (!verbs.entity.get(row1, col1) && verbs.board.contains(row1, col1)) {
		const flower = verbs.entity.get(row, col) === 'flower';
		verbs.entity.move([row, col], [row1, col1]);
		if (!flower) { verbs.entity.create(row, col, 'flower'); };
	    }
	    else {
		verbs.entity.move([row, col], [row, col]);
	    }
	    
	}

	await verbs.wallet.add(-1);

	return 'pass';
    },
    'jump': async ctx => {
	const {verbs} = ctx;

	const filter = mspace(
	    ([row, col]) => verbs.entity.get(row, col),
	    (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])),
	    (a, b) => (a !== b)*1)
	      .wrt(0, verbs.board.selected()).only(0, d => d === 2)
	      .wrt(1, null).only(1, d => d === 0).spread();
	const options = {cancel: 'cancel'};
	const choice = await verbs.player.choice(filter, options);
	if (choice === 'cancel') { return 'loop'; }

	const [row, col] = choice;
	await verbs.player.step(row, col);

	return 'pass';
    },
    'makeflower': async ctx => {
	const {verbs} = ctx;

	const filter = mspace(
	    ([row, col]) => verbs.entity.get(row, col),
	    (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])),
	    (a, b) => (a !== b)*1)
	      .wrt(0, verbs.board.selected()).only(0, d => d <= 2)
	      .wrt(1, null).only(1, d => d === 0).spread();
	const options = {cancel: 'cancel'};
	const choice = await verbs.player.choice(filter, options);
	if (choice === 'cancel') { return 'loop'; }

	const [row, col] = choice;
	verbs.entity.create(row, col, 'flower');

	return 'pass';
    },
    'spawn': async ctx => {
	const {verbs} = ctx;

	const filter = mspace(
	    ([row, col]) => verbs.entity.get(row, col),
	    (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])),
	    (a, b) => (a !== b)*1)
	      .wrt(0, verbs.board.selected()).only(0, d => d <= 2)
	      .wrt(1, null).only(1, d => d === 0).spread();
	const options = {cancel: 'cancel'};
	const choice = await verbs.player.choice(filter, options);
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
    'makebomb': async ctx => {
	const {verbs} = ctx;

	const filter = mspace(
	    ([row, col]) => verbs.entity.get(row, col),
	    (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])),
	    (a, b) => (a !== b)*1)
	      .wrt(0, verbs.board.selected()).only(0, d => d <= 2)
	      .wrt(1, null, 'flower').only(1, d => d === 0).spread();
	const options = {cancel: 'cancel'};
	const choice = await verbs.player.choice(filter, options);
	if (choice === 'cancel') { return 'loop'; }

	const [row, col] = choice;
	verbs.entity.destroy(row, col);
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
	    entity => ['flower', 'bomb', 'mushroom'].includes(entity),
	));

	await verbs.wallet.add(-1);

	return 'pass';
    },
    'makeflower2': async ctx => {
	const {verbs} = ctx;

	for (let i = 0; i < 2; i++) {
	    const filter = mspace(
		([row, col]) => verbs.entity.get(row, col),
		(a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])),
		(a, b) => (a !== b)*1)
		  .wrt(0, verbs.board.selected()).only(0, d => d <= 2)
		  .wrt(1, null).only(1, d => d === 0).spread();
	    const options = i ? {pass: 'stop'} : {cancel: 'cancel'};
	    const choice = await verbs.player.choice(filter, options);
	    
	    if (choice === 'cancel') { return 'shop'; }
	    if (choice === 'pass') { break; }
	    
	    const [row, col] = choice;
	    verbs.entity.create(row, col, 'flower');	    	    
	}

	await verbs.wallet.add(-1);

	return 'pass';
    },
    'shop': async ctx => {
	const {verbs} = ctx;

	const filter = mspace(
	    ([row, col]) => verbs.entity.get(row, col),
	    (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])),
	    (a, b) => (a !== b)*1)
	      .wrt(0, verbs.board.selected()).only(0, d => false)
	      .wrt(1, null).only(1, d => false).spread();
	const options = {
	    makeflower2: 'makeflower2',
	    kick2: 'kick2',
	    makebomb: 'makebomb',
	    spawn: 'spawn',
	    // wizard: 'plantwizard',	    
	    //unplant: 'unplant',
	    cancel: 'cancel',
	};
	const prices = [1, 1, 1, 1, ''];
	const choice = await verbs.player.choice(filter, options, prices);

	if (choice === 'cancel') { return 'loop'; }
	return choice;
    },
};
export const battle = async verbs => {
    await new Context({external: verbs}).stateMachine(states);
};
