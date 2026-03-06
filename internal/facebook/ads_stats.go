package facebook

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"strconv"

	"github.com/salmonumbrella/facebook-cli/internal/api"
)

type StatsPoint struct {
	CampaignID      string  `json:"campaign_id"`
	CampaignName    string  `json:"campaign_name,omitempty"`
	Date            string  `json:"date"`
	Impressions     float64 `json:"impressions"`
	Clicks          float64 `json:"clicks"`
	Spend           float64 `json:"spend"`
	CTR             float64 `json:"ctr"`
	CPC             float64 `json:"cpc"`
	CPM             float64 `json:"cpm"`
	Conversions     float64 `json:"conversions"`
	ConversionValue float64 `json:"conversion_value"`
	CPA             float64 `json:"cpa"`
	ROAS            float64 `json:"roas"`
}

func toNumber(value any) float64 {
	switch typed := value.(type) {
	case float64:
		return typed
	case float32:
		return float64(typed)
	case int:
		return float64(typed)
	case int64:
		return float64(typed)
	case string:
		number, err := strconv.ParseFloat(typed, 64)
		if err == nil {
			return number
		}
		return 0
	case json.Number:
		number, _ := typed.Float64()
		return number
	default:
		return 0
	}
}

func parseInsightsRow(row map[string]any) StatsPoint {
	conversions := toNumber(row["conversions"])
	conversionValue := toNumber(row["conversion_value"])
	spend := toNumber(row["spend"])
	point := StatsPoint{
		CampaignID:      asString(row["campaign_id"]),
		CampaignName:    asString(row["campaign_name"]),
		Date:            asString(row["date_start"]),
		Impressions:     toNumber(row["impressions"]),
		Clicks:          toNumber(row["clicks"]),
		Spend:           spend,
		CTR:             toNumber(row["ctr"]),
		CPC:             toNumber(row["cpc"]),
		CPM:             toNumber(row["cpm"]),
		Conversions:     conversions,
		ConversionValue: conversionValue,
	}
	if conversions > 0 {
		point.CPA = spend / conversions
	}
	if spend > 0 {
		point.ROAS = conversionValue / spend
	}
	return point
}

func CollectStats(
	ctx context.Context,
	client *api.Client,
	accountID string,
	token string,
	startDate string,
	endDate string,
	storageDir string,
) (map[string]any, error) {
	if storageDir == "" {
		home, _ := os.UserHomeDir()
		storageDir = filepath.Join(home, ".config", "facebook-cli", "stats", "daily")
	}
	if err := os.MkdirAll(storageDir, 0o755); err != nil {
		return nil, err
	}

	response, err := client.Graph(ctx, "GET", normalizeAccountPath(accountID)+"/insights", token, map[string]string{
		"level":          "campaign",
		"time_increment": "1",
		"fields":         "campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,cpm,date_start,date_stop,conversions,conversion_value",
		"time_range":     normalizeValue(map[string]any{"since": startDate, "until": endDate}),
	}, nil)
	if err != nil {
		return nil, err
	}
	row := normalizeGraphObject(response)
	items, _ := row["data"].([]any)
	points := make([]StatsPoint, 0, len(items))
	seenCampaigns := map[string]struct{}{}
	for _, item := range items {
		point := parseInsightsRow(normalizeGraphObject(item))
		points = append(points, point)
		seenCampaigns[point.CampaignID] = struct{}{}

		filename := filepath.Join(storageDir, point.CampaignID+"_"+point.Date+".json")
		data, err := json.MarshalIndent(point, "", "  ")
		if err != nil {
			return nil, err
		}
		if err := os.WriteFile(filename, data, 0o644); err != nil {
			return nil, err
		}
	}

	return map[string]any{
		"campaigns":  len(seenCampaigns),
		"dataPoints": len(points),
		"storageDir": storageDir,
		"points":     points,
	}, nil
}

