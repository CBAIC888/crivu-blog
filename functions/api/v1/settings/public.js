import { getPublicSettings, handle, json, requireDb } from '../_shared.js';

export const onRequestGet = handle(async ({ env }) => json({ settings: await getPublicSettings(requireDb(env)) }));
