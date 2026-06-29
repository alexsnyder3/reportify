const timestamp = () => new Date().toISOString();

export const logger = {
  info: (msg: string, meta?: object) =>
    console.log(JSON.stringify({ level: 'info', ts: timestamp(), msg, ...meta })),
  warn: (msg: string, meta?: object) =>
    console.warn(JSON.stringify({ level: 'warn', ts: timestamp(), msg, ...meta })),
  error: (msg: string, meta?: object) =>
    console.error(JSON.stringify({ level: 'error', ts: timestamp(), msg, ...meta })),
  debug: (msg: string, meta?: object) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(JSON.stringify({ level: 'debug', ts: timestamp(), msg, ...meta }));
    }
  },
};
