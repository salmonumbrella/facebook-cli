package config

import (
	"os"
	"path/filepath"
	"strings"
)

const cliEnvRelativePath = "cli/.env"

// Env resolves variables from process env first, then cli/.env.
type Env struct {
	values map[string]string
	path   string
}

// NewEnv loads cli/.env relative to the current working tree.
func NewEnv() *Env {
	env, err := LoadEnvironment("")
	if err != nil {
		return &Env{values: map[string]string{}}
	}
	return env
}

// NewEnvFromValues creates an Env from explicit cli/.env values.
func NewEnvFromValues(values map[string]string) *Env {
	cloned := make(map[string]string, len(values))
	for key, value := range values {
		cloned[key] = value
	}
	return &Env{values: cloned}
}

// LoadEnvironment discovers and loads cli/.env relative to startDir.
func LoadEnvironment(startDir string) (*Env, error) {
	path, found, err := findCLIEnvPath(startDir)
	if err != nil {
		return nil, err
	}

	env := NewEnvFromValues(nil)
	if !found {
		return env, nil
	}

	values, err := readCLIEnv(path)
	if err != nil {
		return nil, err
	}

	env.values = values
	env.path = path
	return env, nil
}

// Lookup returns process env first, then cli/.env values.
func (e *Env) Lookup(name string) (string, bool) {
	if value, ok := os.LookupEnv(name); ok {
		return value, true
	}
	if e == nil {
		return "", false
	}
	value, ok := e.values[name]
	return value, ok
}

// Get returns the resolved env value or an empty string when unset.
func (e *Env) Get(name string) string {
	value, _ := e.Lookup(name)
	return value
}

// CLIEnvPath returns the loaded cli/.env path, if one was found.
func (e *Env) CLIEnvPath() string {
	if e == nil {
		return ""
	}
	return e.path
}

// CLIEnvPath resolves cli/.env relative to the current working directory tree.
func CLIEnvPath() string {
	if value, ok := os.LookupEnv("FBCLI_ENV_PATH"); ok && value != "" {
		return value
	}

	path, found, err := findCLIEnvPath("")
	if err != nil || !found {
		return ""
	}
	return path
}

// ParseCLIEnv parses the small dotenv subset supported by the TS CLI.
func ParseCLIEnv(text string) map[string]string {
	out := map[string]string{}

	for _, rawLine := range strings.Split(text, "\n") {
		line := strings.TrimSpace(strings.TrimSuffix(rawLine, "\r"))
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		index := strings.IndexRune(line, '=')
		if index < 0 {
			continue
		}

		key := strings.TrimSpace(line[:index])
		if !validEnvKey(key) {
			continue
		}

		value := strings.TrimSpace(line[index+1:])
		if len(value) >= 2 {
			if (value[0] == '"' && value[len(value)-1] == '"') || (value[0] == '\'' && value[len(value)-1] == '\'') {
				value = value[1 : len(value)-1]
			}
		}

		out[key] = value
	}

	return out
}

func validEnvKey(key string) bool {
	if key == "" {
		return false
	}
	if !isEnvStart(key[0]) {
		return false
	}
	for i := 1; i < len(key); i++ {
		if !isEnvPart(key[i]) {
			return false
		}
	}
	return true
}

func isEnvStart(ch byte) bool {
	return ch == '_' || ch >= 'A' && ch <= 'Z' || ch >= 'a' && ch <= 'z'
}

func isEnvPart(ch byte) bool {
	return isEnvStart(ch) || ch >= '0' && ch <= '9'
}

func readCLIEnv(path string) (map[string]string, error) {
	data, err := os.ReadFile(path) //nolint:gosec // Local config file path controlled by the CLI user.
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]string{}, nil
		}
		return nil, err
	}
	return ParseCLIEnv(string(data)), nil
}

func findCLIEnvPath(startDir string) (string, bool, error) {
	if value, ok := os.LookupEnv("FBCLI_ENV_PATH"); ok && value != "" {
		return value, true, nil
	}

	dir, ok, err := resolveSearchStart(startDir)
	if err != nil || !ok {
		return "", false, err
	}

	for {
		candidate := filepath.Join(dir, cliEnvRelativePath)
		info, statErr := os.Stat(candidate)
		if statErr == nil && !info.IsDir() {
			return candidate, true, nil
		}
		if statErr != nil && !os.IsNotExist(statErr) {
			return "", false, statErr
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			return "", false, nil
		}
		dir = parent
	}
}

func resolveSearchStart(startDir string) (string, bool, error) {
	if startDir == "" {
		wd, err := os.Getwd()
		if err != nil {
			return "", false, nil
		}
		startDir = wd
	}

	abs, err := filepath.Abs(startDir)
	if err != nil {
		return "", false, err
	}

	info, err := os.Stat(abs)
	if err == nil && !info.IsDir() {
		abs = filepath.Dir(abs)
	}

	return abs, true, nil
}

// ConfigDirForHome returns the exact ~/.config/facebook-cli directory.
func ConfigDirForHome(home string) string {
	return filepath.Join(home, ".config", AppName)
}

// ProfileStorePathForHome returns the default profiles.json path.
func ProfileStorePathForHome(home string) string {
	return filepath.Join(ConfigDirForHome(home), "profiles.json")
}

// DefaultProfilePath returns the default profile store path.
func DefaultProfilePath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(".config", AppName, "profiles.json")
	}
	return ProfileStorePathForHome(home)
}
