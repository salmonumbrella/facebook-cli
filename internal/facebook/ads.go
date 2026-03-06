package facebook

import (
	"context"
	"fmt"
	"math"
	"strings"

	"github.com/salmonumbrella/facebook-cli/internal/api"
)

func normalizeAccountPath(accountID string) string {
	if strings.HasPrefix(accountID, "act_") {
		return accountID
	}
	return "act_" + accountID
}

func ListAdAccounts(ctx context.Context, client *api.Client, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", "me/adaccounts", token, params, nil)
}

func GetAdAccount(ctx context.Context, client *api.Client, accountID string, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", normalizeAccountPath(accountID), token, params, nil)
}

func ListCampaigns(ctx context.Context, client *api.Client, accountID string, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", normalizeAccountPath(accountID)+"/campaigns", token, params, nil)
}

func GetCampaign(ctx context.Context, client *api.Client, campaignID string, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", campaignID, token, params, nil)
}

func ListAdSets(ctx context.Context, client *api.Client, accountID string, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", normalizeAccountPath(accountID)+"/adsets", token, params, nil)
}

func GetAdSet(ctx context.Context, client *api.Client, adSetID string, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", adSetID, token, params, nil)
}

func ListAds(ctx context.Context, client *api.Client, accountID string, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", normalizeAccountPath(accountID)+"/ads", token, params, nil)
}

func GetAd(ctx context.Context, client *api.Client, adID string, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", adID, token, params, nil)
}

func ListCreatives(ctx context.Context, client *api.Client, accountID string, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", normalizeAccountPath(accountID)+"/adcreatives", token, params, nil)
}

func GetCreative(ctx context.Context, client *api.Client, creativeID string, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", creativeID, token, params, nil)
}

func GetInsights(ctx context.Context, client *api.Client, accountID string, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", normalizeAccountPath(accountID)+"/insights", token, params, nil)
}

func GetInsightsWithBreakdowns(ctx context.Context, client *api.Client, accountID string, token string, params map[string]string) (any, error) {
	response, err := client.Graph(ctx, "GET", normalizeAccountPath(accountID)+"/insights", token, params, nil)
	if err != nil {
		return nil, err
	}
	row := normalizeGraphObject(response)
	data, _ := row["data"].([]any)
	if len(data) == 0 {
		return response, nil
	}

	out := make([]map[string]any, 0, len(data))
	for _, item := range data {
		entry := normalizeGraphObject(item)
		spend := toNumber(entry["spend"])
		conversions := toNumber(entry["conversions"])
		conversionValue := toNumber(entry["conversion_value"])
		entry["cpa"] = 0.0
		if conversions > 0 {
			entry["cpa"] = spend / conversions
		}
		entry["roas"] = 0.0
		if spend > 0 {
			entry["roas"] = conversionValue / spend
		}
		out = append(out, entry)
	}
	row["data"] = out
	return row, nil
}

func ListAudiences(ctx context.Context, client *api.Client, accountID string, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", normalizeAccountPath(accountID)+"/customaudiences", token, params, nil)
}

func GetAudience(ctx context.Context, client *api.Client, audienceID string, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", audienceID, token, params, nil)
}

func SearchInterests(ctx context.Context, client *api.Client, token string, query string, limit int) (any, error) {
	if limit <= 0 {
		limit = 25
	}
	return client.Graph(ctx, "GET", "search", token, map[string]string{
		"type":  "adinterest",
		"q":     query,
		"limit": fmt.Sprintf("%d", limit),
	}, nil)
}

func SearchBehaviors(ctx context.Context, client *api.Client, token string, query string, limit int) (any, error) {
	if limit <= 0 {
		limit = 25
	}
	return client.Graph(ctx, "GET", "search", token, map[string]string{
		"type":  "adTargetingCategory",
		"class": "behaviors",
		"q":     query,
		"limit": fmt.Sprintf("%d", limit),
	}, nil)
}

func GetAudienceSizeEstimate(ctx context.Context, client *api.Client, accountID string, token string, targetingSpec map[string]any) (any, error) {
	return client.Graph(ctx, "GET", normalizeAccountPath(accountID)+"/delivery_estimate", token, map[string]string{
		"targeting_spec":    normalizeValue(targetingSpec),
		"optimization_goal": "REACH",
	}, nil)
}

func CreateCampaign(ctx context.Context, client *api.Client, accountID string, token string, payload map[string]any) (any, error) {
	return client.Graph(ctx, "POST", normalizeAccountPath(accountID)+"/campaigns", token, nil, payload)
}

func UpdateCampaign(ctx context.Context, client *api.Client, campaignID string, token string, payload map[string]any) (any, error) {
	return client.Graph(ctx, "POST", campaignID, token, nil, payload)
}

func PauseCampaign(ctx context.Context, client *api.Client, campaignID string, token string) (any, error) {
	return client.Graph(ctx, "POST", campaignID, token, nil, map[string]any{"status": "PAUSED"})
}

func ActivateCampaign(ctx context.Context, client *api.Client, campaignID string, token string) (any, error) {
	return client.Graph(ctx, "POST", campaignID, token, nil, map[string]any{"status": "ACTIVE"})
}

func DeleteCampaign(ctx context.Context, client *api.Client, campaignID string, token string) (any, error) {
	return client.Graph(ctx, "DELETE", campaignID, token, nil, nil)
}

func CreateAdSet(ctx context.Context, client *api.Client, accountID string, token string, payload map[string]any) (any, error) {
	return client.Graph(ctx, "POST", normalizeAccountPath(accountID)+"/adsets", token, nil, payload)
}

func UpdateAdSet(ctx context.Context, client *api.Client, adSetID string, token string, payload map[string]any) (any, error) {
	return client.Graph(ctx, "POST", adSetID, token, nil, payload)
}

