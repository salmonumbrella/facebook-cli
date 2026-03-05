import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import {
  buildAppAccessToken,
  buildFacebookOAuthUrl,
  clearStoredAuth,
  computeExpiresAt,
  debugToken,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
} from "../../src/lib/auth.js";
import { createProfileStore, type ProfileAuthData } from "../../src/lib/profiles.js";
import { DEFAULT_GRAPH_API_VERSION } from "../../src/config.js";
import { redactToken } from "../../src/lib/redact.js";
import type { RuntimeContext } from "../lib/context.js";

interface LoginOptions {
  redirectUri: string;
  timeoutMs: number;
  openBrowser: boolean;
  printOnly: boolean;
  scopes: string[];
}

interface OAuthCallback {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
}

const DEFAULT_LOGIN_SCOPES = [
  "public_profile",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "ads_read",
  "ads_management",
  "business_management",
];

function normalizeScopes(scopes: string[]): string[] {
  return [...new Set(scopes.map((scope) => scope.trim()).filter(Boolean))];
}

function defaultScopes(): string[] {
  const envScopes = process.env.FB_OAUTH_SCOPES;
  if (!envScopes) return DEFAULT_LOGIN_SCOPES;
  const parsed = normalizeScopes(envScopes.split(","));
  return parsed.length > 0 ? parsed : DEFAULT_LOGIN_SCOPES;
}

function parseLoginOptions(args: string[]): LoginOptions {
  const out: LoginOptions = {
    redirectUri: process.env.FB_OAUTH_REDIRECT_URI ?? "http://localhost:8484/callback",
    timeoutMs: Number(process.env.FB_OAUTH_TIMEOUT_MS ?? "180000"),
    openBrowser: true,
    printOnly: false,
    scopes: defaultScopes(),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--redirect-uri") {
      const value = args[i + 1];
      if (!value) throw new Error("Missing value for --redirect-uri");
      out.redirectUri = value;
      i += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      const value = args[i + 1];
      if (!value) throw new Error("Missing value for --timeout-ms");
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("--timeout-ms must be a positive number");
      }
      out.timeoutMs = parsed;
      i += 1;
      continue;
    }
    if (arg === "--scopes") {
      const value = args[i + 1];
      if (!value) throw new Error("Missing value for --scopes");
      out.scopes = normalizeScopes(value.split(","));
      i += 1;
      continue;
    }
    if (arg === "--scope") {
      const value = args[i + 1];
      if (!value) throw new Error("Missing value for --scope");
      out.scopes = normalizeScopes([...out.scopes, value]);
      i += 1;
      continue;
    }
    if (arg === "--no-open") {
      out.openBrowser = false;
      continue;
    }
    if (arg === "--print-only") {
      out.printOnly = true;
      continue;
    }
    throw new Error(`Unknown auth login option: ${arg}`);
  }

  if (out.scopes.length === 0) {
    throw new Error("No OAuth scopes configured. Use --scopes or FB_OAUTH_SCOPES.");
  }

  return out;
}

function openBrowser(url: string): void {
  if (process.platform === "darwin") {
    spawn("open", [url], { stdio: "ignore", detached: true }).unref();
    return;
  }
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true }).unref();
    return;
  }
  spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
}

