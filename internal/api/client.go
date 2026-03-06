package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"time"
)

const (
	DefaultGraphVersion = "v25.0"
	BatchLimit          = 50
)

type Client struct {
	HTTP       *http.Client
	APIVersion string
	DryRun     bool
	MaxRetries int
	GraphURL   string
	RuploadURL string
}

type BatchRequest struct {
	Method      string
	RelativeURL string
	Body        map[string]string
}

type BatchResponse struct {
	Code int `json:"code"`
	Body any `json:"body"`
}

func New(version string) *Client {
	if strings.TrimSpace(version) == "" {
		version = DefaultGraphVersion
	}

	return &Client{
		HTTP: &http.Client{
			Timeout: 30 * time.Second,
		},
		APIVersion: version,
		MaxRetries: 3,
	}
}

func (c *Client) GraphBase() string {
	if strings.TrimSpace(c.GraphURL) != "" {
		return strings.TrimRight(c.GraphURL, "/")
	}
	return fmt.Sprintf("https://graph.facebook.com/%s", c.APIVersion)
}

func (c *Client) RuploadBase() string {
	if strings.TrimSpace(c.RuploadURL) != "" {
		return strings.TrimRight(c.RuploadURL, "/")
	}
	return fmt.Sprintf("https://rupload.facebook.com/video-upload/%s", c.APIVersion)
}

