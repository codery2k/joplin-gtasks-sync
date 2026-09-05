import { CanonicalField, CanonicalTask, CANONICAL_FIELDS, FieldChanges } from './model';

export function fieldValuesEqual(field: CanonicalField, left: unknown, right: unknown): boolean {
	return left === right;
}

export function diff(base: CanonicalTask, current: CanonicalTask): FieldChanges {
	const changes: FieldChanges = {};
	for (const field of CANONICAL_FIELDS) {
		if (!fieldValuesEqual(field, base[field], current[field])) {
			changes[field] = { from: base[field], to: current[field] };
		}
	}
	return changes;
}

export function hasChanges(changes: FieldChanges): boolean {
	return Object.keys(changes).length > 0;
}