func summarize(values []float64) map[string]any {
	if len(values) == 0 {
		return map[string]any{"min": 0.0, "max": 0.0, "avg": 0.0, "stddev": 0.0}
	}
	minValue := values[0]
	maxValue := values[0]
	total := 0.0
	for _, value := range values {
		if value < minValue {
			minValue = value
		}
		if value > maxValue {
			maxValue = value
		}
		total += value
	}
	avg := total / float64(len(values))
	var variance float64
	for _, value := range values {
		diff := value - avg
		variance += diff * diff
	}
	variance /= float64(len(values))
	return map[string]any{
		"min":    minValue,
		"max":    maxValue,
		"avg":    avg,
		"stddev": math.Sqrt(variance),
	}
}

func AnalyzeStats(dataPoints []map[string]any) map[string]any {
	impressions := []float64{}
	clicks := []float64{}
	spend := []float64{}
	ctr := []float64{}
	cpc := []float64{}
	cpm := []float64{}

	for _, point := range dataPoints {
		impressions = append(impressions, toNumber(point["impressions"]))
		clicks = append(clicks, toNumber(point["clicks"]))
		spend = append(spend, toNumber(point["spend"]))
		ctr = append(ctr, toNumber(point["ctr"]))
		cpc = append(cpc, toNumber(point["cpc"]))
		cpm = append(cpm, toNumber(point["cpm"]))
	}

	trend := map[string]any{"impressions": 0.0, "clicks": 0.0, "spend": 0.0}
	if len(impressions) > 1 {
		trend["impressions"] = impressions[len(impressions)-1] - impressions[0]
		trend["clicks"] = clicks[len(clicks)-1] - clicks[0]
		trend["spend"] = spend[len(spend)-1] - spend[0]
	}

	return map[string]any{
		"impressions": summarize(impressions),
		"clicks":      summarize(clicks),
		"spend":       summarize(spend),
		"ctr":         summarize(ctr),
		"cpc":         summarize(cpc),
		"cpm":         summarize(cpm),
		"trend":       trend,
	}
}

func ValidateStats(dataPoints []StatsPoint) []map[string]any {
	byCampaign := map[string][]StatsPoint{}
	for _, point := range dataPoints {
		byCampaign[point.CampaignID] = append(byCampaign[point.CampaignID], point)
	}

	out := make([]map[string]any, 0, len(byCampaign))
	for campaignID, points := range byCampaign {
		impressions := 0.0
		clicks := 0.0
		spend := 0.0
		for _, point := range points {
			impressions += point.Impressions
			clicks += point.Clicks
			spend += point.Spend
		}
		runtimeHours := len(points) * 24
		pass := impressions >= 1000 && clicks >= 10 && spend >= 1 && runtimeHours >= 24
		recommendation := "collect_more_data_before_optimization"
		if pass {
			recommendation = "ready_for_optimization"
		}
		out = append(out, map[string]any{
			"campaignId": campaignID,
			"pass":       pass,
			"checks": map[string]any{
				"impressions":  impressions,
				"clicks":       clicks,
				"spend":        spend,
				"runtimeHours": runtimeHours,
			},
			"recommendation": recommendation,
		})
	}
	return out
}

func ExportStatsCSV(dataPoints []StatsPoint, outputPath string) error {
	file, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer func() { _ = file.Close() }()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	if err := writer.Write([]string{
		"campaign_id", "campaign_name", "date", "impressions", "clicks", "spend", "ctr", "cpc", "cpm", "conversions", "cpa", "roas",
	}); err != nil {
		return err
	}
	for _, point := range dataPoints {
		if err := writer.Write([]string{
			point.CampaignID,
			point.CampaignName,
			point.Date,
			asString(point.Impressions),
			asString(point.Clicks),
			asString(point.Spend),
			asString(point.CTR),
			asString(point.CPC),
			asString(point.CPM),
			asString(point.Conversions),
			asString(point.CPA),
			asString(point.ROAS),
		}); err != nil {
			return err
		}
	}
	return writer.Error()
}
