package cmd

import (
	"strings"
	"time"

	facebookauth "github.com/salmonumbrella/facebook-cli/internal/auth"
	"github.com/salmonumbrella/facebook-cli/internal/config"
	"github.com/salmonumbrella/facebook-cli/internal/profile"
)

var defaultLoginScopes = []string{
	"public_profile",
	"pages_show_list",
	"pages_read_engagement",
	"pages_manage_posts",
	"ads_read",
	"ads_management",
	"business_management",
}

func requestedScopes(env *config.Env, csv string, list []string) []string {
	if envScopes := normalizeScopes(strings.Split(env.Get("FB_OAUTH_SCOPES"), ",")); len(envScopes) > 0 && csv == "" && len(list) == 0 {
		return envScopes
	}
	base := defaultLoginScopes
	if csv != "" {
		base = normalizeScopes(strings.Split(csv, ","))
	}
	base = append(base, list...)
	scopes := normalizeScopes(base)
	if len(scopes) == 0 {
		return defaultLoginScopes
	}
	return scopes
}

func normalizeScopes(scopes []string) []string {
	seen := map[string]struct{}{}
	out := []string{}
	for _, scope := range scopes {
		scope = strings.TrimSpace(scope)
		if scope == "" {
			continue
		}
		if _, ok := seen[scope]; ok {
			continue
		}
		seen[scope] = struct{}{}
		out = append(out, scope)
	}
	return out
}

func tokenPreview(token string) string {
	if token == "" {
		return ""
	}
	if strings.HasPrefix(token, "EAA") && len(token) > 10 {
		return token[:6] + "..." + token[len(token)-4:]
	}
	if len(token) <= 10 {
		return token[:4] + "..."
	}
	return token[:6] + "..." + token[len(token)-4:]
}

func buildProfileAuth(expiresIn int, tokenType string, debugData map[string]any) *profile.AuthData {
	isValid, hasValid := debugData["is_valid"].(bool)
	var expiresInValue *int
	if expiresIn > 0 {
		expiresInCopy := expiresIn
		expiresInValue = &expiresInCopy
	}
	authData := &profile.AuthData{
		Provider:   "facebook_oauth",
		ObtainedAt: time.Now().UTC().Format(time.RFC3339),
		ExpiresAt:  facebookauth.ComputeExpiresAt(expiresIn, time.Now()),
		ExpiresIn:  expiresInValue,
		TokenType:  tokenType,
		Scopes:     toStringSlice(debugData["scopes"]),
		UserID:     firstString(debugData["user_id"]),
		AppID:      firstString(debugData["app_id"]),
	}
	if hasValid {
		authData.IsValid = &isValid
	}
	return authData
}

func toStringSlice(value any) []string {
	items, ok := value.([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(items))
	for _, item := range items {
		if text, ok := item.(string); ok {
			out = append(out, text)
		}
	}
	return out
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func firstNonBlank(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func firstNonZero(values ...int) int {
	for _, value := range values {
		if value != 0 {
			return value
		}
	}
	return 0
}

func ternaryString(condition bool, whenTrue string, whenFalse string) string {
	if condition {
		return whenTrue
	}
	return whenFalse
}
