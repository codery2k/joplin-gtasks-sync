import { Clock } from '../../src/ports';

export class FakeClock implements Clock {
	constructor(private current: number) {}

	now(): number {
		this.current += 1;
		return this.current;
	}

	set(ms: number): void {
		this.current = ms;
	}
}
