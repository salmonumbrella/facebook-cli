package cmd

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	"github.com/salmonumbrella/facebook-cli/internal/api"
	"github.com/salmonumbrella/facebook-cli/internal/config"
	"github.com/salmonumbrella/facebook-cli/internal/facebook"
	"github.com/salmonumbrella/facebook-cli/internal/output"
	"github.com/salmonumbrella/facebook-cli/internal/profile"
)

var (
	Version = "dev"
	Commit  = "none"
	Date    = "unknown"
)

type rootFlags struct {
	Output      string
	DryRun      bool
	APIVersion  string
	AccessToken string
	Profile     string
}

type app struct {
	env     *config.Env
	flags   rootFlags
	runtime config.RuntimeContext
	client  *api.Client
}

func Execute(ctx context.Context, args []string) error {
	application := &app{
		env: config.NewEnv(),
		flags: rootFlags{
			Output: "json",
		},
	}

	root := &cobra.Command{
		Use:           "fbcli",
		Short:         "Facebook Graph API CLI",
		Version:       Version,
		SilenceErrors: true,
		SilenceUsage:  true,
		PersistentPreRunE: func(cmd *cobra.Command, _ []string) error {
			runtime, err := config.ResolveRuntimeContext(
				application.flags.Output,
				application.flags.DryRun,
				application.flags.APIVersion,
				application.flags.AccessToken,
				application.flags.Profile,
				application.env,
			)
			if err != nil {
				return err
			}
			application.runtime = runtime
			application.client = api.New(runtime.APIVersion)
			application.client.DryRun = runtime.DryRun
			return nil
		},
	}

	root.PersistentFlags().StringVar(&application.flags.Output, "output", "json", "Output format: json|table|csv")
	root.PersistentFlags().BoolVar(&application.flags.DryRun, "dry-run", false, "Do not perform mutations")
	root.PersistentFlags().StringVar(&application.flags.APIVersion, "api-version", "", "Override Graph API version")
	root.PersistentFlags().StringVar(&application.flags.AccessToken, "access-token", "", "Override access token for this run")
	root.PersistentFlags().StringVar(&application.flags.Profile, "profile", "", "Use a named profile")

	root.AddCommand(
		newAuthCommand(application),
		newProfileCommand(application),
		newLimitsCommand(application),
		newAdsCommand(application),
		newBusinessCommand(application),
		newInvoicesCommand(application),
		newAdLibraryCommand(application),
		newInstagramCommand(application),
		newWhatsAppCommand(application),
		newPageInsightsCommand(application),
		newPostLocalCommand(application),
		newDraftCommand(application),
		newMeCommand(application),
		newPagesCommand(application),
		newMusicCommand(application),
	)
	addPageScopedCommands(root, application)

	root.SetArgs(args)
	return root.ExecuteContext(ctx)
}

func (a *app) write(cmd *cobra.Command, value any) error {
	return output.Write(cmd.OutOrStdout(), value, a.runtime.Output)
}

func (a *app) requireAccessToken() (string, error) {
	if strings.TrimSpace(a.runtime.AccessToken) == "" {
		return "", errors.New("missing access token. Use --access-token or profile/env token")
	}
	return a.runtime.AccessToken, nil
}

func (a *app) loadProfileStore() (*profile.Store, profile.StoreData, error) {
	store := profile.New(a.runtime.ProfilePath)
	data, err := store.Load()
	if err != nil {
		return nil, profile.StoreData{}, err
	}
	return store, data, nil
}

func (a *app) loadPageAssets(ctx context.Context) ([]facebook.PageAsset, error) {
	configAssets, err := config.LoadPageAssets(a.env)
	if err != nil {
		return nil, err
	}
	assets := make([]facebook.PageAsset, 0, len(configAssets))
	for _, asset := range configAssets {
		assets = append(assets, facebook.PageAsset{
			FBPageID:        asset.FBPageID,
			PageName:        asset.PageName,
			DisplayName:     asset.DisplayName,
			PageAccessToken: asset.PageAccessToken,
		})
	}
	return facebook.ResolvePageAssets(ctx, a.client, assets, a.runtime.AccessToken)
}

func (a *app) requirePageAssets(ctx context.Context) ([]facebook.PageAsset, error) {
	assets, err := a.loadPageAssets(ctx)
	if err != nil {
		return nil, err
	}
	if len(assets) == 0 {
		return nil, errors.New("no page assets available. Run `fbcli auth login` and `fbcli pages`, or set FACEBOOK_ASSETS in .env or via FBCLI_ENV_PATH")
	}
	return assets, nil
}

func (a *app) requirePage(ctx context.Context, pageName string) (facebook.PageAsset, error) {
	assets, err := a.requirePageAssets(ctx)
	if err != nil {
		return facebook.PageAsset{}, err
	}
	return facebook.GetPageOrError(assets, pageName)
}

func readStdin(cmd *cobra.Command) (string, error) {
	info, err := os.Stdin.Stat()
	if err != nil {
		return "", err
	}
	if info.Mode()&os.ModeCharDevice != 0 {
		return "", nil
	}
	data, err := io.ReadAll(cmd.InOrStdin())
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

func resolveText(cmd *cobra.Command, arg string, label string) (string, error) {
	if arg != "" && arg != "-" {
		return arg, nil
	}
	stdin, err := readStdin(cmd)
	if err != nil {
		return "", err
	}
	if stdin == "" {
		return "", fmt.Errorf("no %s provided via argument or stdin", label)
	}
	return stdin, nil
}

func resolveIDs(cmd *cobra.Command, arg string) ([]string, error) {
	if arg != "" && arg != "-" {
		return splitCSVOrLines(arg), nil
	}
	stdin, err := readStdin(cmd)
	if err != nil {
		return nil, err
	}
	if stdin == "" {
		return nil, errors.New("no IDs provided via argument or stdin")
	}
	return splitCSVOrLines(stdin), nil
}

func splitCSVOrLines(value string) []string {
	fields := strings.FieldsFunc(value, func(r rune) bool {
		return r == ',' || r == '\n' || r == '\r'
	})
	out := make([]string, 0, len(fields))
	for _, field := range fields {
		field = strings.TrimSpace(field)
		if field != "" {
			out = append(out, field)
		}
	}
	return out
}

func parseJSONArgument(arg string) (map[string]any, error) {
	if strings.TrimSpace(arg) == "" {
		return map[string]any{}, nil
	}
	var out map[string]any
	if err := json.Unmarshal([]byte(arg), &out); err != nil {
		return nil, err
	}
	return out, nil
}

func parseJSONDataArgument(arg string) ([]map[string]any, error) {
	row, err := parseJSONArgument(arg)
	if err != nil {
		return nil, err
	}
	items, _ := row["data"].([]any)
	out := make([]map[string]any, 0, len(items))
	for _, item := range items {
		out = append(out, toMap(item))
	}
	return out, nil
}

func toMap(value any) map[string]any {
	if row, ok := value.(map[string]any); ok {
		return row
	}
	return map[string]any{}
}

func parseOptionalInt(value string, fallback int) int {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func parseOptionalFloat(value string, fallback float64) float64 {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return fallback
	}
	return parsed
}
