import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { createServer } from "node:http";
import { delimiter, join } from "node:path";
import type { RuntimeContext } from "../../lib/context.js";
import {
  buildAppAccessToken,
  buildFacebookOAuthUrl,
  computeExpiresAt,
  debugToken,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  type DebugTokenInput,
  type ExchangeCodeForTokenInput,
  type ExchangeForLongLivedTokenInput,
} from "../../../src/lib/auth.js";
import { createProfileStore, type ProfileAuthData } from "../../../src/lib/profiles.js";
import { getCliEnvVar } from "../../lib/env.js";
import {
  defaultScopes,
  normalizeScopes,
  requireAppCredentials,
  resolveAuthVersion,
  tokenPreview,
  validateLocalRedirectUri,
} from "./shared.js";

export interface LoginOptions {
  redirectUri: string;
  timeoutMs: number;
  openBrowser: boolean;
  printOnly: boolean;
  scopes: string[];
}

export interface OAuthCallback {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
}

export interface OpenBrowserResult {
  opened: boolean;
  error?: string;
}

export interface OAuthFlowDeps {
  openBrowser: (url: string) => OpenBrowserResult;
  waitForOAuthCallback: (
    redirectUri: string,
    expectedState: string,
    timeoutMs: number,
  ) => Promise<OAuthCallback>;
  exchangeCodeForToken: (input: ExchangeCodeForTokenInput) => Promise<any>;
  exchangeForLongLivedToken: (input: ExchangeForLongLivedTokenInput) => Promise<any>;
  debugToken: (input: DebugTokenInput) => Promise<any>;
}

export function parseLoginOptions(args: string[]): LoginOptions {
  const out: LoginOptions = {
    redirectUri: getCliEnvVar("FB_OAUTH_REDIRECT_URI") ?? "http://localhost:8484/callback",
    timeoutMs: Number(getCliEnvVar("FB_OAUTH_TIMEOUT_MS") ?? "180000"),
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

  const redirectValidation = validateLocalRedirectUri(out.redirectUri);
  if (!redirectValidation.ok) {
    throw new Error(redirectValidation.error);
  }
  out.redirectUri = redirectValidation.normalized ?? out.redirectUri;

  return out;
}

function openBrowserDefault(url: string): OpenBrowserResult {
  const command =
    process.platform === "darwin"
      ? { cmd: "open", args: [url] }
      : process.platform === "win32"
        ? { cmd: "cmd", args: ["/c", "start", "", url] }
        : { cmd: "xdg-open", args: [url] };

  if (!commandExists(command.cmd)) {
    return { opened: false, error: `${command.cmd} is not available on PATH` };
  }

  try {
    const child = spawn(command.cmd, command.args, { stdio: "ignore", detached: true });
    child.unref();
  } catch (error) {
    return {
      opened: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return { opened: true };
}

function commandExists(command: string): boolean {
  const pathEnv = process.env.PATH ?? "";
  if (!pathEnv) return false;

  const mode = process.platform === "win32" ? constants.F_OK : constants.X_OK;
  const extensions =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
          .split(";")
          .map((value) => value.trim().toLowerCase())
      : [""];

  for (const dir of pathEnv.split(delimiter)) {
    if (!dir) continue;
    for (const ext of extensions) {
      const candidate = join(dir, process.platform === "win32" ? `${command}${ext}` : command);
      try {
        accessSync(candidate, mode);
        return true;
      } catch {
        // Continue probing PATH.
      }
    }
  }
  return false;
}

async function waitForOAuthCallbackDefault(
  redirectUri: string,
  expectedState: string,
  timeoutMs: number,
): Promise<OAuthCallback> {
  const callbackUrl = new URL(redirectUri);
  const port = Number(callbackUrl.port || "80");
  const pathname = callbackUrl.pathname || "/";

  return new Promise<OAuthCallback>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(
        new Error(
          `OAuth callback timed out after ${timeoutMs}ms. Open the auth URL and complete login, then ensure your browser can reach ${redirectUri}.`,
        ),
      );
    }, timeoutMs);

    const server = createServer((req, res) => {
      const reqUrl = new URL(req.url ?? "/", redirectUri);
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
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "EADDRINUSE") {
        reject(
          new Error(
            `Failed to start OAuth callback server on port ${port}: address already in use.`,
          ),
        );
        return;
      }
      reject(new Error(`Failed to start OAuth callback server on port ${port}: ${err.message}`));
    });

    server.listen(port);
  });
}

export function defaultOAuthFlowDeps(): OAuthFlowDeps {
  return {
    openBrowser: openBrowserDefault,
    waitForOAuthCallback: waitForOAuthCallbackDefault,
    exchangeCodeForToken,
    exchangeForLongLivedToken,
    debugToken,
  };
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

export async function runAuthLogin(
  args: string[],
  runtime: RuntimeContext,
  deps: OAuthFlowDeps = defaultOAuthFlowDeps(),
): Promise<unknown> {
  const options = parseLoginOptions(args);
  const { appId, appSecret } = requireAppCredentials("login");
  const version = resolveAuthVersion(runtime);
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

  console.error(`Complete Facebook login in your browser: ${authUrl}`);
  let browser = {
    attempted: options.openBrowser,
    opened: false,
    error: undefined as string | undefined,
  };
  if (options.openBrowser) {
    const opened = deps.openBrowser(authUrl);
    browser = { attempted: true, opened: opened.opened, error: opened.error };
    if (!opened.opened) {
      console.error(`Could not open browser automatically: ${opened.error ?? "unknown error"}`);
      console.error("Open the URL above manually.");
    }
  }

  const callback = await deps.waitForOAuthCallback(options.redirectUri, state, options.timeoutMs);
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

  const shortLived = await deps.exchangeCodeForToken({
    appId,
    appSecret,
    redirectUri: options.redirectUri,
    code: callback.code,
    version,
  });
  const shortToken = shortLived?.access_token as string | undefined;
  if (!shortToken) throw new Error("Facebook token exchange did not return access_token");

  const longLived = await deps.exchangeForLongLivedToken({
    appId,
    appSecret,
    accessToken: shortToken,
    version,
  });
  const finalToken = (longLived?.access_token as string | undefined) ?? shortToken;
  const expiresIn = Number(longLived?.expires_in ?? shortLived?.expires_in ?? 0) || undefined;

  const appAccessToken = buildAppAccessToken(appId, appSecret);
  const debug = await deps.debugToken({
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
    auth: profileAuthData(expiresIn, longLived?.token_type ?? shortLived?.token_type, debug?.data),
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
    browser,
  };
}

export async function runAuthRefresh(
  runtime: RuntimeContext,
  deps: OAuthFlowDeps = defaultOAuthFlowDeps(),
): Promise<unknown> {
  const { appId, appSecret } = requireAppCredentials("refresh");
  const version = resolveAuthVersion(runtime);
  const store = createProfileStore(runtime.profilePath);
  const data = store.load();
  const existing = data.profiles[runtime.profileName] ?? {};
  const currentToken = existing.access_token ?? runtime.accessToken;
  if (!currentToken) {
    throw new Error("No stored access token to refresh. Run `auth login` first.");
  }

  const refreshed = await deps.exchangeForLongLivedToken({
    appId,
    appSecret,
    accessToken: currentToken,
    version,
  });
  const newToken = (refreshed?.access_token as string | undefined) ?? currentToken;
  const expiresIn = Number(refreshed?.expires_in ?? 0) || undefined;
  const appAccessToken = buildAppAccessToken(appId, appSecret);
  const debug = await deps.debugToken({
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
