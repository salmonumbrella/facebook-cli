import { homedir } from "node:os";
import { join } from "node:path";
import { createProfileStore } from "../../src/lib/profiles.js";
import { resolveAccessToken } from "../../src/config.js";

export type OutputFormat = "json" | "table" | "csv";

export interface GlobalOptions {
  output: OutputFormat;
  dryRun: boolean;
  apiVersion?: string;
  accessToken?: string;
  profile?: string;
  args: string[];
}

export interface RuntimeContext {
  output: OutputFormat;
  dryRun: boolean;
  apiVersion?: string;
  accessToken?: string;
  profileName: string;
  profilePath: string;
}

const FLAG_WITH_VALUE = new Set(["--output", "--api-version", "--access-token", "--profile"]);

export function parseGlobalOptions(argv: string[]): GlobalOptions {
  const out: GlobalOptions = {
    output: "json",
    dryRun: false,
    args: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      out.args.push(token);
      continue;
    }

    if (token === "--dry-run") {
      out.dryRun = true;
      continue;
    }

    if (FLAG_WITH_VALUE.has(token)) {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${token}`);
      }
      i += 1;

      if (token === "--output") {
        if (value === "json" || value === "table" || value === "csv") out.output = value;
        else throw new Error(`Invalid --output format: ${value}`);
      } else if (token === "--api-version") {
        out.apiVersion = value;
      } else if (token === "--access-token") {
        out.accessToken = value;
      } else if (token === "--profile") {
        out.profile = value;
      }
      continue;
    }

    // Unknown global flags are left in command args for command-level parsing.
    out.args.push(token);
  }

  return out;
}

export function resolveRuntimeContext(options: GlobalOptions): RuntimeContext {
  const profilePath = join(homedir(), ".config", "facebook-cli", "profiles.json");
  const store = createProfileStore(profilePath);
  const data = store.load();
  const profileName = options.profile ?? data.active ?? "default";
  const profile = data.profiles[profileName] ?? {};

  const accessToken = resolveAccessToken(
    options.accessToken,
    process.env.FB_ACCESS_TOKEN,
    profile.access_token,
  );

  return {
    output: options.output,
    dryRun: options.dryRun,
    apiVersion: options.apiVersion ?? process.env.FB_API_VERSION,
    accessToken,
    profileName,
    profilePath,
  };
}
