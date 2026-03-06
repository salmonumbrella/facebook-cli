package facebook

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/salmonumbrella/facebook-cli/internal/api"
)

func ListPosts(ctx context.Context, client *api.Client, page PageAsset) (any, error) {
	return client.Graph(ctx, "GET", page.FBPageID+"/posts", page.PageAccessToken, map[string]string{
		"fields": "id,message,created_time",
	}, nil)
}

func CreatePost(ctx context.Context, client *api.Client, page PageAsset, message string) (any, error) {
	return client.Graph(ctx, "POST", page.FBPageID+"/feed", page.PageAccessToken, nil, map[string]any{
		"message": message,
	})
}

func PostImage(ctx context.Context, client *api.Client, page PageAsset, imageURL string, caption string) (any, error) {
	return client.Graph(ctx, "POST", page.FBPageID+"/photos", page.PageAccessToken, nil, map[string]any{
		"url":     imageURL,
		"caption": caption,
	})
}

func UpdatePost(ctx context.Context, client *api.Client, page PageAsset, postID string, message string) (any, error) {
	return client.Graph(ctx, "POST", postID, page.PageAccessToken, nil, map[string]any{
		"message": message,
	})
}

func DeletePost(ctx context.Context, client *api.Client, page PageAsset, postID string) (any, error) {
	return client.Graph(ctx, "DELETE", postID, page.PageAccessToken, nil, nil)
}

func SchedulePost(ctx context.Context, client *api.Client, page PageAsset, message string, timestamp string) (any, error) {
	return client.Graph(ctx, "POST", page.FBPageID+"/feed", page.PageAccessToken, nil, map[string]any{
		"message":                message,
		"published":              "false",
		"scheduled_publish_time": timestamp,
	})
}

func ListComments(ctx context.Context, client *api.Client, page PageAsset, postID string) (any, error) {
	return client.Graph(ctx, "GET", postID+"/comments", page.PageAccessToken, map[string]string{
		"fields": "id,message,from,created_time",
	}, nil)
}

func ReplyToComment(ctx context.Context, client *api.Client, page PageAsset, commentID string, message string) (any, error) {
	return client.Graph(ctx, "POST", commentID+"/comments", page.PageAccessToken, nil, map[string]any{
		"message": message,
	})
}

func DeleteComment(ctx context.Context, client *api.Client, page PageAsset, commentID string) (any, error) {
	return client.Graph(ctx, "DELETE", commentID, page.PageAccessToken, nil, nil)
}

func SetCommentHidden(ctx context.Context, client *api.Client, page PageAsset, commentID string, hidden bool) (any, error) {
	value := "false"
	if hidden {
		value = "true"
	}
	return client.Graph(ctx, "POST", commentID, page.PageAccessToken, nil, map[string]any{
		"is_hidden": value,
	})
}

func bulkCommentOperation(
	ctx context.Context,
	client *api.Client,
	page PageAsset,
	commentIDs []string,
	method string,
	body map[string]string,
) ([]map[string]any, error) {
	requests := make([]api.BatchRequest, 0, len(commentIDs))
	for _, commentID := range commentIDs {
		requests = append(requests, api.BatchRequest{
			Method:      method,
			RelativeURL: commentID,
			Body:        body,
		})
	}

	responses, err := client.GraphBatch(ctx, page.PageAccessToken, requests)
	if err != nil {
		return nil, err
	}

	out := make([]map[string]any, 0, len(commentIDs))
	for index, commentID := range commentIDs {
		success := false
		var result any
		if index < len(responses) {
			success = responses[index].Code == 200
			result = responses[index].Body
		}
		out = append(out, map[string]any{
			"comment_id": commentID,
			"result":     result,
			"success":    success,
		})
	}
	return out, nil
}

func BulkDeleteComments(ctx context.Context, client *api.Client, page PageAsset, commentIDs []string) ([]map[string]any, error) {
	return bulkCommentOperation(ctx, client, page, commentIDs, "DELETE", nil)
}

