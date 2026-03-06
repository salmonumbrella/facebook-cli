package config

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

	"github.com/salmonumbrella/facebook-cli/internal/profile"
)

const (
	AppName                = "facebook-cli"
	DefaultGraphAPIVersion = "v25.0"
)

// PageAsset matches the FACEBOOK_ASSETS entries used by the TypeScript CLI.
type PageAsset struct {
	FBPageID        string `json:"fb_page_id"`
	PageName        string `json:"page_name"`
	DisplayName     string `json:"display_name"`
	PageAccessToken string `json:"page_access_token"`
}

// AppConfig holds Facebook app credentials loaded from process env or cli/.env.
type AppConfig struct {
	AppID     string
	UserToken string
}

// RuntimeContext contains the resolved auth/profile runtime values for commands.
type RuntimeContext struct {
	Output      string
	DryRun      bool
	APIVersion  string
	AccessToken string
	ProfileName string
	ProfilePath string
}

// GraphAPIVersion resolves the configured Graph API version or the default.
func GraphAPIVersion(version string) string {
	if version != "" {
		return version
	}
	return DefaultGraphAPIVersion
}

// GraphAPIBase returns the Graph API base URL for the resolved version.
func GraphAPIBase(version string) string {
	return "https://graph.facebook.com/" + GraphAPIVersion(version)
}

// ResolveAccessToken applies the cli > env > profile precedence used by the TS CLI.
func ResolveAccessToken(cliToken, envToken, profileToken string) string {
	if cliToken != "" {
		return cliToken
	}
	if envToken != "" {
		return envToken
	}
	return profileToken
}

// ParsePageAssets parses and validates the raw FACEBOOK_ASSETS JSON payload.
func ParsePageAssets(raw string) ([]PageAsset, error) {
	normalized, err := decodeJSONValue(raw)
	if err != nil {
		return nil, errors.New("FACEBOOK_ASSETS is not valid JSON")
	}
	return validatePageAssets(normalized)
}

// LoadPageAssets reads FACEBOOK_ASSETS from process env or cli/.env.
func LoadPageAssets(env *Env) ([]PageAsset, error) {
	if env == nil {
		env = NewEnv()
	}

	raw := "[]"
	if value, ok := env.Lookup("FACEBOOK_ASSETS"); ok {
		raw = value
	}

	return ParsePageAssets(raw)
}

func decodeJSONValue(raw string) (any, error) {
	decoder := json.NewDecoder(bytes.NewBufferString(raw))
	decoder.UseNumber()

	var value any
	if err := decoder.Decode(&value); err != nil {
		return nil, err
	}

	var extra any
	if err := decoder.Decode(&extra); err == nil {
		return nil, errors.New("unexpected extra JSON input")
	}

	return value, nil
}

func validatePageAssets(input any) ([]PageAsset, error) {
	rows, ok := input.([]any)
	if !ok {
		return nil, invalidPageAssets("FACEBOOK_ASSETS", "expected array")
	}

	assets := make([]PageAsset, 0, len(rows))
	for index, row := range rows {
		object, ok := row.(map[string]any)
		if !ok {
			return nil, invalidPageAssets(strconv.Itoa(index), "expected object")
		}

		asset := PageAsset{}
		var err error
		if asset.FBPageID, err = requiredPageAssetString(object, index, "fb_page_id"); err != nil {
			return nil, err
		}
		if asset.PageName, err = requiredPageAssetString(object, index, "page_name"); err != nil {
			return nil, err
		}
		if asset.DisplayName, err = requiredPageAssetString(object, index, "display_name"); err != nil {
			return nil, err
		}
		if asset.PageAccessToken, err = requiredPageAssetString(object, index, "page_access_token"); err != nil {
			return nil, err
		}

		assets = append(assets, asset)
	}

	return assets, nil
}

func requiredPageAssetString(object map[string]any, index int, key string) (string, error) {
	raw, ok := object[key]
	if !ok {
		return "", invalidPageAssets(fmt.Sprintf("%d.%s", index, key), "required")
	}

	value, ok := raw.(string)
	if !ok {
		return "", invalidPageAssets(fmt.Sprintf("%d.%s", index, key), "expected string")
	}
	if value == "" {
		return "", invalidPageAssets(fmt.Sprintf("%d.%s", index, key), "must be at least 1 character")
	}

	return value, nil
}

func invalidPageAssets(path, message string) error {
	return fmt.Errorf("FACEBOOK_ASSETS has invalid shape at '%s': %s", path, message)
}

// LoadAppConfig reads app config fields from process env or cli/.env.
func LoadAppConfig(env *Env) AppConfig {
	if env == nil {
		env = NewEnv()
	}

	cfg := AppConfig{}
	if value, ok := env.Lookup("FB_APP_ID"); ok {
		cfg.AppID = value
	}
	if value, ok := env.Lookup("FB_USER_ACCESS_TOKEN"); ok {
		cfg.UserToken = value
	} else if value, ok := env.Lookup("FB_ACCESS_TOKEN"); ok {
		cfg.UserToken = value
	}

	return cfg
}

// ResolveRuntimeContext resolves api version, access token, profile name, and store path.
func ResolveRuntimeContext(
	output string,
	dryRun bool,
	apiVersion string,
	cliAccessToken string,
	profileName string,
	env *Env,
) (RuntimeContext, error) {
	if env == nil {
		env = NewEnv()
	}

	profilePath := DefaultProfilePath()
	store := profile.NewStore(profilePath)
	data, err := store.Load()
	if err != nil {
		return RuntimeContext{}, err
	}

	if profileName == "" {
		profileName = data.Active
	}
	if profileName == "" {
		profileName = profile.DefaultProfileName
	}

	profileData := data.Profiles[profileName]

	if apiVersion == "" {
		if value, ok := env.Lookup("FB_API_VERSION"); ok {
			apiVersion = value
		}
	}
	if apiVersion == "" {
		apiVersion = DefaultGraphAPIVersion
	}

	accessToken := profileData.AccessToken
	if value, ok := env.Lookup("FB_ACCESS_TOKEN"); ok {
		accessToken = value
	}
	if cliAccessToken != "" {
		accessToken = cliAccessToken
	}

	return RuntimeContext{
		Output:      output,
		DryRun:      dryRun,
		APIVersion:  apiVersion,
		AccessToken: accessToken,
		ProfileName: profileName,
		ProfilePath: profilePath,
	}, nil
}
