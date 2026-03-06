package facebook

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/salmonumbrella/facebook-cli/internal/api"
)

type DeployConfig struct {
	Campaign map[string]any   `json:"campaign" yaml:"campaign"`
	AdSet    map[string]any   `json:"ad_set" yaml:"ad_set"`
	Creative map[string]any   `json:"creative,omitempty" yaml:"creative,omitempty"`
	Ads      []map[string]any `json:"ads" yaml:"ads"`
	Image    map[string]any   `json:"image,omitempty" yaml:"image,omitempty"`
}

type ValidationResult struct {
	Valid  bool     `json:"valid"`
	Errors []string `json:"errors"`
}

func readDeployConfig(raw any) DeployConfig {
	row := normalizeGraphObject(raw)
	config := DeployConfig{
		Campaign: normalizeGraphObject(row["campaign"]),
		AdSet:    normalizeGraphObject(row["ad_set"]),
		Creative: normalizeGraphObject(row["creative"]),
		Image:    normalizeGraphObject(row["image"]),
	}
	if ads, ok := row["ads"].([]any); ok {
		config.Ads = make([]map[string]any, 0, len(ads))
		for _, item := range ads {
			config.Ads = append(config.Ads, normalizeGraphObject(item))
		}
	}
	return config
}

func LoadDeployConfig(path string) (DeployConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return DeployConfig{}, err
	}

	var raw any
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".json":
		err = json.Unmarshal(data, &raw)
	default:
		err = yaml.Unmarshal(data, &raw)
		if err != nil {
			err = json.Unmarshal(data, &raw)
		}
	}
	if err != nil {
		return DeployConfig{}, err
	}
	return readDeployConfig(raw), nil
}

func ValidateDeployConfig(config DeployConfig) ValidationResult {
	errors := []string{}
	if len(config.Campaign) == 0 || asString(config.Campaign["objective"]) == "" {
		errors = append(errors, "campaign.objective is required")
	}
	if len(config.AdSet) == 0 {
		errors = append(errors, "ad_set is required")
	}
	if len(config.Ads) == 0 {
		errors = append(errors, "ads must contain at least one ad")
	}
	return ValidationResult{
		Valid:  len(errors) == 0,
		Errors: errors,
	}
}

func ExecuteDeploy(
	ctx context.Context,
	client *api.Client,
	token string,
	accountID string,
	config DeployConfig,
	dryRun bool,
) (any, error) {
	validation := ValidateDeployConfig(config)
	if !validation.Valid {
		return map[string]any{
			"ok":         false,
			"validation": validation,
		}, nil
	}

	if dryRun {
		return map[string]any{
			"ok":     true,
			"dryRun": true,
			"steps":  []string{"upload_image", "create_campaign", "create_ad_set", "create_creative", "create_ads"},
			"config": config,
			"valid":  validation.Valid,
			"errors": validation.Errors,
		}, nil
	}

	var imageResult any
	var err error
	if len(config.Image) > 0 {
		imageResult, err = client.Graph(ctx, "POST", normalizeAccountPath(accountID)+"/adimages", token, asStringMap(config.Image), nil)
		if err != nil {
			return nil, err
		}
	}

	campaign, err := client.Graph(ctx, "POST", normalizeAccountPath(accountID)+"/campaigns", token, asStringMap(config.Campaign), nil)
	if err != nil {
		return nil, err
	}
	adSetPayload := mergeMap(config.AdSet, map[string]any{
		"campaign_id": normalizeGraphObject(campaign)["id"],
	})
	adSet, err := client.Graph(ctx, "POST", normalizeAccountPath(accountID)+"/adsets", token, asStringMap(adSetPayload), nil)
	if err != nil {
		return nil, err
	}

	creativePayload := map[string]any{}
	for key, value := range config.Creative {
		creativePayload[key] = value
	}
	imageRow := normalizeGraphObject(imageResult)
	images := normalizeGraphObject(imageRow["images"])
	for imageHash := range images {
		creativePayload["image_hash"] = imageHash
		break
	}

	creative, err := client.Graph(ctx, "POST", normalizeAccountPath(accountID)+"/adcreatives", token, asStringMap(creativePayload), nil)
	if err != nil {
		return nil, err
	}

	adIDs := []any{}
	for _, ad := range config.Ads {
		adPayload := map[string]any{}
		for key, value := range ad {
			adPayload[key] = value
		}
		adPayload["adset_id"] = normalizeGraphObject(adSet)["id"]
		if _, ok := adPayload["creative"]; !ok {
			adPayload["creative"] = map[string]any{
				"creative_id": normalizeGraphObject(creative)["id"],
			}
		}
		if _, ok := adPayload["status"]; !ok {
			adPayload["status"] = "PAUSED"
		}
		result, err := client.Graph(ctx, "POST", normalizeAccountPath(accountID)+"/ads", token, nil, adPayload)
		if err != nil {
			return nil, err
		}
		adIDs = append(adIDs, normalizeGraphObject(result)["id"])
	}

	return map[string]any{
		"ok":         true,
		"campaignId": normalizeGraphObject(campaign)["id"],
		"adSetId":    normalizeGraphObject(adSet)["id"],
		"creativeId": normalizeGraphObject(creative)["id"],
		"adIds":      adIDs,
	}, nil
}
