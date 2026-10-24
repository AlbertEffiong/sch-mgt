<?php

declare(strict_types=1);

namespace Syntax\Support;

use Syntax\Http\ApiError;

/**
 * Compact declarative validator (zod-style rules from the original backend).
 *
 * Rule spec keys: type (string|number|int|date|array), optional, trim (default true),
 * min, max, email, password, regex, regexMessage, enum, objectid, default,
 * lower, upper, items (for arrays), __refine (top-level callable -> error message).
 */
final class Validate
{
    public static function run(array $data, array $rules): array
    {
        $parsed = [];
        $details = [];

        foreach ($rules as $field => $spec) {
            if ($field === '__refine') {
                continue;
            }
            $value = $data[$field] ?? null;
            $optional = (bool) ($spec['optional'] ?? false);

            if ($value === null || $value === '' || $value === []) {
                if (array_key_exists('default', $spec)) {
                    $parsed[$field] = $spec['default'];
                    continue;
                }
                if ($optional) {
                    continue;
                }
                $details[] = ['path' => $field, 'message' => 'Required'];
                continue;
            }

            $before = count($details);
            $parsedValue = self::parseValue($value, $spec, $field, $details);
            if (count($details) === $before) {
                $parsed[$field] = $parsedValue;
            }
        }

        if (isset($rules['__refine']) && $details === []) {
            $message = ($rules['__refine'])($parsed);
            if (is_string($message) && $message !== '') {
                $details[] = ['path' => '_', 'message' => $message];
            }
        }

        if ($details !== []) {
            throw ApiError::badRequest('Validation failed', 'VALIDATION_ERROR', $details);
        }

        return $parsed;
    }

    private static function parseValue(mixed $value, array $spec, string $field, array &$details): mixed
    {
        $type = $spec['type'] ?? 'string';

        switch ($type) {
            case 'string':
                if (is_array($value) || is_object($value)) {
                    $details[] = ['path' => $field, 'message' => 'Expected string'];
                    return null;
                }
                $string = (string) $value;
                if (($spec['trim'] ?? true) !== false) {
                    $string = trim($string);
                }
                if ($string === '') {
                    $details[] = ['path' => $field, 'message' => 'Required'];
                    return null;
                }
                if (isset($spec['min']) && mb_strlen($string) < (int) $spec['min']) {
                    $details[] = ['path' => $field, 'message' => sprintf('String must contain at least %d character(s)', (int) $spec['min'])];
                    return null;
                }
                if (isset($spec['max']) && mb_strlen($string) > (int) $spec['max']) {
                    $details[] = ['path' => $field, 'message' => sprintf('String must contain at most %d character(s)', (int) $spec['max'])];
                    return null;
                }
                if (!empty($spec['email']) && filter_var($string, FILTER_VALIDATE_EMAIL) === false) {
                    $details[] = ['path' => $field, 'message' => 'Invalid email'];
                    return null;
                }
                if (!empty($spec['objectid']) && !Ids::isId($string)) {
                    $details[] = ['path' => $field, 'message' => 'Invalid identifier'];
                    return null;
                }
                if (!empty($spec['regex']) && preg_match($spec['regex'], $string) !== 1) {
                    $details[] = ['path' => $field, 'message' => $spec['regexMessage'] ?? 'Invalid format'];
                    return null;
                }
                if (isset($spec['enum']) && !in_array($string, $spec['enum'], true)) {
                    $details[] = ['path' => $field, 'message' => 'Invalid value. Expected one of: ' . implode(', ', $spec['enum'])];
                    return null;
                }
                if (!empty($spec['password']) && !Password::isStrong($string)) {
                    $details[] = ['path' => $field, 'message' => Password::POLICY_MESSAGE];
                    return null;
                }
                if (!empty($spec['lower'])) {
                    $string = strtolower($string);
                }
                if (!empty($spec['upper'])) {
                    $string = strtoupper($string);
                }
                return $string;

            case 'number':
            case 'int':
                if (is_array($value)) {
                    $details[] = ['path' => $field, 'message' => 'Expected number'];
                    return null;
                }
                if (is_string($value)) {
                    $trimmed = trim($value);
                    if ($trimmed === '' || !is_numeric($trimmed)) {
                        $details[] = ['path' => $field, 'message' => 'Expected number'];
                        return null;
                    }
                    $value = $trimmed;
                }
                if (is_bool($value)) {
                    $details[] = ['path' => $field, 'message' => 'Expected number'];
                    return null;
                }
                $number = (float) $value;
                if ($type === 'int' && floor($number) !== $number) {
                    $details[] = ['path' => $field, 'message' => 'Expected integer'];
                    return null;
                }
                if (isset($spec['min']) && $number < (float) $spec['min']) {
                    $details[] = ['path' => $field, 'message' => 'Number must be greater than or equal to ' . $spec['min']];
                    return null;
                }
                if (isset($spec['max']) && $number > (float) $spec['max']) {
                    $details[] = ['path' => $field, 'message' => 'Number must be less than or equal to ' . $spec['max']];
                    return null;
                }
                return $type === 'int' ? (int) $number : $number;

            case 'date':
                if (is_numeric($value)) {
                    $value = date('Y-m-d', (int) $value);
                }
                if (!is_string($value) || strtotime($value) === false) {
                    $details[] = ['path' => $field, 'message' => 'Invalid date'];
                    return null;
                }
                return (new \DateTimeImmutable($value, new \DateTimeZone('UTC')))
                    ->setTime(0, 0, 0)
                    ->format('Y-m-d\TH:i:s.v\Z');

            case 'array':
                if (!is_array($value)) {
                    $details[] = ['path' => $field, 'message' => 'Expected array'];
                    return null;
                }
                if (!array_is_list($value)) {
                    $value = array_values($value);
                }
                if (isset($spec['min']) && count($value) < (int) $spec['min']) {
                    $details[] = ['path' => $field, 'message' => sprintf('Array must contain at least %d element(s)', (int) $spec['min'])];
                    return null;
                }
                $itemsSpec = $spec['items'] ?? null;
                if ($itemsSpec === null) {
                    return $value;
                }
                $out = [];
                foreach ($value as $index => $item) {
                    $path = $field . '.' . $index;
                    if (is_array($itemsSpec)) {
                        $itemObj = is_array($item) ? $item : [];
                        $parsedItem = [];
                        foreach ($itemsSpec as $key => $keySpec) {
                            $itemValue = $itemObj[$key] ?? null;
                            $keyOptional = (bool) ($keySpec['optional'] ?? false);
                            if ($itemValue === null || $itemValue === '' || $itemValue === []) {
                                if (!$keyOptional) {
                                    $details[] = ['path' => $path . '.' . $key, 'message' => 'Required'];
                                }
                                continue;
                            }
                            $sub = [];
                            $parsed = self::parseValue($itemValue, $keySpec, $path . '.' . $key, $sub);
                            if ($sub === []) {
                                $parsedItem[$key] = $parsed;
                            }
                            $details = array_merge($details, $sub);
                        }
                        $out[] = $parsedItem;
                    } else {
                        $sub = [];
                        $parsed = self::parseValue($item, $itemsSpec, $path, $sub);
                        if ($sub === []) {
                            $out[] = $parsed;
                        }
                        $details = array_merge($details, $sub);
                    }
                }
                return $out;

            default:
                $details[] = ['path' => $field, 'message' => 'Unsupported rule type: ' . $type];
                return null;
        }
    }
}
