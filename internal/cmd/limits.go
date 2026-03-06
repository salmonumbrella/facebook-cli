package cmd

import (
	"encoding/json"
	"errors"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

func newLimitsCommand(a *app) *cobra.Command {
	return &cobra.Command{
		Use:   "limits",
		Args:  cobra.ExactArgs(1),
		Short: "Inspect rate limit headers from the environment",
		RunE: func(cmd *cobra.Command, args []string) error {
			if args[0] != "check" {
				return errors.New("usage: fbcli limits check")
			}
			parseHeader := func(name string) any {
				value := os.Getenv(name)
				if strings.TrimSpace(value) == "" {
					return nil
				}
				var out any
				if err := json.Unmarshal([]byte(value), &out); err == nil {
					return out
				}
				return value
			}
			return a.write(cmd, map[string]any{
				"ok":            true,
				"appUsage":      parseHeader("FB_X_APP_USAGE"),
				"businessUsage": parseHeader("FB_X_BUSINESS_USE_CASE_USAGE"),
			})
		},
	}
}
