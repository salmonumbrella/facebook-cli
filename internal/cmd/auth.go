package cmd

import (
	"errors"
	"time"

	"github.com/spf13/cobra"

	facebookauth "github.com/salmonumbrella/facebook-cli/internal/auth"
	"github.com/salmonumbrella/facebook-cli/internal/profile"
)

func newAuthCommand(a *app) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "auth",
		Short: "Authentication commands",
	}

	cmd.AddCommand(newAuthLoginCommand(a))
	cmd.AddCommand(newAuthStatusCommand(a))
	cmd.AddCommand(newAuthLogoutCommand(a))
	cmd.AddCommand(newAuthRefreshCommand(a))
	cmd.AddCommand(newAuthDoctorCommand(a))
	return cmd
}

func newAuthStatusCommand(a *app) *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Args:  cobra.NoArgs,
		Short: "Show auth status",
		RunE: func(cmd *cobra.Command, args []string) error {
			_, data, err := a.loadProfileStore()
			if err != nil {
				return err
			}
			profileData := data.Profiles[a.runtime.ProfileName]
			return a.write(cmd, map[string]any{
				"authenticated": a.runtime.AccessToken != "",
				"profile":       a.runtime.ProfileName,
				"source":        ternaryString(a.runtime.AccessToken != "", "override/env/profile", "none"),
				"token":         tokenPreview(a.runtime.AccessToken),
				"auth":          profileData.Auth,
			})
		},
	}
}

func newAuthLogoutCommand(a *app) *cobra.Command {
	return &cobra.Command{
		Use:   "logout",
		Args:  cobra.NoArgs,
		Short: "Clear stored auth for the active profile",
		RunE: func(cmd *cobra.Command, args []string) error {
			store, data, err := a.loadProfileStore()
			if err != nil {
				return err
			}
			data = profile.ClearStoredAuth(data, a.runtime.ProfileName)
			if err := store.Save(data); err != nil {
				return err
			}
			return a.write(cmd, map[string]any{
				"ok":        true,
				"profile":   a.runtime.ProfileName,
				"loggedOut": true,
			})
		},
	}
}

func newAuthRefreshCommand(a *app) *cobra.Command {
	return &cobra.Command{
		Use:   "refresh",
		Args:  cobra.NoArgs,
		Short: "Refresh the stored token",
		RunE: func(cmd *cobra.Command, args []string) error {
			appID := a.env.Get("FB_APP_ID")
			appSecret := a.env.Get("FB_APP_SECRET")
			if appID == "" || appSecret == "" {
				return errors.New("FB_APP_ID and FB_APP_SECRET are required for auth refresh")
			}

			authClient := facebookauth.New()
			store, data, err := a.loadProfileStore()
			if err != nil {
				return err
			}
			profileData := data.Profiles[a.runtime.ProfileName]
			currentToken := firstNonBlank(profileData.AccessToken, a.runtime.AccessToken)
			if currentToken == "" {
				return errors.New("no stored access token to refresh. Run `auth login` first")
			}

			refreshed, err := authClient.ExchangeForLongLivedToken(cmd.Context(), appID, appSecret, currentToken, a.runtime.APIVersion)
			if err != nil {
				return err
			}
			newToken := firstNonBlank(firstString(refreshed["access_token"]), currentToken)
			expiresIn := parseOptionalInt(firstString(refreshed["expires_in"]), 0)
			debugResponse, err := authClient.DebugToken(cmd.Context(), newToken, facebookauth.BuildAppAccessToken(appID, appSecret), a.runtime.APIVersion)
			if err != nil {
				return err
			}

			profileData.AccessToken = newToken
			profileData.Auth = buildProfileAuth(expiresIn, firstString(refreshed["token_type"]), toMap(debugResponse["data"]))
			data.Profiles[a.runtime.ProfileName] = profileData
			data.Active = a.runtime.ProfileName
			if err := store.Save(data); err != nil {
				return err
			}

			return a.write(cmd, map[string]any{
				"ok":        true,
				"profile":   a.runtime.ProfileName,
				"expiresIn": expiresIn,
				"expiresAt": facebookauth.ComputeExpiresAt(expiresIn, time.Now()),
				"token":     tokenPreview(newToken),
			})
		},
	}
}
