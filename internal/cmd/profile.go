package cmd

import (
	"fmt"
	"sort"

	"github.com/spf13/cobra"

	"github.com/salmonumbrella/facebook-cli/internal/profile"
)

func newProfileCommand(a *app) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "profile",
		Short: "Manage local profiles",
	}

	cmd.AddCommand(&cobra.Command{
		Use:   "add <name>",
		Args:  cobra.ExactArgs(1),
		Short: "Add a profile",
		RunE: func(cmd *cobra.Command, args []string) error {
			accessToken, _ := cmd.Flags().GetString("access-token")
			store, data, err := a.loadProfileStore()
			if err != nil {
				return err
			}
			profileData := data.Profiles[args[0]]
			if accessToken != "" {
				profileData.AccessToken = accessToken
			}
			data.Profiles[args[0]] = profileData
			if data.Active == "" {
				data.Active = args[0]
			}
			if err := store.Save(data); err != nil {
				return err
			}
			return a.write(cmd, map[string]any{"ok": true, "added": args[0]})
		},
	})
	cmd.Commands()[0].Flags().String("access-token", "", "Profile access token")

	cmd.AddCommand(&cobra.Command{
		Use:   "switch <name>",
		Args:  cobra.ExactArgs(1),
		Short: "Switch active profile",
		RunE: func(cmd *cobra.Command, args []string) error {
			store, data, err := a.loadProfileStore()
			if err != nil {
				return err
			}
			if _, ok := data.Profiles[args[0]]; !ok {
				return fmt.Errorf("profile %q not found", args[0])
			}
			data.Active = args[0]
			if err := store.Save(data); err != nil {
				return err
			}
			return a.write(cmd, map[string]any{"ok": true, "active": args[0]})
		},
	})

	cmd.AddCommand(&cobra.Command{
		Use:   "show [name]",
		Args:  cobra.MaximumNArgs(1),
		Short: "Show profile",
		RunE: func(cmd *cobra.Command, args []string) error {
			_, data, err := a.loadProfileStore()
			if err != nil {
				return err
			}
			name := data.Active
			if len(args) == 1 {
				name = args[0]
			}
			profileData, ok := data.Profiles[name]
			if !ok {
				return fmt.Errorf("profile %q not found", name)
			}
			return a.write(cmd, map[string]any{
				"active":         data.Active,
				"profile":        name,
				"hasAccessToken": profileData.AccessToken != "",
				"defaults":       profileData.Defaults,
			})
		},
	})

	cmd.AddCommand(&cobra.Command{
		Use:   "remove <name>",
		Args:  cobra.ExactArgs(1),
		Short: "Remove profile",
		RunE: func(cmd *cobra.Command, args []string) error {
			store, data, err := a.loadProfileStore()
			if err != nil {
				return err
			}
			delete(data.Profiles, args[0])
			if data.Active == args[0] {
				data.Active = profile.DefaultProfileName
				for _, name := range sortedProfileNames(data.Profiles) {
					data.Active = name
					break
				}
			}
			if data.Active == "" {
				data.Active = profile.DefaultProfileName
			}
			if _, ok := data.Profiles[data.Active]; !ok {
				data.Profiles[data.Active] = profile.Data{}
			}
			if err := store.Save(data); err != nil {
				return err
			}
			return a.write(cmd, map[string]any{"ok": true, "removed": args[0], "active": data.Active})
		},
	})

	cmd.AddCommand(&cobra.Command{
		Use:   "list",
		Args:  cobra.NoArgs,
		Short: "List profiles",
		RunE: func(cmd *cobra.Command, args []string) error {
			_, data, err := a.loadProfileStore()
			if err != nil {
				return err
			}
			rows := make([]map[string]any, 0, len(data.Profiles))
			for _, name := range sortedProfileNames(data.Profiles) {
				profileData := data.Profiles[name]
				rows = append(rows, map[string]any{
					"name":           name,
					"active":         name == data.Active,
					"hasAccessToken": profileData.AccessToken != "",
				})
			}
			return a.write(cmd, map[string]any{
				"active":   data.Active,
				"profiles": rows,
			})
		},
	})

	return cmd
}

func sortedProfileNames(profiles map[string]profile.Data) []string {
	names := make([]string, 0, len(profiles))
	for name := range profiles {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}
