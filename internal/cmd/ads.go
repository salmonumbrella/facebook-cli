package cmd

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/spf13/cobra"

	"github.com/salmonumbrella/facebook-cli/internal/facebook"
)

func newAdsCommand(a *app) *cobra.Command {
	return &cobra.Command{
		Use:   "ads",
		Args:  cobra.ArbitraryArgs,
		Short: "Ads API commands",
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return errors.New("usage: fbcli ads <group> <action>")
			}
			group := args[0]
			action := ""
			rest := []string{}
			if len(args) > 1 {
				action = args[1]
				rest = args[2:]
			}
			token := a.runtime.AccessToken

			requireToken := func() (string, error) {
				if a.runtime.DryRun {
					return token, nil
				}
				return a.requireAccessToken()
			}

			if group == "deploy" {
				if action == "" || len(rest) < 1 {
					return errors.New("usage: fbcli ads deploy <config-path> <account-id>")
				}
				configData, err := facebook.LoadDeployConfig(action)
				if err != nil {
					return err
				}
				if a.runtime.DryRun || token == "" || rest[0] == "" {
					return a.write(cmd, map[string]any{"ok": true, "dryRun": true, "valid": facebook.ValidateDeployConfig(configData)})
				}
				result, err := facebook.ExecuteDeploy(cmd.Context(), a.client, token, rest[0], configData, a.runtime.DryRun)
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			}

			if group == "validate" {
				if action == "" {
					return errors.New("usage: fbcli ads validate <config-path>")
				}
				configData, err := facebook.LoadDeployConfig(action)
				if err != nil {
					return err
				}
				return a.write(cmd, facebook.ValidateDeployConfig(configData))
			}

			if group == "audience" {
				token, err := requireToken()
				if err != nil {
					return err
				}
				var result any
				switch action {
				case "search-interests":
					result, err = facebook.SearchInterests(cmd.Context(), a.client, token, firstArg(rest), 25)
				case "search-behaviors":
					result, err = facebook.SearchBehaviors(cmd.Context(), a.client, token, firstArg(rest), 25)
				case "estimate-size":
					payload, parseErr := parseJSONArgument(argAt(rest, 1))
					if parseErr != nil {
						return parseErr
					}
					result, err = facebook.GetAudienceSizeEstimate(cmd.Context(), a.client, firstArg(rest), token, payload)
				default:
					return errors.New("usage: fbcli ads audience <search-interests|search-behaviors|estimate-size>")
				}
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			}

			if group == "duplicate" {
				if a.runtime.DryRun || token == "" {
					return a.write(cmd, map[string]any{"ok": true, "dryRun": true, "route": "ads duplicate"})
				}
				result, err := facebook.DuplicateCampaign(cmd.Context(), a.client, action, token, firstArg(rest), facebook.DuplicateCampaignOptions{
					Name:         argAt(rest, 1),
					BudgetFactor: parseOptionalFloat(argAt(rest, 2), 0),
				})
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			}

			if group == "stats" {
				switch action {
				case "collect":
					if len(rest) < 3 {
						return errors.New("usage: fbcli ads stats collect <account-id> <since> <until> [storage-dir]")
					}
					if a.runtime.DryRun || token == "" {
						return a.write(cmd, map[string]any{"ok": true, "dryRun": true, "route": "ads stats collect"})
					}
					result, err := facebook.CollectStats(cmd.Context(), a.client, rest[0], token, rest[1], rest[2], argAt(rest, 3))
					if err != nil {
						return err
					}
					return a.write(cmd, result)
				case "analyze":
					rows, err := parseJSONDataArgument(firstArg(rest))
					if err != nil {
						return err
					}
					return a.write(cmd, facebook.AnalyzeStats(rows))
				case "validate":
					rows, err := parseJSONDataArgument(firstArg(rest))
					if err != nil {
						return err
					}
					points := make([]facebook.StatsPoint, 0, len(rows))
					for _, row := range rows {
						points = append(points, statsPointFromRow(row))
					}
					return a.write(cmd, facebook.ValidateStats(points))
				case "export":
					rows, err := parseJSONDataArgument(firstArg(rest))
					if err != nil {
						return err
					}
					points := make([]facebook.StatsPoint, 0, len(rows))
					for _, row := range rows {
						points = append(points, statsPointFromRow(row))
					}
					outputPath := argAt(rest, 1)
					if outputPath == "" {
						outputPath = "/tmp/facebook-cli-stats.csv"
					}
					if err := facebook.ExportStatsCSV(points, outputPath); err != nil {
						return err
					}
					return a.write(cmd, map[string]any{"ok": true, "output": outputPath})
				default:
					return errors.New("usage: fbcli ads stats <collect|analyze|validate|export>")
				}
			}

			if group == "optimize" {
				switch action {
				case "validate":
					configData, err := parseOptimizationConfig(firstArg(rest))
					if err != nil {
						return err
					}
					return a.write(cmd, facebook.ValidateOptimizationConfig(configData))
				case "create":
					if a.runtime.DryRun || token == "" {
						return a.write(cmd, map[string]any{"ok": true, "dryRun": true, "route": "ads optimize create"})
					}
					configData, err := parseOptimizationConfig(argAt(rest, 1))
					if err != nil {
						return err
					}
					result, err := facebook.CreateTestCampaigns(cmd.Context(), a.client, token, firstArg(rest), configData, facebook.CreateTestCampaignOptions{})
					if err != nil {
						return err
					}
					return a.write(cmd, result)
				case "update":
					if a.runtime.DryRun || token == "" {
						return a.write(cmd, map[string]any{"ok": true, "dryRun": true, "route": "ads optimize update"})
					}
					result, err := facebook.UpdateCPMBids(cmd.Context(), a.client, token, splitCSVOrLines(firstArg(rest)), parseOptionalFloat(argAt(rest, 1), 0))
					if err != nil {
						return err
					}
					return a.write(cmd, result)
				default:
					return errors.New("usage: fbcli ads optimize <validate|create|update>")
				}
			}

			if group == "exportyaml" {
				token, err := a.requireAccessToken()
				if err != nil {
					return err
				}
				result, err := facebook.ExportCampaignToYAML(cmd.Context(), a.client, token, action, 0, 0, 0)
				if err != nil {
					return err
				}
				_, err = fmt.Fprintln(cmd.OutOrStdout(), result)
				return err
			}

			if _, err := requireToken(); err != nil {
				return err
			}
			if token == "" && a.runtime.DryRun {
				token = a.runtime.AccessToken
			}

			if group == "accounts" {
				var result any
				var err error
				switch action {
				case "list":
					if a.runtime.DryRun {
						result = map[string]any{"ok": true, "route": "ads accounts list"}
					} else {
						result, err = facebook.ListAdAccounts(cmd.Context(), a.client, token, nil)
					}
				case "get":
					if a.runtime.DryRun {
						result = map[string]any{"ok": true, "route": "ads accounts get"}
					} else {
						result, err = facebook.GetAdAccount(cmd.Context(), a.client, firstArg(rest), token, nil)
					}
				default:
					return errors.New("usage: fbcli ads accounts <list|get>")
				}
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			}

			if group == "campaigns" {
				result, err := runAdsMutation(cmd, a.runtime.DryRun,
					func() (any, error) {
						switch action {
						case "list":
							return facebook.ListCampaigns(cmd.Context(), a.client, firstArg(rest), token, nil)
						case "get":
							return facebook.GetCampaign(cmd.Context(), a.client, firstArg(rest), token, nil)
						case "create":
							payload, err := parseJSONArgument(argAt(rest, 1))
							if err != nil {
								return nil, err
							}
							return facebook.CreateCampaign(cmd.Context(), a.client, firstArg(rest), token, payload)
						case "update":
							payload, err := parseJSONArgument(argAt(rest, 1))
							if err != nil {
								return nil, err
							}
							return facebook.UpdateCampaign(cmd.Context(), a.client, firstArg(rest), token, payload)
						case "pause":
							return facebook.PauseCampaign(cmd.Context(), a.client, firstArg(rest), token)
						case "activate":
							return facebook.ActivateCampaign(cmd.Context(), a.client, firstArg(rest), token)
						case "delete":
							return facebook.DeleteCampaign(cmd.Context(), a.client, firstArg(rest), token)
						default:
							return nil, errors.New("usage: fbcli ads campaigns <list|get|create|update|pause|activate|delete>")
						}
					},
					"ads campaigns "+action)
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			}

			if group == "adsets" {
				result, err := runAdsMutation(cmd, a.runtime.DryRun,
					func() (any, error) {
						switch action {
						case "list":
							return facebook.ListAdSets(cmd.Context(), a.client, firstArg(rest), token, nil)
						case "get":
							return facebook.GetAdSet(cmd.Context(), a.client, firstArg(rest), token, nil)
						case "create":
							payload, err := parseJSONArgument(argAt(rest, 1))
							if err != nil {
								return nil, err
							}
							return facebook.CreateAdSet(cmd.Context(), a.client, firstArg(rest), token, payload)
						case "update":
							payload, err := parseJSONArgument(argAt(rest, 1))
							if err != nil {
								return nil, err
							}
							return facebook.UpdateAdSet(cmd.Context(), a.client, firstArg(rest), token, payload)
						default:
							return nil, errors.New("usage: fbcli ads adsets <list|get|create|update>")
						}
					},
					"ads adsets "+action)
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			}

			if group == "ads" {
				result, err := runAdsMutation(cmd, a.runtime.DryRun,
					func() (any, error) {
						switch action {
						case "list":
							return facebook.ListAds(cmd.Context(), a.client, firstArg(rest), token, nil)
						case "get":
							return facebook.GetAd(cmd.Context(), a.client, firstArg(rest), token, nil)
						case "create":
							payload, err := parseJSONArgument(argAt(rest, 1))
							if err != nil {
								return nil, err
							}
							return facebook.CreateAd(cmd.Context(), a.client, firstArg(rest), token, payload)
						case "update":
							payload, err := parseJSONArgument(argAt(rest, 1))
							if err != nil {
								return nil, err
							}
							return facebook.UpdateAd(cmd.Context(), a.client, firstArg(rest), token, payload)
						default:
							return nil, errors.New("usage: fbcli ads ads <list|get|create|update>")
						}
					},
					"ads ads "+action)
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			}

			if group == "creatives" {
				result, err := runAdsMutation(cmd, a.runtime.DryRun,
					func() (any, error) {
						switch action {
						case "list":
							return facebook.ListCreatives(cmd.Context(), a.client, firstArg(rest), token, nil)
						case "get":
							return facebook.GetCreative(cmd.Context(), a.client, firstArg(rest), token, nil)
						case "create":
							payload, err := parseJSONArgument(argAt(rest, 1))
							if err != nil {
								return nil, err
							}
							return facebook.CreateCreative(cmd.Context(), a.client, firstArg(rest), token, payload)
						default:
							return nil, errors.New("usage: fbcli ads creatives <list|get|create>")
						}
					},
					"ads creatives "+action)
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			}

			if group == "images" && action == "upload" {
				if a.runtime.DryRun {
					return a.write(cmd, map[string]any{"ok": true, "route": "ads images upload"})
				}
				payload, err := parseJSONArgument(argAt(rest, 1))
				if err != nil {
					return err
				}
				result, err := facebook.UploadImage(cmd.Context(), a.client, firstArg(rest), token, payload)
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			}

			if group == "insights" && action == "get" {
				params := map[string]string{}
				if len(rest) > 1 {
					payload, err := parseJSONArgument(rest[1])
					if err != nil {
						return err
					}
					for key, value := range payload {
						params[key] = firstString(value)
					}
				}
				var result any
				var err error
				if a.runtime.DryRun {
					result = map[string]any{"ok": true, "route": "ads insights get"}
				} else if params["breakdowns"] != "" {
					result, err = facebook.GetInsightsWithBreakdowns(cmd.Context(), a.client, firstArg(rest), token, params)
				} else {
					result, err = facebook.GetInsights(cmd.Context(), a.client, firstArg(rest), token, params)
				}
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			}

			if group == "audiences" {
				result, err := runAdsMutation(cmd, a.runtime.DryRun,
					func() (any, error) {
						switch action {
						case "list":
							return facebook.ListAudiences(cmd.Context(), a.client, firstArg(rest), token, nil)
						case "get":
							return facebook.GetAudience(cmd.Context(), a.client, firstArg(rest), token, nil)
						case "create":
							payload, err := parseJSONArgument(argAt(rest, 1))
							if err != nil {
								return nil, err
							}
							return facebook.CreateAudience(cmd.Context(), a.client, firstArg(rest), token, payload)
						case "update":
							payload, err := parseJSONArgument(argAt(rest, 1))
							if err != nil {
								return nil, err
							}
							return facebook.UpdateAudience(cmd.Context(), a.client, firstArg(rest), token, payload)
						case "delete":
							return facebook.DeleteAudience(cmd.Context(), a.client, firstArg(rest), token)
						default:
							return nil, errors.New("usage: fbcli ads audiences <list|get|create|update|delete>")
						}
					},
					"ads audiences "+action)
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			}

			return fmt.Errorf("unknown ads command path: %s", strings.Join(args, " "))
		},
	}
}

