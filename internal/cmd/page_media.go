package cmd

import (
	"errors"
	"strings"

	"github.com/spf13/cobra"

	"github.com/salmonumbrella/facebook-cli/internal/config"
	"github.com/salmonumbrella/facebook-cli/internal/facebook"
)

func addPageMediaCommands(root *cobra.Command, a *app) {
	dmCmd := &cobra.Command{
		Use:   "dm <page> <user-id> [message]",
		Args:  cobra.MinimumNArgs(2),
		Short: "Send a page DM",
		RunE: func(cmd *cobra.Command, args []string) error {
			page, err := a.requirePage(cmd.Context(), args[0])
			if err != nil {
				return err
			}
			message, err := resolveText(cmd, strings.Join(args[2:], " "), "message")
			if err != nil {
				return err
			}
			result, err := facebook.SendDM(cmd.Context(), a.client, page, args[1], message)
			if err != nil {
				return err
			}
			return a.write(cmd, result)
		},
	}

	publishReelCmd := pageCommand(a, "publish-reel <page> <url|file> [description]", "Publish a reel", func(cmd *cobra.Command, args []string) (any, error) {
		if a.runtime.DryRun {
			return map[string]any{"ok": true, "route": "publish-reel"}, nil
		}
		description := strings.Join(args[2:], " ")
		page, err := a.requirePage(cmd.Context(), args[0])
		if err != nil {
			return nil, err
		}
		return facebook.PublishReel(cmd.Context(), a.client, page, args[1], description, "")
	})
	reelsCmd := pageCommand(a, "reels <page>", "List reels", func(cmd *cobra.Command, args []string) (any, error) {
		page, err := a.requirePage(cmd.Context(), args[0])
		if err != nil {
			return nil, err
		}
		return facebook.ListReels(cmd.Context(), a.client, page)
	})
	videoStatusCmd := pageCommand(a, "video-status <page> <video-id>", "Video status", func(cmd *cobra.Command, args []string) (any, error) {
		page, err := a.requirePage(cmd.Context(), args[0])
		if err != nil {
			return nil, err
		}
		return facebook.VideoStatus(cmd.Context(), a.client, page, args[1])
	})

	publishVideoCmd := &cobra.Command{
		Use:   "publish-video <page> <url|file> [title]",
		Args:  cobra.MinimumNArgs(2),
		Short: "Publish a video",
		RunE: func(cmd *cobra.Command, args []string) error {
			if a.runtime.DryRun {
				return a.write(cmd, map[string]any{"ok": true, "route": "publish-video"})
			}
			page, err := a.requirePage(cmd.Context(), args[0])
			if err != nil {
				return err
			}
			description, _ := cmd.Flags().GetString("description")
			appConfig := config.LoadAppConfig(a.env)
			result, err := facebook.PublishVideo(cmd.Context(), a.client, page, appConfig.AppID, appConfig.UserToken, args[1], strings.Join(args[2:], " "), description)
			if err != nil {
				return err
			}
			return a.write(cmd, result)
		},
	}
	publishVideoCmd.Flags().String("description", "", "Video description")

	videoStoryCmd := pageCommand(a, "video-story <page> <url|file>", "Publish a video story", func(cmd *cobra.Command, args []string) (any, error) {
		if a.runtime.DryRun {
			return map[string]any{"ok": true, "route": "video-story"}, nil
		}
		page, err := a.requirePage(cmd.Context(), args[0])
		if err != nil {
			return nil, err
		}
		return facebook.PublishVideoStory(cmd.Context(), a.client, page, args[1])
	})
	photoStoryCmd := pageCommand(a, "photo-story <page> <photo-url>", "Publish a photo story", func(cmd *cobra.Command, args []string) (any, error) {
		if a.runtime.DryRun {
			return map[string]any{"ok": true, "route": "photo-story"}, nil
		}
		page, err := a.requirePage(cmd.Context(), args[0])
		if err != nil {
			return nil, err
		}
		return facebook.PublishPhotoStory(cmd.Context(), a.client, page, args[1])
	})
	storiesCmd := pageCommand(a, "stories <page>", "List stories", func(cmd *cobra.Command, args []string) (any, error) {
		page, err := a.requirePage(cmd.Context(), args[0])
		if err != nil {
			return nil, err
		}
		return facebook.ListStories(cmd.Context(), a.client, page)
	})

	slideshowCmd := &cobra.Command{
		Use:   "slideshow <page> <url1,url2,...>",
		Args:  cobra.MinimumNArgs(2),
		Short: "Create a slideshow",
		RunE: func(cmd *cobra.Command, args []string) error {
			if a.runtime.DryRun {
				return a.write(cmd, map[string]any{"ok": true, "route": "slideshow"})
			}
			page, err := a.requirePage(cmd.Context(), args[0])
			if err != nil {
				return err
			}
			urls := splitCSVOrLines(args[1])
			if args[1] == "-" {
				urls, err = resolveIDs(cmd, "-")
				if err != nil {
					return err
				}
			}
			if len(urls) < 3 || len(urls) > 7 {
				return errors.New("slideshow requires 3-7 image URLs")
			}
			duration, _ := cmd.Flags().GetInt("duration")
			transition, _ := cmd.Flags().GetInt("transition")
			result, err := facebook.CreateSlideshow(cmd.Context(), a.client, page, urls, duration, transition)
			if err != nil {
				return err
			}
			return a.write(cmd, result)
		},
	}
	slideshowCmd.Flags().Int("duration", 1750, "Duration in ms")
	slideshowCmd.Flags().Int("transition", 250, "Transition in ms")

	crosspostCmd := pageCommand(a, "crosspost <page> <video-id>", "Crosspost a video", func(cmd *cobra.Command, args []string) (any, error) {
		page, err := a.requirePage(cmd.Context(), args[0])
		if err != nil {
			return nil, err
		}
		return facebook.Crosspost(cmd.Context(), a.client, page, args[1])
	})
	enableCrosspostCmd := pageCommand(a, "enable-crosspost <page> <video-id> <page-ids>", "Enable crossposting", func(cmd *cobra.Command, args []string) (any, error) {
		page, err := a.requirePage(cmd.Context(), args[0])
		if err != nil {
			return nil, err
		}
		return facebook.EnableCrosspost(cmd.Context(), a.client, page, args[1], splitCSVOrLines(args[2]))
	})
	crosspostPagesCmd := pageCommand(a, "crosspost-pages <page>", "List crosspost pages", func(cmd *cobra.Command, args []string) (any, error) {
		page, err := a.requirePage(cmd.Context(), args[0])
		if err != nil {
			return nil, err
		}
		return facebook.CrosspostPages(cmd.Context(), a.client, page)
	})
	crosspostCheckCmd := pageCommand(a, "crosspost-check <page> <video-id>", "Check crossposting eligibility", func(cmd *cobra.Command, args []string) (any, error) {
		page, err := a.requirePage(cmd.Context(), args[0])
		if err != nil {
			return nil, err
		}
		return facebook.CrosspostCheck(cmd.Context(), a.client, page, args[1])
	})

	abCreateCmd := &cobra.Command{
		Use:   "ab-create <page> <name> <goal> <video-ids> <control-id>",
		Args:  cobra.ExactArgs(5),
		Short: "Create an A/B test",
		RunE: func(cmd *cobra.Command, args []string) error {
			page, err := a.requirePage(cmd.Context(), args[0])
			if err != nil {
				return err
			}
			description, _ := cmd.Flags().GetString("desc")
			duration, _ := cmd.Flags().GetInt("duration")
			result, err := facebook.ABCreate(cmd.Context(), a.client, page, args[1], args[2], splitCSVOrLines(args[3]), args[4], description, duration)
			if err != nil {
				return err
			}
			return a.write(cmd, result)
		},
	}
	abCreateCmd.Flags().String("desc", "", "Description")
	abCreateCmd.Flags().Int("duration", 0, "Duration in seconds")

	abResultsCmd := pageCommand(a, "ab-results <page> <test-id>", "A/B results", func(cmd *cobra.Command, args []string) (any, error) {
		page, err := a.requirePage(cmd.Context(), args[0])
		if err != nil {
			return nil, err
		}
		return facebook.ABResults(cmd.Context(), a.client, page, args[1])
	})
	abTestsCmd := &cobra.Command{
		Use:   "ab-tests <page>",
		Args:  cobra.ExactArgs(1),
		Short: "List A/B tests",
		RunE: func(cmd *cobra.Command, args []string) error {
			page, err := a.requirePage(cmd.Context(), args[0])
			if err != nil {
				return err
			}
			since, _ := cmd.Flags().GetString("since")
			until, _ := cmd.Flags().GetString("until")
			result, err := facebook.ABTests(cmd.Context(), a.client, page, since, until)
			if err != nil {
				return err
			}
			return a.write(cmd, result)
		},
	}
	abTestsCmd.Flags().String("since", "", "Start date")
	abTestsCmd.Flags().String("until", "", "End date")
	abDeleteCmd := pageCommand(a, "ab-delete <page> <test-id>", "Delete an A/B test", func(cmd *cobra.Command, args []string) (any, error) {
		page, err := a.requirePage(cmd.Context(), args[0])
		if err != nil {
			return nil, err
		}
		return facebook.ABDelete(cmd.Context(), a.client, page, args[1])
	})

	root.AddCommand(
		dmCmd,
		publishReelCmd,
		reelsCmd,
		videoStatusCmd,
		publishVideoCmd,
		videoStoryCmd,
		photoStoryCmd,
		storiesCmd,
		slideshowCmd,
		crosspostCmd,
		enableCrosspostCmd,
		crosspostPagesCmd,
		crosspostCheckCmd,
		abCreateCmd,
		abResultsCmd,
		abTestsCmd,
		abDeleteCmd,
	)
}
