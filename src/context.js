class Context {
    static range(n) {
	const raw = new Array(n).fill().map((_, i) => i);
	return new Context(raw);
    }
    constructor(raw={}) {
	this.raw = raw;
	return new Proxy(raw, {
	    get: (obj, prop) => this[prop] || raw[prop],
	    // set: (obj, prop, value) => { raw[prop] = value; return true; },
	});
    }
    assign(raw) {
	Object.assign(this.raw, raw);
	return this;
    }
    keys() {
	return Object.keys(this.raw);
    }
    values() {
	return Object.values(this.raw);
    }
    map(func) {
	// const [func, ...tail] = funcs;	
	const raw = Object
	      .keys(this.raw)
	      .map((key, i) => ({[key]: func(this.raw[key], key, i)}))
	      .reduce((a, b) => Object.assign(a, b), {});

	// if (tail.length > 0) { return new Context(raw).map(...tail); }
	// else { return new Context(raw); }
	return new Context(raw);
    }
    forEach(func) {
	this.map(func);
	return this;
    }
    into(func) {
	return func(this);
    }
    async onto_OLD(...funcs) {
	for (const func of funcs) { await func(this); }
	return this;
    }
    onto(...funcs) {
	const hasAsync = funcs.map(func => func.constructor.name).includes("AsyncFunction");
	if (hasAsync) {
	    return new Promise(async res => {
		for (const func of funcs) { await func(this); }
		res(this);
	    });
	}
	else {
	    for (const func of funcs) { func(this); }
	    return this;
	}
    }
    log() {
	console.log('[Context]', this.raw);
	return this;
    }
    narrow(...keys) {
	const data = keys
	      .map(key => ({[key]: this.raw[key]}))
	      .reduce((a, b) => Object.assign(a, b), {});
	return new Context(data);
    }
    filter(func) {
	const raw = Object.keys(this.raw)
	      .filter((key, i) => func(this.raw[key], key, i))
	      .map(key => ({[key]: this.raw[key]}))
	      .reduce((a, b) => Object.assign(a, b), {});
	return new Context(raw);
    }
    invert() {
	const raw = this.keys().reduce((raw, key) => Object.assign(raw, {[this[key]]: key}), {});
	return new Context(raw);
    }
    remove(...keys) {
	keys.forEach(key => delete this.raw[key]);
	return;
    }
    async stateMachine(states, start=Object.keys(states)[0]) {
	let state = start;
	while (states[state]) { state = await states[state](this); }
	return state;
    }
    async treeMachine(root) {
	const path = [];
	while (true) {
	    const node = path.reduce((a, b) => a[b], root);
	    if (!node) {break;}	    
	    const next = await node[Object.keys(node)[0]](this);
	    if (next === '..') { path.pop(); } else { path.push(next); }
	}
    }
}
module.exports = {Context};
