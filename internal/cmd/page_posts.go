package cmd

import (
	"strings"

	"github.com/spf13/cobra"

	"github.com/salmonumbrella/facebook-cli/internal/facebook"
)

func addPageScopedCommands(root *cobra.Command, a *app) {
	root.AddCommand(
		&cobra.Command{
			Use:   "posts <page>",
			Args:  cobra.ExactArgs(1),
			Short: "List posts",
			RunE: func(cmd *cobra.Command, args []string) error {
				page, err := a.requirePage(cmd.Context(), args[0])
				if err != nil {
					return err
				}
				result, err := facebook.ListPosts(cmd.Context(), a.client, page)
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			},
		},
		&cobra.Command{
			Use:   "post <page> [message]",
			Args:  cobra.MinimumNArgs(1),
			Short: "Create a post",
			RunE: func(cmd *cobra.Command, args []string) error {
				page, err := a.requirePage(cmd.Context(), args[0])
				if err != nil {
					return err
				}
				message, err := resolveText(cmd, strings.Join(args[1:], " "), "message")
				if err != nil {
					return err
				}
				result, err := facebook.CreatePost(cmd.Context(), a.client, page, message)
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			},
		},
		&cobra.Command{
			Use:   "post-image <page> <url> [caption]",
			Args:  cobra.MinimumNArgs(2),
			Short: "Create an image post",
			RunE: func(cmd *cobra.Command, args []string) error {
				page, err := a.requirePage(cmd.Context(), args[0])
				if err != nil {
					return err
				}
				caption, err := resolveText(cmd, strings.Join(args[2:], " "), "caption")
				if err != nil {
					return err
				}
				result, err := facebook.PostImage(cmd.Context(), a.client, page, args[1], caption)
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			},
		},
		&cobra.Command{
			Use:   "update-post <page> <post-id> [message]",
			Args:  cobra.MinimumNArgs(2),
			Short: "Update a post",
			RunE: func(cmd *cobra.Command, args []string) error {
				page, err := a.requirePage(cmd.Context(), args[0])
				if err != nil {
					return err
				}
				message, err := resolveText(cmd, strings.Join(args[2:], " "), "message")
				if err != nil {
					return err
				}
				result, err := facebook.UpdatePost(cmd.Context(), a.client, page, args[1], message)
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			},
		},
		&cobra.Command{
			Use:   "delete-post <page> <post-id>",
			Args:  cobra.ExactArgs(2),
			Short: "Delete a post",
			RunE: func(cmd *cobra.Command, args []string) error {
				page, err := a.requirePage(cmd.Context(), args[0])
				if err != nil {
					return err
				}
				result, err := facebook.DeletePost(cmd.Context(), a.client, page, args[1])
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			},
		},
		&cobra.Command{
			Use:   "schedule <page> [message] <timestamp>",
			Args:  cobra.MinimumNArgs(2),
			Short: "Schedule a post",
			RunE: func(cmd *cobra.Command, args []string) error {
				page, err := a.requirePage(cmd.Context(), args[0])
				if err != nil {
					return err
				}
				timestamp := args[len(args)-1]
				message := strings.Join(args[1:len(args)-1], " ")
				if len(args) == 2 {
					message, err = resolveText(cmd, "", "message")
					if err != nil {
						return err
					}
				}
				result, err := facebook.SchedulePost(cmd.Context(), a.client, page, message, timestamp)
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			},
		},
		&cobra.Command{
			Use:   "comments <page> <post-id>",
			Args:  cobra.ExactArgs(2),
			Short: "List comments",
			RunE: func(cmd *cobra.Command, args []string) error {
				page, err := a.requirePage(cmd.Context(), args[0])
				if err != nil {
					return err
				}
				result, err := facebook.ListComments(cmd.Context(), a.client, page, args[1])
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			},
		},
		&cobra.Command{
			Use:   "reply <page> <comment-id> [message]",
			Args:  cobra.MinimumNArgs(2),
			Short: "Reply to a comment",
			RunE: func(cmd *cobra.Command, args []string) error {
				page, err := a.requirePage(cmd.Context(), args[0])
				if err != nil {
					return err
				}
				message, err := resolveText(cmd, strings.Join(args[2:], " "), "message")
				if err != nil {
					return err
				}
				result, err := facebook.ReplyToComment(cmd.Context(), a.client, page, args[1], message)
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			},
		},
		&cobra.Command{
			Use:   "delete-comment <page> <comment-id>",
			Args:  cobra.ExactArgs(2),
			Short: "Delete a comment",
			RunE: func(cmd *cobra.Command, args []string) error {
				page, err := a.requirePage(cmd.Context(), args[0])
				if err != nil {
					return err
				}
				result, err := facebook.DeleteComment(cmd.Context(), a.client, page, args[1])
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			},
		},
		&cobra.Command{
			Use:   "hide-comment <page> <comment-id>",
			Args:  cobra.ExactArgs(2),
			Short: "Hide a comment",
			RunE: func(cmd *cobra.Command, args []string) error {
				page, err := a.requirePage(cmd.Context(), args[0])
				if err != nil {
					return err
				}
				result, err := facebook.SetCommentHidden(cmd.Context(), a.client, page, args[1], true)
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			},
		},
		&cobra.Command{
			Use:   "unhide-comment <page> <comment-id>",
			Args:  cobra.ExactArgs(2),
			Short: "Unhide a comment",
			RunE: func(cmd *cobra.Command, args []string) error {
				page, err := a.requirePage(cmd.Context(), args[0])
				if err != nil {
					return err
				}
				result, err := facebook.SetCommentHidden(cmd.Context(), a.client, page, args[1], false)
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			},
		},
		&cobra.Command{
			Use:   "bulk-delete <page> [ids]",
			Args:  cobra.MinimumNArgs(1),
			Short: "Bulk delete comments",
			RunE: func(cmd *cobra.Command, args []string) error {
				page, err := a.requirePage(cmd.Context(), args[0])
				if err != nil {
					return err
				}
				ids, err := resolveIDs(cmd, strings.Join(args[1:], ","))
				if err != nil {
					return err
				}
				result, err := facebook.BulkDeleteComments(cmd.Context(), a.client, page, ids)
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			},
		},
		&cobra.Command{
			Use:   "bulk-hide <page> [ids]",
			Args:  cobra.MinimumNArgs(1),
			Short: "Bulk hide comments",
			RunE: func(cmd *cobra.Command, args []string) error {
				page, err := a.requirePage(cmd.Context(), args[0])
				if err != nil {
					return err
				}
				ids, err := resolveIDs(cmd, strings.Join(args[1:], ","))
				if err != nil {
					return err
				}
				result, err := facebook.BulkHideComments(cmd.Context(), a.client, page, ids)
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			},
		},
	)

	addPageAnalyticsCommands(root, a)
	addPageMediaCommands(root, a)
}
