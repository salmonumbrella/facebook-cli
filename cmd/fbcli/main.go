package main

import (
	"context"
	"fmt"
	"os"

	"github.com/salmonumbrella/facebook-cli/internal/cmd"
)

var (
	version = "dev"
	commit  = "none"
	date    = "unknown"
)

func main() {
	cmd.Version = version
	cmd.Commit = commit
	cmd.Date = date
	if err := cmd.Execute(context.Background(), os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "fbcli:", err)
		os.Exit(1)
	}
}
