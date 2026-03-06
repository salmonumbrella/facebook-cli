package facebook

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/salmonumbrella/facebook-cli/internal/api"
)

func GetBusinessInfo(ctx context.Context, client *api.Client, businessID string, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", businessID, token, params, nil)
}

func ListBusinessAdAccounts(ctx context.Context, client *api.Client, businessID string, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", businessID+"/owned_ad_accounts", token, params, nil)
}

func ListInvoices(
	ctx context.Context,
	client *api.Client,
	businessID string,
	token string,
	startDate string,
	endDate string,
	params map[string]string,
) (any, error) {
	nextParams := map[string]string{}
	for key, value := range params {
		nextParams[key] = value
	}
	if startDate != "" {
		nextParams["start_date"] = startDate
	}
	if endDate != "" {
		nextParams["end_date"] = endDate
	}
	return client.Graph(ctx, "GET", businessID+"/business_invoices", token, nextParams, nil)
}

func DownloadInvoicePDF(ctx context.Context, client *api.Client, invoiceID string, token string) ([]byte, error) {
	response, err := client.Graph(ctx, "GET", invoiceID, token, map[string]string{
		"fields": "download_uri",
	}, nil)
	if err != nil {
		return nil, err
	}

	uri := asString(normalizeGraphObject(response)["download_uri"])
	if uri == "" {
		return nil, errors.New("invoice download_uri not available")
	}

	body, status, err := client.DownloadBytes(ctx, uri, nil)
	if err != nil {
		return nil, err
	}
	if status >= 400 {
		return nil, fmt.Errorf("failed to download invoice pdf: %d", status)
	}
	return body, nil
}

func SearchAdLibrary(ctx context.Context, client *api.Client, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", "ads_archive", token, params, nil)
}

func ListIGAccounts(ctx context.Context, client *api.Client, token string) (map[string]any, error) {
	response, err := client.Graph(ctx, "GET", "me/accounts", token, map[string]string{
		"fields": "id,name,instagram_business_account",
	}, nil)
	if err != nil {
		return nil, err
	}

	row := normalizeGraphObject(response)
	items, _ := row["data"].([]any)
	out := make([]map[string]any, 0, len(items))
	for _, item := range items {
		page := normalizeGraphObject(item)
		igAccount := normalizeGraphObject(page["instagram_business_account"])
		if len(igAccount) == 0 {
			continue
		}
		out = append(out, map[string]any{
			"page_id":       page["id"],
			"page_name":     page["name"],
			"ig_account_id": igAccount["id"],
		})
	}
	return map[string]any{"data": out}, nil
}

func ListIGMedia(ctx context.Context, client *api.Client, igUserID string, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", igUserID+"/media", token, params, nil)
}

func GetIGMediaInsights(ctx context.Context, client *api.Client, mediaID string, token string, metric string) (any, error) {
	if metric == "" {
		metric = "reach,likes,comments,saved,engagement,impressions,views,shares,total_interactions"
	}
	return client.Graph(ctx, "GET", mediaID+"/insights", token, map[string]string{
		"metric": metric,
	}, nil)
}

func GetIGAccountInsights(ctx context.Context, client *api.Client, igUserID string, token string, metric string, period string) (any, error) {
	if metric == "" {
		metric = "reach,impressions,profile_views,follower_count"
	}
	if period == "" {
		period = "day"
	}
	return client.Graph(ctx, "GET", igUserID+"/insights", token, map[string]string{
		"metric": metric,
		"period": period,
	}, nil)
}

func ListIGComments(ctx context.Context, client *api.Client, mediaID string, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", mediaID+"/comments", token, params, nil)
}

func ReplyIGComment(ctx context.Context, client *api.Client, commentID string, token string, message string) (any, error) {
	return client.Graph(ctx, "POST", commentID+"/replies", token, nil, map[string]any{
		"message": message,
	})
}

func PublishIGMedia(
	ctx context.Context,
	client *api.Client,
	igUserID string,
	token string,
	imageURL string,
	videoURL string,
	caption string,
	mediaType string,
) (any, error) {
	body := map[string]any{}
	if imageURL != "" {
		body["image_url"] = imageURL
	}
	if videoURL != "" {
		body["video_url"] = videoURL
	}
	if caption != "" {
		body["caption"] = caption
	}
	if mediaType != "" {
		body["media_type"] = mediaType
	}

	createResponse, err := client.Graph(ctx, "POST", igUserID+"/media", token, nil, body)
	if err != nil {
		return nil, err
	}

	return client.Graph(ctx, "POST", igUserID+"/media_publish", token, nil, map[string]any{
		"creation_id": asString(normalizeGraphObject(createResponse)["id"]),
	})
}

func ListIGStories(ctx context.Context, client *api.Client, igUserID string, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", igUserID+"/stories", token, params, nil)
}

func SendWhatsAppMessage(ctx context.Context, client *api.Client, phoneNumberID string, token string, to string, text string) (any, error) {
	return client.Graph(ctx, "POST", phoneNumberID+"/messages", token, nil, map[string]any{
		"messaging_product": "whatsapp",
		"to":                to,
		"type":              "text",
		"text": map[string]any{
			"body": text,
		},
	})
}

func ListWhatsAppTemplates(ctx context.Context, client *api.Client, wabaID string, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", wabaID+"/message_templates", token, params, nil)
}

func CreateWhatsAppTemplate(ctx context.Context, client *api.Client, wabaID string, token string, payload map[string]any) (any, error) {
	return client.Graph(ctx, "POST", wabaID+"/message_templates", token, nil, payload)
}

func ListWhatsAppPhoneNumbers(ctx context.Context, client *api.Client, wabaID string, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", wabaID+"/phone_numbers", token, params, nil)
}

func GetPageInsightsMetric(ctx context.Context, client *api.Client, pageID string, token string, metric string, period string) (any, error) {
	if period == "" {
		period = "day"
	}
	return client.Graph(ctx, "GET", pageID+"/insights/"+metric, token, map[string]string{
		"period": period,
	}, nil)
}

func UploadLocalPhoto(ctx context.Context, client *api.Client, pageID string, token string, filePath string, caption string) (any, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}
	fields := map[string]string{}
	if caption != "" {
		fields["caption"] = caption
	}
	return client.GraphMultipart(ctx, pageID+"/photos", token, fields, "source", filePath, data)
}

func CreateDraftPost(ctx context.Context, client *api.Client, pageID string, token string, message string, params map[string]string) (any, error) {
	body := map[string]any{
		"message":                  message,
		"published":                "false",
		"unpublished_content_type": "DRAFT",
	}
	for key, value := range params {
		body[key] = value
	}
	return client.Graph(ctx, "POST", pageID+"/feed", token, nil, body)
}

func GetMe(ctx context.Context, client *api.Client, token string, params map[string]string) (any, error) {
	return client.Graph(ctx, "GET", "me", token, params, nil)
}

func ParseJSONObject(input string) (map[string]any, error) {
	if strings.TrimSpace(input) == "" {
		return map[string]any{}, nil
	}
	var out map[string]any
	if err := json.Unmarshal([]byte(input), &out); err != nil {
		return nil, err
	}
	return out, nil
}
