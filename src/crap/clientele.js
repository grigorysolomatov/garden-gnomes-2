const { Context } = require('./context.js');

const steps = {
    methods: ctx => {
	const {io} = ctx;
	ctx.next = async () => {
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
    },
};

const newClientele = io => new Context({io}).onto(...Object.values(steps));
module.exports = {newClientele};

const getAllClients = io => {
    const next = async () => {
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
	return new Context(client);
    };
    const clients = new Context();
    clients.onto(async clients => {
	while (true) {
	    const client = await next();
	    client.onto(async client => {
		client.id = await client.send('get-id');
		clients[client.id] = client;
	    });
	}
    });
    return clients;
};
