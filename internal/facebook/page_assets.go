package facebook

import (
	"context"
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"github.com/salmonumbrella/facebook-cli/internal/api"
)

var slugPattern = regexp.MustCompile(`[^a-z0-9]+`)

func slugifyPageName(name string) string {
	slug := strings.ToLower(strings.TrimSpace(name))
	slug = slugPattern.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if len(slug) > 40 {
		slug = slug[:40]
		slug = strings.Trim(slug, "-")
	}
	return slug
}

func uniquePageName(displayName string, pageID string, used map[string]struct{}) string {
	base := slugifyPageName(displayName)
	if base == "" {
		if len(pageID) > 6 {
			base = "page-" + pageID[len(pageID)-6:]
		} else {
			base = "page-" + pageID
		}
	}

	candidate := base
	for suffix := 2; ; suffix++ {
		if _, exists := used[candidate]; !exists {
			used[candidate] = struct{}{}
			return candidate
		}
		candidate = fmt.Sprintf("%s-%d", base, suffix)
	}
}

func DerivePageAssetsFromUserToken(ctx context.Context, client *api.Client, accessToken string) ([]PageAsset, error) {
	firstURL, err := url.Parse(client.GraphBase() + "/me/accounts")
	if err != nil {
		return nil, err
	}
	query := firstURL.Query()
	query.Set("access_token", accessToken)
	query.Set("fields", "id,name,access_token")
	query.Set("limit", "100")
	firstURL.RawQuery = query.Encode()

	rows, err := client.PaginateAll(ctx, firstURL.String(), 0)
	if err != nil {
		return nil, err
	}

	used := map[string]struct{}{}
	assets := make([]PageAsset, 0, len(rows))
	for _, row := range rows {
		pageID := asString(row["id"])
		pageToken := asString(row["access_token"])
		if pageID == "" || pageToken == "" {
			continue
		}
		displayName := strings.TrimSpace(asString(row["name"]))
		if displayName == "" {
			displayName = "Page " + pageID
		}
		assets = append(assets, PageAsset{
			FBPageID:        pageID,
			PageName:        uniquePageName(displayName, pageID, used),
			DisplayName:     displayName,
			PageAccessToken: pageToken,
		})
	}

	return assets, nil
}

func MergePageAssets(configured []PageAsset, derived []PageAsset) []PageAsset {
	if len(configured) == 0 {
		return derived
	}
	if len(derived) == 0 {
		return configured
	}

	byID := make(map[string]PageAsset, len(configured))
	order := make([]string, 0, len(configured)+len(derived))
	for _, asset := range configured {
		byID[asset.FBPageID] = asset
		order = append(order, asset.FBPageID)
	}

	for _, asset := range derived {
		existing, ok := byID[asset.FBPageID]
		if ok {
			existing.PageAccessToken = asset.PageAccessToken
			byID[asset.FBPageID] = existing
			continue
		}
		byID[asset.FBPageID] = asset
		order = append(order, asset.FBPageID)
	}

	out := make([]PageAsset, 0, len(byID))
	seen := map[string]struct{}{}
	for _, id := range order {
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, byID[id])
	}
	return out
}

func ResolvePageAssets(ctx context.Context, client *api.Client, configured []PageAsset, accessToken string) ([]PageAsset, error) {
	if strings.TrimSpace(accessToken) == "" {
		return configured, nil
	}

	derived, err := DerivePageAssetsFromUserToken(ctx, client, accessToken)
	if err != nil {
		if len(configured) > 0 {
			return configured, nil
		}
		return nil, err
	}
	return MergePageAssets(configured, derived), nil
}
