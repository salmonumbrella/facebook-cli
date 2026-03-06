package cmd

import (
	"github.com/spf13/cobra"

	"github.com/salmonumbrella/facebook-cli/internal/facebook"
)

func addPageAnalyticsCommands(root *cobra.Command, a *app) {
	root.AddCommand(
		pageCommand(a, "insights <page> <post-id>", "Post insights", func(cmd *cobra.Command, args []string) (any, error) {
			page, err := a.requirePage(cmd.Context(), args[0])
			if err != nil {
				return nil, err
			}
			return facebook.PostInsights(cmd.Context(), a.client, page, args[1])
		}),
		pageCommand(a, "fans <page>", "Fan count", func(cmd *cobra.Command, args []string) (any, error) {
			page, err := a.requirePage(cmd.Context(), args[0])
			if err != nil {
				return nil, err
			}
			return facebook.Fans(cmd.Context(), a.client, page)
		}),
		pageCommand(a, "likes <page> <post-id>", "Like count", func(cmd *cobra.Command, args []string) (any, error) {
			page, err := a.requirePage(cmd.Context(), args[0])
			if err != nil {
				return nil, err
			}
			return facebook.Likes(cmd.Context(), a.client, page, args[1])
		}),
		pageCommand(a, "shares <page> <post-id>", "Share count", func(cmd *cobra.Command, args []string) (any, error) {
			page, err := a.requirePage(cmd.Context(), args[0])
			if err != nil {
				return nil, err
			}
			return facebook.Shares(cmd.Context(), a.client, page, args[1])
		}),
		pageCommand(a, "reactions <page> <post-id>", "Reaction breakdown", func(cmd *cobra.Command, args []string) (any, error) {
			page, err := a.requirePage(cmd.Context(), args[0])
			if err != nil {
				return nil, err
			}
			return facebook.Reactions(cmd.Context(), a.client, page, args[1])
		}),
		pageCommand(a, "impressions <page> <post-id>", "Impressions", func(cmd *cobra.Command, args []string) (any, error) {
			page, err := a.requirePage(cmd.Context(), args[0])
			if err != nil {
				return nil, err
			}
			return facebook.PostMetric(cmd.Context(), a.client, page, args[1], "post_impressions")
		}),
		pageCommand(a, "reach <page> <post-id>", "Reach", func(cmd *cobra.Command, args []string) (any, error) {
			page, err := a.requirePage(cmd.Context(), args[0])
			if err != nil {
				return nil, err
			}
			return facebook.PostMetric(cmd.Context(), a.client, page, args[1], "post_impressions_unique")
		}),
		pageCommand(a, "clicks <page> <post-id>", "Clicks", func(cmd *cobra.Command, args []string) (any, error) {
			page, err := a.requirePage(cmd.Context(), args[0])
			if err != nil {
				return nil, err
			}
			return facebook.PostMetric(cmd.Context(), a.client, page, args[1], "post_clicks")
		}),
		pageCommand(a, "engaged <page> <post-id>", "Engaged users", func(cmd *cobra.Command, args []string) (any, error) {
			page, err := a.requirePage(cmd.Context(), args[0])
			if err != nil {
				return nil, err
			}
			return facebook.PostMetric(cmd.Context(), a.client, page, args[1], "post_engaged_users")
		}),
		pageCommand(a, "top-commenters <page> <post-id>", "Top commenters", func(cmd *cobra.Command, args []string) (any, error) {
			page, err := a.requirePage(cmd.Context(), args[0])
			if err != nil {
				return nil, err
			}
			return facebook.TopCommenters(cmd.Context(), a.client, page, args[1])
		}),
		pageCommand(a, "comment-count <page> <post-id>", "Comment count", func(cmd *cobra.Command, args []string) (any, error) {
			page, err := a.requirePage(cmd.Context(), args[0])
			if err != nil {
				return nil, err
			}
			return facebook.CommentCount(cmd.Context(), a.client, page, args[1])
		}),
	)
}
