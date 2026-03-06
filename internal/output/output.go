package output

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"reflect"
	"sort"
	"strings"
	"text/tabwriter"
)

func Write(w io.Writer, value any, format string) error {
	format = strings.TrimSpace(format)
	if format == "" || format == "json" {
		return writeJSON(w, value)
	}

	rows, ok := extractRows(value)
	if !ok {
		return writeJSON(w, value)
	}

	switch format {
	case "csv":
		return writeCSV(w, rows)
	case "table":
		return writeTable(w, rows)
	default:
		return fmt.Errorf("unsupported output format: %s", format)
	}
}

func FormatRows(rows []map[string]any, format string) (string, error) {
	var builder strings.Builder
	if err := Write(&builder, rows, format); err != nil {
		return "", err
	}
	return builder.String(), nil
}

func extractRows(value any) ([]map[string]any, bool) {
	switch typed := value.(type) {
	case []map[string]any:
		if len(typed) == 0 {
			return []map[string]any{}, true
		}
		return typed, true
	case []any:
		rows := make([]map[string]any, 0, len(typed))
		for _, item := range typed {
			row, ok := item.(map[string]any)
			if !ok {
				return nil, false
			}
			rows = append(rows, row)
		}
		return rows, true
	case map[string]any:
		if data, ok := typed["data"]; ok {
			if rows, ok := extractRows(data); ok {
				return rows, true
			}
		}
		if allScalar(typed) {
			return []map[string]any{typed}, true
		}
		return nil, false
	default:
		return nil, false
	}
}

func allScalar(row map[string]any) bool {
	for _, value := range row {
		if isNilLike(value) {
			continue
		}
		switch value.(type) {
		case string, bool, float64, int, int64, json.Number:
			continue
		default:
			return false
		}
	}
	return true
}

func headersForRows(rows []map[string]any) []string {
	keys := map[string]struct{}{}
	for _, row := range rows {
		for key := range row {
			keys[key] = struct{}{}
		}
	}

	headers := make([]string, 0, len(keys))
	for key := range keys {
		headers = append(headers, key)
	}
	sort.Strings(headers)
	return headers
}

func writeCSV(w io.Writer, rows []map[string]any) error {
	writer := csv.NewWriter(w)
	headers := headersForRows(rows)
	if err := writer.Write(headers); err != nil {
		return err
	}
	for _, row := range rows {
		record := make([]string, 0, len(headers))
		for _, header := range headers {
			record = append(record, stringifyValue(row[header]))
		}
		if err := writer.Write(record); err != nil {
			return err
		}
	}
	writer.Flush()
	return writer.Error()
}

func writeTable(w io.Writer, rows []map[string]any) error {
	tw := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
	headers := headersForRows(rows)
	if _, err := fmt.Fprintln(tw, strings.Join(headers, "\t")); err != nil {
		return err
	}
	for _, row := range rows {
		record := make([]string, 0, len(headers))
		for _, header := range headers {
			record = append(record, stringifyValue(row[header]))
		}
		if _, err := fmt.Fprintln(tw, strings.Join(record, "\t")); err != nil {
			return err
		}
	}
	return tw.Flush()
}

func stringifyValue(value any) string {
	if isNilLike(value) {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return typed
	case json.Number:
		return typed.String()
	default:
		encoded, err := json.Marshal(typed)
		if err == nil && string(encoded) != "null" {
			if len(encoded) > 1 && encoded[0] == '"' && encoded[len(encoded)-1] == '"' {
				return string(encoded[1 : len(encoded)-1])
			}
			return string(encoded)
		}
		return fmt.Sprintf("%v", value)
	}
}

func writeJSON(w io.Writer, value any) error {
	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ")
	return encoder.Encode(value)
}

func isNilLike(value any) bool {
	if value == nil {
		return true
	}
	rv := reflect.ValueOf(value)
	switch rv.Kind() {
	case reflect.Ptr, reflect.Map, reflect.Slice, reflect.Interface:
		return rv.IsNil()
	default:
		return false
	}
}
