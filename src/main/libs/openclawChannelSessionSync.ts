/**
 * OpenClaw Channel Session Sync
 *
 * Discovers and maps sessions created by OpenClaw channel extensions (e.g. Telegram)
 * to local Cowork sessions so that conversations are visible in the LobsterAI UI.
 */

import type { CoworkStore } from '../coworkStore';
import type { IMStore } from '../im/imStore';
import type { IMPlatform } from '../im/types';

const LOBSTERAI_SESSION_PREFIX = 'lobsterai:';

/** Known OpenClaw channel prefixes mapped to IM platforms. */
const CHANNEL_PLATFORM_MAP: Record<string, IMPlatform> = {
  telegram: 'telegram',
  discord: 'discord',
};

/** Parse a channel sessionKey like "telegram:dm:123456789" into platform + conversationId. */
function parseChannelSessionKey(sessionKey: string): { platform: IMPlatform; conversationId: string } | null {
  if (!sessionKey || sessionKey.startsWith(LOBSTERAI_SESSION_PREFIX)) return null;

  const colonIndex = sessionKey.indexOf(':');
  if (colonIndex <= 0) return null;

  const channelName = sessionKey.slice(0, colonIndex);
  const platform = CHANNEL_PLATFORM_MAP[channelName];
  if (!platform) return null;

  const conversationId = sessionKey.slice(colonIndex + 1);
  if (!conversationId) return null;

  return { platform, conversationId };
}

/** Map from channel prefix to title label. */
const CHANNEL_TITLE_PREFIX: Record<string, string> = {
  telegram: '[TG]',
  discord: '[Discord]',
};

export interface ChannelSessionSyncDeps {
  coworkStore: CoworkStore;
  imStore: IMStore;
  getDefaultCwd: () => string;
}

export class OpenClawChannelSessionSync {
  private readonly coworkStore: CoworkStore;
  private readonly imStore: IMStore;
  private readonly getDefaultCwd: () => string;

  /** In-memory cache: openclawSessionKey → local sessionId. */
  private readonly syncedSessionKeys = new Map<string, string>();

  constructor(deps: ChannelSessionSyncDeps) {
    this.coworkStore = deps.coworkStore;
    this.imStore = deps.imStore;
    this.getDefaultCwd = deps.getDefaultCwd;
  }

  /**
   * Try to resolve or create a local Cowork session for a channel-originated sessionKey.
   * Returns the local sessionId if the sessionKey belongs to a channel, or null if not.
   */
  resolveOrCreateSession(sessionKey: string): string | null {
    // 1. Skip LobsterAI-originated sessions
    if (sessionKey.startsWith(LOBSTERAI_SESSION_PREFIX)) return null;

    // 2. Check in-memory cache
    const cached = this.syncedSessionKeys.get(sessionKey);
    if (cached) return cached;

    // 3. Parse channel info
    const parsed = parseChannelSessionKey(sessionKey);
    if (!parsed) return null;

    // 4. Check persistent mapping in im_session_mappings
    const existingMapping = this.imStore.getSessionMapping(parsed.conversationId, parsed.platform);
    if (existingMapping) {
      // Verify the Cowork session still exists
      const session = this.coworkStore.getSession(existingMapping.coworkSessionId);
      if (session) {
        this.syncedSessionKeys.set(sessionKey, existingMapping.coworkSessionId);
        this.imStore.updateSessionLastActive(parsed.conversationId, parsed.platform);
        return existingMapping.coworkSessionId;
      }
      // Session was deleted, remove stale mapping
      this.imStore.deleteSessionMapping(parsed.conversationId, parsed.platform);
    }

    // 5. Create new Cowork session
    const titlePrefix = CHANNEL_TITLE_PREFIX[parsed.platform] || `[${parsed.platform}]`;
    const shortId = parsed.conversationId.length > 12
      ? parsed.conversationId.slice(-12)
      : parsed.conversationId;
    const title = `${titlePrefix} ${shortId}`;
    const cwd = this.getDefaultCwd();

    const session = this.coworkStore.createSession(title, cwd, '', 'local');
    console.log(
      `[ChannelSessionSync] Created session for ${parsed.platform} conversation ${parsed.conversationId}: ${session.id}`,
    );

    // 6. Persist mapping
    this.imStore.createSessionMapping(parsed.conversationId, parsed.platform, session.id);

    // 7. Cache
    this.syncedSessionKeys.set(sessionKey, session.id);

    return session.id;
  }

  /** Check whether a sessionKey belongs to a recognized channel (not a LobsterAI session). */
  isChannelSessionKey(sessionKey: string): boolean {
    if (!sessionKey || sessionKey.startsWith(LOBSTERAI_SESSION_PREFIX)) return false;
    return parseChannelSessionKey(sessionKey) !== null;
  }

  /** Clear in-memory cache (e.g. on gateway reconnect). */
  clearCache(): void {
    this.syncedSessionKeys.clear();
  }
}