func (c *Client) Graph(
	ctx context.Context,
	method string,
	endpoint string,
	token string,
	params map[string]string,
	body map[string]any,
) (any, error) {
	method = strings.ToUpper(strings.TrimSpace(method))
	if method == "" {
		method = http.MethodGet
	}

	if c.DryRun && method != http.MethodGet {
		return map[string]any{
			"dry_run":  true,
			"method":   method,
			"endpoint": endpoint,
			"params":   params,
			"body":     body,
		}, nil
	}

	u := endpoint
	if !strings.HasPrefix(endpoint, "http://") && !strings.HasPrefix(endpoint, "https://") {
		u = fmt.Sprintf("%s/%s", c.GraphBase(), strings.TrimPrefix(endpoint, "/"))
	}

	parsedURL, err := url.Parse(u)
	if err != nil {
		return nil, err
	}
	query := parsedURL.Query()
	query.Set("access_token", token)

	requestBody := body
	requestParams := params
	if method != http.MethodGet && method != http.MethodDelete {
		requestParams = nil
		if requestBody == nil && params != nil {
			requestBody = make(map[string]any, len(params))
			for key, value := range params {
				requestBody[key] = value
			}
		}
	}
	for key, value := range requestParams {
		query.Set(key, normalizeGraphValue(value))
	}
	parsedURL.RawQuery = query.Encode()

	var payload []byte
	contentType := ""
	if requestBody != nil {
		form := url.Values{}
		for key, value := range requestBody {
			form.Set(key, normalizeGraphValue(value))
		}
		payload = []byte(form.Encode())
		contentType = "application/x-www-form-urlencoded"
	}

	responseBody, _, _, err := c.DoRequest(ctx, method, parsedURL.String(), nil, payload, contentType)
	if err != nil {
		return nil, err
	}

	var out any
	if len(responseBody) == 0 {
		return map[string]any{}, nil
	}
	if err := json.Unmarshal(responseBody, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *Client) GraphMultipart(
	ctx context.Context,
	endpoint string,
	token string,
	fields map[string]string,
	fileField string,
	fileName string,
	fileData []byte,
) (any, error) {
	var payload bytes.Buffer
	writer := multipart.NewWriter(&payload)

	for key, value := range fields {
		if err := writer.WriteField(key, value); err != nil {
			return nil, err
		}
	}

	if fileField != "" {
		part, err := writer.CreateFormFile(fileField, filepath.Base(fileName))
		if err != nil {
			return nil, err
		}
		if _, err := part.Write(fileData); err != nil {
			return nil, err
		}
	}

	if err := writer.Close(); err != nil {
		return nil, err
	}

	u := fmt.Sprintf("%s/%s", c.GraphBase(), strings.TrimPrefix(endpoint, "/"))
	parsedURL, err := url.Parse(u)
	if err != nil {
		return nil, err
	}
	query := parsedURL.Query()
	query.Set("access_token", token)
	parsedURL.RawQuery = query.Encode()

	responseBody, _, _, err := c.DoRequest(
		ctx,
		http.MethodPost,
		parsedURL.String(),
		nil,
		payload.Bytes(),
		writer.FormDataContentType(),
	)
	if err != nil {
		return nil, err
	}

	var out any
	if len(responseBody) == 0 {
		return map[string]any{}, nil
	}
	if err := json.Unmarshal(responseBody, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *Client) PaginateAll(ctx context.Context, firstURL string, limit int) ([]map[string]any, error) {
	var out []map[string]any
	nextURL := firstURL

	for strings.TrimSpace(nextURL) != "" {
		body, _, status, err := c.DoRequest(ctx, http.MethodGet, nextURL, nil, nil, "")
		if err != nil {
			return nil, err
		}

		var page struct {
			Data   []map[string]any `json:"data"`
			Paging struct {
				Next string `json:"next"`
			} `json:"paging"`
			Error map[string]any `json:"error"`
		}
		if err := json.Unmarshal(body, &page); err != nil {
			return nil, err
		}
		if status >= 400 {
			return nil, graphResponseError(page.Error, status)
		}

		out = append(out, page.Data...)
		if limit > 0 && len(out) >= limit {
			return out[:limit], nil
		}
		nextURL = page.Paging.Next
	}

	return out, nil
}

func (c *Client) GraphBatch(ctx context.Context, token string, requests []BatchRequest) ([]BatchResponse, error) {
	if len(requests) == 0 {
		return nil, nil
	}
	if c.DryRun {
		results := make([]BatchResponse, 0, len(requests))
		for _, request := range requests {
			results = append(results, BatchResponse{
				Code: 200,
				Body: map[string]any{
					"dry_run":      true,
					"method":       request.Method,
					"relative_url": request.RelativeURL,
					"body":         request.Body,
				},
			})
		}
		return results, nil
	}

	var results []BatchResponse
	for start := 0; start < len(requests); start += BatchLimit {
		end := start + BatchLimit
		if end > len(requests) {
			end = len(requests)
		}

		chunk := make([]map[string]string, 0, end-start)
		for _, request := range requests[start:end] {
			item := map[string]string{
				"method":       request.Method,
				"relative_url": request.RelativeURL,
			}
			if len(request.Body) > 0 {
				form := url.Values{}
				for key, value := range request.Body {
					form.Set(key, value)
				}
				item["body"] = form.Encode()
			}
			chunk = append(chunk, item)
		}

		batchJSON, err := json.Marshal(chunk)
		if err != nil {
			return nil, err
		}

		form := url.Values{}
		form.Set("access_token", token)
		form.Set("include_headers", "false")
		form.Set("batch", string(batchJSON))
		u := c.GraphBase()

		body, _, _, err := c.DoRequest(
			ctx,
			http.MethodPost,
			u,
			nil,
			[]byte(form.Encode()),
			"application/x-www-form-urlencoded",
		)
		if err != nil {
			return nil, err
		}

		var raw []struct {
			Code int             `json:"code"`
			Body json.RawMessage `json:"body"`
		}
		if err := json.Unmarshal(body, &raw); err != nil {
			return nil, err
		}

		for _, item := range raw {
			var parsed any
			if len(item.Body) > 0 {
				if err := json.Unmarshal(item.Body, &parsed); err != nil {
					parsed = string(item.Body)
				} else if text, ok := parsed.(string); ok {
					var nested any
					if err := json.Unmarshal([]byte(text), &nested); err == nil {
						parsed = nested
					}
				}
			}
			results = append(results, BatchResponse{
				Code: item.Code,
				Body: parsed,
			})
		}
	}

	return results, nil
}

func (c *Client) Rupload(
	ctx context.Context,
	endpoint string,
	token string,
	headers map[string]string,
	body []byte,
) (any, error) {
	u := endpoint
	if !strings.HasPrefix(endpoint, "http://") && !strings.HasPrefix(endpoint, "https://") {
		u = fmt.Sprintf("%s/%s", c.RuploadBase(), strings.TrimPrefix(endpoint, "/"))
	}

	requestHeaders := map[string]string{
		"Authorization": fmt.Sprintf("OAuth %s", token),
	}
	for key, value := range headers {
		requestHeaders[key] = value
	}

	responseBody, _, _, err := c.DoRequest(ctx, http.MethodPost, u, requestHeaders, body, "")
	if err != nil {
		return nil, err
	}

	var out any
	if len(responseBody) == 0 {
		return map[string]any{}, nil
	}
	if err := json.Unmarshal(responseBody, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *Client) ResumableUpload(
	ctx context.Context,
	appID string,
	userToken string,
	fileData []byte,
	fileName string,
	fileSize int,
	fileType string,
) (any, error) {
	initResponse, err := c.Graph(ctx, http.MethodPost, fmt.Sprintf("%s/uploads", appID), userToken, map[string]string{
		"file_name":   fileName,
		"file_length": fmt.Sprintf("%d", fileSize),
		"file_type":   fileType,
	}, nil)
	if err != nil {
		return nil, err
	}

	initMap, ok := initResponse.(map[string]any)
	if !ok {
		return nil, errors.New("upload session response had unexpected shape")
	}
	if _, hasError := initMap["error"]; hasError {
		return initMap, nil
	}

	sessionID, _ := initMap["id"].(string)
	if strings.TrimSpace(sessionID) == "" {
		return nil, errors.New("upload session did not return an id")
	}

	headers := map[string]string{
		"Authorization": fmt.Sprintf("OAuth %s", userToken),
		"file_offset":   "0",
	}
	uploadURL := fmt.Sprintf("%s/%s", c.GraphBase(), sessionID)
	responseBody, _, _, err := c.DoRequest(
		ctx,
		http.MethodPost,
		uploadURL,
		headers,
		fileData,
		"application/octet-stream",
	)
	if err != nil {
		return nil, err
	}

	var out map[string]any
	if err := json.Unmarshal(responseBody, &out); err != nil {
		return nil, err
	}
	if handle, ok := out["h"]; ok {
		return handle, nil
	}
	return out, nil
}

func (c *Client) DownloadBytes(ctx context.Context, u string, headers map[string]string) ([]byte, int, error) {
	body, _, status, err := c.DoRequest(ctx, http.MethodGet, u, headers, nil, "")
	if err != nil {
		return nil, 0, err
	}
	return body, status, nil
}

func (c *Client) DoRequest(
	ctx context.Context,
	method string,
	u string,
	headers map[string]string,
	body []byte,
	contentType string,
) ([]byte, http.Header, int, error) {
	method = strings.ToUpper(strings.TrimSpace(method))
	if method == "" {
		method = http.MethodGet
	}
	if c.HTTP == nil {
		c.HTTP = &http.Client{Timeout: 30 * time.Second}
	}

	attempts := c.MaxRetries
	if attempts < 1 {
		attempts = 1
	}

	var lastErr error
	for attempt := 0; attempt < attempts; attempt++ {
		req, err := http.NewRequestWithContext(ctx, method, u, bytes.NewReader(body))
		if err != nil {
			return nil, nil, 0, err
		}
		if contentType != "" {
			req.Header.Set("Content-Type", contentType)
		}
		for key, value := range headers {
			req.Header.Set(key, value)
		}

		resp, err := c.HTTP.Do(req)
		if err != nil {
			lastErr = err
			if attempt == attempts-1 {
				break
			}
			if sleepErr := sleepWithContext(ctx, retryDelay(attempt)); sleepErr != nil {
				return nil, nil, 0, sleepErr
			}
			continue
		}

		responseBody, readErr := io.ReadAll(resp.Body)
		closeErr := resp.Body.Close()
		if readErr != nil {
			return nil, nil, 0, readErr
		}
		if closeErr != nil {
			return nil, nil, 0, closeErr
		}

		if shouldRetry(resp.StatusCode) && attempt < attempts-1 {
			if sleepErr := sleepWithContext(ctx, retryDelay(attempt)); sleepErr != nil {
				return nil, nil, 0, sleepErr
			}
			continue
		}

		return responseBody, resp.Header, resp.StatusCode, nil
	}

	if lastErr == nil {
		lastErr = errors.New("request failed")
	}
	return nil, nil, 0, lastErr
}

func normalizeGraphValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case fmt.Stringer:
		return typed.String()
	case int:
		return fmt.Sprintf("%d", typed)
	case int8:
		return fmt.Sprintf("%d", typed)
	case int16:
		return fmt.Sprintf("%d", typed)
	case int32:
		return fmt.Sprintf("%d", typed)
	case int64:
		return fmt.Sprintf("%d", typed)
	case uint:
		return fmt.Sprintf("%d", typed)
	case uint8:
		return fmt.Sprintf("%d", typed)
	case uint16:
		return fmt.Sprintf("%d", typed)
	case uint32:
		return fmt.Sprintf("%d", typed)
	case uint64:
		return fmt.Sprintf("%d", typed)
	case float32:
		return fmt.Sprintf("%v", typed)
	case float64:
		return fmt.Sprintf("%v", typed)
	case bool:
		if typed {
			return "true"
		}
		return "false"
	default:
		encoded, err := json.Marshal(value)
		if err != nil {
			return fmt.Sprintf("%v", value)
		}
		return string(encoded)
	}
}

func graphResponseError(graphError map[string]any, status int) error {
	if message, ok := graphError["message"].(string); ok && message != "" {
		return errors.New(message)
	}
	return fmt.Errorf("facebook request failed (%d)", status)
}

func shouldRetry(status int) bool {
	return status == http.StatusTooManyRequests || status >= 500
}

func retryDelay(attempt int) time.Duration {
	base := 250 * time.Millisecond
	return base * time.Duration(1<<attempt)
}

func sleepWithContext(ctx context.Context, delay time.Duration) error {
	if delay <= 0 {
		return nil
	}

	timer := time.NewTimer(delay)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}
