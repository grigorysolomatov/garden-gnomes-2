const { Context } = require('./context.js');

const states = {
    init: async ctx => {
	
	const table = [[{}, {}], [{}, {}]]; // table[player][verb][channel]
	const callbacks = [() => {}, () => {}];
	const stop = [false, false];

	Object.assign(ctx, {table, callbacks, stop});
	return 'loop';
    },
    loop: async ctx => {
	const {players, table, callbacks, stop} = ctx;

	const [p, message, callback] = await new Context(players)
	      .map(async (player, p) => [p, ...await player()])
	      .into(ctx => Promise.race(ctx.values()));
	
	const [verb, channel, data] = message;
	const [v, c] = [{send: 0, receive: 1}[verb], channel];

	console.log(p, verb, channel, data || ' ');
	
	callbacks[p] = callback;
	if (v === undefined) {
	    stop[p] = true;
	    if (stop[1-p]) { return [callbacks[p], callbacks[1-p]]; }
	    return 'loop';
	}
	// if (v === undefined) { callbacks[1-p](); callbacks[p](); return; } // END CONVERSATION

	table[p][v][c] = table[p][v][c] || [];
	table[1-p][1-v][c] = table[1-p][1-v][c] || [];

	table[p][v][c].push(v ? callback : data);

	if (v===0) { callback('ok'); } // Info string?

	if (table[p][v][c].length === 0 || table[1-p][1-v][c].length === 0) { return 'loop'; }

	let [val0, val1] = [table[p][v][c].shift(), table[1-p][1-v][c].shift()];
	if (v===1) { [val0, val1] = [val1, val0] }
	
	const [data0, callback1] = [val0, val1];
	callback1(data0);

	return 'loop';
    },
};

const dialogue = async (...players) => await new Context({players}).stateMachine(states);

module.exports = {dialogue};
