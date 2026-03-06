package facebook

import (
	"context"
	"math"
	"math/rand"
	"time"

	"gopkg.in/yaml.v3"

	"github.com/salmonumbrella/facebook-cli/internal/api"
)

type CampaignConfig struct {
	Name                 string  `json:"name" yaml:"name"`
	TotalBudget          float64 `json:"total_budget" yaml:"total_budget"`
	TestBudgetPercentage float64 `json:"test_budget_percentage" yaml:"test_budget_percentage"`
	MaxCPM               float64 `json:"max_cpm" yaml:"max_cpm"`
}

type OptimizationConfig struct {
	Campaign         CampaignConfig   `json:"campaign" yaml:"campaign"`
	Creatives        []map[string]any `json:"creatives" yaml:"creatives"`
	TargetingOptions struct {
		Audiences  []map[string]any `json:"audiences" yaml:"audiences"`
		Placements []map[string]any `json:"placements" yaml:"placements"`
	} `json:"targeting_options" yaml:"targeting_options"`
}

type Combination struct {
	Kind      string         `json:"kind"`
	Creative  map[string]any `json:"creative"`
	Audience  map[string]any `json:"audience,omitempty"`
	Placement map[string]any `json:"placement,omitempty"`
}

type BudgetAllocation struct {
	TotalBudget float64 `json:"totalBudget"`
	TestPercent float64 `json:"testPercent"`
	TestBudget  float64 `json:"testBudget"`
	PerCampaign float64 `json:"perCampaign"`
}

type CreateTestCampaignOptions struct {
	Limit     int
	BatchSize int
	Priority  string
	DryRun    bool
	Template  string
}

func GenerateCombinations(config OptimizationConfig) []Combination {
	out := []Combination{}
	for _, creative := range config.Creatives {
		for _, audience := range config.TargetingOptions.Audiences {
			out = append(out, Combination{
				Kind:     "audience",
				Creative: creative,
				Audience: audience,
			})
		}
		for _, placement := range config.TargetingOptions.Placements {
			out = append(out, Combination{
				Kind:      "placement",
				Creative:  creative,
				Placement: placement,
			})
		}
	}
	return out
}

func AllocateBudget(totalBudget float64, testPercent float64, combinations int) BudgetAllocation {
	testBudget := (totalBudget * testPercent) / 100
	perCampaign := 0.0
	if combinations > 0 {
		perCampaign = testBudget / float64(combinations)
	}
	return BudgetAllocation{
		TotalBudget: totalBudget,
		TestPercent: testPercent,
		TestBudget:  testBudget,
		PerCampaign: perCampaign,
	}
}

func ValidateOptimizationConfig(config OptimizationConfig) ValidationResult {
	errors := []string{}
	if config.Campaign.Name == "" {
		errors = append(errors, "campaign.name is required")
	}
	if config.Campaign.TotalBudget == 0 {
		errors = append(errors, "campaign.total_budget is required")
	}
	if len(config.Creatives) == 0 {
		errors = append(errors, "at least one creative is required")
	}
	if len(config.TargetingOptions.Audiences) == 0 && len(config.TargetingOptions.Placements) == 0 {
		errors = append(errors, "at least one audience or placement is required")
	}
	return ValidationResult{
		Valid:  len(errors) == 0,
		Errors: errors,
	}
}

func CreateTestCampaigns(
	ctx context.Context,
	client *api.Client,
	token string,
	accountID string,
	config OptimizationConfig,
	options CreateTestCampaignOptions,
) (any, error) {
	validation := ValidateOptimizationConfig(config)
	if !validation.Valid {
		return map[string]any{"ok": false, "validation": validation}, nil
	}

	combinations := GenerateCombinations(config)
	if options.Priority != "" {
		prioritized := make([]Combination, 0, len(combinations))
		other := make([]Combination, 0, len(combinations))
		for _, combo := range combinations {
			if combo.Kind == options.Priority {
				prioritized = append(prioritized, combo)
			} else {
				other = append(other, combo)
			}
		}
		combinations = append(prioritized, other...)
	}
	if options.Limit > 0 && options.Limit < len(combinations) {
		combinations = combinations[:options.Limit]
	}

	testPercent := config.Campaign.TestBudgetPercentage
	if testPercent == 0 {
		testPercent = 20
	}
	budget := AllocateBudget(config.Campaign.TotalBudget, testPercent, len(combinations))
	if options.DryRun {
		return map[string]any{
			"ok":       true,
			"dryRun":   true,
			"budget":   budget,
			"selected": combinations,
		}, nil
	}

	batchSize := options.BatchSize
	if batchSize <= 0 {
		batchSize = 10
	}
	created := []any{}
	for offset := 0; offset < len(combinations); offset += batchSize {
		end := offset + batchSize
		if end > len(combinations) {
			end = len(combinations)
		}
		batch := combinations[offset:end]
		for index, combo := range batch {
			nameSuffix := options.Template
			if nameSuffix == "" {
				nameSuffix = combo.Kind
			}
			payload := map[string]any{
				"name":         config.Campaign.Name + " " + asString(offset+index+1) + " (" + nameSuffix + ")",
				"objective":    "OUTCOME_TRAFFIC",
				"status":       "PAUSED",
				"daily_budget": asString(int(math.Max(1, math.Round(budget.PerCampaign)))),
			}
			result, err := client.Graph(ctx, "POST", normalizeAccountPath(accountID)+"/campaigns", token, nil, payload)
			if err != nil {
				return nil, err
			}
			created = append(created, result)
		}
		delay := time.Duration(300*(1<<uint(offset/batchSize))+rand.Intn(150)) * time.Millisecond
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(delay):
		}
	}
	return map[string]any{
		"ok":           true,
		"createdCount": len(created),
		"created":      created,
	}, nil
}

