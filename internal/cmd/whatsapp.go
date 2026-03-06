package cmd

import (
	"errors"
	"strings"

	"github.com/spf13/cobra"

	"github.com/salmonumbrella/facebook-cli/internal/facebook"
)

func newWhatsAppCommand(a *app) *cobra.Command {
	return &cobra.Command{
		Use:   "wa",
		Args:  cobra.ArbitraryArgs,
		Short: "WhatsApp commands",
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return errors.New("usage: fbcli wa <send|templates|phone-numbers>")
			}
			group := args[0]
			action := argAt(args, 1)
			rest := []string{}
			if len(args) > 2 {
				rest = args[2:]
			}
			if a.runtime.DryRun {
				route := "wa " + group
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
			case group == "send":
				result, err = facebook.SendWhatsAppMessage(cmd.Context(), a.client, action, token, argAt(rest, 0), strings.Join(rest[1:], " "))
			case group == "templates" && action == "list":
				result, err = facebook.ListWhatsAppTemplates(cmd.Context(), a.client, firstArg(rest), token, nil)
			case group == "templates" && action == "create":
				payload, parseErr := parseJSONArgument(argAt(rest, 1))
				if parseErr != nil {
					return parseErr
				}
				result, err = facebook.CreateWhatsAppTemplate(cmd.Context(), a.client, firstArg(rest), token, payload)
			case group == "phone-numbers" && action == "list":
				result, err = facebook.ListWhatsAppPhoneNumbers(cmd.Context(), a.client, firstArg(rest), token, nil)
			default:
				return errors.New("usage: fbcli wa <send|templates|phone-numbers>")
			}
			if err != nil {
				return err
			}
			return a.write(cmd, result)
		},
	}
}