func runAdsMutation(cmd *cobra.Command, dryRun bool, fn func() (any, error), route string) (any, error) {
	if dryRun {
		return map[string]any{"ok": true, "route": route}, nil
	}
	return fn()
}

func parseOptimizationConfig(input string) (facebook.OptimizationConfig, error) {
	var configData facebook.OptimizationConfig
	if strings.TrimSpace(input) == "" {
		return configData, nil
	}
	if err := json.Unmarshal([]byte(input), &configData); err != nil {
		return configData, err
	}
	return configData, nil
}

func statsPointFromRow(row map[string]any) facebook.StatsPoint {
	return facebook.StatsPoint{
		CampaignID:      firstString(row["campaign_id"]),
		CampaignName:    firstString(row["campaign_name"]),
		Date:            firstString(firstNonEmptyValue(row["date"], row["date_start"])),
		Impressions:     parseOptionalFloat(firstString(row["impressions"]), 0),
		Clicks:          parseOptionalFloat(firstString(row["clicks"]), 0),
		Spend:           parseOptionalFloat(firstString(row["spend"]), 0),
		CTR:             parseOptionalFloat(firstString(row["ctr"]), 0),
		CPC:             parseOptionalFloat(firstString(row["cpc"]), 0),
		CPM:             parseOptionalFloat(firstString(row["cpm"]), 0),
		Conversions:     parseOptionalFloat(firstString(row["conversions"]), 0),
		ConversionValue: parseOptionalFloat(firstString(row["conversion_value"]), 0),
		CPA:             parseOptionalFloat(firstString(row["cpa"]), 0),
		ROAS:            parseOptionalFloat(firstString(row["roas"]), 0),
	}
}