func ExportCampaignToYAML(
	ctx context.Context,
	client *api.Client,
	token string,
	campaignID string,
	budget float64,
	testPercent float64,
	maxCPM float64,
) (string, error) {
	response, err := client.Graph(ctx, "GET", campaignID, token, map[string]string{
		"fields": "id,name,objective,daily_budget",
	}, nil)
	if err != nil {
		return "", err
	}
	row := normalizeGraphObject(response)
	if budget == 0 {
		budget = toNumber(row["daily_budget"])
	}
	if testPercent == 0 {
		testPercent = 20
	}
	if maxCPM == 0 {
		maxCPM = 10
	}

	payload := map[string]any{
		"campaign": map[string]any{
			"name":                   asString(row["name"]),
			"total_budget":           budget,
			"test_budget_percentage": testPercent,
			"max_cpm":                maxCPM,
		},
		"creatives":         []any{},
		"targeting_options": map[string]any{"audiences": []any{}, "placements": []any{}},
	}

	data, err := yaml.Marshal(payload)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func UpdateCPMBids(ctx context.Context, client *api.Client, token string, campaignIDs []string, maxCPM float64) (map[string]any, error) {
	type statsPoint struct {
		CampaignID  string
		CPM         float64
		Impressions float64
	}
	stats := []statsPoint{}

	for _, campaignID := range campaignIDs {
		response, err := client.Graph(ctx, "GET", campaignID+"/insights", token, map[string]string{
			"fields": "cpm,impressions",
			"limit":  "1",
		}, nil)
		if err != nil {
			return nil, err
		}
		row := normalizeGraphObject(response)
		data, _ := row["data"].([]any)
		first := map[string]any{}
		if len(data) > 0 {
			first = normalizeGraphObject(data[0])
		}
		stats = append(stats, statsPoint{
			CampaignID:  campaignID,
			CPM:         toNumber(first["cpm"]),
			Impressions: toNumber(first["impressions"]),
		})
	}

	cpms := []float64{}
	for _, point := range stats {
		if !math.IsNaN(point.CPM) && !math.IsInf(point.CPM, 0) {
			cpms = append(cpms, point.CPM)
		}
	}
	avg := mean(cpms)
	variance := 0.0
	if len(cpms) > 0 {
		for _, value := range cpms {
			diff := value - avg
			variance += diff * diff
		}
		variance /= float64(len(cpms))
	}
	capValue := math.Min(maxCPM, avg+math.Sqrt(variance))

	worstImpressions := 0.0
	if len(stats) > 0 {
		worstImpressions = stats[0].Impressions
		for _, point := range stats[1:] {
			if point.Impressions < worstImpressions {
				worstImpressions = point.Impressions
			}
		}
	}

	updated := 0
	for _, point := range stats {
		var payload map[string]any
		if point.Impressions <= worstImpressions {
			payload = map[string]any{"status": "PAUSED"}
		} else {
			payload = map[string]any{"bid_amount": asString(int(math.Round(capValue * 100)))}
		}
		if _, err := client.Graph(ctx, "POST", point.CampaignID, token, nil, payload); err != nil {
			return nil, err
		}
		updated++
	}

	return map[string]any{
		"cap":     capValue,
		"updated": updated,
	}, nil
}

func mean(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	total := 0.0
	for _, value := range values {
		total += value
	}
	return total / float64(len(values))
}