func BulkHideComments(ctx context.Context, client *api.Client, page PageAsset, commentIDs []string) ([]map[string]any, error) {
	return bulkCommentOperation(ctx, client, page, commentIDs, "POST", map[string]string{
		"is_hidden": "true",
	})
}

func PostInsights(ctx context.Context, client *api.Client, page PageAsset, postID string) (any, error) {
	metrics := []string{
		"post_impressions",
		"post_impressions_unique",
		"post_impressions_paid",
		"post_impressions_organic",
		"post_engaged_users",
		"post_clicks",
		"post_reactions_like_total",
		"post_reactions_love_total",
		"post_reactions_wow_total",
		"post_reactions_haha_total",
		"post_reactions_sorry_total",
		"post_reactions_anger_total",
	}
	return client.Graph(ctx, "GET", postID+"/insights", page.PageAccessToken, map[string]string{
		"metric": strings.Join(metrics, ","),
		"period": "lifetime",
	}, nil)
}

func Fans(ctx context.Context, client *api.Client, page PageAsset) (map[string]any, error) {
	response, err := client.Graph(ctx, "GET", page.FBPageID, page.PageAccessToken, map[string]string{
		"fields": "fan_count",
	}, nil)
	if err != nil {
		return nil, err
	}
	row := normalizeGraphObject(response)
	return map[string]any{"fan_count": row["fan_count"]}, nil
}

func Likes(ctx context.Context, client *api.Client, page PageAsset, postID string) (map[string]any, error) {
	response, err := client.Graph(ctx, "GET", postID, page.PageAccessToken, map[string]string{
		"fields": "likes.summary(true)",
	}, nil)
	if err != nil {
		return nil, err
	}
	row := normalizeGraphObject(response)
	likes := normalizeGraphObject(row["likes"])
	summary := normalizeGraphObject(likes["summary"])
	return map[string]any{"likes": summary["total_count"]}, nil
}

func Shares(ctx context.Context, client *api.Client, page PageAsset, postID string) (map[string]any, error) {
	response, err := client.Graph(ctx, "GET", postID, page.PageAccessToken, map[string]string{
		"fields": "shares",
	}, nil)
	if err != nil {
		return nil, err
	}
	row := normalizeGraphObject(response)
	shares := normalizeGraphObject(row["shares"])
	return map[string]any{"shares": shares["count"]}, nil
}

func Reactions(ctx context.Context, client *api.Client, page PageAsset, postID string) (map[string]any, error) {
	metrics := []string{
		"post_reactions_like_total",
		"post_reactions_love_total",
		"post_reactions_wow_total",
		"post_reactions_haha_total",
		"post_reactions_sorry_total",
		"post_reactions_anger_total",
	}
	response, err := client.Graph(ctx, "GET", postID+"/insights", page.PageAccessToken, map[string]string{
		"metric": strings.Join(metrics, ","),
		"period": "lifetime",
	}, nil)
	if err != nil {
		return nil, err
	}
	row := normalizeGraphObject(response)
	items, _ := row["data"].([]any)
	out := map[string]any{}
	for _, item := range items {
		entry := normalizeGraphObject(item)
		name := asString(entry["name"])
		values, _ := entry["values"].([]any)
		if len(values) == 0 {
			continue
		}
		valueRow := normalizeGraphObject(values[0])
		out[name] = valueRow["value"]
	}
	return out, nil
}

func PostMetric(ctx context.Context, client *api.Client, page PageAsset, postID string, metric string) (any, error) {
	return client.Graph(ctx, "GET", postID+"/insights", page.PageAccessToken, map[string]string{
		"metric": metric,
		"period": "lifetime",
	}, nil)
}

