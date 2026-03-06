package cmd

import (
	"errors"

	"github.com/spf13/cobra"

	"github.com/salmonumbrella/facebook-cli/internal/facebook"
)

func newBusinessCommand(a *app) *cobra.Command {
	return &cobra.Command{
		Use:   "business",
		Args:  cobra.ArbitraryArgs,
		Short: "Business API commands",
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) < 1 {
				return errors.New("usage: fbcli business <info|ad-accounts>")
			}
			sub := args[0]
			if a.runtime.DryRun {
				return a.write(cmd, map[string]any{"ok": true, "route": "business " + sub})
			}
			token, err := a.requireAccessToken()
			if err != nil {
				return err
			}
			var result any
			switch sub {
			case "info":
				result, err = facebook.GetBusinessInfo(cmd.Context(), a.client, argAt(args, 1), token, nil)
			case "ad-accounts":
				result, err = facebook.ListBusinessAdAccounts(cmd.Context(), a.client, argAt(args, 1), token, nil)
			default:
				return errors.New("usage: fbcli business <info|ad-accounts> <business-id>")
			}
			if err != nil {
				return err
			}
			return a.write(cmd, result)
		},
	}
}

func newInvoicesCommand(a *app) *cobra.Command {
	return &cobra.Command{
		Use:   "invoices",
		Args:  cobra.ArbitraryArgs,
		Short: "Invoice commands",
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return errors.New("usage: fbcli invoices <list|download>")
			}
			sub := args[0]
			if a.runtime.DryRun {
				return a.write(cmd, map[string]any{"ok": true, "route": "invoices " + sub})
			}
			token, err := a.requireAccessToken()
			if err != nil {
				return err
			}
			switch sub {
			case "list":
				result, err := facebook.ListInvoices(cmd.Context(), a.client, argAt(args, 1), token, argAt(args, 2), argAt(args, 3), nil)
				if err != nil {
					return err
				}
				return a.write(cmd, result)
			case "download":
				bytes, err := facebook.DownloadInvoicePDF(cmd.Context(), a.client, argAt(args, 1), token)
				if err != nil {
					return err
				}
				return a.write(cmd, map[string]any{"bytes": len(bytes), "invoiceId": argAt(args, 1)})
			default:
				return errors.New("usage: fbcli invoices <list|download>")
			}
		},
	}
}

func newAdLibraryCommand(a *app) *cobra.Command {
	return &cobra.Command{
		Use:   "ad-library",
		Args:  cobra.ArbitraryArgs,
		Short: "Ad library search",
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) < 1 || args[0] != "search" {
				return errors.New("usage: fbcli ad-library search <query>")
			}
			if a.runtime.DryRun {
				return a.write(cmd, map[string]any{"ok": true, "route": "ad-library search"})
			}
			token, err := a.requireAccessToken()
			if err != nil {
				return err
			}
			result, err := facebook.SearchAdLibrary(cmd.Context(), a.client, token, map[string]string{
				"search_terms":         argAt(args, 1),
				"ad_reached_countries": "US",
			})
			if err != nil {
				return err
			}
			return a.write(cmd, result)
		},
	}
}
