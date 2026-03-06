package cmd

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

func firstArg(args []string) string {
	return argAt(args, 0)
}

func argAt(args []string, index int) string {
	if index < 0 || index >= len(args) {
		return ""
	}
	return args[index]
}

func firstString(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case nil:
		return ""
	default:
		return fmt.Sprintf("%v", value)
	}
}

func firstNonEmptyValue(values ...any) any {
	for _, value := range values {
		if firstString(value) != "" {
			return value
		}
	}
	return ""
}

func pageCommand(a *app, use string, short string, fn func(cmd *cobra.Command, args []string) (any, error)) *cobra.Command {
	return &cobra.Command{
		Use:   use,
		Args:  cobra.MinimumNArgs(strings.Count(use, "<")),
		Short: short,
		RunE: func(cmd *cobra.Command, args []string) error {
			result, err := fn(cmd, args)
			if err != nil {
				return err
			}
			return a.write(cmd, result)
		},
	}
}
