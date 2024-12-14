const sleep = async duration => new Promise(res => setTimeout(res, duration));

module.exports = {sleep};
