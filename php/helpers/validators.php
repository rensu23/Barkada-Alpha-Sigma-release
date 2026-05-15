<?php
/**
 * Simple validation helper class kept for pages that prefer object-style checks.
 */

namespace Helpers;

class Validator {
    private array $errors = [];

    /**Validates required fields 
    */
    public function required(array $data, array $fields): bool {
        foreach ($fields as $field) {
            if (!isset($data[$field]) || (is_string($data[$field]) && trim($data[$field]) === '')) {
                $this->errors[$field] = "Field '$field' is required.";
            }
        }
        return empty($this->errors);
    }

    /**Validates email format
    */
    public function email(string $email): bool {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->errors['email'] = "Invalid email format.";
            return false;
        }
        return true;
    }

    /**Validates numeric IDs
    */
    public function id(mixed $id): bool {
        if (filter_var($id, FILTER_VALIDATE_INT, ["options" => ["min_range" => 1]]) === false) {
            $this->errors['id'] = "Invalid ID provided.";
            return false;
        }
        return true;
    }

    /**Validates payment status against allowed values
    */
    public function paymentStatus(string $status): bool {
        $allowed = ['Not Paid', 'Pending', 'Paid', 'Rejected'];
        if (!in_array($status, $allowed, true)) {
            $this->errors['status'] = "Invalid status value.";
            return false;
        }
        return true;
    }

    public function getErrors(): array {
        return $this->errors;
    }
}