func TopCommenters(ctx context.Context, client *api.Client, page PageAsset, postID string) ([]map[string]any, error) {
	u := fmt.Sprintf("%s/%s/comments?fields=id,message,from,created_time&access_token=%s", client.GraphBase(), postID, page.PageAccessToken)
	allComments, err := client.PaginateAll(ctx, u, 0)
	if err != nil {
		return nil, err
	}

	counter := map[string]int{}
	for _, comment := range allComments {
		from := normalizeGraphObject(comment["from"])
		userID := asString(from["id"])
		if userID != "" {
			counter[userID]++
		}
	}

	type pair struct {
		UserID string
		Count  int
	}
	sorted := make([]pair, 0, len(counter))
	for userID, count := range counter {
		sorted = append(sorted, pair{UserID: userID, Count: count})
	}
	sort.Slice(sorted, func(i, j int) bool {
		if sorted[i].Count == sorted[j].Count {
			return sorted[i].UserID < sorted[j].UserID
		}
		return sorted[i].Count > sorted[j].Count
	})

	out := make([]map[string]any, 0, len(sorted))
	for _, item := range sorted {
		out = append(out, map[string]any{
			"user_id": item.UserID,
			"count":   item.Count,
		})
	}
	return out, nil
}

func CommentCount(ctx context.Context, client *api.Client, page PageAsset, postID string) (map[string]any, error) {
	u := fmt.Sprintf("%s/%s/comments?fields=id&access_token=%s", client.GraphBase(), postID, page.PageAccessToken)
	allComments, err := client.PaginateAll(ctx, u, 0)
	if err != nil {
		return nil, err
	}
	return map[string]any{"comment_count": len(allComments)}, nil
}

func SendDM(ctx context.Context, client *api.Client, page PageAsset, userID string, message string) (any, error) {
	return client.Graph(ctx, "POST", "me/messages", page.PageAccessToken, nil, map[string]any{
		"recipient":      map[string]any{"id": userID},
		"message":        map[string]any{"text": message},
		"messaging_type": "RESPONSE",
	})
}

func urlish(value string) bool {
	return strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://")
}

func readLocalFile(path string) ([]byte, string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, "", fmt.Errorf("file not found: %s", path)
		}
		return nil, "", err
	}
	return data, filepath.Base(path), nil
}

func PublishReel(
	ctx context.Context,
	client *api.Client,
	page PageAsset,
	source string,
	description string,
	title string,
) (any, error) {
	initResponse, err := client.Graph(ctx, "POST", page.FBPageID+"/video_reels", page.PageAccessToken, nil, map[string]any{
		"upload_phase": "start",
	})
	if err != nil {
		return nil, err
	}
	if graphErr := graphError(initResponse); graphErr != nil {
		return mergeMap(map[string]any{"step": "init"}, graphErr), nil
	}
	videoID := asString(normalizeGraphObject(initResponse)["video_id"])

	var uploadResponse any
	if urlish(source) {
		uploadResponse, err = client.Rupload(ctx, videoID, page.PageAccessToken, map[string]string{
			"file_url": source,
		}, nil)
	} else {
		data, _, readErr := readLocalFile(source)
		if readErr != nil {
			return nil, readErr
		}
		uploadResponse, err = client.Rupload(ctx, videoID, page.PageAccessToken, map[string]string{
			"offset":    "0",
			"file_size": fmt.Sprintf("%d", len(data)),
		}, data)
	}
	if err != nil {
		return nil, err
	}
	if graphErr := graphError(uploadResponse); graphErr != nil {
		return mergeMap(map[string]any{"step": "upload", "video_id": videoID}, graphErr), nil
	}

	params := map[string]any{
		"upload_phase": "finish",
		"video_id":     videoID,
		"video_state":  "PUBLISHED",
	}
	if description != "" {
		params["description"] = description
	}
	if title != "" {
		params["title"] = title
	}
	publishResponse, err := client.Graph(ctx, "POST", page.FBPageID+"/video_reels", page.PageAccessToken, nil, params)
	if err != nil {
		return nil, err
	}
	if graphErr := graphError(publishResponse); graphErr != nil {
		return mergeMap(map[string]any{"step": "publish", "video_id": videoID}, graphErr), nil
	}
	return publishResponse, nil
}

