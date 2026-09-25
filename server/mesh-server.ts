/**
 * The mesh relay on a facility network — one long-lived process with
 * websockets, so a referral reaches the other device the moment it is sent.
 * Its rules live in server/relay/app.ts, shared with the hosted relay
 * (server/relay/vercel.ts). `npm run server`.
 *
 * @module server/mesh-server
 */

import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { createRelay } from './relay/app';
import { resolveAuthSecret } from './relay/auth';
import { storeFromEnv } from './relay/store';
import { abdmConfigFromEnv, createAbdmClient } from './relay/abha';
import { bhashiniConfigFromEnv, createBhashiniClient } from './relay/bhashini';
import { relayModeFromEnv } from './relay/mode';

function log(message: string, data?: object): void {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), message, ...data }));
}

const secret = resolveAuthSecret();
if (!secret) {
    console.error('\nMesh relay: no signing secret. Set NALAMMESH_AUTH_SECRET (32+ characters) — sign-in stays disabled until you do.\n');
}

const mode = relayModeFromEnv(process.env);
if (mode.problems.length > 0) {
    console.error(`\nMesh relay (production): cannot start — set ${mode.problems.join('; ')}.\n`);
    process.exit(1);
}

const store = storeFromEnv();
const io = new SocketIO({ cors: { origin: '*', methods: ['GET', 'POST'] }, pingTimeout: 10000, pingInterval: 5000 });
const abdmConfig = abdmConfigFromEnv();
const bhashiniConfig = bhashiniConfigFromEnv();
const relay = createRelay({
    store, secret, io, log,
    demoAccounts: mode.demoAccounts,
    bootstrapAdmin: mode.bootstrapAdmin,
    abdm: abdmConfig ? createAbdmClient(abdmConfig) : null,
    bhashini: bhashiniConfig ? createBhashiniClient(bhashiniConfig) : null,
});
const httpServer = createServer(relay.app);
io.attach(httpServer);
relay.attachSockets(io);

const PORT = process.env.PORT || 3001;

/**
 * A relay left running from an earlier session is the usual reason this port is
 * taken. Node's default here is an unhandled 'error' event and a stack trace,
 * which is alarming and says nothing useful — print the fix instead.
 */
httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
        console.error(
            `\nMesh relay: port ${PORT} is already in use.\n\n` +
            `Another relay is probably still running. Either use it as-is, or stop it:\n` +
            `    lsof -ti :${PORT} | xargs kill\n\n` +
            `To run on a different port instead:\n` +
            `    PORT=3002 npm run server\n`
        );
        process.exit(1);
    }
    throw err;
});

httpServer.listen(PORT, () => {
    log(`Mesh relay running on port ${PORT}`, { store: store.kind, signIn: secret ? 'enabled' : 'disabled', mode: mode.production ? 'production' : 'evaluation' });
});
