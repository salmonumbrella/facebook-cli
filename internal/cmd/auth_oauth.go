package cmd

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os/exec"
	"runtime"
	"time"
)

type oauthCallback struct {
	Code             string
	State            string
	Error            string
	ErrorDescription string
}

func waitForOAuthCallback(ctx context.Context, redirectURI string, expectedState string, timeout time.Duration) (oauthCallback, error) {
	parsed, err := url.Parse(redirectURI)
	if err != nil {
		return oauthCallback{}, err
	}
	resultCh := make(chan oauthCallback, 1)
	server := &http.Server{}
	server.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != parsed.Path {
			http.NotFound(w, r)
			return
		}
		callback := oauthCallback{
			Code:             r.URL.Query().Get("code"),
			State:            r.URL.Query().Get("state"),
			Error:            r.URL.Query().Get("error"),
			ErrorDescription: r.URL.Query().Get("error_description"),
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		switch {
		case callback.Error != "" || callback.Code == "":
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte("<h1>Facebook login failed.</h1><p>You can close this window.</p>"))
		case callback.State != expectedState:
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte("<h1>OAuth state mismatch.</h1><p>You can close this window.</p>"))
		default:
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("<h1>Login complete.</h1><p>You can close this window and return to your terminal.</p>"))
		}
		select {
		case resultCh <- callback:
		default:
		}
		go func() { _ = server.Shutdown(context.Background()) }()
	})

	listener, err := net.Listen("tcp", parsed.Host)
	if err != nil {
		return oauthCallback{}, fmt.Errorf("failed to start OAuth callback server on port %s: %w", parsed.Port(), err)
	}
	defer func() { _ = listener.Close() }()

	go func() {
		_ = server.Serve(listener)
	}()

	timer := time.NewTimer(timeout)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		_ = server.Shutdown(context.Background())
		return oauthCallback{}, ctx.Err()
	case <-timer.C:
		_ = server.Shutdown(context.Background())
		return oauthCallback{}, fmt.Errorf("OAuth callback timed out after %s. Open the auth URL and complete login, then ensure your browser can reach %s", timeout, redirectURI)
	case callback := <-resultCh:
		return callback, nil
	}
}

func openBrowser(rawURL string) error {
	var command *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		command = exec.Command("open", rawURL)
	case "windows":
		command = exec.Command("cmd", "/c", "start", "", rawURL)
	default:
		command = exec.Command("xdg-open", rawURL)
	}
	return command.Start()
}

func validateRedirectURI(raw string) (string, error) {
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", fmt.Errorf("invalid redirect URI: %s", raw)
	}
	if parsed.Scheme != "http" {
		return "", errors.New("OAuth local callback currently supports only http:// redirect URIs (https is not supported here)")
	}
	if parsed.Hostname() == "" {
		return "", errors.New("redirect URI must include a hostname")
	}
	if parsed.Port() == "" {
		return "", errors.New("redirect URI must include an explicit port")
	}
	if parsed.Path == "" {
		parsed.Path = "/"
	}
	return parsed.String(), nil
}

func randomState() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
