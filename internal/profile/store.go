package profile

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
)

const DefaultProfileName = "default"

// AuthData stores Facebook OAuth metadata for a profile.
type AuthData struct {
	Provider   string   `json:"provider,omitempty"`
	ObtainedAt string   `json:"obtained_at,omitempty"`
	ExpiresAt  string   `json:"expires_at,omitempty"`
	ExpiresIn  *int     `json:"expires_in,omitempty"`
	TokenType  string   `json:"token_type,omitempty"`
	Scopes     []string `json:"scopes,omitempty"`
	UserID     string   `json:"user_id,omitempty"`
	AppID      string   `json:"app_id,omitempty"`
	IsValid    *bool    `json:"is_valid,omitempty"`
}

// Data stores the auth token and defaults for one named profile.
type Data struct {
	AccessToken string            `json:"access_token,omitempty"`
	Defaults    map[string]string `json:"defaults,omitempty"`
	Auth        *AuthData         `json:"auth,omitempty"`
}

// StoreData is the serialized profile store shape.
type StoreData struct {
	Active   string          `json:"active"`
	Profiles map[string]Data `json:"profiles"`
}

// Store reads and writes profiles.json on disk.
type Store struct {
	path string
}

// New constructs a profile store for the given path.
func New(path string) *Store {
	return &Store{path: path}
}

// NewStore is an alias kept for clarity in callers/tests.
func NewStore(path string) *Store {
	return New(path)
}

// Path returns the underlying profiles.json path.
func (s *Store) Path() string {
	if s == nil {
		return ""
	}
	return s.path
}

// DefaultStoreData returns the default single-profile store.
func DefaultStoreData() StoreData {
	return StoreData{
		Active: DefaultProfileName,
		Profiles: map[string]Data{
			DefaultProfileName: {},
		},
	}
}

// Load reads and validates the store. Missing files resolve to defaults.
func (s *Store) Load() (StoreData, error) {
	if s == nil || s.path == "" {
		return DefaultStoreData(), nil
	}

	data, err := os.ReadFile(s.path) //nolint:gosec // Local profile store path controlled by the CLI user.
	if err != nil {
		if os.IsNotExist(err) {
			return DefaultStoreData(), nil
		}
		return StoreData{}, err
	}

	raw, err := decodeStoreJSON(data)
	if err != nil {
		return StoreData{}, fmt.Errorf("profile store '%s' is not valid JSON", s.path)
	}

	return parseStoreData(raw, s.path)
}

// Save writes the store, ensuring the parent directory exists.
func (s *Store) Save(data StoreData) error {
	if s == nil || s.path == "" {
		return fmt.Errorf("profile store path is required")
	}

	normalized := normalizeStoreData(data)
	encoded, err := json.MarshalIndent(normalized, "", "  ")
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return err
	}
	return os.WriteFile(s.path, encoded, 0o600)
}

func normalizeStoreData(data StoreData) StoreData {
	if data.Active == "" {
		data.Active = DefaultProfileName
	}
	if data.Profiles == nil {
		data.Profiles = map[string]Data{}
	}
	if _, ok := data.Profiles[data.Active]; !ok {
		data.Profiles[data.Active] = Data{}
	}
	return data
}

func decodeStoreJSON(data []byte) (any, error) {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()

	var raw any
	if err := decoder.Decode(&raw); err != nil {
		return nil, err
	}

	var extra any
	if err := decoder.Decode(&extra); err == nil {
		return nil, fmt.Errorf("unexpected extra JSON input")
	}

	return raw, nil
}

func parseStoreData(raw any, filePath string) (StoreData, error) {
	object, ok := raw.(map[string]any)
	if !ok {
		return StoreData{}, invalidStoreShape(filePath, "profile store", "expected object")
	}

	active, err := requiredStoreString(object, filePath, "active")
	if err != nil {
		return StoreData{}, err
	}

	profilesValue, ok := object["profiles"]
	if !ok {
		return StoreData{}, invalidStoreShape(filePath, "profiles", "required")
	}

	profilesObject, ok := profilesValue.(map[string]any)
	if !ok {
		return StoreData{}, invalidStoreShape(filePath, "profiles", "expected object")
	}

	data := StoreData{
		Active:   active,
		Profiles: make(map[string]Data, len(profilesObject)),
	}

	for name, rawProfile := range profilesObject {
		parsedProfile, err := parseProfileData(rawProfile, filePath, "profiles."+name)
		if err != nil {
			return StoreData{}, err
		}
		data.Profiles[name] = parsedProfile
	}

	if _, ok := data.Profiles[data.Active]; !ok {
		data.Profiles[data.Active] = Data{}
	}

	return data, nil
}

func parseProfileData(raw any, filePath, path string) (Data, error) {
	object, ok := raw.(map[string]any)
	if !ok {
		return Data{}, invalidStoreShape(filePath, path, "expected object")
	}

	var out Data
	if value, ok, err := optionalString(object, filePath, path+".access_token", "access_token"); err != nil {
		return Data{}, err
	} else if ok {
		out.AccessToken = value
	}

	if defaultsRaw, ok := object["defaults"]; ok {
		defaultsObject, ok := defaultsRaw.(map[string]any)
		if !ok {
			return Data{}, invalidStoreShape(filePath, path+".defaults", "expected object")
		}

		out.Defaults = make(map[string]string, len(defaultsObject))
		for key, rawValue := range defaultsObject {
			value, ok := rawValue.(string)
			if !ok {
				return Data{}, invalidStoreShape(filePath, path+".defaults."+key, "expected string")
			}
			out.Defaults[key] = value
		}
	}

	if authRaw, ok := object["auth"]; ok {
		auth, err := parseAuthData(authRaw, filePath, path+".auth")
		if err != nil {
			return Data{}, err
		}
		out.Auth = auth
	}

	return out, nil
}

