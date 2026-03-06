package cmd

import (
	"strings"

	"github.com/spf13/cobra"

	"github.com/salmonumbrella/facebook-cli/internal/facebook"
)

func newPageInsightsCommand(a *app) *cobra.Command {
	return &cobra.Command{
		Use:   "page-insights <metric|alias> <page-id>",
		Args:  cobra.MinimumNArgs(1),
		Short: "Page insights",
		RunE: func(cmd *cobra.Command, args []string) error {
			if a.runtime.DryRun {
				return a.write(cmd, map[string]any{"ok": true, "route": "page-insights " + strings.Join(args, " ")})
			}
			token, err := a.requireAccessToken()
			if err != nil {
				return err
			}

			metric := ""
			pageID := ""
			alias := args[0]
			switch alias {
			case "fans":
				metric, pageID = "page_fans", argAt(args, 1)
			case "reach":
				metric, pageID = "page_impressions_unique", argAt(args, 1)
			case "views":
				metric, pageID = "page_views_total", argAt(args, 1)
			case "engagement":
				metric, pageID = "page_engaged_users", argAt(args, 1)
			default:
				metric, pageID = args[0], argAt(args, 1)
				if pageID == "" {
					pageID = args[0]
					metric = "page_fans"
				}
			}

			result, err := facebook.GetPageInsightsMetric(cmd.Context(), a.client, pageID, token, metric, "day")
			if err != nil {
				return err
			}
			return a.write(cmd, result)
		},
	}
}

func newPostLocalCommand(a *app) *cobra.Command {
	return &cobra.Command{
		Use:   "post-local <page-id> <file-path> [caption]",
		Args:  cobra.MinimumNArgs(2),
		Short: "Upload a local photo",
		RunE: func(cmd *cobra.Command, args []string) error {
			if a.runtime.DryRun {
				return a.write(cmd, map[string]any{"ok": true, "route": "post-local " + strings.Join(args, " ")})
			}
			token, err := a.requireAccessToken()
			if err != nil {
				return err
			}
			result, err := facebook.UploadLocalPhoto(cmd.Context(), a.client, args[0], token, args[1], strings.Join(args[2:], " "))
			if err != nil {
				return err
			}
			return a.write(cmd, result)
		},
	}
}

func newDraftCommand(a *app) *cobra.Command {
	return &cobra.Command{
		Use:   "draft <page-id> <message>",
		Args:  cobra.MinimumNArgs(2),
		Short: "Create a draft post",
		RunE: func(cmd *cobra.Command, args []string) error {
			if a.runtime.DryRun {
				return a.write(cmd, map[string]any{"ok": true, "route": "draft " + strings.Join(args, " ")})
			}
			token, err := a.requireAccessToken()
			if err != nil {
				return err
			}
			result, err := facebook.CreateDraftPost(cmd.Context(), a.client, args[0], token, strings.Join(args[1:], " "), nil)
			if err != nil {
				return err
			}
			return a.write(cmd, result)
		},
	}
}

func newMeCommand(a *app) *cobra.Command {
	return &cobra.Command{
		Use:   "me",
		Args:  cobra.NoArgs,
		Short: "Fetch /me",
		RunE: func(cmd *cobra.Command, args []string) error {
			if a.runtime.DryRun {
				return a.write(cmd, map[string]any{"ok": true, "route": "me"})
			}
			token, err := a.requireAccessToken()
			if err != nil {
				return err
			}
			result, err := facebook.GetMe(cmd.Context(), a.client, token, nil)
			if err != nil {
				return err
			}
			return a.write(cmd, result)
		},
	}
}

func newPagesCommand(a *app) *cobra.Command {
	return &cobra.Command{
		Use:   "pages",
		Args:  cobra.NoArgs,
		Short: "List configured or derived pages",
		RunE: func(cmd *cobra.Command, args []string) error {
			assets, err := a.loadPageAssets(cmd.Context())
			if err != nil {
				return err
			}
			return a.write(cmd, facebook.ListPageSummaries(assets))
		},
	}
}

func newMusicCommand(a *app) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "music",
		Args:  cobra.NoArgs,
		Short: "Music recommendations",
		RunE: func(cmd *cobra.Command, args []string) error {
			musicType, _ := cmd.Flags().GetString("type")
			country, _ := cmd.Flags().GetString("country")
			typeMap := map[string]string{
				"popular": "FACEBOOK_POPULAR_MUSIC",
				"new":     "FACEBOOK_NEW_MUSIC",
				"foryou":  "FACEBOOK_FOR_YOU",
			}
			if mapped, ok := typeMap[musicType]; ok {
				musicType = mapped
			}
			assets, err := a.loadPageAssets(cmd.Context())
			if err != nil {
				return err
			}
			result, err := facebook.Music(cmd.Context(), a.client, assets, musicType, country)
			if err != nil {
				return err
			}
			return a.write(cmd, result)
		},
	}
	cmd.Flags().String("type", "popular", "Music type")
	cmd.Flags().String("country", "", "Country code")
	return cmd
}