func ListReels(ctx context.Context, client *api.Client, page PageAsset) (any, error) {
	return client.Graph(ctx, "GET", page.FBPageID+"/video_reels", page.PageAccessToken, nil, nil)
}

func VideoStatus(ctx context.Context, client *api.Client, page PageAsset, videoID string) (any, error) {
	return client.Graph(ctx, "GET", videoID, page.PageAccessToken, map[string]string{
		"fields": "status",
	}, nil)
}

func PublishVideo(
	ctx context.Context,
	client *api.Client,
	page PageAsset,
	appID string,
	userToken string,
	source string,
	title string,
	description string,
) (any, error) {
	params := map[string]any{}
	if urlish(source) {
		params["file_url"] = source
	} else {
		if strings.TrimSpace(appID) == "" || strings.TrimSpace(userToken) == "" {
			return nil, errors.New("local file upload requires FB_APP_ID and FB_USER_ACCESS_TOKEN")
		}
		data, name, err := readLocalFile(source)
		if err != nil {
			return nil, err
		}
		handle, err := client.ResumableUpload(ctx, appID, userToken, data, name, len(data), "video/mp4")
		if err != nil {
			return nil, err
		}
		params["file_url"] = asString(handle)
	}
	if title != "" {
		params["title"] = title
	}
	if description != "" {
		params["description"] = description
	}
	return client.Graph(ctx, "POST", page.FBPageID+"/videos", page.PageAccessToken, nil, params)
}

func PublishVideoStory(ctx context.Context, client *api.Client, page PageAsset, source string) (any, error) {
	initResponse, err := client.Graph(ctx, "POST", page.FBPageID+"/video_stories", page.PageAccessToken, nil, map[string]any{
		"upload_phase": "start",
	})
	if err != nil {
		return nil, err
	}
	if graphErr := graphError(initResponse); graphErr != nil {
		return mergeMap(map[string]any{"step": "init"}, graphErr), nil
	}
	videoID := asString(normalizeGraphObject(initResponse)["video_id"])

	var uploadResponse any
	if urlish(source) {
		uploadResponse, err = client.Rupload(ctx, videoID, page.PageAccessToken, map[string]string{
			"file_url": source,
		}, nil)
	} else {
		data, _, readErr := readLocalFile(source)
		if readErr != nil {
			return nil, readErr
		}
		uploadResponse, err = client.Rupload(ctx, videoID, page.PageAccessToken, map[string]string{
			"offset":    "0",
			"file_size": fmt.Sprintf("%d", len(data)),
		}, data)
	}
	if err != nil {
		return nil, err
	}
	if graphErr := graphError(uploadResponse); graphErr != nil {
		return mergeMap(map[string]any{"step": "upload", "video_id": videoID}, graphErr), nil
	}

	publishResponse, err := client.Graph(ctx, "POST", page.FBPageID+"/video_stories", page.PageAccessToken, nil, map[string]any{
		"upload_phase": "finish",
		"video_id":     videoID,
	})
	if err != nil {
		return nil, err
	}
	if graphErr := graphError(publishResponse); graphErr != nil {
		return mergeMap(map[string]any{"step": "publish", "video_id": videoID}, graphErr), nil
	}
	return publishResponse, nil
}

func PublishPhotoStory(ctx context.Context, client *api.Client, page PageAsset, photoURL string) (any, error) {
	uploadResponse, err := client.Graph(ctx, "POST", page.FBPageID+"/photos", page.PageAccessToken, nil, map[string]any{
		"url":       photoURL,
		"published": "false",
	})
	if err != nil {
		return nil, err
	}
	if graphErr := graphError(uploadResponse); graphErr != nil {
		return mergeMap(map[string]any{"step": "upload"}, graphErr), nil
	}
	photoID := asString(normalizeGraphObject(uploadResponse)["id"])

	publishResponse, err := client.Graph(ctx, "POST", page.FBPageID+"/photo_stories", page.PageAccessToken, nil, map[string]any{
		"photo_id": photoID,
	})
	if err != nil {
		return nil, err
	}
	if graphErr := graphError(publishResponse); graphErr != nil {
		return mergeMap(map[string]any{"step": "publish", "photo_id": photoID}, graphErr), nil
	}
	return publishResponse, nil
}