func parseAuthData(raw any, filePath, path string) (*AuthData, error) {
	object, ok := raw.(map[string]any)
	if !ok {
		return nil, invalidStoreShape(filePath, path, "expected object")
	}

	auth := &AuthData{}

	if value, ok, err := optionalString(object, filePath, path+".provider", "provider"); err != nil {
		return nil, err
	} else if ok {
		if value != "facebook_oauth" {
			return nil, invalidStoreShape(filePath, path+".provider", "must equal facebook_oauth")
		}
		auth.Provider = value
	}
	if value, ok, err := optionalString(object, filePath, path+".obtained_at", "obtained_at"); err != nil {
		return nil, err
	} else if ok {
		auth.ObtainedAt = value
	}
	if value, ok, err := optionalString(object, filePath, path+".expires_at", "expires_at"); err != nil {
		return nil, err
	} else if ok {
		auth.ExpiresAt = value
	}
	if value, ok, err := optionalInt(object, filePath, path+".expires_in", "expires_in"); err != nil {
		return nil, err
	} else if ok {
		auth.ExpiresIn = &value
	}
	if value, ok, err := optionalString(object, filePath, path+".token_type", "token_type"); err != nil {
		return nil, err
	} else if ok {
		auth.TokenType = value
	}
	if value, ok, err := optionalStringSlice(object, filePath, path+".scopes", "scopes"); err != nil {
		return nil, err
	} else if ok {
		auth.Scopes = value
	}
	if value, ok, err := optionalString(object, filePath, path+".user_id", "user_id"); err != nil {
		return nil, err
	} else if ok {
		auth.UserID = value
	}
	if value, ok, err := optionalString(object, filePath, path+".app_id", "app_id"); err != nil {
		return nil, err
	} else if ok {
		auth.AppID = value
	}
	if value, ok, err := optionalBool(object, filePath, path+".is_valid", "is_valid"); err != nil {
		return nil, err
	} else if ok {
		auth.IsValid = &value
	}

	return auth, nil
}

func requiredStoreString(object map[string]any, filePath, key string) (string, error) {
	value, ok := object[key]
	if !ok {
		return "", invalidStoreShape(filePath, key, "required")
	}

	stringValue, ok := value.(string)
	if !ok {
		return "", invalidStoreShape(filePath, key, "expected string")
	}
	if stringValue == "" {
		return "", invalidStoreShape(filePath, key, "must be at least 1 character")
	}

	return stringValue, nil
}

func optionalString(object map[string]any, filePath, path, key string) (string, bool, error) {
	value, ok := object[key]
	if !ok {
		return "", false, nil
	}

	stringValue, ok := value.(string)
	if !ok {
		return "", false, invalidStoreShape(filePath, path, "expected string")
	}
	return stringValue, true, nil
}

func optionalStringSlice(object map[string]any, filePath, path, key string) ([]string, bool, error) {
	value, ok := object[key]
	if !ok {
		return nil, false, nil
	}

	items, ok := value.([]any)
	if !ok {
		return nil, false, invalidStoreShape(filePath, path, "expected array")
	}

	out := make([]string, 0, len(items))
	for index, item := range items {
		stringValue, ok := item.(string)
		if !ok {
			return nil, false, invalidStoreShape(filePath, path+"."+strconv.Itoa(index), "expected string")
		}
		out = append(out, stringValue)
	}

	return out, true, nil
}

func optionalInt(object map[string]any, filePath, path, key string) (int, bool, error) {
	value, ok := object[key]
	if !ok {
		return 0, false, nil
	}

	switch typed := value.(type) {
	case json.Number:
		parsed, err := typed.Int64()
		if err != nil {
			return 0, false, invalidStoreShape(filePath, path, "expected number")
		}
		return int(parsed), true, nil
	case float64:
		return int(typed), true, nil
	default:
		return 0, false, invalidStoreShape(filePath, path, "expected number")
	}
}

func optionalBool(object map[string]any, filePath, path, key string) (bool, bool, error) {
	value, ok := object[key]
	if !ok {
		return false, false, nil
	}

	boolValue, ok := value.(bool)
	if !ok {
		return false, false, invalidStoreShape(filePath, path, "expected boolean")
	}
	return boolValue, true, nil
}

func invalidStoreShape(filePath, path, message string) error {
	return fmt.Errorf("profile store '%s' has invalid shape at '%s': %s", filePath, path, message)
}

// ClearStoredAuth is kept for compatibility with simpler callers.
func ClearStoredAuth(data StoreData, profileName string) StoreData {
	if profileName == "" {
		profileName = data.Active
	}
	profileData, ok := data.Profiles[profileName]
	if !ok {
		return data
	}
	profileData.AccessToken = ""
	profileData.Auth = nil
	data.Profiles[profileName] = profileData
	return data
}
