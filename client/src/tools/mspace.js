import { Context } from './context.js';

const steps = {
    setup: ctx => {
	const {d0, d1, y} = ctx;

	const wrt = [[], []];
	const filters = [];
	      
	ctx.wrt = (i, ...z) => {
	    wrt[i].splice(0, wrt[i].length);
	    wrt[i].push(...z);
	    return ctx;
	};
	ctx.only = (i, func) => {
	    const cost = x0 => i
		  ? Math.min(...wrt[1].map(y1 => d1(y1, y(x0))))
		  : Math.min(...wrt[0].map(x1 => d0(x1, x0)));
	    filters.push(x => func(cost(x)));
	    return ctx;
	};
	ctx.raw = () => x => filters.every(f => f(x));
	ctx.spread = () => (...x) => filters.every(f => f(x));
    },
};

export const mspace = (y, d0, d1) => new Context({d0, d1, y}).onto(...Object.values(steps));
