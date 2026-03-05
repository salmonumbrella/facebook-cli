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

interface DoctorOptions {
  offline: boolean;
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

function parseDoctorOptions(args: string[]): DoctorOptions {
  const out: DoctorOptions = {
    offline: false,
    scopes: defaultScopes(),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--offline") {
      out.offline = true;
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
    throw new Error(`Unknown auth doctor option: ${arg}`);
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

interface DoctorCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  details: string;
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

    case "doctor": {
      const options = parseDoctorOptions(rest);
      const checks: DoctorCheck[] = [];
      const redirectUri = process.env.FB_OAUTH_REDIRECT_URI ?? "http://localhost:8484/callback";
      const appId = process.env.FB_APP_ID;
      const appSecret = process.env.FB_APP_SECRET;
      const accessToken = runtime.accessToken;

      const store = createProfileStore(runtime.profilePath);
      const data = store.load();
      const profile = data.profiles[runtime.profileName] ?? {};

      checks.push({
        name: "profile_store",
        status: "pass",
        details: `using ${runtime.profilePath} (active: ${runtime.profileName})`,
      });

      checks.push({
        name: "app_id",
        status: appId ? "pass" : "fail",
        details: appId ? "FB_APP_ID is set" : "FB_APP_ID is missing",
      });

      checks.push({
        name: "app_secret",
        status: appSecret ? "pass" : "fail",
        details: appSecret ? "FB_APP_SECRET is set" : "FB_APP_SECRET is missing",
      });

      try {
        const url = new URL(redirectUri);
        const schemeOk = url.protocol === "http:" || url.protocol === "https:";
        checks.push({
          name: "oauth_redirect_uri",
          status: schemeOk ? "pass" : "fail",
          details: schemeOk
            ? `configured redirect: ${redirectUri}`
            : `unsupported redirect scheme: ${url.protocol}`,
        });
      } catch {
        checks.push({
          name: "oauth_redirect_uri",
          status: "fail",
          details: `invalid URL: ${redirectUri}`,
        });
      }

      checks.push({
        name: "access_token",
        status: accessToken ? "pass" : "fail",
        details: accessToken
          ? `token available (${tokenPreview(accessToken)})`
          : "no token resolved from cli/env/profile",
      });

      if (accessToken) {
        if (options.offline) {
          checks.push({
            name: "token_debug",
            status: "warn",
            details: "skipped token introspection because --offline was set",
          });
        } else if (!appId || !appSecret) {
          checks.push({
            name: "token_debug",
            status: "warn",
            details: "cannot debug token without FB_APP_ID and FB_APP_SECRET",
          });
        } else {
          try {
            const debug = await debugToken({
              inputToken: accessToken,
              appAccessToken: buildAppAccessToken(appId, appSecret),
              version,
            });
            const debugData = debug?.data;
            const isValid = Boolean(debugData?.is_valid);
            checks.push({
              name: "token_valid",
              status: isValid ? "pass" : "fail",
              details: isValid ? "token is valid" : "token is invalid",
            });

            const grantedScopes = Array.isArray(debugData?.scopes)
              ? debugData.scopes.filter((scope: unknown) => typeof scope === "string")
              : [];
            const missingScopes = options.scopes.filter((scope) => !grantedScopes.includes(scope));
            checks.push({
              name: "token_scopes",
              status: missingScopes.length === 0 ? "pass" : "fail",
              details:
                missingScopes.length === 0
                  ? "all required scopes are present"
                  : `missing scopes: ${missingScopes.join(", ")}`,
            });

            if (typeof debugData?.expires_at === "number") {
              checks.push({
                name: "token_expiry",
                status: "pass",
                details: `expires_at: ${new Date(debugData.expires_at * 1000).toISOString()}`,
              });
            }
          } catch (error) {
            checks.push({
              name: "token_debug",
              status: "fail",
              details: `debug_token failed: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        }
      }

      const failures = checks.filter((check) => check.status === "fail");
      const warnings = checks.filter((check) => check.status === "warn");
      const nextSteps: string[] = [];
      if (failures.some((check) => check.name === "app_id" || check.name === "app_secret")) {
        nextSteps.push("Set FB_APP_ID and FB_APP_SECRET in your environment or .env");
      }
      if (failures.some((check) => check.name === "access_token")) {
        nextSteps.push("Run `fbcli auth login` to store a token in your active profile");
      }
      if (failures.some((check) => check.name === "oauth_redirect_uri")) {
        nextSteps.push("Set FB_OAUTH_REDIRECT_URI to a valid callback URL");
      }
      if (failures.some((check) => check.name === "token_scopes")) {
        nextSteps.push("Re-run `fbcli auth login --scopes ...` with required permissions");
      }
      if (warnings.some((check) => check.name === "token_debug")) {
        nextSteps.push("Run `fbcli auth doctor` without --offline to verify token with Facebook");
      }

      return {
        ok: failures.length === 0,
        profile: runtime.profileName,
        tokenSource: accessToken ? "cli/env/profile" : "none",
        resolvedToken: accessToken ? tokenPreview(accessToken) : undefined,
        requiredScopes: options.scopes,
        storedAuth: profile.auth ?? null,
        checks,
        summary: {
          pass: checks.filter((check) => check.status === "pass").length,
          warn: warnings.length,
          fail: failures.length,
        },
        nextSteps,
      };
    }

    default:
      throw new Error(
        "Usage: fbcli auth <login|status|logout|refresh|doctor> [--scopes ...] [--redirect-uri ...]",
      );
  }
}