func ListStories(ctx context.Context, client *api.Client, page PageAsset) (any, error) {
	return client.Graph(ctx, "GET", page.FBPageID+"/stories", page.PageAccessToken, nil, nil)
}

func CreateSlideshow(ctx context.Context, client *api.Client, page PageAsset, imageURLs []string, durationMS int, transitionMS int) (any, error) {
	spec := map[string]any{
		"images_urls":   imageURLs,
		"duration_ms":   durationMS,
		"transition_ms": transitionMS,
	}
	encoded, err := json.Marshal(spec)
	if err != nil {
		return nil, err
	}
	return client.Graph(ctx, "POST", page.FBPageID+"/videos", page.PageAccessToken, nil, map[string]any{
		"slideshow_spec": string(encoded),
	})
}

func Music(ctx context.Context, client *api.Client, assets []PageAsset, musicType string, countries string) (any, error) {
	defaultAsset := GetDefaultPageAsset(assets)
	if defaultAsset == nil {
		return nil, errors.New("no pages configured - need a token for music API")
	}
	params := map[string]string{
		"type": musicType,
	}
	if countries != "" {
		params["countries"] = countries
	}
	return client.Graph(ctx, "GET", "audio/recommendations", defaultAsset.PageAccessToken, params, nil)
}

func Crosspost(ctx context.Context, client *api.Client, page PageAsset, videoID string) (any, error) {
	return client.Graph(ctx, "POST", page.FBPageID+"/videos", page.PageAccessToken, nil, map[string]any{
		"crossposted_video_id": videoID,
	})
}

func EnableCrosspost(ctx context.Context, client *api.Client, page PageAsset, videoID string, targetPageIDs []string) (any, error) {
	return client.Graph(ctx, "POST", videoID, page.PageAccessToken, nil, map[string]any{
		"allow_crossposting_for_pages": targetPageIDs,
	})
}

func CrosspostPages(ctx context.Context, client *api.Client, page PageAsset) (any, error) {
	return client.Graph(ctx, "GET", page.FBPageID+"/crosspost_whitelisted_pages", page.PageAccessToken, nil, nil)
}

func CrosspostCheck(ctx context.Context, client *api.Client, page PageAsset, videoID string) (any, error) {
	return client.Graph(ctx, "GET", videoID, page.PageAccessToken, map[string]string{
		"fields": "is_crossposting_eligible",
	}, nil)
}

func ABCreate(
	ctx context.Context,
	client *api.Client,
	page PageAsset,
	name string,
	goal string,
	experimentVideoIDs []string,
	controlVideoID string,
	description string,
	durationSeconds int,
) (any, error) {
	body := map[string]any{
		"name":                 name,
		"experiment_video_ids": experimentVideoIDs,
		"control_video_id":     controlVideoID,
		"optimization_goal":    goal,
	}
	if description != "" {
		body["description"] = description
	}
	if durationSeconds > 0 {
		body["duration_seconds"] = durationSeconds
	}
	return client.Graph(ctx, "POST", page.FBPageID+"/ab_tests", page.PageAccessToken, nil, body)
}

func ABResults(ctx context.Context, client *api.Client, page PageAsset, testID string) (any, error) {
	return client.Graph(ctx, "GET", testID, page.PageAccessToken, nil, nil)
}

func ABTests(ctx context.Context, client *api.Client, page PageAsset, since string, until string) (any, error) {
	params := map[string]string{}
	if since != "" {
		params["since"] = since
	}
	if until != "" {
		params["until"] = until
	}
	return client.Graph(ctx, "GET", page.FBPageID+"/ab_tests", page.PageAccessToken, params, nil)
}

func ABDelete(ctx context.Context, client *api.Client, page PageAsset, testID string) (any, error) {
	return client.Graph(ctx, "DELETE", testID, page.PageAccessToken, nil, nil)
}
