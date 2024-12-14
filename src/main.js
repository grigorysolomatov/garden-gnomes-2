const { Context } = require('./context.js');
const { dialogue } = require('./dialogue.js');
const { sleep } = require('./time.js');

const states = {
    greet: async ctx => {
	const {client, clients} = ctx;

	const [id, callback] = await client.receive('id'); client.id = id;
	callback('ok'); console.log('greet', id);
	
	clients[client.id] ??= client;
	ctx.client = clients[client.id];

	return 'listen';
    },
    listen: async ctx => {
	const {client} = ctx;

	// consolep.log(client.id, 'listen')
	const commands = ['play', 'unplay', 'disconnect'];
	console.log('listen', client.id);
	const [command, message, callback] = await new Context(commands)
	      .map(async command => [command, ...await client.receive(command)])
	      .into(ctx => Promise.race(ctx.values()));
	console.log(client.id, command, message);
	
	Object.assign(client, {message, callback});
	
	return command;
    },
    'play': async ctx => {
	const {client, lobby} = ctx;
	const {message: room='', callback} = client; lobby[room] ??= {};
					
	const oppId = Object.keys(lobby[room])[0];
	const opponent = lobby[room][oppId];

	client.room = room;
	lobby[room][client.id] = client;
	client.callback = callback;
	
	if (!opponent) { return 'listen'; }
	
	client.callback('dialogue begin'); opponent.callback('dialogue begin');

	// console.log({client})
	// console.log({opponent})
	
	delete client.callback; delete opponent.callback;
	delete client.room; delete opponent.room;
	
	delete lobby[room][client.id];
	delete lobby[room][opponent.id];

	console.log('dialogue begin', client.id, opponent.id)
	const callbacks = await dialogue(
	    async () => await client.receive('dialogue'),
	    async () => await opponent.receive('dialogue'),
	);
	callbacks.forEach(_callback => _callback('dialogue end'));
	console.log('dialogue end', client.id, opponent.id);
	
	return 'listen';
    },
    'unplay': async ctx => {
	const {client, lobby} = ctx; const {message, callback} = client;

	callback('ok');
	if (lobby[client.room]) { delete lobby[client.room][client.id]; }	
	delete client.room;
	
	return 'listen';
    },
    'disconnect': async ctx => {
	const {client} = ctx;
	client.callback ??= (() => {});
	return 'unplay';
    },
};
const main = async io => {
    const lobby = new Context(); // {room: {id: client}}
    const clients = new Context(); // {id: client}
    const nextClient = async () => {
	const socket = await new Promise(res => io.once('connection', res));
	const client = {
	    send: async (channel, message) => {
		const response = await new Promise(res => socket.emit(channel, message, res));
		return response;
	    },
	    receive: async channel => {		
		const [message, callback] = await new Promise(res => socket.once(
		    channel,
		    (message, callback) => res([message, callback]),
		));
		return [message, callback];
	    },
	};
	return client;
    };
    while (true) {
	const client = await nextClient();
	new Context({client, clients, lobby}).stateMachine(states);
    }
}

module.exports = {main};
