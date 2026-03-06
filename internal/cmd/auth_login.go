package cmd

import (
	"errors"
	"fmt"
	"time"

	"github.com/spf13/cobra"

	facebookauth "github.com/salmonumbrella/facebook-cli/internal/auth"
)

func newAuthLoginCommand(a *app) *cobra.Command {
	var (
		redirectURI string
		timeoutMS   int
		scopesCSV   string
		scopesList  []string
		noOpen      bool
		printOnly   bool
	)

	cmd := &cobra.Command{
		Use:   "login",
		Args:  cobra.NoArgs,
		Short: "Run the Facebook OAuth flow",
		RunE: func(cmd *cobra.Command, args []string) error {
			authClient := facebookauth.New()
			redirectURI = firstNonBlank(redirectURI, a.env.Get("FB_OAUTH_REDIRECT_URI"), "http://localhost:8484/callback")
			timeoutMS = firstNonZero(timeoutMS, parseOptionalInt(a.env.Get("FB_OAUTH_TIMEOUT_MS"), 180000))
			scopes := requestedScopes(a.env, scopesCSV, scopesList)
			redirectURI, err := validateRedirectURI(redirectURI)
			if err != nil {
				return err
			}

			appID := a.env.Get("FB_APP_ID")
			appSecret := a.env.Get("FB_APP_SECRET")
			if appID == "" || appSecret == "" {
				return errors.New("FB_APP_ID and FB_APP_SECRET are required for auth login")
			}

			state, err := randomState()
			if err != nil {
				return err
			}
			authURL := facebookauth.BuildFacebookOAuthURL(appID, redirectURI, state, scopes, a.runtime.APIVersion)
			if printOnly {
				return a.write(cmd, map[string]any{
					"ok":          true,
					"authUrl":     authURL,
					"redirectUri": redirectURI,
					"scopes":      scopes,
				})
			}

			_, _ = fmt.Fprintln(cmd.ErrOrStderr(), "Complete Facebook login in your browser:", authURL)
			browser := map[string]any{
				"attempted": !noOpen,
				"opened":    false,
			}
			if !noOpen {
				if err := openBrowser(authURL); err != nil {
					browser["error"] = err.Error()
					_, _ = fmt.Fprintln(cmd.ErrOrStderr(), "Could not open browser automatically:", err)
					_, _ = fmt.Fprintln(cmd.ErrOrStderr(), "Open the URL above manually.")
				} else {
					browser["opened"] = true
				}
			}

			callback, err := waitForOAuthCallback(cmd.Context(), redirectURI, state, time.Duration(timeoutMS)*time.Millisecond)
			if err != nil {
				return err
			}
			if callback.Error != "" {
				return fmt.Errorf("facebook authorization failed: %s", firstNonBlank(callback.ErrorDescription, callback.Error))
			}
			if callback.Code == "" {
				return errors.New("oauth callback did not include an authorization code")
			}
			if callback.State != state {
				return errors.New("oauth state mismatch")
			}

			shortLived, err := authClient.ExchangeCodeForToken(cmd.Context(), appID, appSecret, redirectURI, callback.Code, a.runtime.APIVersion)
			if err != nil {
				return err
			}
			shortToken := firstString(shortLived["access_token"])
			if shortToken == "" {
				return errors.New("facebook token exchange did not return access_token")
			}

			longLived, err := authClient.ExchangeForLongLivedToken(cmd.Context(), appID, appSecret, shortToken, a.runtime.APIVersion)
			if err != nil {
				return err
			}
			finalToken := firstNonBlank(firstString(longLived["access_token"]), shortToken)
			expiresIn := parseOptionalInt(firstString(longLived["expires_in"]), parseOptionalInt(firstString(shortLived["expires_in"]), 0))

			debugResponse, err := authClient.DebugToken(cmd.Context(), finalToken, facebookauth.BuildAppAccessToken(appID, appSecret), a.runtime.APIVersion)
			if err != nil {
				return err
			}

			store, data, err := a.loadProfileStore()
			if err != nil {
				return err
			}
			profileData := data.Profiles[a.runtime.ProfileName]
			profileData.AccessToken = finalToken
			profileData.Auth = buildProfileAuth(expiresIn, firstString(longLived["token_type"]), toMap(debugResponse["data"]))
			data.Profiles[a.runtime.ProfileName] = profileData
			data.Active = a.runtime.ProfileName
			if err := store.Save(data); err != nil {
				return err
			}

			return a.write(cmd, map[string]any{
				"ok":              true,
				"profile":         a.runtime.ProfileName,
				"redirectUri":     redirectURI,
				"scopesRequested": scopes,
				"scopesGranted":   toMap(debugResponse["data"])["scopes"],
				"expiresIn":       expiresIn,
				"expiresAt":       facebookauth.ComputeExpiresAt(expiresIn, time.Now()),
				"token":           tokenPreview(finalToken),
				"browser":         browser,
			})
		},
	}
	cmd.Flags().StringVar(&redirectURI, "redirect-uri", "", "OAuth redirect URI")
	cmd.Flags().IntVar(&timeoutMS, "timeout-ms", 0, "OAuth callback timeout in milliseconds")
	cmd.Flags().StringVar(&scopesCSV, "scopes", "", "Comma-separated scopes")
	cmd.Flags().StringArrayVar(&scopesList, "scope", nil, "Additional scope")
	cmd.Flags().BoolVar(&noOpen, "no-open", false, "Do not open the browser automatically")
	cmd.Flags().BoolVar(&printOnly, "print-only", false, "Print the auth URL without running the callback flow")
	return cmd
}