func CreateAd(ctx context.Context, client *api.Client, accountID string, token string, payload map[string]any) (any, error) {
	return client.Graph(ctx, "POST", normalizeAccountPath(accountID)+"/ads", token, nil, payload)
}

func UpdateAd(ctx context.Context, client *api.Client, adID string, token string, payload map[string]any) (any, error) {
	return client.Graph(ctx, "POST", adID, token, nil, payload)
}

func CreateCreative(ctx context.Context, client *api.Client, accountID string, token string, payload map[string]any) (any, error) {
	return client.Graph(ctx, "POST", normalizeAccountPath(accountID)+"/adcreatives", token, nil, payload)
}

func UploadImage(ctx context.Context, client *api.Client, accountID string, token string, payload map[string]any) (any, error) {
	return client.Graph(ctx, "POST", normalizeAccountPath(accountID)+"/adimages", token, nil, payload)
}

func CreateAudience(ctx context.Context, client *api.Client, accountID string, token string, payload map[string]any) (any, error) {
	return client.Graph(ctx, "POST", normalizeAccountPath(accountID)+"/customaudiences", token, nil, payload)
}

func UpdateAudience(ctx context.Context, client *api.Client, audienceID string, token string, payload map[string]any) (any, error) {
	return client.Graph(ctx, "POST", audienceID, token, nil, payload)
}

func DeleteAudience(ctx context.Context, client *api.Client, audienceID string, token string) (any, error) {
	return client.Graph(ctx, "DELETE", audienceID, token, nil, nil)
}

type DuplicateCampaignOptions struct {
	Name         string
	BudgetFactor float64
}

func DuplicateCampaign(
	ctx context.Context,
	client *api.Client,
	campaignID string,
	token string,
	accountID string,
	options DuplicateCampaignOptions,
) (map[string]any, error) {
	sourceCampaign, err := client.Graph(ctx, "GET", campaignID, token, nil, nil)
	if err != nil {
		return nil, err
	}
	adSetsResponse, err := client.Graph(ctx, "GET", campaignID+"/adsets", token, nil, nil)
	if err != nil {
		return nil, err
	}
	sourceAdSets, _ := normalizeGraphObject(adSetsResponse)["data"].([]any)

	adsByAdSet := map[string][]map[string]any{}
	for _, item := range sourceAdSets {
		adSet := normalizeGraphObject(item)
		adSetID := asString(adSet["id"])
		if adSetID == "" {
			continue
		}
		adsResponse, err := client.Graph(ctx, "GET", adSetID+"/ads", token, nil, nil)
		if err != nil {
			return nil, err
		}
		adsRows, _ := normalizeGraphObject(adsResponse)["data"].([]any)
		for _, adRow := range adsRows {
			adsByAdSet[adSetID] = append(adsByAdSet[adSetID], normalizeGraphObject(adRow))
		}
	}

	budgetFactor := options.BudgetFactor
	if budgetFactor == 0 {
		budgetFactor = 1
	}
	sourceCampaignRow := normalizeGraphObject(sourceCampaign)
	baseBudget := toNumber(sourceCampaignRow["daily_budget"])
	if baseBudget == 0 {
		baseBudget = toNumber(sourceCampaignRow["lifetime_budget"])
	}
	scaledBudget := 0
	if baseBudget > 0 {
		scaledBudget = int(math.Round(baseBudget * budgetFactor))
	}

	newCampaignPayload := map[string]any{
		"status": "PAUSED",
	}
	if objective := asString(sourceCampaignRow["objective"]); objective != "" {
		newCampaignPayload["objective"] = objective
	}
	if options.Name != "" {
		newCampaignPayload["name"] = options.Name
	} else if name := asString(sourceCampaignRow["name"]); name != "" {
		newCampaignPayload["name"] = name
	}
	if scaledBudget > 0 {
		newCampaignPayload["daily_budget"] = fmt.Sprintf("%d", scaledBudget)
	}

	newCampaign, err := client.Graph(ctx, "POST", normalizeAccountPath(accountID)+"/campaigns", token, nil, newCampaignPayload)
	if err != nil {
		return nil, err
	}

	adSetMap := map[string]string{}
	for _, item := range sourceAdSets {
		adSet := normalizeGraphObject(item)
		oldAdSetID := asString(adSet["id"])
		if oldAdSetID == "" {
			continue
		}
		payload := map[string]any{
			"campaign_id": asString(normalizeGraphObject(newCampaign)["id"]),
			"status":      "PAUSED",
		}
		if name := asString(adSet["name"]); name != "" {
			payload["name"] = name
		}
		createdAdSet, err := client.Graph(ctx, "POST", normalizeAccountPath(accountID)+"/adsets", token, nil, payload)
		if err != nil {
			return nil, err
		}
		if newID := asString(normalizeGraphObject(createdAdSet)["id"]); newID != "" {
			adSetMap[oldAdSetID] = newID
		}
	}

	createdAds := []any{}
	for oldAdSetID, ads := range adsByAdSet {
		for _, ad := range ads {
			payload := map[string]any{
				"adset_id": adSetMap[oldAdSetID],
				"status":   "PAUSED",
			}
			if name := asString(ad["name"]); name != "" {
				payload["name"] = name
			}
			if creative, ok := ad["creative"]; ok && creative != nil {
				payload["creative"] = creative
			}
			createdAd, err := client.Graph(ctx, "POST", normalizeAccountPath(accountID)+"/ads", token, nil, payload)
			if err != nil {
				return nil, err
			}
			createdAds = append(createdAds, createdAd)
		}
	}

	return map[string]any{
		"campaign":   newCampaign,
		"adSetCount": len(adSetMap),
		"adCount":    len(createdAds),
	}, nil
}
