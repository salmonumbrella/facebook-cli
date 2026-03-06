package cmd

import (
	"errors"
	"strings"

	"github.com/spf13/cobra"

	"github.com/salmonumbrella/facebook-cli/internal/facebook"
)

func newInstagramCommand(a *app) *cobra.Command {
	return &cobra.Command{
		Use:   "ig",
		Args:  cobra.ArbitraryArgs,
		Short: "Instagram commands",
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return errors.New("usage: fbcli ig <accounts|media|account|comments|publish|stories>")
			}
			group := args[0]
			action := argAt(args, 1)
			rest := []string{}
			if len(args) > 2 {
				rest = args[2:]
			}
			if a.runtime.DryRun {
				route := "ig " + group
				if action != "" {
					route += " " + action
				}
				return a.write(cmd, map[string]any{"ok": true, "route": route})
			}
			token, err := a.requireAccessToken()
			if err != nil {
				return err
			}
			var result any
			switch {
			case group == "accounts" && action == "list":
				result, err = facebook.ListIGAccounts(cmd.Context(), a.client, token)
			case group == "media" && action == "list":
				result, err = facebook.ListIGMedia(cmd.Context(), a.client, firstArg(rest), token, nil)
			case group == "media" && action == "insights":
				result, err = facebook.GetIGMediaInsights(cmd.Context(), a.client, firstArg(rest), token, "")
			case group == "account" && action == "insights":
				result, err = facebook.GetIGAccountInsights(cmd.Context(), a.client, firstArg(rest), token, "", "")
			case group == "comments" && action == "list":
				result, err = facebook.ListIGComments(cmd.Context(), a.client, firstArg(rest), token, nil)
			case group == "comments" && action == "reply":
				result, err = facebook.ReplyIGComment(cmd.Context(), a.client, firstArg(rest), token, strings.Join(rest[1:], " "))
			case group == "publish":
				result, err = facebook.PublishIGMedia(cmd.Context(), a.client, action, token, argAt(rest, 0), "", strings.Join(rest[1:], " "), "")
			case group == "stories" && action == "list":
				result, err = facebook.ListIGStories(cmd.Context(), a.client, firstArg(rest), token, nil)
			default:
				return errors.New("usage: fbcli ig <accounts|media|account|comments|publish|stories>")
			}
			if err != nil {
				return err
			}
			return a.write(cmd, result)
		},
	}
}