function tokenPreview(token?: string): string | undefined {
  if (!token) return undefined;
  const redacted = redactToken(token);
  if (redacted !== token) return redacted;
  if (token.length <= 10) return `${token.slice(0, 4)}...`;
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

async function waitForOAuthCallback(
  redirectUri: string,
  expectedState: string,
  timeoutMs: number,
): Promise<OAuthCallback> {
  const callbackUrl = new URL(redirectUri);
  if (callbackUrl.protocol !== "http:") {
    throw new Error("auth login callback currently supports http:// redirect URIs only");
  }
  const hostname = callbackUrl.hostname || "localhost";
  const port = Number(callbackUrl.port || "80");
  const pathname = callbackUrl.pathname || "/";

  return new Promise<OAuthCallback>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(
        new Error(
          `OAuth callback timed out after ${timeoutMs}ms. Open the auth URL and complete login.`,
        ),
      );
    }, timeoutMs);

    const server = createServer((req, res) => {
      const reqUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? `${hostname}:${port}`}`);
      if (reqUrl.pathname !== pathname) {
        res.statusCode = 404;
        res.end("Not Found");
        return;
      }

      const code = reqUrl.searchParams.get("code") ?? undefined;
      const state = reqUrl.searchParams.get("state") ?? undefined;
      const error = reqUrl.searchParams.get("error") ?? undefined;
      const errorDescription = reqUrl.searchParams.get("error_description") ?? undefined;

      res.setHeader("content-type", "text/html; charset=utf-8");
      if (error || !code) {
        res.statusCode = 400;
        res.end("<h1>Facebook login failed.</h1><p>You can close this window.</p>");
      } else if (state !== expectedState) {
        res.statusCode = 400;
        res.end("<h1>OAuth state mismatch.</h1><p>You can close this window.</p>");
      } else {
        res.statusCode = 200;
        res.end(
          "<h1>Login complete.</h1><p>You can close this window and return to your terminal.</p>",
        );
      }

      clearTimeout(timeout);
      server.close(() => {
        resolve({ code, state, error, errorDescription });
      });
    });

    server.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    server.listen(port, hostname);
  });
}

function requireAppCredentials() {
  const appId = process.env.FB_APP_ID;
  const appSecret = process.env.FB_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("FB_APP_ID and FB_APP_SECRET are required for auth login/refresh");
  }
  return { appId, appSecret };
}

function profileAuthData(
  expiresIn: number | undefined,
  tokenType: unknown,
  debugData: any,
): ProfileAuthData {
  return {
    provider: "facebook_oauth",
    obtained_at: new Date().toISOString(),
    expires_in: expiresIn,
    expires_at: computeExpiresAt(expiresIn),
    token_type: typeof tokenType === "string" ? tokenType : undefined,
    scopes: Array.isArray(debugData?.scopes)
      ? debugData.scopes.filter((scope: unknown) => typeof scope === "string")
      : undefined,
    user_id: typeof debugData?.user_id === "string" ? debugData.user_id : undefined,
    app_id: typeof debugData?.app_id === "string" ? debugData.app_id : undefined,
    is_valid: typeof debugData?.is_valid === "boolean" ? debugData.is_valid : undefined,
  };
}

export async function handleAuthCommand(args: string[], runtime: RuntimeContext): Promise<unknown> {
  const sub = args[0];
  const rest = args.slice(1);
  const version = runtime.apiVersion ?? process.env.FB_API_VERSION ?? DEFAULT_GRAPH_API_VERSION;

  switch (sub) {
    case "login": {
      const options = parseLoginOptions(rest);
      const { appId, appSecret } = requireAppCredentials();
      const state = randomUUID();
      const authUrl = buildFacebookOAuthUrl({
        appId,
        redirectUri: options.redirectUri,
        state,
        scopes: options.scopes,
        version,
      });

      if (options.printOnly) {
        return {
          ok: true,
          authUrl,
          redirectUri: options.redirectUri,
          scopes: options.scopes,
        };
      }

      const callbackPromise = waitForOAuthCallback(options.redirectUri, state, options.timeoutMs);
      if (options.openBrowser) openBrowser(authUrl);

      const callback = await callbackPromise;
      if (callback.error) {
        throw new Error(
          `Facebook authorization failed: ${callback.errorDescription ?? callback.error}`,
        );
      }
      if (!callback.code) {
        throw new Error("OAuth callback did not include an authorization code");
      }
      if (callback.state !== state) {
        throw new Error("OAuth state mismatch");
      }

      const shortLived = await exchangeCodeForToken({
        appId,
        appSecret,
        redirectUri: options.redirectUri,
        code: callback.code,
        version,
      });
      const shortToken = shortLived?.access_token as string | undefined;
      if (!shortToken) throw new Error("Facebook token exchange did not return access_token");

      const longLived = await exchangeForLongLivedToken({
        appId,
        appSecret,
        accessToken: shortToken,
        version,
      });
      const finalToken = (longLived?.access_token as string | undefined) ?? shortToken;
      const expiresIn = Number(longLived?.expires_in ?? shortLived?.expires_in ?? 0) || undefined;

      const appAccessToken = buildAppAccessToken(appId, appSecret);
      const debug = await debugToken({
        inputToken: finalToken,
        appAccessToken,
        version,
      });

      const store = createProfileStore(runtime.profilePath);
      const data = store.load();
      const existing = data.profiles[runtime.profileName] ?? {};
      data.profiles[runtime.profileName] = {
        ...existing,
        access_token: finalToken,
        auth: profileAuthData(
          expiresIn,
          longLived?.token_type ?? shortLived?.token_type,
          debug?.data,
        ),
      };
      data.active = runtime.profileName;
      store.save(data);

      return {
        ok: true,
        profile: runtime.profileName,
        redirectUri: options.redirectUri,
        scopesRequested: options.scopes,
        scopesGranted: debug?.data?.scopes ?? [],
        expiresIn,
        expiresAt: computeExpiresAt(expiresIn),
        token: tokenPreview(finalToken),
      };
    }

    case "status": {
      const store = createProfileStore(runtime.profilePath);
      const data = store.load();
      const profile = data.profiles[runtime.profileName] ?? {};
      return {
        authenticated: Boolean(runtime.accessToken),
        profile: runtime.profileName,
        source: runtime.accessToken ? "cli/env/profile" : "none",
        token: tokenPreview(runtime.accessToken),
        auth: profile.auth ?? null,
      };
    }

    case "logout": {
      const store = createProfileStore(runtime.profilePath);
      const next = clearStoredAuth(store.load(), runtime.profileName);
      store.save(next);
      return { ok: true, profile: runtime.profileName, loggedOut: true };
    }

    case "refresh": {
      const { appId, appSecret } = requireAppCredentials();
      const store = createProfileStore(runtime.profilePath);
      const data = store.load();
      const existing = data.profiles[runtime.profileName] ?? {};
      const currentToken = existing.access_token ?? runtime.accessToken;
      if (!currentToken) {
        throw new Error("No stored access token to refresh. Run `auth login` first.");
      }

      const refreshed = await exchangeForLongLivedToken({
        appId,
        appSecret,
        accessToken: currentToken,
        version,
      });
      const newToken = (refreshed?.access_token as string | undefined) ?? currentToken;
      const expiresIn = Number(refreshed?.expires_in ?? 0) || undefined;
      const appAccessToken = buildAppAccessToken(appId, appSecret);
      const debug = await debugToken({
        inputToken: newToken,
        appAccessToken,
        version,
      });

      data.profiles[runtime.profileName] = {
        ...existing,
        access_token: newToken,
        auth: profileAuthData(expiresIn, refreshed?.token_type, debug?.data),
      };
      data.active = runtime.profileName;
      store.save(data);

      return {
        ok: true,
        profile: runtime.profileName,
        expiresIn,
        expiresAt: computeExpiresAt(expiresIn),
        token: tokenPreview(newToken),
      };
    }

    default:
      throw new Error(
        "Usage: fbcli auth <login|status|logout|refresh> [--scopes ...] [--redirect-uri ...]",
      );
  }
}
