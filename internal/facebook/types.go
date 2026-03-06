package facebook

import (
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
)

type PageAsset struct {
	FBPageID        string `json:"fb_page_id"`
	PageName        string `json:"page_name"`
	DisplayName     string `json:"display_name"`
	PageAccessToken string `json:"page_access_token"`
}

type PageSummary struct {
	PageName    string `json:"page_name"`
	DisplayName string `json:"display_name"`
	FBPageID    string `json:"fb_page_id"`
}

func ListPageSummaries(assets []PageAsset) []PageSummary {
	out := make([]PageSummary, 0, len(assets))
	for _, asset := range assets {
		out = append(out, PageSummary{
			PageName:    asset.PageName,
			DisplayName: asset.DisplayName,
			FBPageID:    asset.FBPageID,
		})
	}
	return out
}

func GetPageOrError(assets []PageAsset, name string) (PageAsset, error) {
	for _, asset := range assets {
		if asset.PageName == name {
			return asset, nil
		}
	}

	available := make([]string, 0, len(assets))
	for _, asset := range assets {
		available = append(available, asset.PageName)
	}
	sort.Strings(available)
	if len(available) == 0 {
		return PageAsset{}, fmt.Errorf("page %q not found. Available pages: (none configured)", name)
	}
	return PageAsset{}, fmt.Errorf("page %q not found. Available pages: %s", name, strings.Join(available, ", "))
}

func GetDefaultPageAsset(assets []PageAsset) *PageAsset {
	if len(assets) == 0 {
		return nil
	}
	return &assets[0]
}

func normalizeGraphObject(value any) map[string]any {
	if typed, ok := value.(map[string]any); ok {
		return typed
	}
	return map[string]any{}
}

func graphError(result any) map[string]any {
	obj := normalizeGraphObject(result)
	if _, ok := obj["error"]; ok {
		return obj
	}
	return nil
}

func asString(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case fmt.Stringer:
		return typed.String()
	case nil:
		return ""
	default:
		return fmt.Sprintf("%v", value)
	}
}

func normalizeValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case bool:
		if typed {
			return "true"
		}
		return "false"
	default:
		encoded, err := json.Marshal(value)
		if err != nil {
			return fmt.Sprintf("%v", value)
		}
		return string(encoded)
	}
}

func asStringMap(value any) map[string]string {
	input, ok := value.(map[string]any)
	if !ok {
		return nil
	}
	out := make(map[string]string, len(input))
	for key, raw := range input {
		out[key] = asString(raw)
	}
	return out
}

func mergeMap(base map[string]any, extra map[string]any) map[string]any {
	out := make(map[string]any, len(base)+len(extra))
	for key, value := range base {
		out[key] = value
	}
	for key, value := range extra {
		out[key] = value
	}
	return out
}

var ErrNoPages = errors.New("no page assets available")
